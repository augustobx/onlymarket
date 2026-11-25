import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {addSupplier} from "../actions";
import {Operation} from "../operations";
import {Shell,Field,Notice,money} from "../ui";
import {PageHeader,KpiCard,SectionCard,EmptyState,formatMoney} from "../components/retail-ui";

export const dynamic="force-dynamic";

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;ok?:string}>}){
 const s=await requireSession();
 if(s.role==="CASHIER")return <Shell title="Proveedores"/>;

 const [suppliers,totals]=await Promise.all([
  db.supplier.findMany({where:{tenantId:s.tenantId},orderBy:{name:"asc"},take:500}),
  db.receipt.groupBy({by:["supplierId"],where:{tenantId:s.tenantId},_sum:{totalCostCents:true}}),
 ]);
 const sums=new Map(totals.map(x=>[x.supplierId,x._sum.totalCostCents??0n]));

 return (
  <Shell title="Proveedores">
   <Notice query={await searchParams}/>

   <PageHeader
    kicker="Compras"
    title="Directorio de proveedores"
    subtitle="Contactos comerciales y volumen histórico de mercadería ingresada."
    actions={
     <Operation title="Nuevo proveedor" trigger="+ Nuevo proveedor">
      <form action={addSupplier} className="fields">
       <Field label="Nombre"><input name="name" required maxLength={120}/></Field>
       <Field label="Teléfono"><input name="phone" maxLength={64}/></Field>
       <button>Crear proveedor</button>
      </form>
     </Operation>
    }
   />

   <div className="om-kpi-grid om-kpi-grid--3">
    <KpiCard label="Proveedores listados" value={suppliers.length} hint="Hasta 500 registros" icon="building" tone="brand"/>
    <KpiCard label="Con compras registradas" value={suppliers.filter(p=>sums.has(p.id)).length} hint="Con ingresos históricos" icon="receipt" tone="success"/>
    <KpiCard label="Compras acumuladas" value={formatMoney(suppliers.reduce((a,p)=>a+(sums.get(p.id)??0n),0n))} hint="Consultar deuda en Finanzas" icon="wallet"/>
   </div>

   <SectionCard title="Compras acumuladas por proveedor" subtitle="Totales históricos de mercadería recibida (no representa saldo de cuenta corriente)" icon="truck">
    {suppliers.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Proveedor</th>
         <th>Teléfono</th>
         <th>Compras registradas</th>
        </tr>
       </thead>
       <tbody>
        {suppliers.map(p=>(
         <tr key={p.id}>
          <td><strong>{p.name}</strong></td>
          <td className="mono">{p.phone??"—"}</td>
          <td className="mono"><strong>{money(sums.get(p.id)??0n)}</strong></td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="building" title="Todavía no hay proveedores" description="Cargá tu primer proveedor para registrar compras y recepciones."/>
    )}
   </SectionCard>
  </Shell>
 );
}
