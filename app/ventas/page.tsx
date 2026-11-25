import Link from "next/link";
import {randomUUID} from "node:crypto";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {localDay} from "../../src/domain/parse.mjs";
import {periodBounds} from "../../src/domain/finance.mjs";
import {Operation} from "../operations";
import {Shell,Field,Notice,money} from "../ui";
import {PageHeader,KpiCard,SectionCard,EmptyState,InfoCallout,formatMoney} from "../components/retail-ui";
import {Icon} from "../components/icons";
import {cancelAction} from "./actions";

export const dynamic="force-dynamic";

const labels:Record<string,string>={CASH:"Efectivo",DEBIT:"Débito",CREDIT:"Crédito",TRANSFER:"Transferencia",MIXED:"Mixto"};

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;ok?:string;date?:string;from?:string;to?:string;q?:string;branch?:string;payment?:string;page?:string}>}){
 const s=await requireSession();
 const query=await searchParams;
 if(!["OWNER","MANAGER"].includes(s.role))return <Shell title="Ventas"><p className="error">Sin permisos.</p></Shell>;

 const today=localDay();
 let from=query.from??query.date??today;
 let to=query.to??query.date??today;
 let range;
 try{
  if(from>to){const tmp=from;from=to;to=tmp;}
  range=periodBounds(from,to);
 }catch{
  from=today;to=today;range=periodBounds(today,today);
 }
 const term=(query.q??"").trim().slice(0,120);
 const paymentFilter=query.payment&&labels[query.payment]?query.payment:"";

 const [branches,members]=await Promise.all([
  db.branch.findMany({where:{tenantId:s.tenantId},orderBy:{name:"asc"}}),
  db.membership.findMany({where:{tenantId:s.tenantId},include:{user:{select:{id:true,email:true}}}}),
 ]);
 const branchFilter=branches.find(b=>b.id===query.branch)?.id??"";
 const sales=await db.sale.findMany({
  where:{
   tenantId:s.tenantId,
   createdAt:{gte:range.start,lt:range.end},
   ...(paymentFilter?{payment:paymentFilter as "CASH"|"DEBIT"|"CREDIT"|"TRANSFER"|"MIXED"}:{}),
   ...(branchFilter?{shift:{branchId:branchFilter}}:{}),
  },
  include:{shift:{include:{branch:true}},customer:{select:{name:true,code:true}},cancellation:true,returns:true},
  orderBy:{createdAt:"desc"},
  take:1000,
 });
 const actors=new Map(members.map(m=>[m.userId,m.user.email]));
 const qLower=term.toLowerCase();
 const filtered=term?sales.filter(v=>
  v.id.toLowerCase().includes(qLower)||
  (v.customer?.name??"").toLowerCase().includes(qLower)||
  (v.customer?.code??"").toLowerCase().includes(qLower)||
  (actors.get(v.shift.actorId)??"").toLowerCase().includes(qLower)
 ):sales;
 const pageSize=50,totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
 const page=Math.min(totalPages,Math.max(1,Number(query.page??"1")||1));
 const slice=filtered.slice((page-1)*pageSize,page*pageSize);
 const pageUrl=(p:number)=>"/ventas?"+new URLSearchParams({from,to,...(term?{q:term}:{}),...(branchFilter?{branch:branchFilter}:{}),...(paymentFilter?{payment:paymentFilter}:{}),...(p>1?{page:String(p)}:{})}).toString();

 return (
  <Shell title="Ventas y anulaciones">
   <Notice query={query}/>

   <PageHeader
    kicker="Comercial"
    title="Ventas y anulaciones"
    subtitle={from===to?`Comprobantes registrados para el ${from.split("-").reverse().join("/")}`:`Comprobantes del ${from.split("-").reverse().join("/")} al ${to.split("-").reverse().join("/")}`}
    actions={
     <div className="om-row-actions">
      <a className="actionlink secondarylink" href={"/api/export?"+new URLSearchParams({type:"ventas",from,to,...(term?{q:term}:{}),...(branchFilter?{branch:branchFilter}:{}),...(paymentFilter?{payment:paymentFilter}:{})}).toString()}>
       <Icon name="layers" size={15}/>
       <span>Exportar CSV</span>
      </a>
      <Link className="actionlink secondarylink" href="/pos">
       <Icon name="wallet" size={15}/>
       <span>Ir a caja</span>
      </Link>
     </div>
    }
   />

   <div className="om-kpi-grid">
    <KpiCard label="Tickets filtrados" value={filtered.length} hint="Hasta 1000 por rango consultado" icon="receipt" tone="brand"/>
    <KpiCard label="Importe vigente listado" value={formatMoney(filtered.filter(v=>!v.cancellation).reduce((a,v)=>a+v.totalCents,0n))} hint="Antes de devoluciones" icon="wallet" tone="success"/>
    <KpiCard label="Anuladas" value={filtered.filter(v=>v.cancellation).length} hint="Operaciones anuladas" icon="alert" tone="danger"/>
    <KpiCard label="Con devoluciones" value={filtered.filter(v=>v.returns.length).length} hint="Devoluciones parciales" icon="cart" tone="warning"/>
   </div>

   <SectionCard title="Historial de tickets" subtitle="Las anulaciones completas se limitan al día y caja abierta; las devoluciones parciales se operan sobre una caja abierta de la sucursal" icon="receipt">
    <div className="om-card__body--pad" style={{paddingBottom:0}}>
     <InfoCallout icon="info">
      El reintegro de dinero es manual: anular o devolver no transfiere fondos ni revierte cobros bancarios automáticamente.
     </InfoCallout>
     <form method="get" className="v2-toolbar" style={{marginTop:14,marginBottom:0,padding:0,borderBottom:"none"}}>
      <label className="v2-search">
       <Icon name="search" size={16}/>
       <input name="q" aria-label="Buscar ticket, socio u operador" placeholder="Ticket, socio u operador..." defaultValue={term}/>
      </label>
      <input type="date" name="from" aria-label="Desde" defaultValue={from}/>
      <input type="date" name="to" aria-label="Hasta" defaultValue={to}/>
      <select name="branch" aria-label="Sucursal" defaultValue={branchFilter}>
       <option value="">Todas las sucursales</option>
       {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <select name="payment" aria-label="Medio de pago" defaultValue={paymentFilter}>
       <option value="">Todos los medios</option>
       {Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}
      </select>
      <button className="secondary">
       <Icon name="filter" size={15}/>
       <span>Consultar</span>
      </button>
      {(from!==today||to!==today||term||branchFilter||paymentFilter)&&(
       <Link className="actionlink secondarylink" href="/ventas">Hoy</Link>
      )}
     </form>
    </div>

    {slice.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Venta</th>
         <th>Sucursal / operador</th>
         <th>Pago</th>
         <th>Importe</th>
         <th>Estado</th>
         <th>Acciones</th>
        </tr>
       </thead>
       <tbody>
        {slice.map(v=>(
         <tr key={v.id}>
          <td>
           <Link className="om-link-chip mono" href={"/pos/ticket/"+v.id}>{v.id.slice(0,8)}</Link>
           <small>{v.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}{v.customer?` · ${v.customer.name}`:""}</small>
          </td>
          <td>
           <strong>{v.shift.branch.name}</strong>
           <small>{actors.get(v.shift.actorId)??v.shift.actorId.slice(0,8)}</small>
          </td>
          <td>
           {labels[v.payment]}
           {v.payment==="MIXED"&&(
            <small className="mono">
             Ef {money(v.cashCents)} · Déb {money(v.debitCents)} · Créd {money(v.creditCents)} · Transf {money(v.transferCents)}
            </small>
           )}
          </td>
          <td className="mono"><strong>{money(v.totalCents)}</strong></td>
          <td>
           <span className={"status "+(v.cancellation?"BLOCKED":v.returns.length?"REVIEW":"AVAILABLE")}>
            {v.cancellation?"Anulada":v.returns.length?"Con devoluciones":"Registrada"}
           </span>
           {v.cancellation&&(
            <small>{v.cancellation.reason} · {v.cancellation.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</small>
           )}
          </td>
          <td>
           <div className="om-row-actions">
            {!v.cancellation&&(
             <Link className="om-link-chip" href={"/ventas/devolucion/"+v.id}>Ver / devolver artículos</Link>
            )}
            {!v.cancellation&&!v.returns.length&&!v.shift.closedAt&&localDay(v.createdAt)===today?(
             <Operation
              title={"Anular venta · "+v.id.slice(0,8)}
              trigger="Anular venta"
              variant="secondary"
              description="Esta acción registra una anulación completa. El reintegro se realiza manualmente."
             >
              <form action={cancelAction} className="fields">
               <input type="hidden" name="saleId" value={v.id}/>
               <input type="hidden" name="requestKey" value={randomUUID()}/>
               <Field label="Destino de todos los artículos">
                <select name="disposition">
                 <option value="REVIEW">Regresar al lote en revisión (bloquea venta del lote)</option>
                 <option value="WASTE">Descartar y contabilizar pérdida</option>
                </select>
               </Field>
               <Field label="Motivo"><input name="reason" required maxLength={300}/></Field>
               <label>
                <input type="checkbox" name="confirm" value="yes" required/>
                <span>Confirmo el reintegro manual y el destino de la mercadería</span>
               </label>
               <button>Anular y registrar reintegro</button>
              </form>
             </Operation>
            ):!v.cancellation?null:<small>Sin acciones</small>}
           </div>
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="receipt" title="No hay ventas para este criterio" description="Probá ampliando el rango de fechas o limpiando los filtros."/>
    )}
    {filtered.length>0&&(
     <div className="v2-tablefoot" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <span>Mostrando {slice.length} de {filtered.length} comprobantes · Página {page} de {totalPages}</span>
      {totalPages>1&&(
       <div className="om-row-actions">
        {page>1&&<Link className="om-link-chip" href={pageUrl(page-1)}>‹ Anterior</Link>}
        {page<totalPages&&<Link className="om-link-chip" href={pageUrl(page+1)}>Siguiente ›</Link>}
       </div>
      )}
     </div>
    )}
   </SectionCard>
  </Shell>
 );
}
