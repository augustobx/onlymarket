# Desarrollo local (no producción)
1. Node 22 y PostgreSQL aislado. Definir DATABASE_URL con credenciales locales.
2. npm install
3. npx prisma generate
4. npx prisma db push (solo base local nueva; migraciones versionadas pendientes).
5. Definir BOOTSTRAP_EMAIL, BOOTSTRAP_SLUG, BOOTSTRAP_NAME, BOOTSTRAP_PASSWORD (mínimo 12 caracteres) mediante entorno seguro. Ejecutar node scripts/bootstrap.mjs. Retirar variables al finalizar.
6. npm run dev. Ingresar con código de comercio, correo y contraseña.
7. npm test; npm run db:validate; npm run build.

El alta de comercio se realiza por CLI, no por registro público. Sin datos simulados.
El catálogo, proveedores, recepción, revisión de lotes y transformaciones tienen operaciones persistentes. La vida útil tras apertura está almacenada pero aún no se aplica. Faltan migraciones, restricción SQL, gestión de usuarios y sucursales, edición de catálogo, pruebas de BD, POS, compras multiproducto, pagos, promoción, alertas push, informes y despliegue. La fecha de vencimiento se trata como primer día bloqueado hasta validar política comercial. No utilizar para operaciones comerciales reales antes de auditoría.
