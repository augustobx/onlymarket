# POS, cajas y promociones
- Una caja abierta por usuario y comercio, asociada a una sucursal. Sin retiros ni devoluciones en este incremento.
- El cajero selecciona el lote físico; búsqueda por nombre, SKU, código de barras o lote. Las opciones están ordenadas por vencimiento. No es integración con balanza ni lector de peso variable.
- Cada venta confirma precio y cantidad, y usa transacción serializable con idempotencia. Se revalida el precio y la aptitud del lote en servidor. El costo histórico se descuenta junto al stock.
- Promociones porcentuales por producto o lote, con fechas y condición opcional de próximos vencimientos. Mayor descuento elegible, sin acumulación. No permite vender lotes vencidos o en revisión.
- Pagos registrados manualmente, un medio por venta; sin integración bancaria ni fiscal. Cierre compara efectivo contado contra fondo y ventas en efectivo.
- Pendientes: devoluciones, anulación auditada, pagos mixtos, retiros/ingresos, comprobante imprimible, promociones combinadas, concurrencia real en PostgreSQL, prueba de navegador y despliegue.
