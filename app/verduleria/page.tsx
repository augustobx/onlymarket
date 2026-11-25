import Link from "next/link";
import {randomUUID} from "node:crypto";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {classifyLot} from "../../src/domain/inventory.mjs";
import {localDay} from "../../src/domain/parse.mjs";
import {Operation} from "../operations";
import {Shell,Field,Notice,amount,money,states} from "../ui";
import {PageHeader,KpiCard,SectionCard,EmptyState,InfoCallout,formatMoney} from "../components/retail-ui";
import {Icon} from "../components/icons";
import {reviewProduceAction,wasteProduceAction} from "./actions";

export const dynamic="force-dynamic";

export default async function Page({
 searchParams,
}:{
 searchParams:Promise<{error?:string;ok?:string;branch?:string;state?:string;q?:string}>;
}){
 const s=await requireSession();
 if(s.role==="CASHIER")return <Shell title="Verdulería y frescos"/>;

 const query=await searchParams;
 const term=(query.q??"").trim().slice(0,120);
 const today=localDay();
 const sevenDaysAgo=new Date(Date.now()-7*86400000);

 const [branches,lots,recentLosses]=await Promise.all([
  db.branch.findMany({where:{tenantId:s.tenantId},orderBy:{name:"asc"}}),
  db.lot.findMany({
   where:{
    tenantId:s.tenantId,
    quantityMilli:{gt:0n},
    product:{sector:"PRODUCE"},
    ...(query.branch?{branchId:query.branch}:{}),
    ...(term?{OR:[{code:{contains:term,mode:"insensitive"}},{product:{name:{contains:term,mode:"insensitive"}}},{product:{sku:{contains:term,mode:"insensitive"}}}]}:{}),
   },
   include:{product:true,branch:true,supplier:true},
   orderBy:[{reviewAt:"asc"},{expiresOn:"asc"},{receivedAt:"asc"}],
   take:500,
  }),
  db.stockMovement.findMany({
   where:{
    tenantId:s.tenantId,
    kind:{in:["WASTE","GIFT"]},
    createdAt:{gte:sevenDaysAgo},
    lot:{product:{sector:"PRODUCE"}},
   },
   include:{lot:{include:{product:true,branch:true}}},
   orderBy:{createdAt:"desc"},
   take:20,
  }),
 ]);

 const branchFilter=branches.find(b=>b.id===query.branch)?.id??"";
 const stateFilter=query.state&&Object.prototype.hasOwnProperty.call(states,query.state)?query.state:"";

 const rows=lots.map(l=>{
  const expiry=l.expiresOn?.toISOString().slice(0,10)??null;
  const review=l.reviewAt?localDay(l.reviewAt):null;
  const state=classifyLot({
   today,
   expiresOn:expiry,
   reviewOn:review,
   alertDays:l.product.alertDays,
   status:l.status,
   quantityMilli:l.quantityMilli,
  });
  return {l,expiry,review,state};
 });

 const filtered=rows.filter(r=>!stateFilter||r.state===stateFilter);
 const usableRows=rows.filter(r=>["AVAILABLE","EXPIRING"].includes(r.state));
 const reviewRows=rows.filter(r=>r.state==="REVIEW");
 const riskRows=rows.filter(r=>["REVIEW","EXPIRING","BLOCKED"].includes(r.state));
 const riskCost=riskRows.reduce((a,r)=>a+r.l.remainingCostCents,0n);
 const recentWasteCost=recentLosses.filter(m=>m.kind==="WASTE").reduce((a,m)=>a+(-m.deltaCostCents),0n);

 return (
  <Shell title="Verdulería y frescos">
   <Notice query={query}/>

   <PageHeader
    kicker="Producción y frescos"
    title="Estación de verdulería y frescos"
    subtitle="Inspección diaria de frescura, reprogramación de revisión, mermas rápidas y control de lotes perecederos."
    actions={
     <>
      <Link className="actionlink secondarylink" href="/inventario?view=recepcion">
       <Icon name="truck" size={15}/>
       <span>Nueva recepción</span>
      </Link>
      <Link className="actionlink secondarylink" href="/alertas?sector=PRODUCE">
       <Icon name="bell" size={15}/>
       <span>Ver alertas</span>
      </Link>
     </>
    }
   />

   <div className="om-kpi-grid">
    <KpiCard label="Lotes aptos para venta" value={usableRows.length} hint="Disponibles o próximos a vencer" icon="apple" tone="success"/>
    <KpiCard label="Pendientes de revisión" value={reviewRows.length} hint="Requieren inspección de frescura" icon="clock" tone={reviewRows.length>0?"warning":"default"}/>
    <KpiCard label="Capital en riesgo / revisión" value={formatMoney(riskCost)} hint={`${riskRows.length} lotes con atención`} icon="alert" tone={riskRows.length>0?"danger":"default"}/>
    <KpiCard label="Merma últimos 7 días" value={formatMoney(recentWasteCost)} hint="Descartes registrados en frescos" icon="trash" tone="brand"/>
   </div>

   <SectionCard title="Control físico de lotes frescos" subtitle={`${filtered.length} lotes activos del sector verdulería`} icon="apple">
    <div className="om-card__body--pad" style={{paddingBottom:0}}>
     <InfoCallout icon="info">
      Cada inspección aprobada habilita el lote para POS por el plazo de revisión elegido; las mermas y descartes impactan en costo real y rentabilidad.
     </InfoCallout>
     <form method="get" className="v2-toolbar" style={{marginTop:14,marginBottom:0,padding:0,borderBottom:"none"}}>
      <label className="v2-search">
       <Icon name="search" size={16}/>
       <input name="q" aria-label="Buscar fruta, verdura o lote" placeholder="Buscar producto, SKU o código de lote..." defaultValue={term}/>
      </label>
      <select name="branch" aria-label="Sucursal" defaultValue={branchFilter}>
       <option value="">Todas las sucursales</option>
       {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <select name="state" aria-label="Estado" defaultValue={stateFilter}>
       <option value="">Todos los estados</option>
       {["REVIEW","EXPIRING","AVAILABLE","BLOCKED"].map(k=><option key={k} value={k}>{states[k]}</option>)}
      </select>
      <button className="secondary">
       <Icon name="filter" size={15}/>
       <span>Filtrar</span>
      </button>
      {(term||branchFilter||stateFilter)&&<Link className="actionlink secondarylink" href="/verduleria">Limpiar</Link>}
     </form>
    </div>

    {filtered.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Producto / lote</th>
         <th>Sucursal</th>
         <th>Ingreso / revisión</th>
         <th>Existencia</th>
         <th>Costo restante</th>
         <th>Estado</th>
         <th>Operación diaria</th>
        </tr>
       </thead>
       <tbody>
        {filtered.map(({l,expiry,review,state})=>(
         <tr key={l.id}>
          <td>
           <strong>{l.product.name}</strong>
           <small className="mono">{l.code} · {l.supplier?.name??"Sin proveedor"}</small>
           <div className="om-row-actions" style={{marginTop:6}}>
            <Link className="om-link-chip" href={"/etiquetas/"+l.id}>Etiqueta</Link>
            <Link className="om-link-chip" href={"/trazabilidad?lot="+l.id}>Trazabilidad</Link>
           </div>
          </td>
          <td>{l.branch.name}</td>
          <td className="mono">
           Ingreso: {localDay(l.receivedAt)}
           <small>Próx. revisión: {review??"Sin programar"}</small>
           {expiry&&<small>Vence: {expiry}</small>}
          </td>
          <td className="mono"><strong>{amount(l.quantityMilli,l.product.unit)}</strong></td>
          <td className="mono">{money(l.remainingCostCents)}</td>
          <td><span className={"status "+state}>{states[state]}</span></td>
          <td>
           <div className="om-row-actions">
            <Operation title={"Inspección · "+l.product.name} trigger="Inspeccionar" variant="secondary">
             <form action={reviewProduceAction} className="fields">
              <input type="hidden" name="lotId" value={l.id}/>
              <Field label="Resultado de frescura">
               <select name="decision" defaultValue={state==="BLOCKED"?"BLOCKED":"AVAILABLE"}>
                <option value="AVAILABLE">Apto para venta (renovar revisión)</option>
                <option value="REVIEW">Mantener en revisión</option>
                <option value="BLOCKED">Bloquear por deterioro</option>
               </select>
              </Field>
              <Field label="Próxima revisión en (días, si queda apto)">
               <select name="reviewDays" defaultValue={String(Math.min(30,Math.max(1,l.product.freshnessDays??1)))}>
                <option value="1">1 día (mañana)</option>
                <option value="2">2 días</option>
                <option value="3">3 días</option>
                <option value="5">5 días</option>
                <option value="7">7 días</option>
               </select>
              </Field>
              <Field label="Observación de frescura">
               <input name="reason" required maxLength={300} placeholder="Ej. Mercadería firme, sin golpes"/>
              </Field>
              <button>Confirmar inspección</button>
             </form>
            </Operation>
            <Operation title={"Merma / descarte · "+l.product.name} trigger="Merma rápida" variant="secondary">
             <form action={wasteProduceAction} className="fields">
              <input type="hidden" name="lotId" value={l.id}/>
              <input type="hidden" name="requestKey" value={randomUUID()}/>
              <Field label="Movimiento">
               <select name="kind">
                <option value="WASTE">Merma / descarte</option>
                <option value="GIFT">Regalo / donación (solo lote apto)</option>
               </select>
              </Field>
              <Field label={`Cantidad (${l.product.unit==="KG"?"kg":"u."})`}>
               <input name="quantity" inputMode="decimal" required placeholder={l.product.unit==="KG"?"Ej. 0.500":"Ej. 1"}/>
              </Field>
              <Field label="Motivo">
               <input name="reason" required maxLength={300} placeholder="Ej. Hojas dañadas / maduración excesiva"/>
              </Field>
              <button>Registrar movimiento</button>
             </form>
            </Operation>
           </div>
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="apple" title="Sin lotes activos de verdulería" description="Recibí mercadería del sector Verdulería o limpiá los filtros activos."/>
    )}
   </SectionCard>

   <SectionCard title="Mermas y regalos recientes en verdulería" subtitle="Últimos 7 días (máximo 20 registros)" icon="trash">
    {recentLosses.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Fecha</th>
         <th>Producto / lote</th>
         <th>Sucursal</th>
         <th>Tipo</th>
         <th>Cantidad</th>
         <th>Costo imputado</th>
         <th>Motivo</th>
        </tr>
       </thead>
       <tbody>
        {recentLosses.map(m=>(
         <tr key={m.id}>
          <td className="mono">{localDay(m.createdAt)}</td>
          <td><strong>{m.lot.product.name}</strong><small className="mono">{m.lot.code}</small></td>
          <td>{m.lot.branch.name}</td>
          <td><span className={"status "+(m.kind==="WASTE"?"BLOCKED":"REVIEW")}>{m.kind==="WASTE"?"Merma":"Regalo"}</span></td>
          <td className="mono">{amount(-m.deltaMilli,m.lot.product.unit)}</td>
          <td className="mono"><strong>{money(-m.deltaCostCents)}</strong></td>
          <td>{m.reason}</td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="check" title="Sin mermas recientes" description="No hubo descartes ni regalos de verdulería en los últimos 7 días."/>
    )}
   </SectionCard>
  </Shell>
 );
}
