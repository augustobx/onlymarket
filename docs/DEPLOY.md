# Instalación y operación aislada en servidor dedicado (Debian 13)

## Requisitos del entorno
- Debian 13 con Docker y Docker Compose v2.
- Red Docker externa `proxy` ya existente (Nginx Proxy Manager y `nanoapps-router`).
- Wildcard DNS `*.nanoapps.ar` y Proxy Host #3 de Nginx Proxy Manager (`/opt/infrastructure/nginx-proxy-manager/data/nginx/proxy_host/3.conf`) apuntando a `nanoapps-router:8080` con certificado wildcard Let's Encrypt (`npm-3`).
- Portainer opcional para monitoreo.
- Directorio de aplicación: `/opt/apps/onlymarket`.
- Directorio de backups: `/opt/backups/onlymarket`.
- Dominio SuperAdministrador: `onlymarket.nanoapps.ar` → destino `onlymarket-web:3000` (HTTPS obligatorio por cookie `Secure`).
- Dominio de comercios: `https://{slug}.nanoapps.ar` (resuelto automáticamente desde el hostname; configurable mediante `PLATFORM_DOMAIN` y `TENANT_BASE_DOMAIN`).
- Zona horaria: `America/Argentina/Buenos_Aires`.
- No ejecutar sobre bases de datos ni redes internas de otras aplicaciones. No usar `docker compose down -v` ni `prisma db push` / `migrate reset` en producción.

## BLOQUEO DE PRODUCCIÓN: altas de comercios en nanoapps.ar

**No desplegar esta rama para clientes ni registrar OnlyMarket en el router compartido todavía.** El código rechaza las altas y el bootstrap de comercios en `nanoapps.ar` y `nanoapps.site` (NAMESPACE_UNAVAILABLE). El router actual no ofrece una reserva atómica global: un 404 puede representar un servicio caído o una respuesta negativa en caché. El chequeo y el alta son operaciones separadas; las carreras entre distintos SaaS no quedan protegidas por la unicidad local de PostgreSQL.

Para desbloquear las altas conservando `{slug}.nanoapps.ar`, primero diseñar, aprobar y probar un registro global de reservas con unicidad por FQDN, reconciliación de slugs existentes y participación de todos los escritores de dominios. No usar `SLUG_CHECK_STRICT=false` ni `TENANT_NAMESPACE_MODE=exclusive` para eludir este bloqueo. Ningún cambio de router o NPM está autorizado por esta documentación.

## 1. Arquitectura de dominios (objetivo de aprovisionamiento)

OnlyMarket implementa el estándar de subdominios de NanoLabs de manera completamente configurable por variables de entorno:

- **Superadministrador (`PLATFORM_DOMAIN=onlymarket.nanoapps.ar`)**:
  - Muestra directamente el acceso administrativo (`/superadmin/login` → `/superadmin`).
  - No admite acceso operativo de comercios.
- **Comercios (`TENANT_BASE_DOMAIN=nanoapps.ar` → `https://{slug}.nanoapps.ar`)**:
  - El tenant se resuelve en servidor desde `Host` (rechaza `X-Forwarded-Host` contradictorio) (sin código de comercio en el formulario de login).
  - `/superadmin` responde `404` desde cualquier dominio de comercio o dominio desconocido.
  - Las cookies de sesión (`onlymarket_session` y `onlymarket_platform`) son *host-only* (sin atributo `Domain=`) y se validan además contra el hostname en cada request.
- **Colisiones y aprovisionamiento DNS / Proxy / SSL**:
  - Bajo `*.nanoapps.ar`, DNS y SSL wildcard ya existen en Nginx Proxy Manager (`3.conf` → `nanoapps-router:8080`). No es necesario crear registros DNS, certificados ni Proxy Hosts por cada nuevo comercio.
  - `onlymarket-web` expone `GET /api/internal/caddy/ask?domain=<hostname>` devolviendo `204` para `PLATFORM_DOMAIN` y tenants registrados, y `404` para subdominios inexistentes o reservados de otros SaaS.
  - Al crear un comercio, OnlyMarket valida el formato DNS, los slugs reservados y los duplicados locales. Para un dominio exclusivo autorizado puede consultar el router y endpoints ask; las altas compartidas se rechazan antes de esa consulta hasta que exista una reserva global.
