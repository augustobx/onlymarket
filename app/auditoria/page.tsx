import Link from "next/link";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {localDay} from "../../src/domain/parse.mjs";
import {periodBounds} from "../../src/domain/finance.mjs";
import {Shell,Notice,money,amount} from "../ui";
import {PageHeader,KpiCard,SectionCard,EmptyState,InfoCallout} from "../components/retail-ui";
import {Icon} from "../components/icons";

export const dynamic="force-dynamic";

function summarizeDiff(prevRaw:string,nextRaw:string){
 try{
  const prev=JSON.parse(prevRaw) as Record<string,unknown>;
  const next=JSON.parse(nextRaw) as Record<string,unknown>;
  const labels:Record<string,string>={
   name:"Nombre",
   sku:"SKU",
   barcode:"EAN",
   weightCode:"PLU",
   sector:"Sector",
   quickAccess:"Acceso POS",
   price:"Precio (cts)",
   alertDays:"Aviso",
   freshnessDays:"Frescura",
   openedLifeDays:"Apertura",
   active:"Activo",
  };
  const parts:string[]=[];
  for(const k of Object.keys(labels)){
   if(String(prev[k]??"")!==String(next[k]??"")){
    parts.push(`${labels[k]}: ${String(prev[k]??"—")} → ${String(next[k]??"—")}`);
   }
  }
  return parts.length?parts.join(" · "):"Sin cambios visibles";
 }catch{
  return `${prevRaw} → ${nextRaw}`;
 }
}

