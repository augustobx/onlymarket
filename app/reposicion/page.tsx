import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {localDay} from "../../src/domain/parse.mjs";
import {classifyLot} from "../../src/domain/inventory.mjs";
import {Operation} from "../operations";
import {Shell,Field,Notice,amount,sectors} from "../ui";
import {PageHeader,KpiCard,SectionCard,EmptyState} from "../components/retail-ui";
import {Icon} from "../components/icons";
import {targetAction} from "../stock/actions";

export const dynamic="force-dynamic";

export default async function Page({
 searchParams,
}:{
 searchParams:Promise<{ok?:string;error?:string;branch?:string;only?:string}>;
}){
 const s=await requireSession();
 if(s.role==="CASHIER")return <Shell title="Reposición"/>;

 const query=await searchParams;
 const tenantId=s.tenantId;
 const today=localDay();
 const manager=["OWNER","MANAGER"].includes(s.role);

 const [targets,lots,branches,products]=await db.$transaction(
  async tx=>Promise.all([
   tx.stockTarget.findMany({where:{tenantId,product:{active:true},...(query.branch?{branchId:query.branch}:{})},include:{product:true,branch:true},orderBy:[{branch:{name:"asc"}},{product:{name:"asc"}}]}),
   tx.lot.findMany({where:{tenantId,quantityMilli:{gt:0n},product:{active:true},...(query.branch?{branchId:query.branch}:{})},include:{product:true}}),
   tx.branch.findMany({where:{tenantId},orderBy:{name:"asc"}}),
   tx.product.findMany({where:{tenantId,active:true},orderBy:{name:"asc"},select:{id:true,name:true,unit:true}}),
  ] as const),
  {isolationLevel:"RepeatableRead"}
 );

 const balances=new Map<string,{usable:bigint;held:bigint}>();
 for(const l of lots){
  const key=l.branchId+":"+l.productId;
  const b=balances.get(key)??{usable:0n,held:0n};
  const state=classifyLot({
   today,
   expiresOn:l.expiresOn?.toISOString().slice(0,10)??null,
   reviewOn:l.reviewAt?localDay(l.reviewAt):null,
   status:l.status,
   quantityMilli:l.quantityMilli,
   alertDays:l.product.alertDays,
  });
  if(["AVAILABLE","EXPIRING"].includes(state))b.usable+=l.quantityMilli;
  else b.held+=l.quantityMilli;
  balances.set(key,b);
 }

 const rows=targets
  .map(t=>{
   const balance=balances.get(t.branchId+":"+t.productId)??{usable:0n,held:0n};
   const low=balance.usable<t.minimumMilli;
   return {...t,...balance,low,suggested:low&&t.targetMilli>balance.usable?t.targetMilli-balance.usable:0n};
  })
  .sort((a,b)=>Number(b.low)-Number(a.low));

 const visible=rows.filter(r=>query.only!=="low"||r.low);
 const lowCount=rows.filter(r=>r.low).length;

 return (
  <Shell title="Reposición">
   <Notice query={query}/>

   <PageHeader
    kicker="Mercadería"
    title="Stock mínimo y reposición"
    subtitle="Sugerencias de compra o traslado según mínimos configurados por sucursal."
    actions={
     <div className="om-row-actions">
      <a className="actionlink secondarylink" href={"/api/export?"+new URLSearchParams({type:"reposicion",...(query.branch?{branch:query.branch}:{}),...(query.only?{only:query.only}:{})}).toString()}>
       <Icon name="layers" size={15}/>
       <span>Exportar CSV</span>
      </a>
      {manager&&(
       <Operation
        title="Configurar mínimo y objetivo"
        trigger="Configurar objetivo de stock"
        description="El mínimo activa la alerta cuando el stock apto cae por debajo; el objetivo define la cantidad sugerida."
       >
        <form action={targetAction} className="fields">
         <Field label="Sucursal">
          <select name="branchId">{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
         </Field>
         <Field label="Producto">
          <select name="productId">
           {products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.unit==="KG"?"kg":"u."}</option>)}
          </select>
         </Field>
         <Field label="Stock mínimo"><input name="minimum" inputMode="decimal" required/></Field>
         <Field label="Stock objetivo"><input name="target" inputMode="decimal" required/></Field>
         <button disabled={!branches.length||!products.length}>Guardar objetivo</button>
        </form>
       </Operation>
      )}
     </div>
    }
   />

   <div className="om-kpi-grid om-kpi-grid--3">
    <KpiCard label="Objetivos configurados" value={rows.length} hint="Combinaciones producto / sucursal" icon="packageCheck" tone="brand"/>
    <KpiCard label="Debajo del mínimo" value={lowCount} hint="Requieren reposición" icon="alert" tone={lowCount>0?"warning":"success"}/>
    <KpiCard label="En nivel óptimo" value={rows.length-lowCount} hint="Existencia apta suficiente" icon="check" tone="success"/>
   </div>

   <SectionCard title="Sugerencias de compra o traslado" subtitle="Se excluyen lotes retenidos o vencidos" icon="truck">
    <form method="get" className="v2-toolbar">
     <select name="branch" aria-label="Sucursal" defaultValue={query.branch??""}>
      <option value="">Todas las sucursales</option>
      {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
     </select>
     <select name="only" aria-label="Estado" defaultValue={query.only??""}>
      <option value="">Todos los objetivos</option>
      <option value="low">Solo bajo mínimo</option>
     </select>
     <button className="secondary">
      <Icon name="filter" size={15}/>
      <span>Filtrar</span>
     </button>
    </form>

    {visible.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Producto</th>
         <th>Sucursal</th>
         <th>Disponible</th>
         <th>Retenido</th>
         <th>Mínimo</th>
         <th>Objetivo</th>
         <th>Sugerencia</th>
        </tr>
       </thead>
       <tbody>
        {visible.map(r=>(
         <tr key={r.branchId+":"+r.productId}>
          <td>
           <strong>{r.product.name}</strong>
           <small>{sectors[r.product.sector as keyof typeof sectors]}</small>
          </td>
          <td>{r.branch.name}</td>
          <td className="mono"><strong>{amount(r.usable,r.product.unit)}</strong></td>
          <td className="mono">{amount(r.held,r.product.unit)}</td>
          <td className="mono">{amount(r.minimumMilli,r.product.unit)}</td>
          <td className="mono">{amount(r.targetMilli,r.product.unit)}</td>
          <td>
           {r.low?(
            <>
             <span className="status REVIEW">Reponer</span>
             <small className="mono">+{amount(r.suggested,r.product.unit)}</small>
            </>
           ):(
            <span className="status AVAILABLE">Suficiente</span>
           )}
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="packageCheck" title="Sin objetivos para mostrar" description="Configurá stock mínimo y objetivo por sucursal para recibir sugerencias."/>
    )}
   </SectionCard>
  </Shell>
 );
}
