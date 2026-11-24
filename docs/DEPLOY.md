# Instalación aislada (candidata, todavía no autorizada para producción)

Prerequisitos: Docker Compose, red externa proxy de Nginx Proxy Manager, repositorio privado, CI verde del commit exacto y pruebas de aceptación. No ejecutar sobre bases de otras aplicaciones.

1. Clonar en /opt/apps/onlymarket; seleccionar el commit auditado.
2. En la raíz, crear .env con permisos 600 y POSTGRES_PASSWORD generado con openssl rand -hex 32. No publicar ni copiar a Git.
3. docker compose config -q
4. docker compose up -d db
5. docker compose build app
6. docker compose run --rm app npm run db:deploy
7. docker compose up -d app
8. docker compose ps; docker compose logs --tail=100 app
9. Configurar NPM: destino onlymarket-web:3000, HTTPS obligatorio (cookie de sesión segura). No exponer el puerto PostgreSQL ni modificar otros hosts.

Alta inicial: ejecutar scripts/bootstrap.mjs dentro del contenedor mediante variables de entorno temporales BOOTSTRAP_EMAIL, BOOTSTRAP_SLUG, BOOTSTRAP_NAME y BOOTSTRAP_PASSWORD. No escribir secretos en historial; usar archivo temporal 600 o lectura silenciosa en shell y retirar variables después. El script no sobrescribe comercios existentes.

Backups: sh scripts/backup.sh /opt/backups/onlymarket. La lista del archivo se verifica con pg_restore -l; esto NO prueba una restauración. Restaurar en una base aislada y validar antes de pasar a producción. Mantener una copia externa cifrada. No usar down -v, db push ni reset en producción.

PWA: manifest y worker sin caché de datos privados. Requiere HTTPS; funcionamiento offline de ventas no incluido. Validar instalación en cada navegador/dispositivo.

Pendientes de producción: prueba de navegador, migración y restore probados, revisión de roles y políticas de caducidad, comprobantes y devoluciones, prueba de capacidad POS. No incluye ARCA, integración directa de balanza, pagos bancarios ni Hub.
