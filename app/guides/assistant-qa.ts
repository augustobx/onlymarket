import type {IconName} from "../components/icons";

export type AssistantCategory=
 |"Ingresos y lotes"
 |"Desposte y frescos"
 |"Caja y ventas"
 |"Control y plata";

export type AssistantQA={
 id:string;
 category:AssistantCategory;
 icon:IconName;
 question:string;
 keywords:string;
 routes:string[];
 quickAnswer:string;
 steps:string[];
 whatHappens:string;
 actions:{label:string;href:string}[];
};

export const ASSISTANT_CATEGORIES:AssistantCategory[]=[
 "Ingresos y lotes",
 "Desposte y frescos",
 "Caja y ventas",
 "Control y plata",
];

export const ASSISTANT_QUESTIONS:AssistantQA[]=[
 {
  id:"ingreso-carne",
  category:"Ingresos y lotes",
  icon:"beef",
  question:"¿Cómo cargo un ingreso de carne (media res o caja)?",
  keywords:"carne media res cuarto paleta vaca cerdo carniceria ingreso compra lote vencimiento kg",
  routes:["/","/catalogo","/inventario","/transformaciones","/proveedores"],
  quickAnswer:"Entra como lote por kilogramo en Compras con fecha de vencimiento obligatoria; después lo cortás en Desposte.",
  steps:[
   "Verificá que exista el producto de entrada (ej. «Media res vacuna», por Kilogramo y sector Carnicería) en Productos.",
   "Entrá a Compras y recepción → Nueva recepción (o Recibir lote).",
   "Elegí proveedor, sucursal, lote, kilos totales, COSTO TOTAL del lote (no el precio por kilo) y la fecha de vencimiento.",
   "Si lo vas a trozar en cortes comerciales, andá derecho a Desposte y fraccionamiento.",
  ],
  whatHappens:"El lote nace Disponible con sus kilos reales y su costo total. Cuando lo despostás, ese costo se reparte automáticamente por kilo entre los cortes que vendas y lo que vaya a merma.",
  actions:[
   {label:"Ir a Recibir mercadería",href:"/inventario?view=recepcion"},
   {label:"Ir a Desposte",href:"/transformaciones?view=nueva&sector=BUTCHERY"},
  ],
 },
 {
  id:"cargar-lote-y-despues",
  category:"Ingresos y lotes",
  icon:"truck",
  question:"Cargué un lote de un producto, ¿qué pasa ahora y qué hago con él?",
  keywords:"lote cargado recibi mercaderia que hago despues donde va fefo vender stock",
  routes:["/","/catalogo","/inventario","/stock","/pos"],
  quickAnswer:"Si es un producto común (unidad o cerrado) y está Disponible, ya aparece solo para vender en la Caja de esa sucursal.",
  steps:[
   "Confirmá en Compras y recepción que el lote figure en estado «Disponible» y en la sucursal correcta.",
   "Si necesitás imprimir código de barras o cartel de góndola, tocá «Etiqueta» en esa fila.",
   "Para venderlo, abrí Terminal de caja en esa misma sucursal y escanealo o buscalo por nombre.",
  ],
  whatHappens:"Cuando tengas varios lotes del mismo producto, la caja descuenta automáticamente el que vence primero (regla FEFO). Desde Trazabilidad ves de qué factura vino y en qué ticket salió.",
  actions:[
   {label:"Ver lotes recibidos",href:"/inventario"},
   {label:"Abrir Terminal de caja",href:"/pos"},
  ],
 },
 {
  id:"factura-completa",
  category:"Ingresos y lotes",
  icon:"receipt",
  question:"¿Cómo cargo una factura o remito con varios productos juntos?",
  keywords:"factura remito proveedor varios productos compra multiple diferencia 0",
  routes:["/inventario","/proveedores","/finanzas","/catalogo"],
  quickAnswer:"Usá «Nueva recepción múltiple» para cargar todos los renglones juntos y cuadrar contra el total de la factura.",
  steps:[
   "Entrá a Compras y recepción → «Nueva recepción».",
   "Completá Proveedor, Sucursal, Número de comprobante y el Total final de la factura.",
   "Agregá un renglón por producto indicando lote, cantidad y el costo TOTAL de ese renglón.",
   "Confirmá cuando en el panel derecho la Diferencia marque $ 0,00.",
  ],
  whatHappens:"Crea todos los lotes físicos de una sola vez, registra el comprobante de compra y actualiza el saldo con el proveedor en Finanzas.",
  actions:[
   {label:"Abrir Nueva recepción",href:"/inventario?view=recepcion"},
   {label:"Ver Proveedores",href:"/proveedores"},
  ],
 },
 {
  id:"lote-revision-bloqueado",
  category:"Ingresos y lotes",
  icon:"alert",
  question:"Un lote dice «Revisar calidad» o «Bloqueado», ¿cómo lo habilito?",
  keywords:"revisar calidad review bloqueado blocked retenido no aparece caja habilitar aprobar inspeccion",
  routes:["/inventario","/alertas","/stock","/transformaciones","/verduleria","/catalogo"],
  quickAnswer:"Por seguridad, los lotes en Revisión o Bloqueados no se ven en Caja hasta que alguien los revise y apruebe.",
  steps:[
   "Si vino de un desposte, en la pantalla de Desposte podés tocar directo «Habilitar para venta».",
   "Para cualquier otro lote, andá a Compras y recepción, buscalo abajo y tocá «Registrar revisión».",
   "Elegí «Apto tras inspección», escribí un motivo corto (ej. «Control cámara OK») y guardá.",
  ],
  whatHappens:"Si no está vencido, el lote pasa a Disponible en esa sucursal y aparece inmediatamente para vender en Caja. Propietarios y encargados también pueden rehabilitar bloqueos manuales.",
  actions:[
   {label:"Revisar lotes en Inventario",href:"/inventario"},
   {label:"Ver Alertas activas",href:"/alertas"},
  ],
 },
 {
  id:"desposte-y-merma",
  category:"Desposte y frescos",
  icon:"scale",
  question:"¿Cómo desposto cortes y dónde cargo el hueso, grasa o merma?",
  keywords:"desposte cortar media res hueso grasa recorte merma regalo plantilla fraccionar",
  routes:["/transformaciones","/inventario","/verduleria","/"],
  quickAnswer:"Elegís los kilos del lote entero, cargás cada corte vendible + la merma/hueso y la suma de pesos tiene que empatar exacta.",
  steps:[
   "Entrá a Desposte y fraccionamiento → «Nueva transformación» (o área Carnicería / Fiambrería).",
   "Elegí el lote origen y escribí cuántos kilos reales vas a trozar.",
   "Cargá cada corte como Destino «Corte / stock», y el hueso/recorte como «Merma» (poniendo el detalle).",
   "Dejá tildada la casilla «Habilitar cortes directo para vender en Caja» para no tener que aprobarlos después.",
  ],
  whatHappens:"Solo habilita confirmar cuando Entrada = Cortes + Merma + Regalos (0,000 kg de diferencia). Los cortes salen con el vencimiento original heredado y el costo por kilo bien calculado.",
  actions:[
   {label:"Ir a Mesa de desposte",href:"/transformaciones?view=nueva&sector=BUTCHERY"},
   {label:"Ver historial de despostes",href:"/transformaciones"},
  ],
 },
 {
  id:"apertura-frescura",
  category:"Desposte y frescos",
  icon:"cheese",
  question:"¿Por qué me pide revisar o acorta vencimiento en Verdulería o Fiambrería?",
  keywords:"frescura apertura horma bolsa verduleria fruta verdura queso vencimiento corto revision",
  routes:["/verduleria","/alertas","/catalogo","/inventario","/transformaciones"],
  quickAnswer:"Al abrir una horma o controlar productos frescos, la vida útil real pasa a ser de pocos días y nunca supera el vencimiento del envase.",
  steps:[
   "En Productos podés definir cuántos días de vida útil tiene un artículo una vez abierto o cuántos días dura fresco.",
   "Cuando abrís una horma/paquete desde Inventario («Merma / regalo / apertura»), marcás la apertura del lote.",
   "En Verdulería y frescos revisás a diario los lotes pendientes para revalidar frescura o mandar lo dañado a merma.",
  ],
  whatHappens:"Evita vender mercadería pasada: cuando vence el plazo tras apertura, el lote avisa en Alertas y se retiene hasta pasar inspección.",
  actions:[
   {label:"Abrir Verdulería y frescos",href:"/verduleria"},
   {label:"Ver Alertas",href:"/alertas"},
  ],
 },
 {
  id:"merma-regalo",
  category:"Desposte y frescos",
  icon:"trash",
  question:"¿Cómo doy de baja mercadería tirada, vencida o regalada?",
  keywords:"merma tirar basura desperdicio vencido roto regalo muestra baja ajuste",
  routes:["/inventario","/verduleria","/stock","/alertas","/finanzas"],
  quickAnswer:"Se descuenta del lote como Merma o Regalo para que baje el stock real y quede reflejado en la pérdida del negocio.",
  steps:[
   "Andá a Compras y recepción (o Verdulería y frescos si es fruta/verdura).",
   "En la fila del lote afectado tocá «Merma / regalo / apertura».",
   "Elegí Merma (o Regalo), cargá la cantidad exacta y el motivo, y guardá.",
  ],
  whatHappens:"El stock del lote baja al instante, queda auditado quién lo registró y Finanzas suma ese costo al bloque de Pérdidas / mermas del período.",
  actions:[
   {label:"Ir a lotes en Inventario",href:"/inventario"},
   {label:"Ir a Verdulería",href:"/verduleria"},
  ],
 },
 {
  id:"no-aparece-en-caja",
  category:"Caja y ventas",
  icon:"search",
  question:"Busco un producto en Caja y no aparece (o dice «En otra sucursal»)",
  keywords:"no aparece no busca producto vacio sin stock otra sucursal caja pos aceite lote",
  routes:["/pos","/catalogo","/inventario","/stock","/"],
  quickAnswer:"Cada caja vende solo los lotes Disponibles de LA SUCURSAL donde abriste ese turno.",
  steps:[
   "Mirá en la barra oscura de arriba en Caja qué sucursal dice junto a «Caja abierta».",
   "Si buscaste el producto y aparece etiquetado «En otra sucursal», cerrá el turno con «Realizar arqueo» y abrí turno en la sucursal donde está el stock.",
   "Si el stock sí está en esta sucursal, revisá en Inventario que el lote no esté vencido o en «Revisar calidad».",
  ],
  whatHappens:"Nunca mezclás stock de dos locales por error. Podés verificar al toque desde el catálogo en qué depósito está cada unidad.",
  actions:[
   {label:"Abrir Terminal de caja",href:"/pos"},
   {label:"Revisar lotes por sucursal",href:"/inventario"},
  ],
 },
 {
  id:"cobrar-pago-mixto",
  category:"Caja y ventas",
  icon:"creditCard",
  question:"¿Cómo cobro con efectivo, tarjeta o pago mixto (dos medios)?",
  keywords:"cobrar pos pago mixto efectivo debito credito transferencia vuelto billete",
  routes:["/pos","/ventas"],
  quickAnswer:"En el panel derecho de Caja elegís el medio o «Pago mixto» para repartir el total entre varios medios.",
  steps:[
   "Cargá los productos escaneando, buscando o tocando las tarjetas del panel izquierdo.",
   "En el panel derecho elegí cliente (opcional) y tocá Efectivo, Débito, Crédito, Transferencia o Pago mixto.",
   "En Efectivo podés tocar «Exacto» o los botones de billetes rápidos; en Pago mixto completá cada medio hasta cubrir el total.",
   "Tocá «Confirmar venta» (o F12) para emitir el ticket.",
  ],
  whatHappens:"Calcula el vuelto automáticamente, descuenta los lotes por FEFO, aplica promos/combos vigentes y suma la venta al turno abierto.",
  actions:[
   {label:"Ir a Terminal de caja",href:"/pos"},
  ],
 },
 {
  id:"devolucion-anulacion",
  category:"Caja y ventas",
  icon:"refresh",
  question:"¿Cómo hago una devolución parcial o anulo un ticket equivocado?",
  keywords:"devolucion anular cancelar ticket error reintegro devolver dinero plata",
  routes:["/ventas","/pos","/finanzas","/auditoria"],
  quickAnswer:"Nunca borres nada manual: desde Ventas podés anular un ticket completo o devolver solo los ítems que trajo el cliente.",
  steps:[
   "Entrá a Ventas y anulaciones y ubicá la operación por fecha, hora o cliente.",
   "Si el ticket entero estuvo mal, usá «Anular» indicando el motivo y el reintegro.",
   "Si devolvió solo parte de la compra, entrá a «Devolución», elegí ítem/cantidad y si vuelve a Disponible o Revisar calidad.",
  ],
  whatHappens:"El stock reingresa trazado y, si devolviste efectivo en el turno actual, el sistema ajusta automáticamente el efectivo esperado de caja.",
  actions:[
   {label:"Ir a Ventas y anulaciones",href:"/ventas"},
  ],
 },
 {
  id:"balanza-plu",
  category:"Caja y ventas",
  icon:"barcode",
  question:"¿Cómo configuro y uso códigos de balanza (PLU por peso)?",
  keywords:"balanza plu peso etiqueta codigo barras 5 digitos prefijo configuracion kg",
  routes:["/configuracion","/catalogo","/pos","/inventario"],
  quickAnswer:"Definís el prefijo de tu balanza en Perfil del comercio y el código PLU de 5 dígitos en cada producto por kilogramo.",
  steps:[
   "Entrá a Perfil del comercio y configurá el «Prefijo de balanza» (los 2 primeros dígitos de tus etiquetas de balanza).",
   "En Productos e inventario, editá cada producto por kg y cargale su «PLU de peso» (exacto 5 dígitos).",
   "Al escanear la etiqueta en Caja, el lector decodifica el producto y el peso exacto en gramos automáticamente.",
  ],
  whatHappens:"No tenés que tipear gramos a mano en Caja y el ticket factura al centavo exacto según el precio por kg.",
  actions:[
   {label:"Configurar prefijo de balanza",href:"/configuracion"},
   {label:"Ir a Productos",href:"/catalogo"},
  ],
 },
 {
  id:"promos-combos-clientes",
  category:"Caja y ventas",
  icon:"tag",
  question:"¿Cómo armo ofertas 2x1, descuentos por cantidad, combos o puntos de socios?",
  keywords:"promo promocion oferta 2x1 3x2 descuento combo paquete cliente socio puntos canje",
  routes:["/promociones","/combos","/clientes","/pos"],
  quickAnswer:"Configurás las reglas una vez en Promociones, Combos o Clientes y la Caja las calcula sola al escanear.",
  steps:[
   "Promociones: creá % de descuento (opcional desde cierta cantidad o atado a un lote por vencer) o modalidad NxM (llevá 3 pagá 2).",
   "Combos: armá un pack con varios artículos y un precio especial vigente entre fechas.",
   "Clientes: cargá socios con código; al seleccionarlos en Caja aplican su descuento y suman puntos canjeables luego en Clientes.",
  ],
  whatHappens:"En Caja se elige automáticamente el beneficio que más conviene al cliente sin duplicar descuentos encima de otro.",
  actions:[
   {label:"Ir a Promociones",href:"/promociones"},
   {label:"Ir a Combos",href:"/combos"},
   {label:"Ir a Clientes",href:"/clientes"},
  ],
 },
 {
  id:"traslados-y-conteos",
  category:"Control y plata",
  icon:"layers",
  question:"¿Cómo paso mercadería a otra sucursal o corrijo un conteo físico?",
  keywords:"traslado mover otra sucursal conteo fisico ajuste diferencia inventario deposito",
  routes:["/stock","/reposicion","/inventario","/administracion"],
  quickAnswer:"En Conteos y traslados podés ajustar la cantidad real que contaste o enviar mercadería de un local a otro.",
  steps:[
   "Entrá a Conteos y traslados y buscá el lote o producto.",
   "Si el conteo físico en góndola no coincide con el sistema, tocá «Registrar conteo» y poné la cantidad real encontrada.",
   "Para mandar unidades a otra sucursal, tocá «Trasladar» indicando destino, cantidad y motivo.",
  ],
  whatHappens:"El traslado mantiene el costo y vencimiento originales. Por control, los sobrantes y traslados ingresan en destino como «Revisar calidad» para validar la llegada.",
  actions:[
   {label:"Ir a Conteos y traslados",href:"/stock"},
   {label:"Ver Reposición",href:"/reposicion"},
  ],
 },
 {
  id:"abrir-cerrar-caja",
  category:"Control y plata",
  icon:"wallet",
  question:"¿Cómo abro turno, registro retiros/ingresos y hago el cierre (arqueo)?",
  keywords:"abrir cerrar caja arqueo fondo inicial retiro ingreso plata diferencia cierre turno",
  routes:["/pos","/","/finanzas"],
  quickAnswer:"Abrís con el cambio inicial en Caja, registrás entradas o salidas de plata si sacás cambio, y al terminar cerrás contando los billetes.",
  steps:[
   "En Terminal de caja elegí tu sucursal, poné el Fondo inicial ($) en billetes y abrí caja.",
   "Si agregás cambio o sacás efectivo para un pago menor, usá el botón «Ingreso / retiro» en la barra oscura de arriba.",
   "Al terminar el turno tocá «Realizar arqueo», contá el efectivo real del cajón, cargalo y confirmá «Cerrar caja».",
  ],
  whatHappens:"El sistema compara Efectivo esperado (fondo + cobros efectivo + ingresos − retiros − devoluciones en efectivo) contra lo que contaste y genera el comprobante de cierre imprimible.",
  actions:[
   {label:"Ir a Terminal de caja",href:"/pos"},
  ],
 },
 {
  id:"compras-vs-ganancia",
  category:"Control y plata",
  icon:"chart",
  question:"¿Por qué una compra de mercadería no se resta de la ganancia del día en Finanzas?",
  keywords:"finanzas ganancia margen costo compra no resta plata resultado neto gastos",
  routes:["/finanzas","/informes","/inventario"],
  quickAnswer:"Porque comprar mercadería la convierte en inventario (activo), no en pérdida: el costo recién se descuenta a medida que la vendés.",
  steps:[
   "Al recibir un lote de $ 100.000, ese dinero pasa a valor de stock en Inventario.",
   "Cada vez que vendés un producto de ese lote, el sistema descuenta el costo exacto de las unidades vendidas para calcular tu Ganancia bruta.",
   "Los gastos que SÍ restan directo del resultado son los Gastos operativos (alquiler, luz, fletes, sueldos) y las Mermas.",
  ],
  whatHappens:"Así evitás el error clásico de perder plata en los papeles el día que comprás mercadería para todo el mes y parecer hiper rentable cuando vendés sin reponer.",
  actions:[
   {label:"Abrir Finanzas",href:"/finanzas"},
   {label:"Abrir Informes",href:"/informes"},
  ],
 },
 {
  id:"sucursales-y-usuarios",
  category:"Control y plata",
  icon:"users",
  question:"¿Cómo creo otra sucursal o usuarios para cajeros y encargados?",
  keywords:"sucursal nueva empleado usuario cajero encargado inventario rol permisos clave",
  routes:["/administracion","/configuracion","/"],
  quickAnswer:"Desde Sucursales y equipo creás nuevos locales y das de alta a tu equipo con permisos limitados a su rol.",
  steps:[
   "Entrá a Sucursales y equipo (visible solo para Propietario).",
   "Creá primero las sucursales o depósitos con «+ Nueva sucursal».",
   "Agregá cada persona con correo, clave inicial y rol: Cajero (solo Terminal de caja), Inventario, Encargado o Propietario.",
  ],
  whatHappens:"Un Cajero entra directo a vender sin ver ni tocar costos, compras o finanzas. Podés cambiar roles, restablecer claves o revocar accesos cuando quieras.",
  actions:[
   {label:"Ir a Sucursales y equipo",href:"/administracion"},
  ],
 },
];

export function matchAssistantQuestions(query:string,currentRoute:string):{
 contextual:AssistantQA[];
 all:AssistantQA[];
}{
 const clean=currentRoute.split("?")[0]||"/";
 const q=query.trim().toLocaleLowerCase("es-AR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 const tokens=q.split(/\s+/).filter(Boolean);

 const score=(item:AssistantQA)=>{
  if(!tokens.length)return 0;
  const hay=[item.question,item.keywords,item.quickAnswer,item.category,...item.steps]
   .join(" ")
   .toLocaleLowerCase("es-AR")
   .normalize("NFD")
   .replace(/[\u0300-\u036f]/g,"");
  return tokens.every(t=>hay.includes(t))?1:0;
 };

 const filtered=tokens.length?ASSISTANT_QUESTIONS.filter(i=>score(i)>0):ASSISTANT_QUESTIONS;
 const contextual=ASSISTANT_QUESTIONS.filter(
  item=>item.routes.some(r=>r===clean||(r!=="/"&&clean.startsWith(r)))
 );
 return {
  contextual:contextual.length?contextual.slice(0,4):ASSISTANT_QUESTIONS.slice(0,4),
  all:filtered,
 };
}
