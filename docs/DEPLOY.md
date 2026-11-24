# Instalación y operación aislada en servidor dedicado (Debian 13)

## Requisitos del entorno
- Debian 13 con Docker y Docker Compose v2.
- Red Docker externa `proxy` ya existente (Nginx Proxy Manager).
- Portainer opcional para monitoreo.
- Directorio de aplicación: `/opt/apps/onlymarket`.
- Directorio de backups: `/opt/backups/onlymarket`.
- Dominio propuesto: `onlymarket.nanoapps.ar` -> destino `onlymarket-web:3000` (HTTPS obligatorio por cookie `Secure`).
- Zona horaria: `America/Argentina/Buenos_Aires`.
- No ejecutar sobre bases de datos ni redes internas de otras aplicaciones. No usar `docker compose down -v` ni `prisma db push` / `migrate reset` en producción.

## 1. Instalación inicial
1. Clonar en `/opt/apps/onlymarket` y posicionarse en el commit exacto con CI verde:
   ```sh
   mkdir -p /opt/apps /opt/backups/onlymarket
   git clone https://github.com/augustobx/onlymarket.git /opt/apps/onlymarket
   cd /opt/apps/onlymarket
   git checkout <SHA_APROBADO>
   ```
2. Crear `.env` con permisos `600` (sin puntuación en `POSTGRES_PASSWORD` para URL segura):
   ```sh
   umask 077
   cat > .env <<EOF
   POSTGRES_PASSWORD=$(openssl rand -hex 32)
   PLATFORM_ADMIN_ENABLED=false
   HUB_INTEGRATION_TOKEN=
   EOF
   chmod 600 .env
   ```
   Si se habilita el panel central (`/superadmin`) o la lectura de Hub, definir `PLATFORM_ADMIN_ENABLED=true` y `HUB_INTEGRATION_TOKEN=$(openssl rand -hex 32)`.
3. Verificar configuración, levantar PostgreSQL, construir imagen y aplicar migraciones:
   ```sh
   docker network inspect proxy >/dev/null
   docker compose config -q
   docker compose up -d --wait db
   docker compose build app
   docker compose run --rm app npm run db:deploy
   docker compose up -d --wait app
   docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1);return r.text()}).then(console.log)"
   ```
4. En Nginx Proxy Manager, crear Proxy Host `onlymarket.nanoapps.ar` apuntando a `onlymarket-web`, puerto `3000`, con certificado SSL y Force SSL activados. No exponer PostgreSQL al host ni a `proxy`.
5. Alta del comercio inicial (y administrador de plataforma opcional) sin dejar secretos en historial:
   ```sh
   set +o history
   docker compose exec -T \
     -e BOOTSTRAP_EMAIL="dueno@comercio.ar" \
     -e BOOTSTRAP_SLUG="mi-comercio" \
     -e BOOTSTRAP_NAME="Mi Comercio" \
     -e BOOTSTRAP_PASSWORD="CLAVE-SEGURA-MIN-12-CHARS" \
     app node scripts/bootstrap.mjs
   set -o history
   ```
   Para plataforma (solo si `PLATFORM_ADMIN_ENABLED=true`):
   ```sh
   set +o history
   docker compose exec -T \
     -e PLATFORM_BOOTSTRAP_EMAIL="admin@nanolabs.ar" \
     -e PLATFORM_BOOTSTRAP_PASSWORD="CLAVE-PLATAFORMA-LARGA" \
     app node scripts/bootstrap-platform.mjs
   set -o history
   ```

## 2. Actualización controlada
Utilizar el script verificado con el SHA de 40 caracteres que ya tenga CI verde:
```sh
cd /opt/apps/onlymarket
git fetch --all --prune
git checkout <SHA_APROBADO>
ONLYMARKET_CI_APPROVED=<SHA_APROBADO> sh scripts/deploy-review.sh <SHA_APROBADO>
```
Este flujo detiene `app`, genera backup previo en `/opt/backups/onlymarket`, ejecuta `npm run db:deploy`, levanta `onlymarket-web` y valida `/api/health`.

## 3. Backup y prueba de restauración aislada
- Generar backup manual:
  ```sh
  cd /opt/apps/onlymarket
  sh scripts/backup.sh /opt/backups/onlymarket
  ```
- Probar restauración en base temporal dentro del mismo servicio `db` (sin afectar `onlymarket`):
  ```sh
  DUMP="/opt/backups/onlymarket/onlymarket-YYYYMMDDTHHMMSSZ-PID.dump"
  docker compose exec -T db createdb -U onlymarket onlymarket_restore_check
  docker compose exec -T db pg_restore -U onlymarket -d onlymarket_restore_check --exit-on-error < "$DUMP"
  docker compose exec -T db psql -U onlymarket -d onlymarket_restore_check -Atc 'SELECT count(*) FROM "Tenant";'
  docker compose exec -T db dropdb -U onlymarket onlymarket_restore_check
  ```
- Restauración ante incidente en base principal (ventana de mantenimiento):
  ```sh
  cd /opt/apps/onlymarket
  docker compose stop app
  docker compose exec -T db psql -U onlymarket -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='onlymarket' AND pid<>pg_backend_pid();"
  docker compose exec -T db dropdb -U onlymarket onlymarket
  docker compose exec -T db createdb -U onlymarket onlymarket
  docker compose exec -T db pg_restore -U onlymarket -d onlymarket --exit-on-error < "$DUMP"
  docker compose up -d --wait app
  ```

## 4. Rollback
1. Detener la aplicación: `docker compose stop app`.
2. Si hubo cambios de esquema incompatibles hacia atrás, restaurar el dump previo generado por `deploy-review.sh` en `/opt/backups/onlymarket`.
3. Volver al commit anterior (`git checkout <SHA_ANTERIOR>`), reconstruir y levantar solo este stack:
   ```sh
   docker compose build app
   docker compose up -d --wait app
   docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1);return r.text()}).then(console.log)"
   ```

## 5. Alcance y limitaciones documentadas (`1.0.0-rc.1`)
Las siguientes capacidades están **fuera de alcance** en esta versión y NO deben ofrecerse al usuario final como activas:
- **Facturación electrónica ARCA / AFIP**: los comprobantes emitidos son internos y no fiscales.
- **Integración directa con balanzas físicas** (serial/USB): se soporta escaneo manual de etiquetas EAN-13 con peso codificado (prefijo `2X` + PLU 5 dígitos + gramos 5 dígitos + dígito verificador) y confirmación en POS.
- **Notificaciones push**: las alertas de vencimiento y frescura se consultan en `/alertas` (refresco automático mientras la pantalla está abierta).
- **Ventas offline**: el Service Worker (`/sw.js`) es strictly network-only; sin conexión bloquea navegación y no encola ventas locales.
- **Canje de puntos**: el módulo de fidelización acumula puntos informativos netos (descontando anulaciones y devoluciones) y aplica descuento de socio configurable; el canje como medio de pago está pendiente.
- **Cobro automático de suscripciones**: planes, vencimiento de licencia y suspensión se administran manualmente desde `/superadmin`.
- **Recuperación automática de contraseña por correo**: no hay SMTP configurado; un usuario autenticado cambia su clave en `/cuenta`, y el propietario puede revocar accesos en `/administracion`.
