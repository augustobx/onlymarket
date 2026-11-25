import {randomUUID} from "node:crypto";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {localDay} from "../../src/domain/parse.mjs";
import {periodBounds,summarizeFinance} from "../../src/domain/finance.mjs";
import {Operation} from "../operations";
import {Shell,Notice,Field,money} from "../ui";
import {PageHeader,KpiCard,SectionCard,EmptyState,InfoCallout,formatMoney} from "../components/retail-ui";
import {Icon} from "../components/icons";
import {expenseAction,paymentAction} from "./actions";

export const dynamic="force-dynamic";

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;ok?:string;from?:string;to?:string}>}){
 const s=await requireSession();
 const query=await searchParams;
 if(!["OWNER","MANAGER"].includes(s.role))return <Shell title="Finanzas"><p className="error">Sin permisos.</p></Shell>;

 const today=localDay();
 let from=query.from??today.slice(0,7)+"-01";
 let to=query.to??today;
 let range;
 try{range=periodBounds(from,to);}
 catch{from=today.slice(0,7)+"-01";to=today;range=periodBounds(today,today);query.error="Período inválido; se muestra el mes actual.";}

 const where={tenantId:s.tenantId};
 const time={gte:range.start,lt:range.end};
 const dates={gte:range.fromDate,lte:range.toDate};

 const [sales,losses,expenses,purchases,payments,suppliers,allPurchases,allPayments,recentExpenses,recentPayments,adjustments,returns]=
  await db.$transaction(
   async tx=>Promise.all([
    tx.sale.aggregate({where:{...where,createdAt:time,cancellation:null},_sum:{totalCents:true,costCents:true}}),
    tx.stockMovement.groupBy({by:["kind"],orderBy:{kind:"asc"},where:{...where,createdAt:time,kind:{in:["WASTE","GIFT"]}},_sum:{deltaCostCents:true}}),
    tx.expense.aggregate({where:{...where,occurredOn:dates},_sum:{amountCents:true}}),
    tx.receipt.aggregate({where:{...where,createdAt:time},_sum:{totalCostCents:true}}),
    tx.supplierPayment.aggregate({where:{...where,occurredOn:dates},_sum:{amountCents:true}}),
    tx.supplier.findMany({where,orderBy:{name:"asc"}}),
    tx.receipt.groupBy({by:["supplierId"],orderBy:{supplierId:"asc"},where,_sum:{totalCostCents:true}}),
    tx.supplierPayment.groupBy({by:["supplierId"],orderBy:{supplierId:"asc"},where,_sum:{amountCents:true}}),
    tx.expense.findMany({where:{...where,occurredOn:dates},orderBy:[{occurredOn:"desc"},{createdAt:"desc"}],take:100}),
    tx.supplierPayment.findMany({where:{...where,occurredOn:dates},include:{supplier:true},orderBy:[{occurredOn:"desc"},{createdAt:"desc"}],take:100}),
    tx.$queryRaw<{shortage:bigint;surplus:bigint}[]>`
     SELECT COALESCE(SUM("costCents") FILTER(WHERE "afterMilli"<"beforeMilli"),0)::bigint shortage,
            COALESCE(SUM("costCents") FILTER(WHERE "afterMilli">"beforeMilli"),0)::bigint surplus
     FROM "StockControl" WHERE "tenantId"=${s.tenantId} AND kind='COUNT' AND "createdAt">=${range.start} AND "createdAt"<${range.end}`,
    tx.saleReturn.aggregate({where:{...where,createdAt:time},_sum:{refundCents:true,costCents:true}}),
   ] as const),
   {isolationLevel:"RepeatableRead"}
  );

 const salesTotal=sales._sum.totalCents??0n;
 const cost=sales._sum.costCents??0n;
 const waste=-(losses.find(x=>x.kind==="WASTE")?._sum.deltaCostCents??0n);
 const gifts=-(losses.find(x=>x.kind==="GIFT")?._sum.deltaCostCents??0n);
 const expense=expenses._sum.amountCents??0n;
 const refunds=returns._sum.refundCents??0n;
 const returnedCost=returns._sum.costCents??0n;

 const report=summarizeFinance({
  sales:salesTotal,
  costOfSales:cost,
  refunds,
  returnedCost,
  waste,
  gifts,
  expenses:expense,
  purchases:purchases._sum.totalCostCents??0n,
  payments:payments._sum.amountCents??0n,
 });

 const bought=new Map(allPurchases.map(x=>[x.supplierId,x._sum.totalCostCents??0n]));
 const paid=new Map(allPayments.map(x=>[x.supplierId,x._sum.amountCents??0n]));
 const shortage=adjustments[0]?.shortage??0n;
 const surplus=adjustments[0]?.surplus??0n;

 const metrics:[string,bigint][]=[
  ["Ventas brutas vigentes",salesTotal],
  ["Devoluciones",refunds],
  ["Ventas netas",salesTotal-refunds],
  ["Costo de ventas neto",cost-returnedCost],
  ["Ganancia bruta",report.gross],
  ["Mermas y descartes",waste-shortage],
  ["Faltantes de inventario",shortage],
  ["Sobrantes valorizados (no ingreso)",surplus],
  ["Regalos",gifts],
  ["Gastos operativos",expense],
  ["Resultado operativo estimado",report.estimatedOperatingProfit],
  ["Compras recibidas",report.purchases],
  ["Pagos a proveedores",report.payments],
 ];

 return (
  <Shell title="Finanzas y rentabilidad">
   <Notice query={query}/>

   <PageHeader
    kicker="Resultados del período"
    title="Finanzas y rentabilidad"
    subtitle={`Situación económica del ${from.split("-").reverse().join("/")} al ${to.split("-").reverse().join("/")}`}
    actions={
     <>
      <Operation
       title="Registrar gasto operativo"
       trigger="+ Registrar gasto"
       description="No registrar aquí compras de mercadería ya ingresadas. No altera el arqueo del POS."
      >
       <form action={expenseAction} className="fields">
        <input type="hidden" name="requestKey" value={randomUUID()}/>
        <Field label="Categoría"><input name="category" required placeholder="Alquiler, luz, sueldos..."/></Field>
        <Field label="Detalle"><input name="description" required/></Field>
        <Field label="Importe ($)"><input name="amount" required inputMode="decimal"/></Field>
        <Field label="Fecha"><input name="date" type="date" required max={today} defaultValue={today}/></Field>
        <button>Registrar gasto</button>
       </form>
      </Operation>
      <Operation
       title="Registrar pago a proveedor"
       trigger="Registrar pago a proveedor"
       variant="secondary"
       description="Reduce el saldo adeudado al proveedor, sin alterar la ganancia del período ni el efectivo de caja."
      >
       <form action={paymentAction} className="fields">
        <input type="hidden" name="requestKey" value={randomUUID()}/>
        <Field label="Proveedor">
         <select name="supplierId">{suppliers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </Field>
        <Field label="Importe ($)"><input name="amount" required inputMode="decimal"/></Field>
        <Field label="Fecha"><input name="date" type="date" required max={today} defaultValue={today}/></Field>
        <Field label="Medio de pago">
         <select name="payment">
          <option value="CASH">Efectivo</option>
          <option value="TRANSFER">Transferencia</option>
          <option value="DEBIT">Débito</option>
          <option value="CREDIT">Crédito</option>
         </select>
        </Field>
        <Field label="Referencia"><input name="reference"/></Field>
        <button>Registrar pago</button>
       </form>
      </Operation>
      <a className="actionlink secondarylink" href={"/api/export?"+new URLSearchParams({type:"finanzas",from,to}).toString()}>
       <Icon name="layers" size={15}/>
       <span>Exportar CSV</span>
      </a>
     </>
    }
   />

   <SectionCard title="Período de consulta" icon="sliders" padded>
    <form method="get" className="formgrid">
     <Field label="Desde"><input type="date" name="from" defaultValue={from}/></Field>
     <Field label="Hasta"><input type="date" name="to" defaultValue={to}/></Field>
     <button className="secondary">
      <Icon name="filter" size={15}/>
      <span>Consultar período</span>
     </button>
    </form>
    <InfoCallout icon="info">
     Devoluciones reconocidas en su fecha de registro. El resultado operativo estimado no reemplaza balances contables ni liquidaciones impositivas.
    </InfoCallout>
   </SectionCard>

   <div className="om-kpi-grid">
    <KpiCard label="Ventas netas" value={formatMoney(salesTotal-refunds)} hint="Devoluciones descontadas por fecha" icon="chart" tone="brand"/>
    <KpiCard label="Ganancia bruta" value={formatMoney(report.gross)} hint="Ventas menos costo neto" icon="wallet" tone="success"/>
    <KpiCard label="Resultado operativo estimado" value={formatMoney(report.estimatedOperatingProfit)} hint="Antes de impuestos y amortizaciones" icon="receipt" tone={report.estimatedOperatingProfit<0n?"danger":"success"}/>
    <KpiCard label="Compras recibidas" value={formatMoney(report.purchases)} hint="Costo de mercadería ingresada" icon="truck"/>
   </div>

   <SectionCard title="Desglose económico del período" subtitle="Detalle de ingresos, costos, mermas y gastos" icon="chart" padded>
    <section className="metrics" style={{marginBottom:0}}>
     {metrics.map(([name,value])=>(
      <article key={name}>
       <small>{name}</small>
       <strong>{money(value)}</strong>
      </article>
     ))}
    </section>
   </SectionCard>

   <SectionCard title="Cuenta corriente de proveedores · histórico" subtitle="Positivo indica deuda; negativo indica anticipo a favor" icon="building">
    {suppliers.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Proveedor</th>
         <th>Compras</th>
         <th>Pagos</th>
         <th>Saldo</th>
        </tr>
       </thead>
       <tbody>
        {suppliers.map(p=>{
         const bal=(bought.get(p.id)??0n)-(paid.get(p.id)??0n);
         return (
          <tr key={p.id}>
           <td><strong>{p.name}</strong></td>
           <td className="mono">{money(bought.get(p.id)??0n)}</td>
           <td className="mono">{money(paid.get(p.id)??0n)}</td>
           <td className="mono">
            <span className={"status "+(bal>0n?"REVIEW":"AVAILABLE")}>{money(bal)}</span>
           </td>
          </tr>
         );
        })}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="building" title="Sin proveedores registrados" description="Cargá proveedores para seguir su cuenta corriente."/>
    )}
   </SectionCard>

   <div className="om-dashgrid">
    <SectionCard title="Gastos del período" subtitle="Hasta 100 movimientos" icon="wallet">
     {recentExpenses.length>0?(
      <div className="tablewrap">
       <table>
        <thead>
         <tr>
          <th>Fecha</th>
          <th>Categoría / detalle</th>
          <th>Importe</th>
         </tr>
        </thead>
        <tbody>
         {recentExpenses.map(e=>(
          <tr key={e.id}>
           <td className="mono">{e.occurredOn.toISOString().slice(0,10)}</td>
           <td><strong>{e.category}</strong><small>{e.description}</small></td>
           <td className="mono"><strong>{formatMoney(e.amountCents)}</strong></td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     ):(
      <EmptyState icon="wallet" title="Sin gastos registrados" description="Los gastos operativos del período aparecerán aquí."/>
     )}
    </SectionCard>

    <SectionCard title="Pagos a proveedores" subtitle="Hasta 100 movimientos" icon="banknote">
     {recentPayments.length>0?(
      <div className="tablewrap">
       <table>
        <thead>
         <tr>
          <th>Fecha</th>
          <th>Proveedor</th>
          <th>Importe</th>
         </tr>
        </thead>
        <tbody>
         {recentPayments.map(p=>(
          <tr key={p.id}>
           <td className="mono">{p.occurredOn.toISOString().slice(0,10)}</td>
           <td><strong>{p.supplier.name}</strong></td>
           <td className="mono"><strong>{formatMoney(p.amountCents)}</strong></td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     ):(
      <EmptyState icon="banknote" title="Sin pagos registrados" description="Los pagos imputados a proveedores aparecerán aquí."/>
     )}
    </SectionCard>
   </div>
  </Shell>
 );
}
