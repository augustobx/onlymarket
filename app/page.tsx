import Link from "next/link";
import {db} from "../src/server/db";
import {requireSession} from "../src/server/auth";
import {classifyLot} from "../src/domain/inventory.mjs";
import {localDay} from "../src/domain/parse.mjs";
import {Shell,money,states,amount} from "./ui";
export const dynamic="force-dynamic";
export default async function Home(){
 const s=await requireSession();
 if(s.role==="CASHIER")return <Shell title="Resumen"/>;
 const where={tenantId:s.tenantId};
 const [products,suppliers,lots,receipts]=await Promise.all([db.product.count({where}),db.supplier.count({where}),db.lot.findMany({where:{...where,quantityMilli:{gt:0n}},include:{product:true,branch:true}}),db.receipt.aggregate({where,_sum:{totalCostCents:true}})]);
 const today=localDay();
 const classified=lots.map(l=>({l,state:classifyLot({today,expiresOn:l.expiresOn?.toISOString().slice(0,10)??null,reviewOn:l.reviewAt?localDay(l.reviewAt):null,alertDays:l.product.alertDays,status:l.status,quantityMilli:l.quantityMilli})}));
 const attention=classified.filter(x=>x.state!=="AVAILABLE");
 return <Shell title="Resumen operativo"><section className="metrics">{[["Productos",products],["Proveedores",suppliers],["Lotes con stock",lots.length],["Lotes a revisar",attention.length],["Valor de stock",money(lots.reduce((a,l)=>a+l.remainingCostCents,0n))],["Compras registradas (histórico)",money(receipts._sum.totalCostCents??0n)]].map(([k,v])=><article key={k}><small>{k}</small><strong>{v}</strong></article>)}</section><section className="panel"><h2>Atención de mercadería</h2><p>Fecha local: {today}. Los avisos no sustituyen controles de calidad.</p>{attention.length===0?<p>No hay lotes que requieran atención.</p>:<div className="tablewrap"><table><thead><tr><th>Producto</th><th>Lote</th><th>Stock</th><th>Estado</th><th>Sucursal</th></tr></thead><tbody>{attention.slice(0,100).map(({l,state})=><tr key={l.id}><td>{l.product.name}</td><td>{l.code}</td><td>{amount(l.quantityMilli,l.product.unit)}</td><td><span className={"status "+state}>{states[state]}</span></td><td>{l.branch.name}</td></tr>)}</tbody></table></div>}<Link href="/inventario">Gestionar inventario</Link></section><section className="panel"><h2>Alcance actual</h2><p>Compras por lote, stock y transformaciones. POS, cuentas corrientes y rentabilidad aún no habilitados.</p></section></Shell>;
}
