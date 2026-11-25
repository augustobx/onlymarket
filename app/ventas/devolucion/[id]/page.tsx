import Link from "next/link";
import {notFound} from "next/navigation";
import {randomUUID} from "node:crypto";
import {db} from "../../../../src/server/db";
import {requireSession} from "../../../../src/server/auth";
import {Operation} from "../../../operations";
import {Shell,Notice,money,amount} from "../../../ui";
import {PageHeader,KpiCard,SectionCard,EmptyState,InfoCallout} from "../../../components/retail-ui";
import {Icon} from "../../../components/icons";
import Editor from "./editor";

export const dynamic="force-dynamic";

const wire=(p:{cashCents:bigint;debitCents:bigint;creditCents:bigint;transferCents:bigint})=>({
 cashCents:p.cashCents.toString(),
 debitCents:p.debitCents.toString(),
 creditCents:p.creditCents.toString(),
 transferCents:p.transferCents.toString(),
});

export default async function Page({
 params,
 searchParams,
}:{
 params:Promise<{id:string}>;
 searchParams:Promise<{error?:string;ok?:string}>;
}){
 const s=await requireSession();
 if(!["OWNER","MANAGER"].includes(s.role))notFound();

 const {id}=await params;
 const q=await searchParams;
 const tenantId=s.tenantId;

 const [sale,shift]=await db.$transaction([
  db.sale.findUnique({
   where:{tenantId_id:{tenantId,id}},
   include:{
    shift:{include:{branch:true}},
    cancellation:true,
    lines:{include:{product:true,lot:true}},
    returns:{include:{line:{include:{product:true}},returnedLot:true},orderBy:{createdAt:"desc"}},
   },
  }),
  db.cashShift.findFirst({where:{tenantId,actorId:s.actorUserId,closedAt:null}}),
 ],{isolationLevel:"RepeatableRead"});

 if(!sale)notFound();

 const lines=sale.lines
  .map(l=>({
   id:l.id,
   name:l.productName+" · "+l.lot.code,
   unit:l.product.unit,
   quantityMilli:l.quantityMilli.toString(),
   totalCents:l.totalCents.toString(),
   costCents:l.costCents.toString(),
   previous:sale.returns.filter(r=>r.saleLineId===l.id).reduce((a,r)=>a+r.quantityMilli,0n).toString(),
  }))
  .filter(l=>BigInt(l.previous)<BigInt(l.quantityMilli));

 const prior=sale.returns.reduce(
  (a,r)=>({
   cashCents:a.cashCents+r.cashCents,
   debitCents:a.debitCents+r.debitCents,
   creditCents:a.creditCents+r.creditCents,
   transferCents:a.transferCents+r.transferCents,
  }),
  {cashCents:0n,debitCents:0n,creditCents:0n,transferCents:0n}
 );

 return (
  <Shell title="Devoluciones">
   <Notice query={q}/>

   <PageHeader
    kicker={`Venta ${sale.id.slice(0,8)}`}
    title="Devoluciones"
    subtitle={`${sale.shift.branch.name} · ${sale.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}`}
    actions={
     <>
      <Link className="actionlink secondarylink" href="/ventas">
       <Icon name="chevronLeft" size={15}/>
       <span>Volver a ventas</span>
      </Link>
      {!sale.cancellation&&lines.length>0&&shift&&shift.branchId===sale.shift.branchId&&(
       <Operation title="Registrar devolución de artículo" trigger="+ Nueva devolución" wide>
        <Editor saleId={sale.id} shiftId={shift.id} requestKey={randomUUID()} lines={lines} sale={wire(sale)} prior={wire(prior)}/>
       </Operation>
      )}
     </>
    }
   />

   <div className="om-kpi-grid om-kpi-grid--3">
    <KpiCard label="Venta original" value={money(sale.totalCents)} hint="Total del comprobante" icon="receipt" tone="brand"/>
    <KpiCard label="Reintegrado" value={money(sale.returns.reduce((a,r)=>a+r.refundCents,0n))} hint="Devoluciones acumuladas" icon="wallet" tone="warning"/>
    <KpiCard label="Artículos con saldo" value={lines.length} hint="Renglones devolvibles" icon="box" tone="success"/>
   </div>

   {(sale.cancellation||!lines.length||!shift||shift.branchId!==sale.shift.branchId)&&(
    <InfoCallout icon="info" tone="warning">
     {sale.cancellation
      ?"Venta anulada; no admite devoluciones."
      :!lines.length
       ?"Todos los artículos de esta venta ya fueron devueltos."
       :<>Para devolver mercadería, abrí tu propia caja en la sucursal original. <Link href="/pos">Ir a caja</Link></>}
    </InfoCallout>
   )}

   <SectionCard title="Historial de devoluciones" subtitle="Movimientos registrados sobre esta venta" icon="clock" padded>
    {sale.returns.length>0?(
     <div>
      {sale.returns.map(r=>(
       <div className="om-record-row" key={r.id}>
        <div>
         <strong>{r.line.productName} · {amount(r.quantityMilli,r.line.product.unit)}</strong>
         <small>{r.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})} · {r.reason}</small>
        </div>
        <div className="om-row-actions">
         <strong className="mono">{money(r.refundCents)}</strong>
         {r.returnedLot?(
          <Link className="om-link-chip" href={"/trazabilidad?lot="+r.returnedLot.id}>Lote en revisión</Link>
         ):(
          <span className="status BLOCKED">Descarte</span>
         )}
        </div>
       </div>
      ))}
     </div>
    ):(
     <EmptyState icon="receipt" title="Sin devoluciones" description="Esta venta no registra devoluciones parciales."/>
    )}
   </SectionCard>
  </Shell>
 );
}
