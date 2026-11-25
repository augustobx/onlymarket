import Link from "next/link";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {addSupplier,updateSupplier} from "../actions";
import {Operation} from "../operations";
import {Shell,Field,Notice,money} from "../ui";
import {PageHeader,KpiCard,SectionCard,EmptyState,formatMoney} from "../components/retail-ui";
import {Icon} from "../components/icons";

export const dynamic="force-dynamic";

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;ok?:string;q?:string}>}){
 const s=await requireSession();
 if(s.role==="CASHIER")return <Shell title="Proveedores"/>;

 const query=await searchParams;
 const term=(query.q??"").trim().slice(0,120);

 const [suppliers,totals,payments]=await Promise.all([
  db.supplier.findMany({
   where:{
    tenantId:s.tenantId,
    ...(term?{OR:[{name:{contains:term,mode:"insensitive"}},{phone:{contains:term,mode:"insensitive"}}]}:{}),
   },
   orderBy:{name:"asc"},
   take:500,
  }),
  db.receipt.groupBy({by:["supplierId"],where:{tenantId:s.tenantId},_sum:{totalCostCents:true}}),
  db.supplierPayment.groupBy({by:["supplierId"],where:{tenantId:s.tenantId},_sum:{amountCents:true}}),
 ]);
 const sums=new Map(totals.map(x=>[x.supplierId,x._sum.totalCostCents??0n]));
 const paid=new Map(payments.map(x=>[x.supplierId,x._sum.amountCents??0n]));
 const totalDebt=suppliers.reduce((a,p)=>a+((sums.get(p.id)??0n)-(paid.get(p.id)??0n)),0n);

 return (
  <Shell title="Proveedores">
   <Notice query={query}/>

   <PageHeader
    kicker="Compras"
    title="Directorio de proveedores"
    subtitle="Contactos comerciales, volumen histórico de compras y saldo de cuenta corriente."
    actions={
     <div className="om-row-actions">
      {["OWNER","MANAGER"].includes(s.role)&&(
       <Link className="actionlink secondarylink" href="/finanzas">
        <Icon name="wallet" size={15}/>
        <span>Registrar pago</span>
       </Link>
      )}
      <Operation title="Nuevo proveedor" trigger="+ Nuevo proveedor">
       <form action={addSupplier} className="fields">
        <Field label="Nombre"><input name="name" required maxLength={120}/></Field>
        <Field label="Teléfono"><input name="phone" maxLength={64}/></Field>
        <button>Crear proveedor</button>
       </form>
      </Operation>
     </div>
    }
   />

   <div className="om-kpi-grid">
    <KpiCard label="Proveedores listados" value={suppliers.length} hint="Hasta 500 registros" icon="building" tone="brand"/>
    <KpiCard label="Con compras registradas" value={suppliers.filter(p=>sums.has(p.id)).length} hint="Con ingresos históricos" icon="receipt" tone="success"/>
    <KpiCard label="Compras acumuladas" value={formatMoney(suppliers.reduce((a,p)=>a+(sums.get(p.id)??0n),0n))} hint="Total de mercadería recibida" icon="truck"/>
    <KpiCard label="Saldo neto de cta. cte." value={formatMoney(totalDebt)} hint="Compras menos pagos registrados" icon="wallet" tone={totalDebt>0n?"warning":"success"}/>
   </div>

   <SectionCard title="Cuenta corriente y contactos" subtitle="Compras acumuladas, pagos imputados y saldo pendiente por proveedor" icon="truck">
    <form method="get" className="v2-toolbar">
     <label className="v2-search">
      <Icon name="search" size={16}/>
      <input name="q" aria-label="Buscar proveedor" placeholder="Buscar por nombre o teléfono..." defaultValue={term}/>
     </label>
     <button className="secondary">
      <Icon name="search" size={15}/>
      <span>Buscar</span>
     </button>
     {term&&<Link className="actionlink secondarylink" href="/proveedores">Ver todos</Link>}
    </form>

    {suppliers.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Proveedor</th>
         <th>Teléfono</th>
         <th>Compras registradas</th>
         <th>Pagos imputados</th>
         <th>Saldo adeudado</th>
         <th>Acciones</th>
        </tr>
       </thead>
       <tbody>
        {suppliers.map(p=>{
         const b=sums.get(p.id)??0n;
         const pg=paid.get(p.id)??0n;
         const bal=b-pg;
         return (
          <tr key={p.id}>
           <td><strong>{p.name}</strong></td>
           <td className="mono">{p.phone??"—"}</td>
           <td className="mono">{money(b)}</td>
           <td className="mono">{money(pg)}</td>
           <td className="mono">
            <span className={"status "+(bal>0n?"REVIEW":"AVAILABLE")}>{money(bal)}</span>
           </td>
           <td>
            <Operation title={"Editar · "+p.name} trigger="Editar" variant="secondary">
             <form action={updateSupplier} className="fields">
              <input type="hidden" name="id" value={p.id}/>
              <Field label="Nombre"><input name="name" defaultValue={p.name} required maxLength={120}/></Field>
              <Field label="Teléfono"><input name="phone" defaultValue={p.phone??""} maxLength={64}/></Field>
              <button>Guardar cambios</button>
             </form>
            </Operation>
           </td>
          </tr>
         );
        })}
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
