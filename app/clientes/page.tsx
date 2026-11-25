import {randomUUID} from "node:crypto";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {getCustomerPointsSummary} from "../../src/server/loyalty.mjs";
import {localDay} from "../../src/domain/parse.mjs";
import {Operation} from "../operations";
import {Shell,Field,Notice,money} from "../ui";
import {PageHeader,KpiCard,SectionCard,EmptyState,formatMoney} from "../components/retail-ui";
import {Icon} from "../components/icons";
import {customerAction,redeemAction} from "./actions";

export const dynamic="force-dynamic";

type Stats={id:string;visits:bigint;net:bigint;earned:bigint;redeemed:bigint;redeemedValue:bigint;available:bigint};

export default async function Page({searchParams}:{searchParams:Promise<{q?:string;ok?:string;error?:string}>}){
 const s=await requireSession();
 if(!["OWNER","MANAGER"].includes(s.role))return <Shell title="Clientes"><p className="error">Sin permisos</p></Shell>;

 const q=await searchParams;
 const tenantId=s.tenantId;
 const term=(q.q??"").slice(0,120);

 const [customers,stats,tenant,redemptions]=await Promise.all([
  db.customer.findMany({
   where:{tenantId,...(term?{OR:[{name:{contains:term,mode:"insensitive"}},{code:{contains:term,mode:"insensitive"}}]}:{})},
   orderBy:{name:"asc"},
   take:500,
  }),
  getCustomerPointsSummary(db,tenantId) as Promise<Stats[]>,
  db.tenant.findUniqueOrThrow({where:{id:tenantId},select:{pointValueCents:true}}),
  db.pointRedemption.findMany({
   where:{tenantId},
   include:{customer:{select:{name:true,code:true}}},
   orderBy:{createdAt:"desc"},
   take:30,
  }),
 ]);

 const byId=new Map(stats.map(x=>[x.id,x]));
 const totalAvailable=customers.reduce((a,c)=>a+(byId.get(c.id)?.available??0n),0n);

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

   <div className="om-kpi-grid">
    <KpiCard label="Socios listados" value={customers.length} hint="Resultados de búsqueda" icon="users" tone="brand"/>
    <KpiCard label="Socios activos" value={customers.filter(c=>c.active).length} hint="Habilitados en POS" icon="check" tone="success"/>
    <KpiCard label="Compras netas acumuladas" value={formatMoney(customers.reduce((a,c)=>a+(byId.get(c.id)?.net??0n),0n))} hint="Total de socios listados" icon="wallet"/>
    <KpiCard label="Puntos disponibles" value={String(totalAvailable)} hint={tenant.pointValueCents>0n?`Canje: ${money(tenant.pointValueCents)} / pto`:"Sin valor monetario por punto"} icon="sparkles" tone="brand"/>
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
         <th>Puntos (disp. / gan. / canj.)</th>
         <th>Estado</th>
         <th>Acciones</th>
        </tr>
       </thead>
       <tbody>
        {customers.map(c=>{
         const v=byId.get(c.id);
         const avail=v?.available??0n;
         return (
          <tr key={c.id}>
           <td>
            <strong>{c.name}</strong>
            <small className="mono">{c.code}</small>
           </td>
           <td className="mono">{String(v?.visits??0n)}</td>
           <td className="mono"><strong>{money(v?.net??0n)}</strong></td>
           <td className="mono">
            <strong>{String(avail)}</strong>
            <small>{String(v?.earned??0n)} gan. · {String(v?.redeemed??0n)} canj.</small>
           </td>
           <td>
            <form action={customerAction}>
             <input type="hidden" name="id" value={c.id}/>
             <input type="hidden" name="active" value={c.active?"no":"yes"}/>
             <button className="secondary">{c.active?"Activo · desactivar":"Inactivo · activar"}</button>
            </form>
           </td>
           <td>
            <div className="om-row-actions">
             <Operation title={"Socio · "+c.name} trigger="Editar" variant="secondary">
              <form action={customerAction} className="fields">
               <input type="hidden" name="id" value={c.id}/>
               <Field label="Nombre"><input name="name" defaultValue={c.name} required maxLength={120}/></Field>
               <Field label="Estado">
                <select name="active" defaultValue={c.active?"yes":"no"}>
                 <option value="yes">Activo</option>
                 <option value="no">Inactivo</option>
                </select>
               </Field>
               <button>Guardar cambios</button>
              </form>
             </Operation>
             {c.active&&avail>0n&&(
              <Operation title={"Canjear puntos · "+c.name} trigger="Canjear puntos" variant="secondary" description={`Saldo disponible: ${avail} puntos${tenant.pointValueCents>0n?` · Equivalencia: ${money(tenant.pointValueCents)} / punto`:""}`}>
               <form action={redeemAction} className="fields">
                <input type="hidden" name="customerId" value={c.id}/>
                <input type="hidden" name="requestKey" value={randomUUID()}/>
                <Field label="Puntos a canjear">
                 <input name="points" type="number" min="1" max={String(avail)} required defaultValue={String(avail)}/>
                </Field>
                <Field label="Motivo / premio">
                 <input name="reason" required maxLength={300} placeholder="Ej. Voucher descuento / premio mostrador"/>
                </Field>
                <button>Registrar canje</button>
               </form>
              </Operation>
             )}
            </div>
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

   <SectionCard title="Últimos canjes de puntos" subtitle="Hasta 30 operaciones registradas" icon="sparkles">
    {redemptions.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Fecha</th>
         <th>Socio</th>
         <th>Puntos</th>
         <th>Valor ref.</th>
         <th>Motivo</th>
        </tr>
       </thead>
       <tbody>
        {redemptions.map(r=>(
         <tr key={r.id}>
          <td className="mono">{localDay(r.createdAt)}</td>
          <td><strong>{r.customer.name}</strong><small className="mono">{r.customer.code}</small></td>
          <td className="mono"><strong>-{String(r.points)}</strong></td>
          <td className="mono">{money(r.valueCents)}</td>
          <td>{r.reason}</td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="sparkles" title="Sin canjes registrados" description="Los canjes de puntos de socios aparecerán aquí."/>
    )}
   </SectionCard>
  </Shell>
 );
}
