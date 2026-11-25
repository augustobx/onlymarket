import type {NextRequest} from "next/server";
import type {Sector} from "@prisma/client";
import {db} from "../../../src/server/db";
import {currentSession} from "../../../src/server/auth";
import {localDay} from "../../../src/domain/parse.mjs";
import {periodBounds,summarizeFinance} from "../../../src/domain/finance.mjs";
import {classifyLot} from "../../../src/domain/inventory.mjs";
import {buildCsv,formatCentsCsv,formatMilliCsv} from "../../../src/domain/csv.mjs";
import {sectors} from "../../ui";

export const dynamic="force-dynamic";

const paymentLabels:Record<string,string>={
 CASH:"Efectivo",
 DEBIT:"Débito",
 CREDIT:"Crédito",
 TRANSFER:"Transferencia",
 MIXED:"Mixto",
};

function parseRange(fromParam:string|null,toParam:string|null,defaultFrom:string,defaultTo:string){
 let from=fromParam||defaultFrom;
 let to=toParam||defaultTo;
 try{
  if(from>to){const tmp=from;from=to;to=tmp;}
  return {from,to,range:periodBounds(from,to)};
 }catch{
  return {from:defaultFrom,to:defaultTo,range:periodBounds(defaultFrom,defaultTo)};
 }
}

