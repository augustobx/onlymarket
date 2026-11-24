import Link from "next/link";
import {notFound} from "next/navigation";
import {randomUUID} from "node:crypto";
import {db} from "../../../../src/server/db";
import {requireSession} from "../../../../src/server/auth";
import {Shell,Notice,money,amount} from "../../../ui";
import Editor from "./editor";
export const dynamic="force-dynamic";
const wire=(p:{cashCents:bigint;debitCents:bigint;creditCents:bigint;transferCents:bigint})=>({cashCents:p.cashCents.toString(),debitCents:p.debitCents.toString(),creditCents:p.creditCents.toString(),transferCents:p.transferCents.toString()});
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;ok?:string}>}){
 const s=await requireSession();if(!["OWNER","MANAGER"].includes(s.role))notFound();
 const {id}=await params,q=await searchParams,tenantId=s.tenantId;
 const [sale,shift]=await db.$transaction([
 db.sale.findUnique({where:{tenantId_id:{tenantId,id}},include:{shift:{include:{branch:true}},cancellation:true,lines:{include:{product:true,lot:true}},returns:{include:{line:{include:{product:true}},returnedLot:true},orderBy:{createdAt:"desc"}}}}),
 db.cashShift.findFirst({where:{tenantId,actorId:s.actorUserId,closedAt:null}})
 ],{isolationLevel:"RepeatableRead"});
 if(!sale)notFound();
 const lines=sale.lines.map(l=>({id:l.id,name:l.productName+" · "+l.lot.code,unit:l.product.unit,quantityMilli:l.quantityMilli.toString(),totalCents:l.totalCents.toString(),costCents:l.costCents.toString(),previous:sale.returns.filter(r=>r.saleLineId===l.id).reduce((a,r)=>a+r.quantityMilli,0n).toString()})).filter(l=>BigInt(l.previous)<BigInt(l.quantityMilli));
 const prior=sale.returns.reduce((a,r)=>({cashCents:a.cashCents+r.cashCents,debitCents:a.debitCents+r.debitCents,creditCents:a.creditCents+r.creditCents,transferCents:a.transferCents+r.transferCents}),{cashCents:0n,debitCents:0n,creditCents:0n,transferCents:0n});
 return <Shell title="Devoluciones"><Notice query={q}/><section className="panel"><Link href="/ventas">Volver a ventas</Link><h2>Venta {sale.id.slice(0,8)}</h2><p>{sale.shift.branch.name} · {sale.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})} · Original {money(sale.totalCents)} · Reintegrado {money(sale.returns.reduce((a,r)=>a+r.refundCents,0n))}</p>{sale.cancellation?<p>Venta anulada; no admite devoluciones.</p>:!lines.length?<p>Todos los artículos fueron devueltos.</p>:!shift||shift.branchId!==sale.shift.branchId?<p>Para devolver mercadería, abrí tu propia caja en la sucursal original. <Link href="/pos">Ir a caja</Link></p>:<Editor saleId={sale.id} shiftId={shift.id} requestKey={randomUUID()} lines={lines} sale={wire(sale)} prior={wire(prior)}/>}</section><section className="panel"><h2>Historial de devoluciones</h2>{sale.returns.map(r=><p key={r.id}>{r.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})} · {r.line.productName} · {amount(r.quantityMilli,r.line.product.unit)} · {money(r.refundCents)} · {r.reason} · {r.returnedLot?<Link href={"/trazabilidad?lot="+r.returnedLot.id}>Lote en revisión</Link>:"Descarte"}</p>)}{!sale.returns.length&&<p>Sin devoluciones.</p>}</section></Shell>;
}
