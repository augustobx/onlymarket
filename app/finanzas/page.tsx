import {randomUUID} from "node:crypto";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {localDay} from "../../src/domain/parse.mjs";
import {periodBounds,summarizeFinance} from "../../src/domain/finance.mjs";
import {Shell,Notice,Field,money} from "../ui";
import {expenseAction,paymentAction} from "./actions";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{error?:string;ok?:string;from?:string;to?:string}>}){
 const s=await requireSession(),query=await searchParams;
 if(!["OWNER","MANAGER"].includes(s.role))return <Shell title="Finanzas"><p>Sin permisos.</p></Shell>;
 const today=localDay();let from=query.from??today.slice(0,7)+"-01",to=query.to??today;
 let range;try{range=periodBounds(from,to);}catch{from=today.slice(0,7)+"-01";to=today;range=periodBounds(from,to);query.error="Período inválido; se muestra el mes actual.";}
 const where={tenantId:s.tenantId},time={gte:range.start,lt:range.end},dates={gte:range.fromDate,lte:range.toDate};
 const [sales,losses,expenses,purchases,payments,suppliers,allPurchases,allPayments,recentExpenses,recentPayments]=await db.$transaction(async tx=>{
 return Promise.all([
 tx.sale.aggregate({where:{...where,createdAt:time},_sum:{totalCents:true,costCents:true}}),
 tx.stockMovement.groupBy({by:["kind"],orderBy:{kind:"asc"},where:{...where,createdAt:time,kind:{in:["WASTE","GIFT"]}},_sum:{deltaCostCents:true}}),
 tx.expense.aggregate({where:{...where,occurredOn:dates},_sum:{amountCents:true}}),
 tx.receipt.aggregate({where:{...where,createdAt:time},_sum:{totalCostCents:true}}),
 tx.supplierPayment.aggregate({where:{...where,occurredOn:dates},_sum:{amountCents:true}}),
 tx.supplier.findMany({where,orderBy:{name:"asc"}}),
 tx.receipt.groupBy({by:["supplierId"],orderBy:{supplierId:"asc"},where,_sum:{totalCostCents:true}}),
 tx.supplierPayment.groupBy({by:["supplierId"],orderBy:{supplierId:"asc"},where,_sum:{amountCents:true}}),
 tx.expense.findMany({where:{...where,occurredOn:dates},orderBy:[{occurredOn:"desc"},{createdAt:"desc"}],take:100}),
 tx.supplierPayment.findMany({where:{...where,occurredOn:dates},include:{supplier:true},orderBy:[{occurredOn:"desc"},{createdAt:"desc"}],take:100})
 ] as const);
 },{isolationLevel:"RepeatableRead"});
 const salesTotal=sales._sum.totalCents??0n,cost=sales._sum.costCents??0n,waste=-(losses.find(x=>x.kind==="WASTE")?._sum.deltaCostCents??0n),gifts=-(losses.find(x=>x.kind==="GIFT")?._sum.deltaCostCents??0n),expense=expenses._sum.amountCents??0n;
 const report=summarizeFinance({sales:salesTotal,costOfSales:cost,waste,gifts,expenses:expense,purchases:purchases._sum.totalCostCents??0n,payments:payments._sum.amountCents??0n});
 const bought=new Map(allPurchases.map(x=>[x.supplierId,x._sum.totalCostCents??0n])),paid=new Map(allPayments.map(x=>[x.supplierId,x._sum.amountCents??0n]));
 const metrics:[string,bigint][]=[["Ventas",salesTotal],["Costo de ventas",cost],["Ganancia bruta",report.gross],["Mermas",waste],["Regalos",gifts],["Gastos operativos",expense],["Resultado operativo estimado",report.estimatedOperatingProfit],["Compras recibidas",report.purchases],["Pagos a proveedores",report.payments]];
 return <Shell title="Finanzas y rentabilidad"><Notice query={query}/><section className="panel"><form method="get" className="formgrid"><Field label="Desde"><input type="date" name="from" defaultValue={from}/></Field><Field label="Hasta"><input type="date" name="to" defaultValue={to}/></Field><button>Consultar período</button></form><p>Resultado operativo estimado: ventas menos costo de lo vendido, mermas, regalos y gastos registrados. No equivale a utilidad contable o fiscal; no incluye impuestos, depreciaciones ni saldos iniciales no cargados.</p></section><section className="metrics">{metrics.map(([name,value])=><article key={name}><small>{name}</small><strong>{money(value)}</strong></article>)}</section><section className="panel"><h2>Registrar gasto operativo</h2><p>No registrar aquí pagos de mercadería ya contabilizada como compra. Estos movimientos no alteran el arqueo del POS.</p><form action={expenseAction} className="formgrid"><input type="hidden" name="requestKey" value={randomUUID()}/><Field label="Categoría"><input name="category" required placeholder="Alquiler, luz, sueldos..."/></Field><Field label="Detalle"><input name="description" required/></Field><Field label="Importe ($)"><input name="amount" required inputMode="decimal"/></Field><Field label="Fecha"><input name="date" type="date" required max={today} defaultValue={today}/></Field><button>Registrar gasto</button></form></section><section className="panel"><h2>Registrar pago a proveedor</h2><p>El pago reduce el saldo del proveedor, no la ganancia del período ni el efectivo de caja POS.</p><form action={paymentAction} className="formgrid"><input type="hidden" name="requestKey" value={randomUUID()}/><Field label="Proveedor"><select name="supplierId">{suppliers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Importe ($)"><input name="amount" required inputMode="decimal"/></Field><Field label="Fecha"><input name="date" type="date" required max={today} defaultValue={today}/></Field><Field label="Medio de pago"><select name="payment"><option value="CASH">Efectivo</option><option value="TRANSFER">Transferencia</option><option value="DEBIT">Débito</option><option value="CREDIT">Crédito</option></select></Field><Field label="Referencia"><input name="reference"/></Field><button>Registrar pago</button></form></section><section className="panel"><h2>Cuenta corriente de proveedores · histórico</h2><p>Saldo según compras y pagos registrados desde el alta del sistema. Positivo: deuda; negativo: anticipo.</p><div className="tablewrap"><table><thead><tr><th>Proveedor</th><th>Compras</th><th>Pagos</th><th>Saldo</th></tr></thead><tbody>{suppliers.map(p=><tr key={p.id}><td>{p.name}</td><td>{money(bought.get(p.id)??0n)}</td><td>{money(paid.get(p.id)??0n)}</td><td>{money((bought.get(p.id)??0n)-(paid.get(p.id)??0n))}</td></tr>)}</tbody></table></div></section><section className="panel"><h2>Últimos gastos del período (hasta 100)</h2>{recentExpenses.map(e=><p key={e.id}>{e.occurredOn.toISOString().slice(0,10)} · {e.category} · {e.description} · {money(e.amountCents)}</p>)}{!recentExpenses.length&&<p>Sin gastos registrados.</p>}<h2>Últimos pagos del período (hasta 100)</h2>{recentPayments.map(p=><p key={p.id}>{p.occurredOn.toISOString().slice(0,10)} · {p.supplier.name} · {money(p.amountCents)}</p>)}{!recentPayments.length&&<p>Sin pagos registrados.</p>}</section></Shell>;
}
