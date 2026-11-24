import Link from "next/link";
import {notFound} from "next/navigation";
import {requireSession} from "../../../../src/server/auth";
import {db} from "../../../../src/server/db";
import {money,amount} from "../../../ui";
import PrintButton from "./print";
export const dynamic="force-dynamic";
const labels={CASH:"Efectivo",DEBIT:"Débito",CREDIT:"Crédito",TRANSFER:"Transferencia"};
export default async function Page({params}:{params:Promise<{id:string}>}){
 const s=await requireSession(),{id}=await params;
 if(!["OWNER","MANAGER","CASHIER"].includes(s.role))notFound();
 const sale=await db.sale.findUnique({where:{tenantId_id:{tenantId:s.tenantId,id}},include:{cancellation:true,shift:{include:{branch:true}},lines:{include:{lot:true,product:true}}}});
 if(!sale||(s.role==="CASHIER"&&sale.actorId!==s.actorUserId))notFound();
 return <main className="ticketpage"><div className="tickettools"><Link href="/pos">Volver al punto de venta</Link><PrintButton/></div><article className="ticket"><h1>{s.tenantName}</h1><p>{sale.shift.branch.name}</p><h2>Comprobante interno</h2><p>NO VÁLIDO COMO FACTURA</p>{sale.cancellation&&<p className="error"><strong>VENTA ANULADA</strong><br/>{sale.cancellation.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})} · {sale.cancellation.reason}</p>}<p>{sale.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}<br/>Operación: {sale.id}</p><hr/>{sale.lines.map(l=><div className="ticketline" key={l.id}><strong>{l.productName}</strong><span>{amount(l.quantityMilli,l.product.unit)} × {money(l.unitPriceCents)}</span><span>Lote: {l.lot.code}</span>{l.promotionLabel&&<span>{l.promotionLabel}</span>}{l.subtotalCents>l.totalCents&&<span>Descuento: {money(l.subtotalCents-l.totalCents)}</span>}<b>{money(l.totalCents)}</b></div>)}<hr/><div className="ticketsum"><span>Subtotal</span><b>{money(sale.subtotalCents)}</b><span>Descuentos</span><b>{money(sale.subtotalCents-sale.totalCents)}</b><strong>Total</strong><strong>{money(sale.totalCents)}</strong><span>Medio de pago</span><b>{labels[sale.payment]}</b>{sale.tenderedCents!==null&&<><span>Recibido</span><b>{money(sale.tenderedCents)}</b></>}{sale.changeCents!==null&&<><span>Vuelto</span><b>{money(sale.changeCents)}</b></>}</div><hr/><p>Gracias por su compra.</p></article></main>;
}
