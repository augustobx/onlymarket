import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {localDay} from "../../src/domain/parse.mjs";
import {Operation} from "../operations";
import {Shell,Notice,Field,amount} from "../ui";
import {PageHeader,SectionCard,EmptyState,InfoCallout} from "../components/retail-ui";
import RuleFields from "./rule-fields";
import {createPromotion,disablePromotion} from "./actions";

export const dynamic="force-dynamic";

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;ok?:string;lot?:string}>}){
 const s=await requireSession();
 if(!["OWNER","MANAGER"].includes(s.role))return <Shell title="Promociones"><p className="error">Sin permisos.</p></Shell>;

 const query=await searchParams;
 const where={tenantId:s.tenantId};
 const [products,lots,promos]=await Promise.all([
  db.product.findMany({where:{...where,active:true},orderBy:{name:"asc"}}),
  db.lot.findMany({where:{...where,quantityMilli:{gt:0n}},include:{product:true,branch:true}}),
  db.promotion.findMany({where,include:{product:true,lot:true},orderBy:{startsOn:"desc"},take:500}),
 ]);
 const selected=lots.find(l=>l.id===query.lot&&l.product.active);
 const today=localDay();

 return (
  <Shell title="Promociones">
   <Notice query={query}/>

   <PageHeader
    kicker="Comercial"
    title="Ofertas y descuentos"
    subtitle="Reglas porcentuales, cantidad mínima, ofertas NxM y liquidación por vencimiento."
    actions={
     <Operation
      title="Nueva promoción"
      trigger="+ Nueva promoción"
      wide
      description="Se calcula por lote físico sin acumular descuentos. El sistema elige automáticamente la opción más favorable."
     >
      <form action={createPromotion} className="formgrid">
       <Field label="Nombre"><input name="name" required/></Field>
       <Field label="Producto">
        <select name="productId" defaultValue={selected?.productId}>
         {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
       </Field>
       <Field label="Lote (opcional)">
        <select name="lotId" defaultValue={selected?.id??""}>
         <option value="">Todos los lotes del producto</option>
         {lots.map(l=><option key={l.id} value={l.id}>{l.product.name} · {l.code} · {l.branch.name}</option>)}
        </select>
       </Field>
       <RuleFields/>
       <Field label="Vence dentro de (días, opcional)"><input type="number" name="expiryDays" min="1" max="365"/></Field>
       <Field label="Desde"><input name="startsOn" type="date" required defaultValue={today}/></Field>
       <Field label="Hasta"><input name="endsOn" type="date" required defaultValue={today}/></Field>
       <button>Crear promoción</button>
      </form>
     </Operation>
    }
   />

   <SectionCard title="Promociones registradas" subtitle="Hasta 500 reglas configuradas" icon="tag">
    <div className="om-card__body--pad" style={{paddingBottom:0}}>
     <InfoCallout icon="info">
      En caja se aplica automáticamente la promoción vigente que mayor ahorro genere para el cliente, sin acumulaciones indebidas.
     </InfoCallout>
    </div>

    {promos.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Nombre</th>
         <th>Producto / lote</th>
         <th>Regla</th>
         <th>Vigencia</th>
         <th>Estado</th>
         <th>Acción</th>
        </tr>
       </thead>
       <tbody>
        {promos.map(p=>{
         const start=p.startsOn.toISOString().slice(0,10);
         const end=p.endsOn.toISOString().slice(0,10);
         const label=!p.active?"Desactivada":today<start?"Programada":today>end?"Finalizada":"Vigente";
         const cls=!p.active?"EXHAUSTED":today<start?"REVIEW":today>end?"BLOCKED":"AVAILABLE";
         return (
          <tr key={p.id}>
           <td><strong>{p.name}</strong></td>
           <td>
            {p.product.name} · <span className="mono">{p.lot?.code??"Todos"}</span>
            <small>{p.expiryWithinDays?`Vence en ${p.expiryWithinDays} días o menos`:"Sin condición de vencimiento"}</small>
           </td>
           <td className="mono">
            <strong>{p.buyUnits!==null?`${p.buyUnits}x${p.payUnits}`:`${p.discountBps/100}%`}</strong>
            {p.minimumMilli!==null&&<small>Desde {amount(p.minimumMilli,p.product.unit)}</small>}
           </td>
           <td className="mono">{start} — {end}</td>
           <td><span className={"status "+cls}>{label}</span></td>
           <td>
            {p.active&&(
             <form action={disablePromotion}>
              <input type="hidden" name="id" value={p.id}/>
              <button className="secondary">Desactivar</button>
             </form>
            )}
           </td>
          </tr>
         );
        })}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="tag" title="Sin promociones" description="Creá una oferta por porcentaje, cantidad mínima o 2x1 / 3x2."/>
    )}
   </SectionCard>
  </Shell>
 );
}
