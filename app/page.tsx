import Link from "next/link";
import {redirect} from "next/navigation";
import {Prisma} from "@prisma/client";
import {showTransform} from "../src/domain/settings.mjs";
import {db} from "../src/server/db";
import {requireSession} from "../src/server/auth";
import {localDay} from "../src/domain/parse.mjs";
import {periodBounds} from "../src/domain/finance.mjs";
import {balances} from "../src/server/product-balance";
import {Shell,sectors} from "./ui";
import {PageHead,Card,Metric,Attention,formatMoney} from "./v2";
export const dynamic="force-dynamic";
type Hour={hour:number;amount:bigint};
type SectorTotal={sector:string;amount:bigint};
export default async function Home({searchParams}:{searchParams:Promise<{branch?:string}>}){
 const s=await requireSession();if(s.role==="CASHIER")redirect("/pos");
 const manager=["OWNER","MANAGER"].includes(s.role),tenantId=s.tenantId,today=localDay(),{start,end}=periodBounds(today,today),time={gte:start,lt:end};
 const q=await searchParams,branches=await db.branch.findMany({where:{tenantId},orderBy:{name:"asc"}});
 const branch=branches.find(b=>b.id===q.branch)?.id,where={tenantId,...(branch?{branchId:branch}:{})},shiftWhere=branch?{shift:{branchId:branch}}:{};
 const sqlBranch=branch?Prisma.sql`AND sh."branchId"=${branch}`:Prisma.empty;
 const [products,lots,targets,sales,returns,hours,sectorRows,shifts,members,shiftSales,shiftReturns]=await db.$transaction(async tx=>Promise.all([
 tx.product.findMany({where:{tenantId,active:true},select:{id:true,sector:true}}),
 tx.lot.findMany({where:{...where,quantityMilli:{gt:0n}},include:{product:{select:{active:true,alertDays:true,sector:true}}}}),
 tx.stockTarget.findMany({where:{...where,product:{active:true}}}),
 manager?tx.sale.aggregate({where:{tenantId,...shiftWhere,createdAt:time,cancellation:null},_sum:{totalCents:true,costCents:true},_count:true}):Promise.resolve(null),
 manager?tx.saleReturn.aggregate({where:{tenantId,...shiftWhere,createdAt:time},_sum:{refundCents:true,costCents:true}}):Promise.resolve(null),
 manager?tx.$queryRaw<Hour[]>`
 WITH activity AS (
 SELECT sa."createdAt" event_at,sa."totalCents" amount FROM "Sale" sa JOIN "CashShift" sh ON sh."tenantId"=sa."tenantId" AND sh.id=sa."shiftId" LEFT JOIN "SaleCancellation" c ON c."tenantId"=sa."tenantId" AND c."saleId"=sa.id WHERE sa."tenantId"=${tenantId} AND sa."createdAt">=${start} AND sa."createdAt"<${end} AND c.id IS NULL ${sqlBranch}
 UNION ALL SELECT r."createdAt",-r."refundCents" FROM "SaleReturn" r JOIN "CashShift" sh ON sh."tenantId"=r."tenantId" AND sh.id=r."shiftId" WHERE r."tenantId"=${tenantId} AND r."createdAt">=${start} AND r."createdAt"<${end} ${sqlBranch})
 SELECT EXTRACT(HOUR FROM (event_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires'))::int AS "hour",SUM(amount)::bigint amount FROM activity GROUP BY 1 ORDER BY 1`:Promise.resolve([] as Hour[]),
 manager?tx.$queryRaw<SectorTotal[]>`
 WITH activity AS (
 SELECT p.sector::text sector,sl."totalCents" amount FROM "SaleLine" sl JOIN "Sale" sa ON sa."tenantId"=sl."tenantId" AND sa.id=sl."saleId" JOIN "CashShift" sh ON sh."tenantId"=sa."tenantId" AND sh.id=sa."shiftId" JOIN "Product" p ON p."tenantId"=sl."tenantId" AND p.id=sl."productId" LEFT JOIN "SaleCancellation" c ON c."tenantId"=sa."tenantId" AND c."saleId"=sa.id WHERE sa."tenantId"=${tenantId} AND sa."createdAt">=${start} AND sa."createdAt"<${end} AND c.id IS NULL ${sqlBranch}
 UNION ALL SELECT p.sector::text,-r."refundCents" FROM "SaleReturn" r JOIN "CashShift" sh ON sh."tenantId"=r."tenantId" AND sh.id=r."shiftId" JOIN "SaleLine" sl ON sl."tenantId"=r."tenantId" AND sl.id=r."saleLineId" JOIN "Product" p ON p."tenantId"=sl."tenantId" AND p.id=sl."productId" WHERE r."tenantId"=${tenantId} AND r."createdAt">=${start} AND r."createdAt"<${end} ${sqlBranch})
 SELECT sector,SUM(amount)::bigint amount FROM activity GROUP BY sector`:Promise.resolve([] as SectorTotal[]),
 manager?tx.cashShift.findMany({where:{...where,OR:[{closedAt:null},{closedAt:time}]},include:{branch:true},orderBy:{openedAt:"desc"}}):Promise.resolve([]),
 manager?tx.membership.findMany({where:{tenantId},include:{user:{select:{email:true}}}}):Promise.resolve([]),
 manager?tx.sale.groupBy({by:["shiftId"],where:{tenantId,...shiftWhere,createdAt:time,cancellation:null},_sum:{totalCents:true}}):Promise.resolve([]),
 manager?tx.saleReturn.groupBy({by:["shiftId"],where:{tenantId,...shiftWhere,createdAt:time},_sum:{refundCents:true}}):Promise.resolve([])
 ] as const),{isolationLevel:"RepeatableRead"});
 const bal=balances(lots,today,localDay),low=targets.filter(t=>(bal.branches.get(t.branchId+":"+t.productId)??0n)<t.minimumMilli).length,empty=products.filter(p=>!(bal.products.get(p.id)?.usable??0n)).length;
 const usableCost=[...bal.products.values()].reduce((a,b)=>a+b.cost,0n),held=[...bal.products.values()].reduce((a,b)=>a+b.heldCost,0n);
 const gross=sales?._sum.totalCents??0n,refund=returns?._sum.refundCents??0n,net=gross-refund,gain=net-(sales?._sum.costCents??0n)+(returns?._sum.costCents??0n),count=sales?._count??0;
 const values=Array.from({length:24},(_,hour)=>hours.find(h=>h.hour===hour)?.amount??0n),max=values.reduce((a,b)=>{const v=b<0n?-b:b;return a>v?a:v;},0n);
 const bySector=Object.entries(sectors).map(([k,name])=>({k,name,value:manager?(sectorRows.find(r=>r.sector===k)?.amount??0n):lots.filter(l=>l.product.sector===k).reduce((a,l)=>a+l.remainingCostCents,0n)})),maxSector=bySector.reduce((a,b)=>{const v=b.value<0n?-b.value:b.value;return a>v?a:v;},0n);
 const branchQuery=branch?"branch="+encodeURIComponent(branch):"",actors=new Map(members.map(m=>[m.userId,m.user.email]));
 const todayByShift=new Map(shiftSales.map(x=>[x.shiftId,x._sum.totalCents??0n]));for(const r of shiftReturns)todayByShift.set(r.shiftId,(todayByShift.get(r.shiftId)??0n)-(r._sum.refundCents??0n));
 return <Shell title="Resumen operativo"><PageHead kicker="Centro de operaciones" title="Resumen del negocio" subtitle={today.split("-").reverse().join("/")+" · Datos registrados del comercio"} actions={<><form method="get" className="v2-filter"><select aria-label="Sucursal" name="branch" defaultValue={branch??""}><option value="">Todas las sucursales</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><button className="secondary">Aplicar</button></form><Link className="actionlink" href="/inventario?view=recepcion">+ Nueva recepción</Link></>}/>
 <div className="v2-grid4">{manager?<><Metric label="Ventas netas" value={formatMoney(net)} hint="Ventas vigentes menos devoluciones de hoy" icon="chart"/><Metric label="Ganancia bruta" value={formatMoney(gain)} hint="Antes de mermas y gastos" icon="wallet"/><Metric label="Tickets vigentes" value={count} hint="Ventas registradas hoy" icon="receipt"/><Metric label="Ticket promedio" value={count?formatMoney(gross/BigInt(count)):"—"} hint="Importe medio de tickets vigentes, sin devoluciones" icon="cart"/></>:<><Metric label="Artículos activos" value={products.length} hint="Catálogo del comercio" icon="box"/><Metric label="Valor de stock apto" value={formatMoney(usableCost)} hint="Costo restante" icon="wallet"/><Metric label="Stock retenido" value={formatMoney(held)} hint="No disponible para venta" icon="warn"/><Metric label="Lotes con stock" value={lots.length} hint="Sucursal seleccionada" icon="box"/></>}</div>
 <div className="v2-dashgrid"><Card title={manager?"Ventas por hora":"Inventario por sector"} subtitle={manager?"Importes netos · hora argentina":"Costos de stock restante"}>{manager?<div className="v2-chart"><div className="v2-chart-axis"><small>{formatMoney(max)}</small><small>{formatMoney(0n)}</small><small>{formatMoney(-max)}</small></div><div className="v2-chart-bars">{values.map((v,i)=><div key={i} title={i+" h · "+formatMoney(v)}><div className="v2-chart-column"><span className={v<0n?"negative":""} style={{height:(max?Number((v<0n?-v:v)*10000n/max)/100:0)/2+"%"}}/></div><small>{i}h</small></div>)}</div></div>:<div className="v2-bars">{bySector.map(r=><div key={r.k}><div><strong>{r.name}</strong><span>{formatMoney(r.value)}</span></div><div className="v2-track"><span style={{width:(maxSector?Number(r.value*10000n/maxSector)/100:0)+"%"}}/></div></div>)}</div>}</Card>
 <Card title="Requiere atención" subtitle="Situación del inventario"><Attention href={"/reposicion?only=low&"+branchQuery} label="Bajo mínimo" hint="Producto y sucursal con objetivo configurado" count={low} icon="box"/><Attention href={"/alertas?state=REVIEW&"+branchQuery} label="Mercadería en revisión" hint="Frescura y calidad" count={bal.counts.REVIEW} icon="warn"/><Attention href={"/alertas?state=BLOCKED&"+branchQuery} label="Lotes bloqueados" hint="No aptos para vender" count={bal.counts.BLOCKED} icon="warn" tone="bad"/><Attention href={"/catalogo?state=empty&"+branchQuery} label="Productos sin stock apto" hint="Catálogo activo" count={empty} icon="box" tone="bad"/>{showTransform(s.profile)&&<Attention href="/transformaciones" label="Producción y frescos" hint="Desposte y fraccionamiento" icon="scale" tone="neutral"/>}</Card></div>
 <div className="v2-dashgrid">{manager?<Card title="Estado de cajas" subtitle="Turnos abiertos o cerrados hoy · ventas netas de hoy" actions={<Link className="actionlink secondarylink" href="/pos">Abrir POS</Link>}><div className="tablewrap"><table><thead><tr><th>Sucursal / turno</th><th>Operador</th><th>Ventas</th><th>Estado</th></tr></thead><tbody>{shifts.map(sh=><tr key={sh.id}><td><strong>{sh.branch.name}</strong><small>{sh.id.slice(0,8)} · {sh.openedAt.toLocaleTimeString("es-AR",{timeZone:"America/Argentina/Buenos_Aires",hour:"2-digit",minute:"2-digit"})}</small></td><td>{actors.get(sh.actorId)??sh.actorId.slice(0,8)}</td><td>{formatMoney(todayByShift.get(sh.id)??0n)}</td><td><span className={"status "+(sh.closedAt?"EXHAUSTED":"AVAILABLE")}>{sh.closedAt?"Cerrada":"Abierta"}</span></td></tr>)}</tbody></table></div>{!shifts.length&&<p className="empty">No hay turnos abiertos ni cierres de hoy.</p>}</Card>:<Card title="Accesos operativos"><Attention href="/inventario" label="Compras y recepción" hint="Registrar mercadería" icon="truck"/><Attention href="/stock" label="Conteo y traslado" hint="Control físico" icon="box"/><Attention href="/trazabilidad" label="Historial de lotes" hint="Consultar movimientos" icon="receipt"/></Card>}
 <Card title={manager?"Ventas por sector":"Control de mercadería"} subtitle={manager?"Importe neto del día":"Valor de costo restante"}><div className="v2-bars">{manager?bySector.map(r=><div key={r.k}><div><strong>{r.name}</strong><span>{formatMoney(r.value)}</span></div><div className="v2-track"><span className={r.value<0n?"negative":""} style={{width:(maxSector?Number((r.value<0n?-r.value:r.value)*10000n/maxSector)/100:0)+"%"}}/></div></div>):<><p>Stock apto: {formatMoney(usableCost)}</p><p>Retenido: {formatMoney(held)}</p></>}</div></Card></div>
 </Shell>;
}
