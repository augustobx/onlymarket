import type {IconName} from "../components/icons";

export type ModuleGuide={
 id:string;
 route:string;
 aliases?:string[];
 group:"Operación"|"Mercadería"|"Producción y frescos"|"Comercial"|"Administración"|"Cuenta y ayuda";
 icon:IconName;
 title:string;
 summary:string;
 lifecycle:string[];
 howTo:string[];
 whatToExpect:string[];
 tip?:string;
};

export const SYSTEM_OVERVIEW={
 title:"Cómo funciona OnlyMarket",
 subtitle:"Todo gira alrededor de cuatro piezas simples: Productos, Lotes trazables, Sucursales independientes y Turnos de caja.",
 pillars:[
  {
   title:"Lotes y regla FEFO",
   description:"Cada compra o fraccionamiento crea un lote físico con fecha de vencimiento. En caja el sistema descuenta automáticamente primero el lote que vence antes (FEFO).",
  },
  {
   title:"Unidades y peso (PLU)",
   description:"Podés vender artículos cerrados por unidad o frescos por kilo. Si usás balanza etiquetadora, los códigos PLU leen el peso directo desde el lector.",
  },
  {
   title:"Sucursales aisladas",
   description:"Cada sucursal maneja su propio stock, turnos de caja y reposición. Si ves stock en el catálogo pero no en caja, revisá en qué sucursal abriste el turno.",
  },
  {
   title:"Trazabilidad y margen real",
   description:"Cada venta guarda el costo exacto de los lotes consumidos. Así Finanzas e Informes calculan ganancia real sin mezclar gastos ni inventarios.",
  },
 ],
 flow:[
  "1. Cargar catálogo",
  "2. Recibir compras (lotes)",
  "3. Controlar stock y frescos",
  "4. Cobrar en Terminal de caja",
  "5. Ver márgenes y cierres",
 ],
};