export default async function Page({
 searchParams,
}:{
 searchParams:Promise<{error?:string;ok?:string;from?:string;to?:string;q?:string}>;
}){
 const s=await requireSession();
 if(!["OWNER","MANAGER"].includes(s.role))return <Shell title="Auditoría"><p className="error">Sin permisos.</p></Shell>;

 const query=await searchParams;
 const today=localDay();
 let from=query.from??today.slice(0,7)+"-01";
 let to=query.to??today;
 let range;
 try{
  if(from>to){const tmp=from;from=to;to=tmp;}
  range=periodBounds(from,to);
 }catch{
  from=today.slice(0,7)+"-01";
  to=today;
  range=periodBounds(from,to);
 }
 const term=(query.q??"").trim().slice(0,120);
 const qLower=term.toLowerCase();
 const time={gte:range.start,lt:range.end};

 const [members,products,catalogChanges,cancellations,returns,controls]=await Promise.all([
  db.membership.findMany({where:{tenantId:s.tenantId},include:{user:{select:{id:true,email:true}}}}),
  db.product.findMany({where:{tenantId:s.tenantId},select:{id:true,name:true,sku:true}}),
  db.catalogChange.findMany({where:{tenantId:s.tenantId,createdAt:time},orderBy:{createdAt:"desc"},take:250}),
  db.saleCancellation.findMany({where:{tenantId:s.tenantId,createdAt:time},include:{sale:{include:{shift:{include:{branch:true}}}}},orderBy:{createdAt:"desc"},take:200}),
  db.saleReturn.findMany({where:{tenantId:s.tenantId,createdAt:time},include:{line:{include:{product:true}},shift:{include:{branch:true}}},orderBy:{createdAt:"desc"},take:200}),
  db.stockControl.findMany({where:{tenantId:s.tenantId,createdAt:time},include:{source:{include:{product:true,branch:true}}},orderBy:{createdAt:"desc"},take:200}),
 ]);

 const actors=new Map(members.map(m=>[m.userId,m.user.email]));
 const prodById=new Map(products.map(p=>[p.id,p]));

 const filteredCatalog=term?catalogChanges.filter(c=>{
  const p=prodById.get(c.productId);
  const actor=actors.get(c.actorId)??"";
  return [p?.name??"",p?.sku??"",actor,c.previous,c.next].some(v=>v.toLowerCase().includes(qLower));
 }):catalogChanges;

 const filteredCancels=term?cancellations.filter(c=>
  [c.saleId,c.reason,c.sale.shift.branch.name,actors.get(c.actorId)??""].some(v=>v.toLowerCase().includes(qLower))
 ):cancellations;

 const filteredReturns=term?returns.filter(r=>
  [r.saleId,r.reason,r.line.productName,r.shift.branch.name,actors.get(r.actorId)??""].some(v=>v.toLowerCase().includes(qLower))
 ):returns;

 const filteredControls=term?controls.filter(c=>
  [c.source.code,c.source.product.name,c.source.branch.name,c.reason,actors.get(c.actorId)??""].some(v=>v.toLowerCase().includes(qLower))
 ):controls;

 return (
  <Shell title="Auditoría operativa">
   <Notice query={query}/>

   <PageHeader
    kicker="Control y trazabilidad"
    title="Auditoría de cambios críticos"
    subtitle={`Registro inmutable de precios, anulaciones, devoluciones y controles de stock (${from.split("-").reverse().join("/")} al ${to.split("-").reverse().join("/")})`}
    actions={
     <a className="actionlink secondarylink" href={"/api/export?"+new URLSearchParams({type:"auditoria",from,to,...(term?{q:term}:{})}).toString()}>
      <Icon name="layers" size={15}/>
      <span>Exportar CSV</span>
     </a>
    }
   />

   <div className="om-kpi-grid">
    <KpiCard label="Cambios de catálogo" value={filteredCatalog.length} hint="Precios, sectores y estados" icon="tag" tone="brand"/>
    <KpiCard label="Ventas anuladas" value={filteredCancels.length} hint="Anulaciones completas del período" icon="alert" tone={filteredCancels.length?"danger":"default"}/>
    <KpiCard label="Devoluciones parciales" value={filteredReturns.length} hint="Reintegros con reingreso o descarte" icon="cart" tone={filteredReturns.length?"warning":"default"}/>
    <KpiCard label="Controles y traslados" value={filteredControls.length} hint="Ajustes físicos registrados" icon="layers"/>
   </div>

   <SectionCard title="Filtro de auditoría" icon="sliders" padded>
    <form method="get" className="v2-toolbar" style={{margin:0,padding:0,borderBottom:"none"}}>
     <label className="v2-search">
      <Icon name="search" size={16}/>
      <input name="q" aria-label="Buscar producto, lote, operador o motivo" placeholder="Producto, lote, operador, ticket o motivo..." defaultValue={term}/>
     </label>
     <input type="date" name="from" aria-label="Desde" defaultValue={from}/>
     <input type="date" name="to" aria-label="Hasta" defaultValue={to}/>
     <button className="secondary">
      <Icon name="filter" size={15}/>
      <span>Consultar</span>
     </button>
     {(term||from!==today.slice(0,7)+"-01"||to!==today)&&<Link className="actionlink secondarylink" href="/auditoria">Limpiar</Link>}
    </form>
    <div style={{marginTop:12}}>
     <InfoCallout icon="info">
      Todos los cambios de precios, anulaciones y ajustes físicos se graban con usuario, fecha y motivo dentro de la transacción original.
     </InfoCallout>
    </div>
   </SectionCard>

   <SectionCard title="Cambios de catálogo y precios" subtitle="Hasta 250 registros del período" icon="tag">
    {filteredCatalog.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Fecha</th>
         <th>Producto</th>
         <th>Operador</th>
         <th>Detalle de cambios</th>
        </tr>
       </thead>
       <tbody>
        {filteredCatalog.map(c=>{
         const p=prodById.get(c.productId);
         return (
          <tr key={c.id}>
           <td className="mono">{c.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</td>
           <td><strong>{p?.name??c.productId.slice(0,8)}</strong>{p?.sku&&<small className="mono">{p.sku}</small>}</td>
           <td>{actors.get(c.actorId)??c.actorId.slice(0,8)}</td>
           <td className="mono" style={{fontSize:12.5}}>{summarizeDiff(c.previous,c.next)}</td>
          </tr>
         );
        })}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="tag" title="Sin cambios de catálogo" description="No hubo modificaciones de artículos en el rango seleccionado."/>
    )}
   </SectionCard>

   <div className="om-dashgrid">
    <SectionCard title="Anulaciones y devoluciones" subtitle="Operaciones reversadas en caja" icon="alert">
     {filteredCancels.length+filteredReturns.length>0?(
      <div className="tablewrap">
       <table>
        <thead>
         <tr>
          <th>Fecha</th>
          <th>Tipo / Ticket</th>
          <th>Sucursal / Operador</th>
          <th>Importe</th>
          <th>Motivo</th>
         </tr>
        </thead>
        <tbody>
         {filteredCancels.map(c=>(
          <tr key={"C-"+c.id}>
           <td className="mono">{c.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</td>
           <td><span className="status BLOCKED">Anulación</span> <Link className="om-link-chip mono" href={"/pos/ticket/"+c.saleId}>{c.saleId.slice(0,8)}</Link></td>
           <td><strong>{c.sale.shift.branch.name}</strong><small>{actors.get(c.actorId)??c.actorId.slice(0,8)}</small></td>
           <td className="mono"><strong>{money(c.sale.totalCents)}</strong></td>
           <td>{c.reason}</td>
          </tr>
         ))}
         {filteredReturns.map(r=>(
          <tr key={"R-"+r.id}>
           <td className="mono">{r.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</td>
           <td><span className="status REVIEW">Devolución</span> <Link className="om-link-chip mono" href={"/pos/ticket/"+r.saleId}>{r.saleId.slice(0,8)}</Link></td>
           <td><strong>{r.shift.branch.name}</strong><small>{actors.get(r.actorId)??r.actorId.slice(0,8)}</small></td>
           <td className="mono"><strong>{money(r.refundCents)}</strong><small>{r.line.productName}</small></td>
           <td>{r.reason}</td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     ):(
      <EmptyState icon="check" title="Sin anulaciones ni devoluciones" description="No se registraron reversos comerciales en el período."/>
     )}
    </SectionCard>

    <SectionCard title="Controles físicos y traslados" subtitle="Conteos de inventario y transferencias" icon="layers">
     {filteredControls.length>0?(
      <div className="tablewrap">
       <table>
        <thead>
         <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Producto / lote</th>
          <th>Operador</th>
          <th>Cantidad / Motivo</th>
         </tr>
        </thead>
        <tbody>
         {filteredControls.map(c=>(
          <tr key={c.id}>
           <td className="mono">{c.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</td>
           <td><span className={"status "+(c.kind==="COUNT"?"REVIEW":"AVAILABLE")}>{c.kind==="COUNT"?"Conteo":"Traslado"}</span></td>
           <td>
            <strong>{c.source.product.name}</strong>
            <small className="mono">{c.source.code} · {c.source.branch.name}</small>
           </td>
           <td>{actors.get(c.actorId)??c.actorId.slice(0,8)}</td>
           <td className="mono">
            <strong>{c.kind==="COUNT"?`${amount(c.beforeMilli,c.source.product.unit)} → ${amount(c.afterMilli,c.source.product.unit)}`:amount(c.quantityMilli,c.source.product.unit)}</strong>
            <small>{c.reason}</small>
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     ):(
      <EmptyState icon="layers" title="Sin controles en el período" description="Los conteos físicos y traslados entre sucursales aparecerán aquí."/>
     )}
    </SectionCard>
   </div>
  </Shell>
 );
}
