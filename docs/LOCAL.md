# Desarrollo local (no producción)

1. Node 22+ y PostgreSQL 17 aislado. Definir `DATABASE_URL` con credenciales locales.
2. `npm ci`
3. `npx prisma generate`
4. `npx prisma migrate deploy`
5. Definir `BOOTSTRAP_EMAIL`, `BOOTSTRAP_SLUG`, `BOOTSTRAP_NAME` y `BOOTSTRAP_PASSWORD` (mínimo 12 caracteres) y ejecutar `node scripts/bootstrap.mjs`. Retirar variables al finalizar.
6. `npm run dev` (o `npm run build && npm run start`). Ingresar en `http://localhost:3000/login` con código de comercio, correo y contraseña.
7. Verificación completa: `npm run db:validate`, `RUN_DB_TESTS=1 npm test`, `npm run build` y `npm run test:browser`.

Consultar [docs/DEPLOY.md](DEPLOY.md) para el alcance operativo y las funcionalidades fuera de alcance en `1.0.0-rc.1`.