export const MODULE_GUIDES:ModuleGuide[]=[
 {
  id:"resumen",
  route:"/",
  group:"Operación",
  icon:"home",
  title:"Resumen del negocio",
  summary:"Tablero inicial con ventas del día, estado de cajas, alertas urgentes y atajos operativos.",
  lifecycle:[
   "Apertura de turno",
   "Operación del día",
   "Detección de alertas",
   "Cierre financiero",
  ],
  howTo:[
   "Revisá primero el bloque de atención inmediata para ver vencimientos, cajas o stock bajo.",
   "Compará las ventas y la ganancia bruta del día contra el objetivo operativo.",
   "Usá los accesos rápidos para saltar directo a Caja, Recepción o Alertas.",
  ],
  whatToExpect:[
   "Todos los importes se actualizan con las ventas, devoluciones y recepciones confirmadas al instante.",
   "Las alertas rojas requieren revisión antes de seguir vendiendo esos lotes.",
  ],
 },
 {
  id:"alertas",
  route:"/alertas",
  group:"Operación",
  icon:"bell",
  title:"Centro de alertas",
  summary:"Lista priorizada de lotes próximos a vencer, vencidos, stock crítico y artículos en revisión.",
  lifecycle:[
   "Carga de lote con vencimiento",
   "Aviso previo",
   "Acción preventiva (promo / revisión)",
   "Bloqueo o baja",
  ],
  howTo:[
   "Presioná «Actualizar avisos» para recalcular vencimientos y mínimos al momento.",
   "Atendé primero los lotes bloqueados o vencidos para retirarlos de góndola.",
   "Para lotes por vencer, podés lanzar una promoción rápida desde Comercial.",
  ],
  whatToExpect:[
   "Los lotes vencidos se bloquean automáticamente y ya no se pueden vender en Terminal de caja.",
   "Las alertas disminuyen a medida que vendés, ajustás o liquidás los lotes afectados.",
  ],
 },
 {
  id:"pos",
  route:"/pos",
  aliases:["/pos/ticket","/pos/cierre"],
  group:"Operación",
  icon:"cart",
  title:"Terminal de caja",
  summary:"Punto de venta rápido para escanear o buscar productos, aplicar promos y cobrar por medio de pago.",
  lifecycle:[
   "Abrir turno con fondo",
   "Escanear o tocar artículos",
   "Aplicar cliente / promo",
   "Cobrar y emitir ticket",
   "Realizar arqueo",
  ],
  howTo:[
   "Abrí turno eligiendo sucursal y fondo inicial en efectivo.",
   "Buscá por nombre, SKU, código de barras o PLU de balanza, o tocá las tarjetas de la izquierda.",
   "Elegí cliente (opcional), medio de pago (o pago mixto) y confirmá la venta.",
  ],
  whatToExpect:[
   "Con «Escaneo rápido» activo, cada lectura suma 1 unidad por FEFO sin pasos extra.",
   "Si buscás un producto sin stock en tu caja, te mostrará en qué otra sucursal está disponible.",
   "Al cerrar turno («Realizar arqueo») comparás el efectivo contado contra el esperado y generás el cierre.",
  ],
  tip:"Atajos útiles: F2 vuelve al buscador, F4 va a cantidad y F12 enfoca Confirmar venta.",
 },
 {
  id:"catalogo",
  route:"/catalogo",
  aliases:["/catalogo/importar"],
  group:"Mercadería",
  icon:"box",
  title:"Productos e inventario",
  summary:"Maestro de productos (SKU, código de barras, unidad, precio) e importación masiva por CSV.",
  lifecycle:[
   "Alta o importación CSV",
   "Fijar precio y mínimos",
   "Recibir lotes con stock",
   "Venta o ajuste",
  ],
  howTo:[
   "Creá artículos con «+ Nuevo producto» definiendo si se vende por unidad o por kilo.",
   "Activá acceso rápido si querés que aparezca como botón táctil destacado en caja.",
   "Para cargar muchos de una vez, entrá a Importar CSV usando el formato por punto y coma.",
  ],
  whatToExpect:[
   "Un producto nuevo nace con stock 0 hasta que registres una recepción en Compras o un conteo.",
   "Cambiar el precio acá impacta en las nuevas ventas, sin alterar tickets ya cerrados.",
  ],
 },
 {
  id:"inventario",
  route:"/inventario",
  group:"Mercadería",
  icon:"truck",
  title:"Compras y recepción",
  summary:"Ingreso de facturas/remitos de proveedores y generación de lotes trazables con su costo real.",
  lifecycle:[
   "Cargar factura o remito",
   "Ingresar lotes y vencimientos",
   "Cuadrar total",
   "Stock disponible en caja",
  ],
  howTo:[
   "Usá «Recibir lote» para un ingreso rápido puntual o «Nueva recepción múltiple» para facturas completas.",
   "Buscá cada producto, indicá código de lote, cantidad y el costo total de ese lote (no el unitario).",
   "Verificá en el panel derecho que la diferencia contra el comprobante sea $ 0,00 y confirmá.",
  ],
  whatToExpect:[
   "Cada renglón crea un lote disponible para vender inmediatamente en la sucursal elegida.",
   "El comprobante impacta en la cuenta con el proveedor y alimenta el costo real de cada venta futura.",
  ],
 },
 {
  id:"stock",
  route:"/stock",
  group:"Mercadería",
  icon:"layers",
  title:"Conteos, traslados y estado",
  summary:"Ajustes físicos de inventario, movimiento de mercadería entre sucursales y cambio de estado de lotes.",
  lifecycle:[
   "Detectar diferencia o traslado",
   "Registrar conteo / pase",
   "Actualizar saldos",
   "Registro en Auditoría",
  ],
  howTo:[
   "En «Conteo físico», buscá el lote y cargá la cantidad real contada en góndola o cámara.",
   "En «Traslados entre sucursales», mové unidades de una sucursal origen a una destino.",
   "También podés pasar un lote a Revisión o Bloqueado si tiene daños o problemas de calidad.",
  ],
  whatToExpect:[
   "Los conteos negativos reflejan mermas en el balance financiero; los traslados conservan costo y vencimiento.",
   "Cualquier lote puesto en Revisión o Bloqueado deja de mostrarse como vendible en caja.",
  ],
 },
 {
  id:"reposicion",
  route:"/reposicion",
  group:"Mercadería",
  icon:"packageCheck",
  title:"Reposición inteligente",
  summary:"Detección de faltantes por sucursal comparando stock actual vs stock mínimo configurado.",
  lifecycle:[
   "Definir stock mínimo",
   "Detectar bajo mínimo",
   "Priorizar compra",
   "Recibir mercadería",
  ],
  howTo:[
   "Configurá el stock mínimo sugerido de cada producto según su rotación en sucursal.",
   "Filtrá por sucursal o estado para ver qué artículos quedaron debajo del punto de pedido.",
   "Usá la cantidad sugerida como guía al armar el pedido al proveedor.",
  ],
  whatToExpect:[
   "Solo mide mercadería apta (Disponible / Por vencer), ignorando lotes vencidos o bloqueados.",
   "Al registrar la recepción en Compras, el artículo sale de la lista de faltantes.",
  ],
 },
 {
  id:"proveedores",
  route:"/proveedores",
  group:"Mercadería",
  icon:"building",
  title:"Proveedores",
  summary:"Agenda de proveedores, facturas recibidas y seguimiento rápido de compras registradas.",
  lifecycle:[
   "Alta de proveedor",
   "Asociar facturas en Compras",
   "Seguimiento de pagos",
  ],
  howTo:[
   "Cargá tus proveedores con «+ Nuevo proveedor» (CUIT, contacto y observaciones).",
   "Una vez cargado, aparecerá en el selector de Compras y recepción y en Pagos de Finanzas.",
  ],
  whatToExpect:[
   "Mantiene centralizado el historial de ingresos y pagos a cada proveedor.",
  ],
 },
 {
  id:"trazabilidad",
  route:"/trazabilidad",
  group:"Mercadería",
  icon:"trace",
  title:"Trazabilidad completa",
  summary:"Rastreo paso a paso de cualquier lote: origen de compra, transformaciones, traslados y ventas.",
  lifecycle:[
   "Ingreso / Origen",
   "Transformación o traslado",
   "Tickets vendidos",
   "Auditoría de retiro",
  ],
  howTo:[
   "Escribí un código de lote, producto o factura en el buscador superior para ver su historial.",
   "Revisá en qué tickets se vendió o qué cortes derivaron de una media res o horma.",
  ],
  whatToExpect:[
   "Te permite reconstruir ante cualquier reclamo de calidad qué lote entró y en qué caja salió.",
  ],
 },
 {
  id:"transformaciones",
  route:"/transformaciones",
  group:"Producción y frescos",
  icon:"scale",
  title:"Desposte y fraccionamiento",
  summary:"Conversión de una pieza mayorista (media res, horma, cajón) en cortes finales vendibles sin perder costo.",
  lifecycle:[
   "Elegir lote origen",
   "Cargar cortes, regalos y merma",
   "Verificar balance kg",
   "Generar lotes derivados",
  ],
  howTo:[
   "Elegí la plantilla rápida o tocá «Nuevo fraccionamiento» seleccionando el lote origen y kilos a procesar.",
   "Agregá cada corte de salida con su peso y destino (Stock vendible, Regalo o Merma).",
   "Guardá plantillas de desposte para repetir los mismos cortes más rápido la próxima vez.",
  ],
  whatToExpect:[
   "El peso total de salidas + mermas debe coincidir con el peso tomado del lote origen.",
   "El costo de compra del lote original se reparte proporcionalmente entre los cortes vendibles y limita vencimientos.",
  ],
 },
 {
  id:"verduleria",
  route:"/verduleria",
  group:"Producción y frescos",
  icon:"apple",
  title:"Verdulería y frescos",
  summary:"Control específico de frescura, vida útil al abrir envases y precios de productos pesables.",
  lifecycle:[
   "Ingreso de lote fresco",
   "Seguimiento por días de frescura",
   "Liquidación o merma a tiempo",
  ],
  howTo:[
   "Monitoreá aquí los lotes de verdulería, carnicería o fiambrería próximos a perder frescura.",
   "Si abrís una horma o bolsa cerrada, el sistema acorta su vencimiento al límite de días tras apertura.",
  ],
  whatToExpect:[
   "Ayuda a decidir rebajas del día antes de que la mercadería pase a merma.",
  ],
 },
 {
  id:"promociones",
  route:"/promociones",
  group:"Comercial",
  icon:"tag",
  title:"Promociones y ofertas",
  summary:"Reglas de descuento porcentual, 2x1 / NxM y ofertas por volumen o lote próximo a vencer.",
  lifecycle:[
   "Crear regla con vigencia",
   "Aplicación automática en POS",
   "Medición de ahorro en ticket",
  ],
  howTo:[
   "Definí un descuento por porcentaje (ej. 15% desde 3 kg) o modalidad NxM (ej. llevá 3 pagá 2).",
   "Podés aplicarla a todo un producto o atarla a un lote específico próximo a vencer.",
  ],
  whatToExpect:[
   "En Terminal de caja se aplica sola la mejor promo sin acumular descuentos duplicados.",
   "Queda discriminada en el subtotal del cliente como «Promociones y beneficios».",
  ],
 },
 {
  id:"combos",
  route:"/combos",
  group:"Comercial",
  icon:"sparkles",
  title:"Combos y paquetes",
  summary:"Armado de paquetes cerrados de varios productos a precio especial vigente por fechas.",
  lifecycle:[
   "Elegir productos del combo",
   "Fijar precio promocional",
   "Detección automática en caja",
  ],
  howTo:[
   "Creá un combo agregando los productos incluidos, la cantidad de cada uno y el precio final del pack.",
   "El cajero no necesita buscar un botón aparte: escanea los productos sueltos.",
  ],
  whatToExpect:[
   "Cuando el carrito reúne todos los artículos del combo, el POS calcula el ahorro automáticamente.",
  ],
 },
 {
  id:"clientes",
  route:"/clientes",
  aliases:["/clientes/"],
  group:"Comercial",
  icon:"users",
  title:"Clientes, socios y puntos",
  summary:"Registro de clientes frecuentes, beneficio comercial para socios y canje o historial de puntos.",
  lifecycle:[
   "Alta de cliente / socio",
   "Asociar en Terminal de caja",
   "Acumulación de puntos",
   "Canje de saldo",
  ],
  howTo:[
   "Registrá clientes con «+ Nuevo cliente» indicando código, documento y contacto.",
   "Cuando el cajero elige al cliente en una venta, aplica descuento de socio (si está configurado) y suma puntos.",
   "Desde aquí también podés registrar canjes de puntos acumulados.",
  ],
  whatToExpect:[
   "Los puntos se acreditan al confirmar la venta y se descuentan proporcionalmente si se anula o devuelve.",
  ],
 },
 {
  id:"ventas",
  route:"/ventas",
  aliases:["/ventas/devolucion"],
  group:"Comercial",
  icon:"receipt",
  title:"Ventas, anulaciones y devoluciones",
  summary:"Historial de comprobantes emitidos con opciones seguras de devolución parcial o anulación completa.",
  lifecycle:[
   "Venta confirmada en caja",
   "Consulta / reimpresión",
   "Devolución parcial o anulación",
   "Reintegro y ajuste de stock",
  ],
  howTo:[
   "Buscá cualquier operación reciente para ver su detalle, medio de pago o reimprimir el ticket.",
   "Usá «Devolución» cuando el cliente devuelve parte del ticket o «Anular» para revertir el comprobante completo.",
   "Indicá si la mercadería devuelta vuelve a stock vendible o pasa a Revisión.",
  ],
  whatToExpect:[
   "Las devoluciones en efectivo descuentan el efectivo esperado de la caja abierta.",
   "Nunca borra tickets: deja trazabilidad fiscal interna y registro en Auditoría.",
  ],
 },
 {
  id:"finanzas",
  route:"/finanzas",
  group:"Comercial",
  icon:"wallet",
  title:"Finanzas y rentabilidad",
  summary:"Resultado económico real: ventas netas menos costo real vendido, mermas y gastos operativos.",
  lifecycle:[
   "Ventas y compras del período",
   "Carga de gastos y pagos",
   "Conciliación de arqueos",
   "Resultado neto",
  ],
  howTo:[
   "Registrá gastos diarios (alquiler, luz, bolsas, fletes) y pagos efectuados a proveedores.",
   "Compará la facturación neta contra el costo real de los lotes vendidos en ese período.",
  ],
  whatToExpect:[
   "Las compras no se descuentan dos veces: primero entran como inventario y luego impactan como costo al venderse.",
   "Podés exportar el resumen completo a CSV compatible con Excel.",
  ],
 },
 {
  id:"informes",
  route:"/informes",
  group:"Comercial",
  icon:"chart",
  title:"Informes de gestión",
  summary:"Ranking de rentabilidad por producto, ventas por medio de pago, rendimiento por sucursal y exportación CSV.",
  lifecycle:[
   "Filtrar rango de fechas / sucursal",
   "Analizar márgenes",
   "Exportar a Excel (CSV)",
  ],
  howTo:[
   "Elegí las fechas o sucursal a analizar para ver qué artículos venden más y cuáles dejan mejor margen.",
   "Usá el botón de exportación para bajar la tabla completa a CSV.",
  ],
  whatToExpect:[
   "Detecta rápido artículos con mucho volumen pero bajo margen para recalibrar precios.",
  ],
 },
 {
  id:"auditoria",
  route:"/auditoria",
  group:"Comercial",
  icon:"shield",
  title:"Auditoría operativa",
  summary:"Bitácora inalterable de acciones críticas realizadas por usuarios en el comercio.",
  lifecycle:[
   "Acción de usuario",
   "Registro automático con timestamp",
   "Control administrativo",
  ],
  howTo:[
   "Filtrá por tipo de evento o revisá las últimas acciones ante diferencias de caja o stock.",
  ],
  whatToExpect:[
   "Registra aperturas/cierres de caja, anulaciones, devoluciones, ajustes de stock, cambios de precios y usuarios.",
  ],
 },
 {
  id:"administracion",
  route:"/administracion",
  group:"Administración",
  icon:"shield",
  title:"Sucursales y equipo",
  summary:"Gestión de locales/depósitos del comercio y altas o permisos de cajeros, encargados e inventario.",
  lifecycle:[
   "Crear sucursales",
   "Crear usuarios con rol",
   "Operar según permisos",
  ],
  howTo:[
   "Dá de alta nuevas sucursales antes de recibir stock o abrir cajas independientes en ellas.",
   "Creá cuentas para tu equipo asignando el rol exacto: Cajero (solo POS), Inventario, Encargado o Propietario.",
  ],
  whatToExpect:[
   "Cada rol ve únicamente las secciones que necesita para trabajar sin riesgo de tocar configuraciones críticas.",
  ],
 },
 {
  id:"configuracion",
  route:"/configuracion",
  group:"Administración",
  icon:"settings",
  title:"Perfil del comercio",
  summary:"Reglas globales: prefijo de balanza PLU, descuento de socios, valor del punto y rubro del negocio.",
  lifecycle:[
   "Definir reglas base",
   "Aplicar automático en POS y alertas",
  ],
  howTo:[
   "Configurá el prefijo de 2 dígitos de tu balanza si emitís etiquetas pesables.",
   "Ajustá el porcentaje de descuento por defecto para socios y cuántos pesos equivale cada punto.",
  ],
  whatToExpect:[
   "Los cambios aplican inmediatamente en toda la operación de caja y fidelización.",
  ],
 },
 {
  id:"cuenta",
  route:"/cuenta",
  group:"Cuenta y ayuda",
  icon:"user",
  title:"Mi cuenta",
  summary:"Datos de tu usuario activo y cambio seguro de contraseña personal.",
  lifecycle:[
   "Verificar correo y rol",
   "Actualizar contraseña",
  ],
  howTo:[
   "Ingresá tu contraseña actual y definí una nueva clave personal segura si necesitás renovarla.",
  ],
  whatToExpect:[
   "Solo modifica tu credencial de ingreso sin afectar los turnos ni registros históricos asociados.",
  ],
 },
 {
  id:"ayuda",
  route:"/ayuda",
  group:"Cuenta y ayuda",
  icon:"help",
  title:"Centro de ayuda y guías",
  summary:"Manual práctico con la lógica completa del sistema y todas las guías módulo por módulo.",
  lifecycle:[
   "Entender el flujo general",
   "Buscar un módulo",
   "Aplicar paso a paso",
  ],
  howTo:[
   "Leé el resumen del flujo general arriba si es tu primer día usando OnlyMarket.",
   "Usá el buscador para encontrar cualquier operación (ej. lote, devolución, arqueo, balanza).",
  ],
  whatToExpect:[
   "Cada tarjeta tiene un enlace directo para abrir el módulo que necesitás operar.",
  ],
 },
];

export function resolveModuleGuide(pathname:string):ModuleGuide{
 const clean=pathname.split("?")[0]||"/";
 const exact=MODULE_GUIDES.find(g=>g.route===clean);
 if(exact)return exact;
 const aliasMatch=MODULE_GUIDES.find(
  g=>g.aliases?.some(a=>clean===a||clean.startsWith(a+"/")||clean.startsWith(a))
 );
 if(aliasMatch)return aliasMatch;
 const prefix=MODULE_GUIDES.find(g=>g.route!=="/"&&clean.startsWith(g.route+"/"));
 return prefix??MODULE_GUIDES[0];
}
