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

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;ok?:string;date?:string}>}){
 const s=await requireSession();
 const query=await searchParams;
 if(!["OWNER","MANAGER"].includes(s.role))return <Shell title="Ventas"><p className="error">Sin permisos.</p></Shell>;

 const today=localDay();
 let date=query.date??today;
 let range;
 try{range=periodBounds(date,date);}
 catch{date=today;range=periodBounds(today,today);}

 const [sales,members]=await Promise.all([
  db.sale.findMany({where:{tenantId:s.tenantId,createdAt:{gte:range.start,lt:range.end}},include:{shift:{include:{branch:true}},cancellation:true,returns:true},orderBy:{createdAt:"desc"},take:500}),
  db.membership.findMany({where:{tenantId:s.tenantId},include:{user:{select:{id:true,email:true}}}}),
 ]);
 const actors=new Map(members.map(m=>[m.userId,m.user.email]));

 return (
  <Shell title="Ventas y anulaciones">
   <Notice query={query}/>

   <PageHeader
    kicker="Comercial"
    title="Ventas y anulaciones"
    subtitle={`Comprobantes registrados para el ${date.split("-").reverse().join("/")}`}
    actions={
     <form method="get" className="om-filter-bar">
      <input type="date" name="date" aria-label="Fecha" defaultValue={date}/>
      <button className="secondary">
       <Icon name="filter" size={15}/>
       <span>Consultar</span>
      </button>
     </form>
    }
   />

   <div className="om-kpi-grid">
    <KpiCard label="Tickets listados" value={sales.length} hint="Hasta 500 de la fecha" icon="receipt" tone="brand"/>
    <KpiCard label="Importe vigente listado" value={formatMoney(sales.filter(v=>!v.cancellation).reduce((a,v)=>a+v.totalCents,0n))} hint="Antes de devoluciones" icon="wallet" tone="success"/>
    <KpiCard label="Anuladas" value={sales.filter(v=>v.cancellation).length} hint="Operaciones anuladas" icon="alert" tone="danger"/>
    <KpiCard label="Con devoluciones" value={sales.filter(v=>v.returns.length).length} hint="Devoluciones parciales" icon="cart" tone="warning"/>
   </div>

   <SectionCard title="Historial de tickets" subtitle="Las anulaciones completas se limitan al día y caja abierta; las devoluciones parciales se operan sobre una caja abierta de la sucursal" icon="receipt">
    <div className="om-card__body--pad" style={{paddingBottom:0}}>
     <InfoCallout icon="info">
      El reintegro de dinero es manual: anular o devolver no transfiere fondos ni revierte cobros bancarios automáticamente.
     </InfoCallout>
    </div>

    {sales.length>0?(
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
        {sales.map(v=>(
         <tr key={v.id}>
          <td>
           <Link className="om-link-chip mono" href={"/pos/ticket/"+v.id}>{v.id.slice(0,8)}</Link>
           <small>{v.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</small>
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
            {!v.cancellation&&!v.returns.length&&!v.shift.closedAt&&date===today?(
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
     <EmptyState icon="receipt" title="No hay ventas para esta fecha" description="Seleccioná otra fecha para consultar tickets anteriores."/>
    )}
   </SectionCard>
  </Shell>
 );
}
