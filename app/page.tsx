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
import {PageHeader,KpiCard,SectionCard,AttentionItem,EmptyState,formatMoney,sectorIcons} from "./components/retail-ui";
import {Icon} from "./components/icons";

export const dynamic="force-dynamic";

type Hour={hour:number;amount:bigint};
type SectorTotal={sector:string;amount:bigint};

export default async function Home({searchParams}:{searchParams:Promise<{branch?:string}>}){
 const s=await requireSession();
 if(s.role==="CASHIER")redirect("/pos");

 const manager=["OWNER","MANAGER"].includes(s.role);
 const tenantId=s.tenantId;
 const today=localDay();
 const {start,end}=periodBounds(today,today);
 const time={gte:start,lt:end};
 const q=await searchParams;

 const branches=await db.branch.findMany({where:{tenantId},orderBy:{name:"asc"}});
 const branch=branches.find(b=>b.id===q.branch)?.id;
 const where={tenantId,...(branch?{branchId:branch}:{})};
 const shiftWhere=branch?{shift:{branchId:branch}}:{};
 const sqlBranch=branch?Prisma.sql`AND sh."branchId"=${branch}`:Prisma.empty;

 const [products,lots,targets,sales,returns,hours,sectorRows,shifts,members,shiftSales,shiftReturns]=await db.$transaction(
  async tx=>Promise.all([
   tx.product.findMany({where:{tenantId,active:true},select:{id:true,sector:true}}),
   tx.lot.findMany({where:{...where,quantityMilli:{gt:0n}},include:{product:{select:{active:true,alertDays:true,sector:true}}}}),
   tx.stockTarget.findMany({where:{...where,product:{active:true}}}),
   manager?tx.sale.aggregate({where:{tenantId,...shiftWhere,createdAt:time,cancellation:null},_sum:{totalCents:true,costCents:true},_count:true}):Promise.resolve(null),
   manager?tx.saleReturn.aggregate({where:{tenantId,...shiftWhere,createdAt:time},_sum:{refundCents:true,costCents:true}}):Promise.resolve(null),
   manager?tx.$queryRaw<Hour[]>`
    WITH activity AS (
     SELECT sa."createdAt" event_at,sa."totalCents" amount
     FROM "Sale" sa
     JOIN "CashShift" sh ON sh."tenantId"=sa."tenantId" AND sh.id=sa."shiftId"
     LEFT JOIN "SaleCancellation" c ON c."tenantId"=sa."tenantId" AND c."saleId"=sa.id
     WHERE sa."tenantId"=${tenantId} AND sa."createdAt">=${start} AND sa."createdAt"<${end} AND c.id IS NULL ${sqlBranch}
     UNION ALL
     SELECT r."createdAt",-r."refundCents"
     FROM "SaleReturn" r
     JOIN "CashShift" sh ON sh."tenantId"=r."tenantId" AND sh.id=r."shiftId"
     WHERE r."tenantId"=${tenantId} AND r."createdAt">=${start} AND r."createdAt"<${end} ${sqlBranch}
    )
    SELECT EXTRACT(HOUR FROM (event_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires'))::int AS "hour",SUM(amount)::bigint amount
    FROM activity GROUP BY 1 ORDER BY 1`:Promise.resolve([] as Hour[]),
   manager?tx.$queryRaw<SectorTotal[]>`
    WITH activity AS (
     SELECT p.sector::text sector,sl."totalCents" amount
     FROM "SaleLine" sl
     JOIN "Sale" sa ON sa."tenantId"=sl."tenantId" AND sa.id=sl."saleId"
     JOIN "CashShift" sh ON sh."tenantId"=sa."tenantId" AND sh.id=sa."shiftId"
     JOIN "Product" p ON p."tenantId"=sl."tenantId" AND p.id=sl."productId"
     LEFT JOIN "SaleCancellation" c ON c."tenantId"=sa."tenantId" AND c."saleId"=sa.id
     WHERE sa."tenantId"=${tenantId} AND sa."createdAt">=${start} AND sa."createdAt"<${end} AND c.id IS NULL ${sqlBranch}
     UNION ALL
     SELECT p.sector::text,-r."refundCents"
     FROM "SaleReturn" r
     JOIN "CashShift" sh ON sh."tenantId"=r."tenantId" AND sh.id=r."shiftId"
     JOIN "SaleLine" sl ON sl."tenantId"=r."tenantId" AND sl.id=r."saleLineId"
     JOIN "Product" p ON p."tenantId"=sl."tenantId" AND p.id=sl."productId"
     WHERE r."tenantId"=${tenantId} AND r."createdAt">=${start} AND r."createdAt"<${end} ${sqlBranch}
    )
    SELECT sector,SUM(amount)::bigint amount FROM activity GROUP BY sector`:Promise.resolve([] as SectorTotal[]),
   manager?tx.cashShift.findMany({where:{...where,OR:[{closedAt:null},{closedAt:time}]},include:{branch:true},orderBy:{openedAt:"desc"}}):Promise.resolve([]),
   manager?tx.membership.findMany({where:{tenantId},include:{user:{select:{email:true}}}}):Promise.resolve([]),
   manager?tx.sale.groupBy({by:["shiftId"],where:{tenantId,...shiftWhere,createdAt:time,cancellation:null},_sum:{totalCents:true}}):Promise.resolve([]),
   manager?tx.saleReturn.groupBy({by:["shiftId"],where:{tenantId,...shiftWhere,createdAt:time},_sum:{refundCents:true}}):Promise.resolve([]),
  ] as const),
  {isolationLevel:"RepeatableRead"}
 );

 const bal=balances(lots,today,localDay);
 const low=targets.filter(t=>(bal.branches.get(t.branchId+":"+t.productId)??0n)<t.minimumMilli).length;
 const empty=products.filter(p=>!(bal.products.get(p.id)?.usable??0n)).length;
 const usableCost=[...bal.products.values()].reduce((a,r)=>a+r.cost,0n);
 const held=[...bal.products.values()].reduce((a,r)=>a+r.heldCost,0n);
 const gross=sales?._sum.totalCents??0n;
 const net=gross-(returns?._sum.refundCents??0n);
 const gain=net-((sales?._sum.costCents??0n)-(returns?._sum.costCents??0n));
 const count=sales?._count??0;
 const marginPct=net>0n?Number((gain*1000n)/net)/10:null;

 const byHour=new Map(hours.map(h=>[h.hour,h.amount]));
 const values=Array.from({length:24},(_,h)=>byHour.get(h)??0n);
 const max=values.reduce((m,v)=>{const a=v<0n?-v:v;return a>m?a:m;},0n);

 const sectorAmounts=new Map(sectorRows.map(r=>[r.sector,r.amount]));
 const stockBySector=new Map<string,bigint>();
 for(const l of lots){
  if(!l.product.active)continue;
  stockBySector.set(l.product.sector,(stockBySector.get(l.product.sector)??0n)+l.remainingCostCents);
 }
 const bySector=Object.entries(sectors).map(([k,name])=>({k,name,value:manager?(sectorAmounts.get(k)??0n):(stockBySector.get(k)??0n)}));
 const maxSector=bySector.reduce((m,r)=>{const a=r.value<0n?-r.value:r.value;return a>m?a:m;},0n);

 const actors=new Map(members.map(m=>[m.userId,m.user.email]));
 const todayByShift=new Map<string,bigint>();
 for(const r of shiftSales)todayByShift.set(r.shiftId,r._sum.totalCents??0n);
 for(const r of shiftReturns)todayByShift.set(r.shiftId,(todayByShift.get(r.shiftId)??0n)-(r._sum.refundCents??0n));
 const branchQuery=branch?"branch="+encodeURIComponent(branch):"";

 return (
  <Shell title="Resumen operativo">
   <PageHeader
    kicker={branches.find(b=>b.id===branch)?.name??"Todas las sucursales"}
    title="Resumen del negocio"
    subtitle={`Operación diaria del ${today.split("-").reverse().join("/")} · indicadores reales del comercio`}
    actions={
     <>
      <form method="get" className="om-filter-bar">
       <select aria-label="Sucursal" name="branch" defaultValue={branch??""}>
        <option value="">Todas las sucursales</option>
        {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
       </select>
       <button className="secondary">
        <Icon name="filter" size={15}/>
        <span>Aplicar</span>
       </button>
      </form>
      <Link className="actionlink" href="/inventario?view=recepcion">
       <Icon name="plus" size={15}/>
       <span>Nueva recepción</span>
      </Link>
     </>
    }
   />

   <div className="om-kpi-grid">
    {manager?(
     <>
      <KpiCard label="Ventas netas" value={formatMoney(net)} hint="Ventas vigentes menos devoluciones de hoy" icon="chart" tone="brand"/>
      <KpiCard label="Ganancia bruta" value={formatMoney(gain)} hint={marginPct!==null?`Margen bruto ${marginPct.toLocaleString("es-AR")}% · antes de gastos`:"Antes de mermas y gastos"} icon="wallet" tone="success"/>
      <KpiCard label="Tickets vigentes" value={count} hint="Comprobantes emitidos hoy" icon="receipt"/>
      <KpiCard label="Ticket promedio" value={count?formatMoney(gross/BigInt(count)):"—"} hint="Promedio por ticket vigente" icon="cart"/>
     </>
    ):(
     <>
      <KpiCard label="Artículos activos" value={products.length} hint="Catálogo habilitado" icon="box" tone="brand"/>
      <KpiCard label="Valor de stock apto" value={formatMoney(usableCost)} hint="Costo restante disponible" icon="wallet" tone="success"/>
      <KpiCard label="Stock retenido" value={formatMoney(held)} hint="En revisión o bloqueado" icon="alert" tone="warning"/>
      <KpiCard label="Lotes con stock" value={lots.length} hint="Sucursal seleccionada" icon="layers"/>
     </>
    )}
   </div>

   <div className="om-dashgrid">
    <SectionCard
     title={manager?"Ventas por hora":"Valor de stock por sector"}
     subtitle={manager?"Importes netos en hora argentina (0h–23h)":"Costo restante de mercadería activa"}
     icon={manager?"chart":"box"}
    >
     {manager?(
      <div className="om-chart">
       <div className="om-chart__axis">
        <small>{formatMoney(max)}</small>
        <small>{formatMoney(0n)}</small>
        <small>{formatMoney(-max)}</small>
       </div>
       <div className="om-chart__bars">
        {values.map((v,i)=>(
         <div key={i} className="om-chart__col" title={`${i} h · ${formatMoney(v)}`}>
          <div className="om-chart__track">
           <span className={v<0n?"negative":""} style={{height:(max?Number((v<0n?-v:v)*10000n/max)/100:0)/2+"%"}}/>
          </div>
          <small>{i}h</small>
         </div>
        ))}
       </div>
      </div>
     ):(
      <div className="om-bars">
       {bySector.map(r=>(
        <div key={r.k} className="om-bars__row">
         <div className="om-bars__meta">
          <strong><Icon name={sectorIcons[r.k]??"box"} size={15}/> {r.name}</strong>
          <span>{formatMoney(r.value)}</span>
         </div>
         <div className="om-bars__track">
          <span style={{width:(maxSector?Number(r.value*10000n/maxSector)/100:0)+"%"}}/>
         </div>
        </div>
       ))}
      </div>
     )}
    </SectionCard>

    <SectionCard title="Requiere atención" subtitle="Cola de prioridades de inventario" icon="bell">
     <AttentionItem href={"/reposicion?only=low&"+branchQuery} label="Bajo mínimo" hint="Por debajo del stock objetivo" count={low} icon="packageCheck"/>
     <AttentionItem href={"/alertas?state=REVIEW&"+branchQuery} label="Mercadería en revisión" hint="Control de frescura o calidad" count={bal.counts.REVIEW} icon="clock"/>
     <AttentionItem href={"/alertas?state=BLOCKED&"+branchQuery} label="Lotes bloqueados" hint="No aptos para vender en POS" count={bal.counts.BLOCKED} icon="alert" tone="bad"/>
     <AttentionItem href={"/catalogo?state=empty&"+branchQuery} label="Productos sin stock apto" hint="Artículos activos agotados" count={empty} icon="box" tone="bad"/>
     {showTransform(s.profile)&&(
      <>
       <AttentionItem href="/transformaciones" label="Producción y frescos" hint="Mesa de desposte y fraccionamiento" icon="scale" tone="neutral"/>
       <AttentionItem href="/verduleria" label="Verdulería y frescos" hint="Inspección diaria y mermas" icon="apple" tone="neutral"/>
      </>
     )}
    </SectionCard>
   </div>

   <div className="om-dashgrid">
    {manager?(
     <SectionCard
      title="Estado de cajas"
      subtitle="Turnos abiertos o cerrados hoy"
      icon="cart"
      actions={
       <Link className="actionlink secondarylink" href="/pos">
        <span>Abrir POS</span>
        <Icon name="arrowUpRight" size={14}/>
       </Link>
      }
     >
      {shifts.length>0?(
       <div className="tablewrap">
        <table>
         <thead>
          <tr>
           <th>Sucursal / turno</th>
           <th>Operador</th>
           <th>Ventas netas</th>
           <th>Estado</th>
          </tr>
         </thead>
         <tbody>
          {shifts.map(sh=>(
           <tr key={sh.id}>
            <td>
             <strong>{sh.branch.name}</strong>
             <small className="mono">
              {sh.id.slice(0,8)} · {sh.openedAt.toLocaleTimeString("es-AR",{timeZone:"America/Argentina/Buenos_Aires",hour:"2-digit",minute:"2-digit"})}
             </small>
            </td>
            <td>{actors.get(sh.actorId)??sh.actorId.slice(0,8)}</td>
            <td className="mono"><strong>{formatMoney(todayByShift.get(sh.id)??0n)}</strong></td>
            <td>
             <span className={"status "+(sh.closedAt?"EXHAUSTED":"AVAILABLE")}>
              {sh.closedAt?"Cerrada":"Abierta"}
             </span>
             {sh.closedAt&&(
              <div style={{marginTop:4}}>
               <Link className="om-link-chip" href={"/pos/cierre/"+sh.id}>Ver cierre</Link>
              </div>
             )}
            </td>
           </tr>
          ))}
         </tbody>
        </table>
       </div>
      ):(
       <EmptyState icon="cart" title="Sin turnos hoy" description="Todavía no se abrieron ni cerraron cajas en el día de hoy."/>
      )}
     </SectionCard>
    ):(
     <SectionCard title="Accesos operativos" subtitle="Tareas frecuentes de depósito" icon="layers">
      <AttentionItem href="/inventario" label="Compras y recepción" hint="Ingresar facturas y lotes" icon="truck" tone="neutral"/>
      <AttentionItem href="/stock" label="Conteo y traslado" hint="Ajustes físicos entre sucursales" icon="layers" tone="neutral"/>
      <AttentionItem href="/trazabilidad" label="Historial de lotes" hint="Seguimiento de movimientos" icon="trace" tone="neutral"/>
     </SectionCard>
    )}

    <SectionCard
     title={manager?"Ventas por sector":"Control de mercadería"}
     subtitle={manager?"Importe neto vendido hoy por área":"Resumen de valuación"}
     icon="tag"
    >
     {manager?(
      <div className="om-bars">
       {bySector.map(r=>(
        <div key={r.k} className="om-bars__row">
         <div className="om-bars__meta">
          <strong><Icon name={sectorIcons[r.k]??"box"} size={15}/> {r.name}</strong>
          <span>{formatMoney(r.value)}</span>
         </div>
         <div className="om-bars__track">
          <span className={r.value<0n?"negative":""} style={{width:(maxSector?Number((r.value<0n?-r.value:r.value)*10000n/maxSector)/100:0)+"%"}}/>
         </div>
        </div>
       ))}
      </div>
     ):(
      <div className="om-card__body--pad">
       <div className="v2-totalline"><span>Stock apto</span><strong>{formatMoney(usableCost)}</strong></div>
       <div className="v2-totalline"><span>Stock retenido</span><strong>{formatMoney(held)}</strong></div>
      </div>
     )}
    </SectionCard>
   </div>
  </Shell>
 );
}
