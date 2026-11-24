# Contrato de dominio — v0.1
- Cada operación debe obtener tenant, usuario y permisos desde sesión validada en servidor. Nunca confiar en tenant/rol del navegador.
- Cantidades: enteros en gramos para KG; milésimas para UNIT (ventas de unidades enteras salvo conversión explícita). Dinero en centavos ARS. BigInt se serializa como string.
- Lote conserva saldo de peso y valor; movimientos append-only. No editar saldo fuera de transacción. Compra, venta, merma, regalo y transformación requieren documento y actor.
- Desposte/fraccionamiento: un lote origen, salidas clasificadas como STOCK/GIFT/WASTE. Balance de masa exacto. En esta etapa costo distribuido por peso incluyendo descartes y regalos, que se reconocen como pérdida o entrega sin ingreso. No volver a sumar el mismo costo a los cortes. Método por valor comercial queda pendiente.
- Caducidad: bloquear en fecha de vencimiento (política conservadora provisional), bloquear revisión hasta aprobación autorizada, nunca extender vida útil sin política de seguridad validada. Fecha local Argentina. FEFO solo dentro de mismo tenant, sucursal y producto; confirmar lote físico en caja.
- No exponer rutas de escritura hasta implementar autenticación, autorización, idempotencia, validación y transacciones concurrentes. No prometer facturación fiscal ni hardware sin validación.
- Pendientes: migración SQL con restricciones, cuentas de proveedores, compras, POS, promociones, informes, interfaz, pruebas DB y Docker.
