import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {Operation} from "../operations";
import {Shell,Field,Notice,money} from "../ui";
import {PageHeader,KpiCard,SectionCard,EmptyState,formatMoney} from "../components/retail-ui";
import {Icon} from "../components/icons";
import {customerAction} from "./actions";

export const dynamic="force-dynamic";

type Stats={id:string;visits:bigint;net:bigint;points:bigint};

export default async function Page({searchParams}:{searchParams:Promise<{q?:string;ok?:string;error?:string}>}){
 const s=await requireSession();
 if(!["OWNER","MANAGER"].includes(s.role))return <Shell title="Clientes"><p className="error">Sin permisos</p></Shell>;

 const q=await searchParams;
 const tenantId=s.tenantId;
 const term=(q.q??"").slice(0,120);

 const customers=await db.customer.findMany({
  where:{tenantId,...(term?{OR:[{name:{contains:term,mode:"insensitive"}},{code:{contains:term,mode:"insensitive"}}]}:{})},
  orderBy:{name:"asc"},
  take:500,
 });

 const stats=await db.$queryRaw<Stats[]>`
  WITH refunds AS (SELECT "saleId",SUM("refundCents") AS amount FROM "SaleReturn" WHERE "tenantId"=${tenantId} GROUP BY "saleId"),
  net AS (
   SELECT s."customerId",s."totalCents"-COALESCE(r.amount,0) AS amount,s."pointsRateCents" AS rate
   FROM "Sale" s
   LEFT JOIN refunds r ON r."saleId"=s.id
   LEFT JOIN "SaleCancellation" c ON c."tenantId"=s."tenantId" AND c."saleId"=s.id
   WHERE s."tenantId"=${tenantId} AND s."customerId" IS NOT NULL AND c.id IS NULL
  )
  SELECT "customerId" AS id,COUNT(*) FILTER(WHERE amount>0)::bigint visits,COALESCE(SUM(amount),0)::bigint net,COALESCE(SUM(FLOOR(amount/NULLIF(rate,0))),0)::bigint points
  FROM net GROUP BY "customerId"`;

 const byId=new Map(stats.map(x=>[x.id,x]));

 return (
  <Shell title="Clientes y fidelización">
   <Notice query={q}/>

   <PageHeader
    kicker="Comercial"
    title="Directorio de clientes"
    subtitle="Socios registrados, compras netas acumuladas y seguimiento de puntos."
    actions={
     <Operation
      title="Alta de socio"
      trigger="+ Nuevo cliente"
      description="Al elegirlo en caja recibe el descuento de socio configurado si mejora la oferta individual."
     >
      <form action={customerAction} className="fields">
       <Field label="Código de socio"><input name="code" required maxLength={64}/></Field>
       <Field label="Nombre"><input name="name" required maxLength={120}/></Field>
       <button>Crear cliente</button>
      </form>
     </Operation>
    }
   />

   <div className="om-kpi-grid om-kpi-grid--3">
    <KpiCard label="Socios listados" value={customers.length} hint="Resultados de búsqueda" icon="users" tone="brand"/>
    <KpiCard label="Socios activos" value={customers.filter(c=>c.active).length} hint="Habilitados en POS" icon="check" tone="success"/>
    <KpiCard label="Compras netas acumuladas" value={formatMoney(customers.reduce((a,c)=>a+(byId.get(c.id)?.net??0n),0n))} hint="Total de socios listados" icon="wallet"/>
   </div>

   <SectionCard title="Clientes registrados" subtitle="Hasta 500 resultados" icon="users">
    <form method="get" className="v2-toolbar">
     <label className="v2-search">
      <Icon name="search" size={16}/>
      <input name="q" aria-label="Buscar nombre o código" placeholder="Buscar por nombre o código de socio..." defaultValue={term}/>
     </label>
     <button className="secondary">
      <Icon name="search" size={15}/>
      <span>Buscar</span>
     </button>
    </form>

    {customers.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Socio</th>
         <th>Compras vigentes</th>
         <th>Importe neto acumulado</th>
         <th>Puntos</th>
         <th>Estado</th>
        </tr>
       </thead>
       <tbody>
        {customers.map(c=>{
         const v=byId.get(c.id);
         return (
          <tr key={c.id}>
           <td>
            <strong>{c.name}</strong>
            <small className="mono">{c.code}</small>
           </td>
           <td className="mono">{String(v?.visits??0n)}</td>
           <td className="mono"><strong>{money(v?.net??0n)}</strong></td>
           <td className="mono">{String(v?.points??0n)}</td>
           <td>
            <form action={customerAction}>
             <input type="hidden" name="id" value={c.id}/>
             <input type="hidden" name="active" value={c.active?"no":"yes"}/>
             <button className="secondary">{c.active?"Activo · desactivar":"Inactivo · activar"}</button>
            </form>
           </td>
          </tr>
         );
        })}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="users" title="Sin clientes registrados" description="Creá un socio para otorgar descuentos y registrar historial de compras."/>
    )}
   </SectionCard>
  </Shell>
 );
}
