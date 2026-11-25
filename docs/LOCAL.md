# Desarrollo local (no producción)

1. Node 22+ y PostgreSQL 17 aislado. Definir `DATABASE_URL` con credenciales locales.
   Definir explícitamente `PLATFORM_DOMAIN=localhost`, `TENANT_BASE_DOMAIN=localhost` y `TENANT_URL_PORT=3000` tanto al provisionar como al iniciar Next.js. No configurar `NANOAPPS_ROUTER_URL` en local. No hay alias localhost implícitos en producción.
2. `npm ci`
3. `npx prisma generate`
4. `npx prisma migrate deploy`
5. Definir `BOOTSTRAP_EMAIL`, `BOOTSTRAP_SLUG`, `BOOTSTRAP_NAME` y `BOOTSTRAP_PASSWORD` (mínimo 12 caracteres) y ejecutar `node scripts/bootstrap.mjs`. Retirar variables al finalizar.
6. Opcional para plataforma central: definir `PLATFORM_ADMIN_ENABLED=true`, `PLATFORM_BOOTSTRAP_EMAIL` y `PLATFORM_BOOTSTRAP_PASSWORD` y ejecutar `node scripts/bootstrap-platform.mjs`.
7. `npm run dev` (o `npm run build && npm run start`):
   - Superadministrador local: `http://localhost:3000` (redirige a `/superadmin/login` y `/superadmin`).
   - Comercio local por subdominio: `http://<slug>.localhost:3000/login` (el subdominio resuelve el comercio sin pedir código; `/superadmin` queda bloqueado con `404`).
8. Verificación completa: `npm run db:validate`, `RUN_DB_TESTS=1 npm test`, `npm run build` y `npm run test:browser`.
   Ejecutar también `npx tsc --noEmit` y `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code`.
   En PowerShell iniciar con `node node_modules/next/dist/bin/next start --hostname localhost` para evitar la interpretación de argumentos de `npm.ps1`.
   El smoke requiere una base nueva, las credenciales bootstrap de comercio/plataforma y `HUB_INTEGRATION_TOKEN`. No borra ni reinicializa bases existentes. `SMOKE_ARTIFACT_DIR` guarda capturas desktop/mobile y activa comprobaciones de desbordes.
   Chromium resuelve `*.localhost`; las consultas HTTP de Node usan loopback con `Host` explícito, sin depender del DNS del sistema operativo.

Consultar [docs/DEPLOY.md](DEPLOY.md) para el diseño de dominios, `nanoapps-router` y las funcionalidades fuera de alcance en `1.0.0-rc.1`.
