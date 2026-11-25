import Link from "next/link";
import {notFound} from "next/navigation";
import {requireSession} from "../../../../src/server/auth";
import {db} from "../../../../src/server/db";
import {expectedCash} from "../../../../src/server/sales.mjs";
import {money} from "../../../ui";
import PrintButton from "../../ticket/[id]/print";

export const dynamic="force-dynamic";

export default async function Page({params}:{params:Promise<{id:string}>}){
 const s=await requireSession(),{id}=await params;
 if(!["OWNER","MANAGER","CASHIER"].includes(s.role))notFound();

 const shift=await db.cashShift.findUnique({
  where:{tenantId_id:{tenantId:s.tenantId,id}},
  include:{
   branch:true,
   sales:{include:{cancellation:true}},
   cashMovements:{orderBy:{createdAt:"asc"}},
   returns:{orderBy:{createdAt:"asc"}},
  },
 });
 if(!shift||(s.role==="CASHIER"&&shift.actorId!==s.actorUserId))notFound();

 const [operator,liveExpected]=await Promise.all([
  db.membership.findUnique({where:{tenantId_userId:{tenantId:s.tenantId,userId:shift.actorId}},include:{user:{select:{email:true}}}}),
  expectedCash(db,shift),
 ]);

 const validSales=shift.sales.filter(v=>!v.cancellation);
 const cancelledCount=shift.sales.length-validSales.length;
 const sumBy=(fn:(v:typeof validSales[number])=>bigint)=>validSales.reduce((a,v)=>a+fn(v),0n);
 const cashSales=sumBy(v=>v.cashCents);
 const debitSales=sumBy(v=>v.debitCents);
 const creditSales=sumBy(v=>v.creditCents);
 const transferSales=sumBy(v=>v.transferCents);
 const totalSales=sumBy(v=>v.totalCents);

 const cashReturns=shift.returns.reduce((a,r)=>a+r.cashCents,0n);
 const debitReturns=shift.returns.reduce((a,r)=>a+r.debitCents,0n);
 const creditReturns=shift.returns.reduce((a,r)=>a+r.creditCents,0n);
 const transferReturns=shift.returns.reduce((a,r)=>a+r.transferCents,0n);
 const totalReturns=shift.returns.reduce((a,r)=>a+r.refundCents,0n);

 const cashIn=shift.cashMovements.filter(m=>m.kind==="IN").reduce((a,m)=>a+m.amountCents,0n);
 const cashOut=shift.cashMovements.filter(m=>m.kind==="OUT").reduce((a,m)=>a+m.amountCents,0n);
 const expected=shift.expectedCents??liveExpected;
 const diff=shift.countedCents!==null?shift.countedCents-expected:null;

 const toolsLeft=(
  <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
   <Link href="/pos">Volver al punto de venta</Link>
   {["OWNER","MANAGER"].includes(s.role)&&<Link href="/">Ir al resumen</Link>}
  </div>
 );

 return (
  <PrintButton toolsLeft={toolsLeft}>
   <article className="ticket">
    <h1>{s.tenantName}</h1>
    <p>{shift.branch.name}</p>
    <h2>Comprobante de cierre de caja</h2>
    <p>{shift.closedAt?"ARQUEO DEFINITIVO":"TURNO ABIERTO (PARCIAL)"}</p>
    <p>
     Turno: <span className="mono">{shift.id.slice(0,8)}</span>
     <br/>
     Cajero: {operator?.user.email??shift.actorId.slice(0,8)}
     <br/>
     Apertura: {shift.openedAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}
     <br/>
     Cierre: {shift.closedAt?shift.closedAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"}):"En curso"}
    </p>
    <hr/>
    <div className="ticketsum">
     <span>Tickets vigentes</span><b>{validSales.length}</b>
     <span>Tickets anulados</span><b>{cancelledCount}</b>
     <span>Ventas vigentes</span><b>{money(totalSales)}</b>
     <span>Efectivo ventas</span><b>{money(cashSales)}</b>
     <span>Débito ventas</span><b>{money(debitSales)}</b>
     <span>Crédito ventas</span><b>{money(creditSales)}</b>
     <span>Transferencia ventas</span><b>{money(transferSales)}</b>
    </div>
    <hr/>
    <div className="ticketsum">
     <span>Fondo inicial</span><b>{money(shift.openingCents)}</b>
     <span>Ingresos manuales</span><b>{money(cashIn)}</b>
     <span>Retiros manuales</span><b>-{money(cashOut)}</b>
     <span>Devoluciones efectivo</span><b>-{money(cashReturns)}</b>
     {(debitReturns+creditReturns+transferReturns)>0n&&(
      <><span>Devoluciones electrónicas</span><b>-{money(debitReturns+creditReturns+transferReturns)}</b></>
     )}
     <span>Total devoluciones ({shift.returns.length})</span><b>-{money(totalReturns)}</b>
    </div>
    <hr/>
    <div className="ticketsum">
     <strong>Efectivo esperado</strong><strong>{money(expected)}</strong>
     <span>Efectivo contado</span><b>{shift.countedCents!==null?money(shift.countedCents):"Pendiente"}</b>
     {diff!==null&&(
      <>
       <strong>Diferencia de arqueo</strong>
       <strong>{diff>0n?"+"+money(diff):money(diff)}</strong>
      </>
     )}
    </div>
    {shift.cashMovements.length>0&&(
     <>
      <hr/>
      <h2>Movimientos de efectivo</h2>
      {shift.cashMovements.map(m=>(
       <div className="ticketline" key={m.id}>
        <span>{m.kind==="IN"?"Ingreso":"Retiro"} · {m.reason}</span>
        <b>{m.kind==="IN"?"+ ":"- "}{money(m.amountCents)}</b>
       </div>
      ))}
     </>
    )}
    <hr/>
    <p>Documento de control interno · ID {shift.id}</p>
   </article>
  </PrintButton>
 );
}
