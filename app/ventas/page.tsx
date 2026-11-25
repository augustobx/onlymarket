import {Operation} from "../operations";
import Link from "next/link";
import {randomUUID} from "node:crypto";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {localDay} from "../../src/domain/parse.mjs";
import {periodBounds} from "../../src/domain/finance.mjs";
import {Shell,Field,Notice,money} from "../ui";
import {cancelAction} from "./actions";
export const dynamic="force-dynamic";
const labels={CASH:"Efectivo",DEBIT:"Débito",CREDIT:"Crédito",TRANSFER:"Transferencia",MIXED:"Mixto"};
export default async function Page({searchParams}:{searchParams:Promise<{error?:string;ok?:string;date?:string}>}){
 const s=await requireSession(),query=await searchParams;
 if(!["OWNER","MANAGER"].includes(s.role))return <Shell title="Ventas"><p>Sin permisos.</p></Shell>;
 const today=localDay();let date=query.date??today;let range;try{range=periodBounds(date,date);}catch{date=today;range=periodBounds(today,today);}
 const [sales,members]=await Promise.all([
  db.sale.findMany({where:{tenantId:s.tenantId,createdAt:{gte:range.start,lt:range.end}},include:{shift:{include:{branch:true}},cancellation:true,returns:true},orderBy:{createdAt:"desc"},take:500}),
  db.membership.findMany({where:{tenantId:s.tenantId},include:{user:{select:{id:true,email:true}}}})
 ]);
 const actors=new Map(members.map(m=>[m.userId,m.user.email]));
 return <Shell title="Ventas y anulaciones"><Notice query={query}/><section className="panel"><form method="get" className="formgrid"><Field label="Fecha"><input type="date" name="date" defaultValue={date}/></Field><button>Consultar</button></form><p>Hasta 500 ventas de la fecha. Las anulaciones completas se limitan al día y caja abierta. Las devoluciones parciales se registran en una caja actual de la misma sucursal. El reintegro es manual: esta acción no transfiere dinero ni revierte pagos bancarios.</p></section><section className="panel"><div className="tablewrap"><table><thead><tr><th>Venta</th><th>Sucursal / operador</th><th>Pago</th><th>Importe</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{sales.map(v=><tr key={v.id}><td><Link href={"/pos/ticket/"+v.id}>{v.id.slice(0,8)}</Link><small>{v.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</small></td><td>{v.shift.branch.name}<small>{actors.get(v.shift.actorId)??v.shift.actorId.slice(0,8)}</small></td><td>{labels[v.payment]}{v.payment==="MIXED"&&<small>Efectivo {money(v.cashCents)} · Débito {money(v.debitCents)} · Crédito {money(v.creditCents)} · Transferencia {money(v.transferCents)}</small>}</td><td>{money(v.totalCents)}</td><td>{v.cancellation?"Anulada":v.returns.length?"Con devoluciones":"Registrada"}{v.cancellation&&<small>{v.cancellation.reason} · {v.cancellation.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</small>}</td><td>{!v.cancellation&&<Link href={"/ventas/devolucion/"+v.id}>Ver / devolver artículos</Link>}{!v.cancellation&&!v.returns.length&&!v.shift.closedAt&&date===today?<Operation title={"Anular venta · "+v.id.slice(0,8)} trigger="Anular venta" variant="secondary" description="Esta acción registra una anulación completa. El reintegro se realiza manualmente."><form action={cancelAction} className="fields"><input type="hidden" name="saleId" value={v.id}/><input type="hidden" name="requestKey" value={randomUUID()}/><Field label="Destino de todos los artículos"><select name="disposition"><option value="REVIEW">Regresar al lote en revisión (bloquea venta del lote)</option><option value="WASTE">Descartar y contabilizar pérdida</option></select></Field><Field label="Motivo"><input name="reason" required maxLength={300}/></Field><label><span>Confirmo el reintegro manual y el destino de la mercadería</span><input type="checkbox" name="confirm" value="yes" required/></label><button>Anular y registrar reintegro</button></form></Operation>:<small>No disponible</small>}</td></tr>)}</tbody></table></div>{!sales.length&&<p>No hay ventas para esta fecha.</p>}</section></Shell>;
}
