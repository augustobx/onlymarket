import Link from "next/link";
import {randomUUID} from "node:crypto";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {stockSnapshot} from "../../src/server/stock-control.mjs";
import {classifyLot} from "../../src/domain/inventory.mjs";
import {localDay} from "../../src/domain/parse.mjs";
import {Operation} from "../operations";
import {Shell,Field,Notice,money,amount,fixed,states} from "../ui";
import {PageHeader,SectionCard,EmptyState,InfoCallout} from "../components/retail-ui";
import {Icon} from "../components/icons";
import {controlAction} from "./actions";

export const dynamic="force-dynamic";

export default async function Page({
 searchParams,
}:{
 searchParams:Promise<{lot?:string;q?:string;branch?:string;ok?:string;error?:string}>;
}){
 const s=await requireSession();
 if(s.role==="CASHIER")return <Shell title="Conteos y traslados"/>;

 const query=await searchParams;
 const tenantId=s.tenantId;
 const term=(query.q??"").slice(0,120);
 const today=localDay();
 const manager=["OWNER","MANAGER"].includes(s.role);

 const [lots,branches,history]=await db.$transaction(
  async tx=>Promise.all([
   tx.lot.findMany({
    where:{
     tenantId,
     ...(query.lot?{id:query.lot}:{}),
     ...(query.branch?{branchId:query.branch}:{}),
     ...(term?{OR:[{code:{contains:term,mode:"insensitive"}},{product:{name:{contains:term,mode:"insensitive"}}},{product:{sku:{contains:term,mode:"insensitive"}}},{product:{barcode:{contains:term,mode:"insensitive"}}},{product:{weightCode:{contains:term,mode:"insensitive"}}}]}:{}),
    },
    include:{product:true,branch:true,movements:{orderBy:[{createdAt:"desc"},{id:"desc"}],take:1,select:{id:true}}},
    orderBy:[{product:{name:"asc"}},{receivedAt:"desc"}],
    take:100,
   }),
   tx.branch.findMany({where:{tenantId},orderBy:{name:"asc"}}),
   tx.stockControl.findMany({
    where:{tenantId},
    include:{source:{include:{product:true,branch:true}},destination:{include:{branch:true}}},
    orderBy:{createdAt:"desc"},
    take:100,
   }),
  ] as const),
  {isolationLevel:"RepeatableRead"}
 );

 return (
  <Shell title="Conteos y traslados">
   <Notice query={query}/>

   <PageHeader
    kicker="Mercadería"
    title="Conteos físicos y traslados"
    subtitle="Ajuste de existencias con control de concurrencia y traslados entre sucursales."
    actions={query.lot?<Link className="actionlink secondarylink" href="/stock">Ver todos los lotes</Link>:undefined}
   />

   <SectionCard title="Control de existencias" subtitle="Hasta 100 lotes coincidentes, incluidos agotados" icon="layers">
    <form method="get" className="v2-toolbar">
     <label className="v2-search">
      <Icon name="search" size={16}/>
      <input name="q" aria-label="Buscar producto, SKU o lote" placeholder="Buscar producto, SKU o lote..." defaultValue={term}/>
     </label>
     <select name="branch" aria-label="Sucursal" defaultValue={query.branch??""}>
      <option value="">Todas las sucursales</option>
      {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
     </select>
     <button className="secondary">
      <Icon name="filter" size={15}/>
      <span>Buscar</span>
     </button>
    </form>

    <div className="om-card__body--pad" style={{paddingBottom:0}}>
     <InfoCallout icon="info">
      Los faltantes se contabilizan como pérdida; los sobrantes requieren costo documentado y quedan en revisión. Traslados entre sucursales ingresan en revisión en destino.
     </InfoCallout>
    </div>

    {lots.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Producto / lote</th>
         <th>Sucursal</th>
         <th>Existencia</th>
         <th>Valor</th>
         <th>Estado</th>
         <th>Operaciones</th>
        </tr>
       </thead>
       <tbody>
        {lots.map(l=>{
         const state=classifyLot({
          today,
          expiresOn:l.expiresOn?.toISOString().slice(0,10)??null,
          reviewOn:l.reviewAt?localDay(l.reviewAt):null,
          status:l.status,
          quantityMilli:l.quantityMilli,
          alertDays:l.product.alertDays,
         });
         const snapshot=stockSnapshot(l,l.movements[0]?.id);
         const canTransfer=l.product.active&&["AVAILABLE","EXPIRING"].includes(state)&&branches.length>1;
         return (
          <tr key={l.id}>
           <td>
            <strong>{l.product.name}</strong>
            <small className="mono">{l.code}</small>
            <Link className="om-link-chip" style={{marginTop:6}} href={"/trazabilidad?lot="+l.id}>Historial</Link>
           </td>
           <td>{l.branch.name}</td>
           <td className="mono"><strong>{amount(l.quantityMilli,l.product.unit)}</strong></td>
           <td className="mono">{money(l.remainingCostCents)}</td>
           <td><span className={"status "+state}>{states[state]}</span></td>
           <td>
            <div className="om-row-actions">
             {manager&&(
              <Operation
               title={"Conteo físico · "+l.product.name}
               trigger="Registrar conteo"
               variant="secondary"
               description="Compará el peso o las unidades reales con la existencia registrada."
              >
               <form action={controlAction} className="fields">
                <input type="hidden" name="kind" value="COUNT"/>
                <input type="hidden" name="lotId" value={l.id}/>
                <input type="hidden" name="requestKey" value={randomUUID()}/>
                <input type="hidden" name="snapshot" value={snapshot}/>
                <Field label={`Cantidad física (${l.product.unit==="KG"?"kg":"u."})`}>
                 <input name="quantity" required inputMode="decimal" defaultValue={fixed(l.quantityMilli,3)}/>
                </Field>
                <Field label="Costo total del sobrante ($), solo si aumenta">
                 <input name="addedCost" inputMode="decimal"/>
                </Field>
                <Field label="Motivo / referencia">
                 <input name="reason" required maxLength={300}/>
                </Field>
                <button>Confirmar conteo</button>
               </form>
              </Operation>
             )}
             {canTransfer&&(
              <Operation title={"Traslado · "+l.product.name} trigger="Trasladar stock" variant="secondary">
               <form action={controlAction} className="fields">
                <input type="hidden" name="kind" value="TRANSFER"/>
                <input type="hidden" name="lotId" value={l.id}/>
                <input type="hidden" name="requestKey" value={randomUUID()}/>
                <input type="hidden" name="snapshot" value={snapshot}/>
                <Field label="Sucursal destino">
                 <select name="destinationBranchId">
                  {branches.filter(b=>b.id!==l.branchId).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                 </select>
                </Field>
                <Field label="Cantidad a trasladar"><input name="quantity" inputMode="decimal" required/></Field>
                <Field label="Motivo / referencia"><input name="reason" required maxLength={300}/></Field>
                <button>Confirmar traslado</button>
               </form>
              </Operation>
             )}
            </div>
           </td>
          </tr>
         );
        })}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="layers" title="Sin lotes para la búsqueda" description="Probá con otro nombre, SKU o sucursal."/>
    )}
   </SectionCard>

   <SectionCard title="Últimos controles y traslados" subtitle="Auditoría reciente de ajustes de inventario" icon="clock">
    {history.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Fecha</th>
         <th>Operación</th>
         <th>Lote</th>
         <th>Antes</th>
         <th>Después</th>
         <th>Costo diff. / traslado</th>
         <th>Motivo / destino</th>
        </tr>
       </thead>
       <tbody>
        {history.map(h=>(
         <tr key={h.id}>
          <td className="mono">{h.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</td>
          <td><span className={"status "+(h.kind==="COUNT"?"REVIEW":"AVAILABLE")}>{h.kind==="COUNT"?"Conteo":"Traslado"}</span></td>
          <td>
           <Link href={"/trazabilidad?lot="+h.sourceLotId}><strong>{h.source.product.name}</strong> · <span className="mono">{h.source.code}</span></Link>
           <small>{h.source.branch.name}</small>
          </td>
          <td className="mono">{amount(h.beforeMilli,h.source.product.unit)}</td>
          <td className="mono">{amount(h.afterMilli,h.source.product.unit)}</td>
          <td className="mono">{money(h.costCents)}</td>
          <td>
           {h.reason}
           {h.destination&&(
            <small><Link href={"/trazabilidad?lot="+h.destination.id}>{h.destination.branch.name} · {h.destination.code}</Link></small>
           )}
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="clock" title="Sin operaciones registradas" description="Los conteos físicos y traslados aparecerán en este historial."/>
    )}
   </SectionCard>
  </Shell>
 );
}