- **Migración futura a dominio independiente**:
  - Para operar en un dominio propio (por ejemplo `onlymarket.com.ar`), configurar `PLATFORM_DOMAIN=admin.onlymarket.com.ar`, `TENANT_BASE_DOMAIN=onlymarket.com.ar` y `TENANT_NAMESPACE_MODE=exclusive` en `.env` **solo si NanoLabs tiene control exclusivo del dominio**, configurar DNS + Nginx Proxy Manager para `*.onlymarket.com.ar` → `onlymarket-web:3000` (certificado wildcard Let's Encrypt DNS-01) y recrear solo `onlymarket-web`.

## 2. Instalación inicial en `/opt/apps/onlymarket` (referencia posterior al desbloqueo)

No ejecutar estos pasos hasta completar el bloqueo anterior y confirmar CI verde del SHA exacto.

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
   PLATFORM_DOMAIN=onlymarket.nanoapps.ar
   TENANT_BASE_DOMAIN=nanoapps.ar
   NANOAPPS_ROUTER_URL=http://nanoapps-router:8080
   TENANT_NAMESPACE_MODE=shared
   RESERVED_SLUGS=
   PLATFORM_ADMIN_ENABLED=true
   HUB_INTEGRATION_TOKEN=$(openssl rand -hex 32)
   EOF
   chmod 600 .env
   ```
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
4. **Nginx Proxy Manager (dominio SuperAdmin)**:
   - Crear Proxy Host para `onlymarket.nanoapps.ar` → Forward Hostname: `onlymarket-web`, Forward Port: `3000`, SSL Certificate: reutilizar wildcard `npm-3` (`*.nanoapps.ar`) o emitir certificado Let's Encrypt para `onlymarket.nanoapps.ar`, con **Force SSL** y **Block Common Exploits** activados.
   - No exponer PostgreSQL al host ni a `proxy`. No modificar el Proxy Host wildcard `#3` (`3.conf`).
5. **Integración futura con nanoapps-router**: no editar ni reiniciar el router compartido mientras no exista un plan aprobado de registro global, prueba aislada, inventario de dominios existentes, ventana de cambios y rollback. No alcanza con añadir OnlyMarket a su arreglo de aplicaciones.
6. Alta del administrador de plataforma (y primer comercio si aplica, o crearlo desde `/superadmin`) sin dejar secretos en historial:
   ```sh
   set +o history
   docker compose exec -T \
     -e PLATFORM_BOOTSTRAP_EMAIL="admin@nanolabs.ar" \
     -e PLATFORM_BOOTSTRAP_PASSWORD="CLAVE-PLATAFORMA-LARGA" \
     app node scripts/bootstrap-platform.mjs
   set -o history
   ```
   Luego ingresar en `https://onlymarket.nanoapps.ar` para verificar el panel. Las altas de comercios solo podrán habilitarse cuando se haya resuelto y probado la reserva global.

## 3. Actualización controlada
Utilizar el script verificado con el SHA de 40 caracteres que ya tenga CI verde:
```sh
cd /opt/apps/onlymarket
git fetch --all --prune
git checkout <SHA_APROBADO>
ONLYMARKET_CI_APPROVED=<SHA_APROBADO> sh scripts/deploy-review.sh <SHA_APROBADO>
```
Este flujo detiene `app`, genera backup previo en `/opt/backups/onlymarket`, ejecuta `npm run db:deploy`, levanta `onlymarket-web` y valida `/api/health`.

## 4. Backup y prueba de restauración aislada
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

## 5. Rollback
1. Detener la aplicación: `docker compose stop app`.
2. Si hubo cambios de esquema incompatibles hacia atrás, restaurar el dump previo generado por `deploy-review.sh` en `/opt/backups/onlymarket`.
3. Volver al commit anterior (`git checkout <SHA_ANTERIOR>`), reconstruir y levantar solo este stack:
   ```sh
   docker compose build app
   docker compose up -d --wait app
   docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1);return r.text()}).then(console.log)"
   ```

## 6. Alcance y limitaciones documentadas (`1.0.0-rc.1`)
Las siguientes capacidades están **fuera de alcance** en esta versión y NO deben ofrecerse al usuario final como activas:
- **Facturación electrónica ARCA / AFIP**: los comprobantes emitidos son internos y no fiscales.
- **Integración directa con balanzas físicas** (serial/USB): se soporta escaneo manual de etiquetas EAN-13 con peso codificado (prefijo `2X` + PLU 5 dígitos + gramos 5 dígitos + dígito verificador) y confirmación en POS.
- **Notificaciones push**: las alertas de vencimiento y frescura se consultan en `/alertas` (refresco automático mientras la pantalla está abierta).
- **Ventas offline**: el Service Worker (`/sw.js`) es strictly network-only; sin conexión bloquea navegación y no encola ventas locales.
- **Canje de puntos**: el módulo de fidelización acumula puntos informativos netos (descontando anulaciones y devoluciones) y aplica descuento de socio configurable; el canje como medio de pago está pendiente.
- **Cobro automático de suscripciones**: planes, vencimiento de licencia y suspensión se administran manualmente desde `/superadmin`.
- **Recuperación automática de contraseña por correo**: no hay SMTP configurado; un usuario autenticado cambia su clave en `/cuenta`, y el propietario puede revocar accesos en `/administracion`.
