import Link from "next/link";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {classifyLot} from "../../src/domain/inventory.mjs";
import {localDay} from "../../src/domain/parse.mjs";
import {Shell,amount,money,states,sectors} from "../ui";
import {PageHeader,KpiCard,SectionCard,EmptyState,InfoCallout,formatMoney} from "../components/retail-ui";
import {Icon} from "../components/icons";
import Refresh from "./refresh";

export const dynamic="force-dynamic";

export default async function Page({
 searchParams,
}:{
 searchParams:Promise<{branch?:string;sector?:string;state?:string}>;
}){
 const s=await requireSession();
 if(s.role==="CASHIER")return <Shell title="Alertas"/>;

 const query=await searchParams;
 const today=localDay();
 const tenantId=s.tenantId;

 const [lots,branches]=await Promise.all([
  db.lot.findMany({where:{tenantId,quantityMilli:{gt:0n}},include:{product:true,branch:true},orderBy:[{expiresOn:"asc"},{receivedAt:"asc"}]}),
  db.branch.findMany({where:{tenantId},orderBy:{name:"asc"}}),
 ]);

 const all=lots
  .map(l=>{
   const expiry=l.expiresOn?.toISOString().slice(0,10)??null;
   const review=l.reviewAt?localDay(l.reviewAt):null;
   const state=classifyLot({today,expiresOn:expiry,reviewOn:review,alertDays:l.product.alertDays,status:l.status,quantityMilli:l.quantityMilli});
   const reason=
    state==="BLOCKED"
     ?expiry&&expiry<=today?"Vencimiento alcanzado":"Bloqueo manual"
     :state==="REVIEW"
      ?review&&review<=today?"Control de frescura pendiente":"Revisión manual pendiente"
      :"Vence dentro del plazo de aviso";
   return {l,state,expiry,review,reason};
  })
  .filter(x=>["BLOCKED","REVIEW","EXPIRING"].includes(x.state));

 const priority:Record<string,number>={BLOCKED:0,REVIEW:1,EXPIRING:2};
 const filtered=all
  .filter(x=>(!query.branch||x.l.branchId===query.branch)&&(!query.sector||x.l.product.sector===query.sector)&&(!query.state||x.state===query.state))
  .sort((a,b)=>priority[a.state]-priority[b.state]||(a.expiry??"9999").localeCompare(b.expiry??"9999"));

 const metrics=["BLOCKED","REVIEW","EXPIRING"].map(k=>({
  k,
  count:all.filter(x=>x.state===k).length,
  value:all.filter(x=>x.state===k).reduce((sum,x)=>sum+x.l.remainingCostCents,0n),
 }));

 return (
  <Shell title="Centro de alertas">
   <PageHeader
    kicker="Seguridad de mercadería"
    title="Centro de alertas"
    subtitle="Vencimientos próximos, controles de frescura y lotes bloqueados."
    actions={<Refresh/>}
   />

   <div className="om-kpi-grid">
    {metrics.map(m=>(
     <KpiCard
      key={m.k}
      label={states[m.k]}
      value={`${m.count} lotes`}
      hint={"Valor: "+formatMoney(m.value)}
      icon={m.k==="BLOCKED"?"alert":"clock"}
      tone={m.k==="BLOCKED"?"danger":"warning"}
     />
    ))}
    <KpiCard
     label="Capital sujeto a atención"
     value={formatMoney(metrics.reduce((a,m)=>a+m.value,0n))}
     hint="Costo total en lotes con alerta"
     icon="wallet"
     tone="brand"
    />
   </div>

   <SectionCard
    title="Mercadería que requiere acción"
    subtitle={`Actualización automática cada minuto · Última consulta ${new Date().toLocaleTimeString("es-AR",{timeZone:"America/Argentina/Buenos_Aires",hour:"2-digit",minute:"2-digit"})}`}
    icon="bell"
   >
    <form method="get" className="v2-toolbar">
     <select name="branch" aria-label="Sucursal" defaultValue={query.branch??""}>
      <option value="">Todas las sucursales</option>
      {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
     </select>
     <select name="sector" aria-label="Sector" defaultValue={query.sector??""}>
      <option value="">Todos los sectores</option>
      {Object.entries(sectors).map(([k,v])=><option key={k} value={k}>{v}</option>)}
     </select>
     <select name="state" aria-label="Estado" defaultValue={query.state??""}>
      <option value="">Todos los estados</option>
      {metrics.map(m=><option key={m.k} value={m.k}>{states[m.k]}</option>)}
     </select>
     <button className="secondary">
      <Icon name="filter" size={15}/>
      <span>Filtrar</span>
     </button>
    </form>

    <div className="om-card__body--pad" style={{paddingBottom:0}}>
     <InfoCallout icon="info">
      Los avisos apoyan el control operativo diario; no certifican aptitud bromatológica ni reemplazan la inspección física.
     </InfoCallout>
    </div>

    {filtered.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Producto / lote</th>
         <th>Sucursal</th>
         <th>Estado y motivo</th>
         <th>Revisión / vencimiento</th>
         <th>Stock</th>
         <th>Valor</th>
         <th>Acción</th>
        </tr>
       </thead>
       <tbody>
        {filtered.map(({l,state,reason,review,expiry})=>(
         <tr key={l.id}>
          <td>
           <strong>{l.product.name}</strong>
           <small className="mono">{l.code}</small>
          </td>
          <td>{l.branch.name}</td>
          <td>
           <span className={"status "+state}>{states[state]}</span>
           <small>{reason}</small>
          </td>
          <td className="mono">
           {review??"—"}
           <small>Vence: {expiry??"Sin fecha"}</small>
          </td>
          <td className="mono"><strong>{amount(l.quantityMilli,l.product.unit)}</strong></td>
          <td className="mono">{money(l.remainingCostCents)}</td>
          <td>
           <div className="om-row-actions">
            <Link className="om-link-chip" href={"/inventario?lot="+encodeURIComponent(l.id)}>Gestionar lote</Link>
            {state==="EXPIRING"&&["OWNER","MANAGER"].includes(s.role)&&(
             <Link className="om-link-chip" href={"/promociones?lot="+encodeURIComponent(l.id)}>Crear promoción</Link>
            )}
           </div>
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="check" title="Sin alertas con estos filtros" description="No hay lotes vencidos, en revisión ni próximos a vencer para la selección actual."/>
    )}
   </SectionCard>
  </Shell>
 );
}