export async function GET(req:NextRequest){
 const s=await currentSession();
 if(!s)return Response.json({error:"No autenticado"},{status:401,headers:{"Cache-Control":"no-store"}});

 const sp=req.nextUrl.searchParams;
 const type=sp.get("type")??"";
 const today=localDay();

 if(["ventas","informes","finanzas","auditoria","catalogo_plantilla"].includes(type)&&!["OWNER","MANAGER"].includes(s.role)){
  return Response.json({error:"Sin permisos"},{status:403,headers:{"Cache-Control":"no-store"}});
 }
 if(["reposicion","trazabilidad"].includes(type)&&!["OWNER","MANAGER","INVENTORY"].includes(s.role)){
  return Response.json({error:"Sin permisos"},{status:403,headers:{"Cache-Control":"no-store"}});
 }

 let csv="";

 if(type==="ventas"){
  const {range}=parseRange(sp.get("from")??sp.get("date"),sp.get("to")??sp.get("date"),today,today);
  const term=(sp.get("q")??"").trim().slice(0,120).toLowerCase();
  const payment=sp.get("payment")??"";
  const branch=sp.get("branch")??"";
  const [members,sales]=await Promise.all([
   db.membership.findMany({where:{tenantId:s.tenantId},include:{user:{select:{id:true,email:true}}}}),
   db.sale.findMany({
    where:{
     tenantId:s.tenantId,
     createdAt:{gte:range.start,lt:range.end},
     ...(payment&&paymentLabels[payment]?{payment:payment as "CASH"|"DEBIT"|"CREDIT"|"TRANSFER"|"MIXED"}:{}),
     ...(branch?{shift:{branchId:branch}}:{}),
    },
    include:{shift:{include:{branch:true}},customer:{select:{name:true,code:true}},cancellation:true,returns:true},
    orderBy:{createdAt:"desc"},
    take:5000,
   }),
  ]);
  const actors=new Map(members.map(m=>[m.userId,m.user.email]));
  const filtered=term?sales.filter(v=>
   v.id.toLowerCase().includes(term)||
   (v.customer?.name??"").toLowerCase().includes(term)||
   (v.customer?.code??"").toLowerCase().includes(term)||
   (actors.get(v.shift.actorId)??"").toLowerCase().includes(term)
  ):sales;

  csv=buildCsv(
   ["Ticket","Fecha AR","Sucursal","Operador","Socio","Medio de pago","Total ($)","Costo ($)","Ganancia bruta ($)","Estado","Efectivo ($)","Débito ($)","Crédito ($)","Transferencia ($)"],
   filtered.map(v=>[
    v.id.slice(0,8),
    v.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"}),
    v.shift.branch.name,
    actors.get(v.shift.actorId)??v.shift.actorId.slice(0,8),
    v.customer?`${v.customer.name} (${v.customer.code})`:"Consumidor final",
    paymentLabels[v.payment]??v.payment,
    formatCentsCsv(v.totalCents),
    formatCentsCsv(v.costCents),
    formatCentsCsv(v.totalCents-v.costCents),
    v.cancellation?"Anulada":v.returns.length?"Con devoluciones":"Registrada",
    formatCentsCsv(v.cashCents),
    formatCentsCsv(v.debitCents),
    formatCentsCsv(v.creditCents),
    formatCentsCsv(v.transferCents),
   ])
  );
 }else if(type==="informes"){
  const monthStart=today.slice(0,7)+"-01";
  const {range:{start,end}}=parseRange(sp.get("from"),sp.get("to"),monthStart,today);
  const tenant=s.tenantId;
  type Row={name:string;sector:Sector;unit:string;sales:bigint;cost:bigint;waste:bigint;gifts:bigint;quantity:bigint};
  const rows=await db.$queryRaw<Row[]>`
   WITH activity AS (
    SELECT sl."productId",sl."totalCents" sales,sl."costCents" cost,sl."quantityMilli" quantity
    FROM "SaleLine" sl JOIN "Sale" sa ON sa."tenantId"=sl."tenantId" AND sa.id=sl."saleId"
    LEFT JOIN "SaleCancellation" c ON c."tenantId"=sa."tenantId" AND c."saleId"=sa.id
    WHERE sl."tenantId"=${tenant} AND sa."createdAt">=${start} AND sa."createdAt"<${end} AND c.id IS NULL
    UNION ALL
    SELECT sl."productId",-r."refundCents",-r."costCents",-r."quantityMilli"
    FROM "SaleReturn" r JOIN "SaleLine" sl ON sl."tenantId"=r."tenantId" AND sl.id=r."saleLineId"
    WHERE r."tenantId"=${tenant} AND r."createdAt">=${start} AND r."createdAt"<${end}
   ),
   sold AS (SELECT "productId",SUM(sales)::bigint sales,SUM(cost)::bigint cost,SUM(quantity)::bigint quantity FROM activity GROUP BY "productId"),
   losses AS (
    SELECT l."productId",(-SUM(m."deltaCostCents") FILTER(WHERE m.kind='WASTE'))::bigint waste,(-SUM(m."deltaCostCents") FILTER(WHERE m.kind='GIFT'))::bigint gifts
    FROM "StockMovement" m JOIN "Lot" l ON l."tenantId"=m."tenantId" AND l.id=m."lotId"
    WHERE m."tenantId"=${tenant} AND m."createdAt">=${start} AND m."createdAt"<${end} AND m.kind IN ('WASTE','GIFT') GROUP BY l."productId"
   )
   SELECT p.name,p.sector,p.unit,COALESCE(a.sales,0)::bigint sales,COALESCE(a.cost,0)::bigint cost,COALESCE(a.quantity,0)::bigint quantity,
          COALESCE(b.waste,0)::bigint waste,COALESCE(b.gifts,0)::bigint gifts
   FROM "Product" p LEFT JOIN sold a ON a."productId"=p.id LEFT JOIN losses b ON b."productId"=p.id
   WHERE p."tenantId"=${tenant} AND (a."productId" IS NOT NULL OR b."productId" IS NOT NULL) ORDER BY sales DESC,p.name`;

  csv=buildCsv(
   ["Producto","Sector","Unidad","Cantidad neta","Ventas netas ($)","Costo vendido ($)","Mermas ($)","Regalos ($)","Contribución ($)","Margen (%)"],
   rows.map(r=>{
    const contrib=r.sales-r.cost-r.waste-r.gifts;
    const margin=r.sales<=0n?"":(Number((r.sales-r.cost)*10000n/r.sales)/100).toFixed(2).replace(".",",");
    return [
     r.name,
     sectors[r.sector]??r.sector,
     r.unit,
     formatMilliCsv(r.quantity,r.unit),
     formatCentsCsv(r.sales),
     formatCentsCsv(r.cost),
     formatCentsCsv(r.waste),
     formatCentsCsv(r.gifts),
     formatCentsCsv(contrib),
     margin,
    ];
   })
  );
 }else if(type==="finanzas"){
  const monthStart=today.slice(0,7)+"-01";
  const {range}=parseRange(sp.get("from"),sp.get("to"),monthStart,today);
  const where={tenantId:s.tenantId};
  const time={gte:range.start,lt:range.end};
  const dates={gte:range.fromDate,lte:range.toDate};

  const [sales,losses,expenses,purchases,payments,recentExpenses,recentPayments,adjustments,returns]=
   await db.$transaction(
    async tx=>Promise.all([
     tx.sale.aggregate({where:{...where,createdAt:time,cancellation:null},_sum:{totalCents:true,costCents:true}}),
     tx.stockMovement.groupBy({by:["kind"],orderBy:{kind:"asc"},where:{...where,createdAt:time,kind:{in:["WASTE","GIFT"]}},_sum:{deltaCostCents:true}}),
     tx.expense.aggregate({where:{...where,occurredOn:dates},_sum:{amountCents:true}}),
     tx.receipt.aggregate({where:{...where,createdAt:time},_sum:{totalCostCents:true}}),
     tx.supplierPayment.aggregate({where:{...where,occurredOn:dates},_sum:{amountCents:true}}),
     tx.expense.findMany({where:{...where,occurredOn:dates},orderBy:[{occurredOn:"desc"},{createdAt:"desc"}],take:500}),
     tx.supplierPayment.findMany({where:{...where,occurredOn:dates},include:{supplier:true},orderBy:[{occurredOn:"desc"},{createdAt:"desc"}],take:500}),
     tx.$queryRaw<{shortage:bigint;surplus:bigint}[]>`
      SELECT COALESCE(SUM("costCents") FILTER(WHERE "afterMilli"<"beforeMilli"),0)::bigint shortage,
             COALESCE(SUM("costCents") FILTER(WHERE "afterMilli">"beforeMilli"),0)::bigint surplus
      FROM "StockControl" WHERE "tenantId"=${s.tenantId} AND kind='COUNT' AND "createdAt">=${range.start} AND "createdAt"<${range.end}`,
     tx.saleReturn.aggregate({where:{...where,createdAt:time},_sum:{refundCents:true,costCents:true}}),
    ] as const),
    {isolationLevel:"RepeatableRead"}
   );

  const salesTotal=sales._sum.totalCents??0n;
  const cost=sales._sum.costCents??0n;
  const waste=-(losses.find(x=>x.kind==="WASTE")?._sum.deltaCostCents??0n);
  const gifts=-(losses.find(x=>x.kind==="GIFT")?._sum.deltaCostCents??0n);
  const expense=expenses._sum.amountCents??0n;
  const refunds=returns._sum.refundCents??0n;
  const returnedCost=returns._sum.costCents??0n;
  const shortage=adjustments[0]?.shortage??0n;
  const surplus=adjustments[0]?.surplus??0n;
  const report=summarizeFinance({
   sales:salesTotal,
   costOfSales:cost,
   refunds,
   returnedCost,
   waste,
   gifts,
   expenses:expense,
   purchases:purchases._sum.totalCostCents??0n,
   payments:payments._sum.amountCents??0n,
  });

  const exportRows:(string|bigint)[][]=[
   ["Resumen económico","Ventas brutas vigentes","",formatCentsCsv(salesTotal)],
   ["Resumen económico","Devoluciones","",formatCentsCsv(refunds)],
   ["Resumen económico","Ventas netas","",formatCentsCsv(salesTotal-refunds)],
   ["Resumen económico","Costo de ventas neto","",formatCentsCsv(cost-returnedCost)],
   ["Resumen económico","Ganancia bruta","",formatCentsCsv(report.gross)],
   ["Resumen económico","Mermas y descartes","",formatCentsCsv(waste-shortage)],
   ["Resumen económico","Faltantes de inventario","",formatCentsCsv(shortage)],
   ["Resumen económico","Sobrantes valorizados (no ingreso)","",formatCentsCsv(surplus)],
   ["Resumen económico","Regalos","",formatCentsCsv(gifts)],
   ["Resumen económico","Gastos operativos","",formatCentsCsv(expense)],
   ["Resumen económico","Resultado operativo estimado","",formatCentsCsv(report.estimatedOperatingProfit)],
   ["Resumen económico","Compras recibidas","",formatCentsCsv(report.purchases)],
   ["Resumen económico","Pagos a proveedores","",formatCentsCsv(report.payments)],
   ...recentExpenses.map(e=>["Gasto operativo",e.occurredOn.toISOString().slice(0,10),`${e.category} · ${e.description}`,formatCentsCsv(e.amountCents)]),
   ...recentPayments.map(p=>["Pago a proveedor",p.occurredOn.toISOString().slice(0,10),p.supplier.name,formatCentsCsv(p.amountCents)]),
  ];
  csv=buildCsv(["Sección","Concepto / Fecha","Detalle","Importe ($)"],exportRows);
 }else if(type==="reposicion"){
  const branch=sp.get("branch")??"";
  const only=sp.get("only")??"";
  const [targets,lots]=await db.$transaction(
   async tx=>Promise.all([
    tx.stockTarget.findMany({where:{tenantId:s.tenantId,product:{active:true},...(branch?{branchId:branch}:{})},include:{product:true,branch:true},orderBy:[{branch:{name:"asc"}},{product:{name:"asc"}}]}),
    tx.lot.findMany({where:{tenantId:s.tenantId,quantityMilli:{gt:0n},product:{active:true},...(branch?{branchId:branch}:{})},include:{product:true}}),
   ] as const),
   {isolationLevel:"RepeatableRead"}
  );
  const balances=new Map<string,{usable:bigint;held:bigint}>();
  for(const l of lots){
   const key=l.branchId+":"+l.productId;
   const b=balances.get(key)??{usable:0n,held:0n};
   const st=classifyLot({today,expiresOn:l.expiresOn?.toISOString().slice(0,10)??null,reviewOn:l.reviewAt?localDay(l.reviewAt):null,status:l.status,quantityMilli:l.quantityMilli,alertDays:l.product.alertDays});
   if(["AVAILABLE","EXPIRING"].includes(st))b.usable+=l.quantityMilli;
   else b.held+=l.quantityMilli;
   balances.set(key,b);
  }
  const rows=targets.map(t=>{
   const b=balances.get(t.branchId+":"+t.productId)??{usable:0n,held:0n};
   const low=b.usable<t.minimumMilli;
   const suggested=low&&t.targetMilli>b.usable?t.targetMilli-b.usable:0n;
   return {t,b,low,suggested};
  }).filter(r=>only!=="low"||r.low);

  csv=buildCsv(
   ["Producto","Sector","Sucursal","Unidad","Disponible","Retenido","Mínimo","Objetivo","Estado","Sugerencia a reponer"],
   rows.map(r=>[
    r.t.product.name,
    sectors[r.t.product.sector as keyof typeof sectors]??r.t.product.sector,
    r.t.branch.name,
    r.t.product.unit,
    formatMilliCsv(r.b.usable,r.t.product.unit),
    formatMilliCsv(r.b.held,r.t.product.unit),
    formatMilliCsv(r.t.minimumMilli,r.t.product.unit),
    formatMilliCsv(r.t.targetMilli,r.t.product.unit),
    r.low?"Reponer":"Suficiente",
    formatMilliCsv(r.suggested,r.t.product.unit),
   ])
  );
 }else if(type==="auditoria"){
  const monthStart=today.slice(0,7)+"-01";
  const {range}=parseRange(sp.get("from"),sp.get("to"),monthStart,today);
  const term=(sp.get("q")??"").trim().slice(0,120).toLowerCase();
  const time={gte:range.start,lt:range.end};
  const [members,products,changes,cancels,returns]=await Promise.all([
   db.membership.findMany({where:{tenantId:s.tenantId},include:{user:{select:{id:true,email:true}}}}),
   db.product.findMany({where:{tenantId:s.tenantId},select:{id:true,name:true,sku:true}}),
   db.catalogChange.findMany({where:{tenantId:s.tenantId,createdAt:time},orderBy:{createdAt:"desc"},take:1000}),
   db.saleCancellation.findMany({where:{tenantId:s.tenantId,createdAt:time},include:{sale:true},orderBy:{createdAt:"desc"},take:1000}),
   db.saleReturn.findMany({where:{tenantId:s.tenantId,createdAt:time},include:{line:true},orderBy:{createdAt:"desc"},take:1000}),
  ]);
  const actors=new Map(members.map(m=>[m.userId,m.user.email]));
  const prods=new Map(products.map(p=>[p.id,p]));
  const rows:[string,string,string,string,string][]=[
   ...changes.map(c=>[
    c.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"}),
    "Catálogo",
    actors.get(c.actorId)??c.actorId.slice(0,8),
    prods.get(c.productId)?.name??c.productId.slice(0,8),
    `${c.previous} -> ${c.next}`,
   ] as [string,string,string,string,string]),
   ...cancels.map(c=>[
    c.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"}),
    "Anulación",
    actors.get(c.actorId)??c.actorId.slice(0,8),
    c.saleId.slice(0,8),
    `${c.reason} ($ ${formatCentsCsv(c.sale.totalCents)})`,
   ] as [string,string,string,string,string]),
   ...returns.map(r=>[
    r.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"}),
    "Devolución",
    actors.get(r.actorId)??r.actorId.slice(0,8),
    `${r.saleId.slice(0,8)} · ${r.line.productName}`,
    `${r.reason} ($ ${formatCentsCsv(r.refundCents)})`,
   ] as [string,string,string,string,string]),
  ].filter(row=>!term||row.some(v=>v.toLowerCase().includes(term)));
  csv=buildCsv(["Fecha AR","Tipo","Operador","Referencia","Detalle"],rows);
 }else if(type==="trazabilidad"){
  const lotId=(sp.get("lot")??"").trim();
  if(!lotId)return Response.json({error:"Falta parámetro lot"},{status:400,headers:{"Cache-Control":"no-store"}});
  const [lot,members]=await Promise.all([
   db.lot.findUnique({where:{tenantId_id:{tenantId:s.tenantId,id:lotId}},include:{product:true,branch:true,movements:{orderBy:{createdAt:"asc"}}}}),
   db.membership.findMany({where:{tenantId:s.tenantId},include:{user:{select:{id:true,email:true}}}}),
  ]);
  if(!lot)return Response.json({error:"Lote no encontrado"},{status:404,headers:{"Cache-Control":"no-store"}});
  const actors=new Map(members.map(m=>[m.userId,m.user.email]));
  csv=buildCsv(
   ["Fecha AR","Producto","Lote","Sucursal","Movimiento","Cantidad","Costo ($)","Motivo","Responsable"],
   lot.movements.map(m=>[
    m.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"}),
    lot.product.name,
    lot.code,
    lot.branch.name,
    m.kind,
    formatMilliCsv(m.deltaMilli,lot.product.unit),
    formatCentsCsv(m.deltaCostCents),
    m.reason,
    actors.get(m.actorId)??m.actorId.slice(0,8),
   ])
  );
 }else if(type==="catalogo_plantilla"){
  csv=buildCsv(
   ["sku","nombre","codigo_barras","unidad","sector","precio","aviso_dias","frescura_dias","apertura_dias"],
   [
    ["ALM-001","Yerba mate clásica 1kg","7790000000011","UNIT","ALMACEN","3500,00","7","",""],
    ["VER-001","Tomate redondo seleccionado","","KG","VERDULERIA","2200,00","2","3",""],
   ]
  );
 }else{
  return Response.json({error:"Tipo de exportación inválido"},{status:400,headers:{"Cache-Control":"no-store"}});
 }

 return new Response(csv,{
  status:200,
  headers:{
   "Content-Type":"text/csv; charset=utf-8",
   "Content-Disposition":`attachment; filename="onlymarket-${type}-${s.tenantSlug}-${today}.csv"`,
   "Cache-Control":"no-store",
  },
 });
}
