# Comercio de prueba completo

La seed es **manual**, no se ejecuta al iniciar ni desplegar la aplicación. Compatible con OnlyMarket 2.0 (commit fab8dd72). Requiere un slug nuevo que empiece con demo-, confirmación explícita y disponibilidad comprobada por el mismo router utilizado por el alta normal. No reutiliza usuarios, no actualiza comercios existentes, no elimina registros. Ante un error suspende exclusivamente el comercio recién creado. Genera contraseñas aleatorias independientes para los cinco usuarios y las muestra una sola vez.

## Ejecutar sobre la versión V2 instalada, sin rebuild ni reinicio

Desde el servidor:
```bash
cd /opt/apps/onlymarket
sh scripts/backup.sh /opt/backups/onlymarket
git fetch origin feat/demo-supermarket-seed
git show origin/feat/demo-supermarket-seed:seed-demo.mjs | docker compose exec -T -e DEMO_SLUG=demo-onlymarket -e DEMO_CONFIRM=CREAR_DEMO app node --input-type=module
```

Ejecutar únicamente cuando el PR y la CI de la seed estén aprobados. No hace falta modificar .env. El script usa las variables de entorno del contenedor activo y sus servicios. El nombre de comercio y las credenciales se imprimen en la terminal al terminar. Guardar las credenciales de forma privada. El usuario owner tiene caja abierta en Casa central; el cajero caja1 está disponible para abrir un turno y registrar ventas. El comercio vence a los 90 días; suspendelo desde SuperAdmin al terminar.

## Escenarios incluidos

44 productos, 2 sucursales, 6 proveedores ficticios, 10 socios, 5 usuarios. Inventario por unidad y kilo, códigos EAN válidos y PLU, lotes agotados, mercadería sin existencias, stock mínimo, vencidos, próximos a vencer, bloqueados y revisión de frescura. Recepciones con comprobantes, compras múltiples, 7 días de ventas históricas, ventas de hoy por medios de pago, promociones activas/futuras/finalizadas/inactivas, combos, socios, una anulación, una devolución parcial, caja con diferencia y caja abierta, ingresos/retiros, desposte, fraccionamiento, plantillas, mermas, regalos, conteos, traslados y finanzas.

El historial de días anteriores es simulado: las compras de artículos unitarios, ventas y turnos se datan dentro del período de muestra después de registrarse a través de los servicios reales. Las fechas antiguas de dos lotes se ajustan expresamente para representar el paso del tiempo. Las ventas de hoy usan la hora real. No crea documentos fiscales, órdenes de compra pendientes, pagos electrónicos externos ni terminales físicas que no existen en el producto actual.

La seed concilia cantidades y costos de todos los lotes con sus movimientos, totales de ventas y medios de pago, y efectivo esperado de los cierres. No está diseñada para reiniciarse sobre un comercio con datos: si se desea otra muestra, usar otro slug nuevo. No publicar las contraseñas en tickets ni en GitHub.

## Cargar un comercio demo existente (superprueba)

No crea otro tenant, no cambia la licencia, perfil, contraseñas, ni configuración del comercio. Agrega dos sucursales identificadas como OMDEMO, productos con SKU OMDEMO-, proveedores, socios y cinco cuentas de prueba nuevas (dos encargados, dos cajeros y depósito). El propietario existente conserva acceso a todo. Si los códigos de prueba colisionan o la seed ya comenzó, se rechaza el alta inicial. La conciliación se limita a los registros nuevos. Si una operación posterior falla, puede quedar una carga parcial; no se suspende el tenant existente ni se reintenta automáticamente. Conservar el respaldo previo. Ejecutar con la CI aprobada y sin usuarios operando el comercio demo.

```bash
cd /opt/apps/onlymarket
sh scripts/backup.sh /opt/backups/onlymarket
git fetch origin feat/demo-supermarket-seed
git show origin/feat/demo-supermarket-seed:seed-demo.mjs | docker compose exec -T -e DEMO_MODE=existing -e DEMO_SLUG=superprueba -e DEMO_CONFIRM=CARGAR_SUPER_DEMO app node --input-type=module
```
