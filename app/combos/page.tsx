import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {localDay} from "../../src/domain/parse.mjs";
import {Operation} from "../operations";
import {Shell,Field,Notice,money,sectors} from "../ui";
import {PageHeader,SectionCard,EmptyState} from "../components/retail-ui";
import {SearchPicker,type SearchPickerItem} from "../components/search-picker";
import {comboAction} from "./actions";

export const dynamic="force-dynamic";

export default async function Page({searchParams}:{searchParams:Promise<{ok?:string;error?:string}>}){
 const s=await requireSession();
 if(!["OWNER","MANAGER"].includes(s.role))return <Shell title="Combos"><p className="error">Sin permisos</p></Shell>;

 const [products,combos]=await Promise.all([
  db.product.findMany({where:{tenantId:s.tenantId,active:true,unit:"UNIT"},orderBy:{name:"asc"}}),
  db.combo.findMany({where:{tenantId:s.tenantId},orderBy:{startsOn:"desc"},take:500}),
 ]);
 const today=localDay();

 return (
  <Shell title="Combos entre productos">
   <Notice query={await searchParams}/>

   <PageHeader
    kicker="Comercial"
    title="Combos de productos"
    subtitle="Paquetes de precio fijo entre artículos vendidos por unidad."
    actions={
     <Operation
      title="Nuevo combo"
      trigger="+ Nuevo combo"
      wide
      description="Hasta ocho productos distintos por unidad. Se aplica en caja si supera las promociones individuales."
     >
      <form action={comboAction} className="fields">
       <div className="formgrid">
        <Field label="Nombre"><input name="name" required maxLength={120}/></Field>
        <Field label="Precio del combo ($)"><input name="price" required inputMode="decimal"/></Field>
        <Field label="Desde"><input name="start" type="date" defaultValue={today} required/></Field>
        <Field label="Hasta"><input name="end" type="date" defaultValue={today} required/></Field>
       </div>
       {Array.from({length:8},(_,i)=>(
        <div className="formgrid" key={i}>
         <Field label={"Producto "+(i+1)}>
          <SearchPicker
           name={"product"+i}
           ariaLabel={"Producto "+(i+1)}
           required={i<2}
           allowEmpty={i>=2}
           emptyLabel="Sin producto"
           placeholder="Buscar artículo por nombre, SKU, EAN o sector..."
           items={products.map((p):SearchPickerItem=>({
            id:p.id,
            title:p.name,
            badge:sectors[p.sector as keyof typeof sectors],
            subtitle:`SKU ${p.sku}${p.barcode?" · EAN "+p.barcode:""}`,
            price:`${money(p.salePriceCents)}/u.`,
            searchText:`${p.name} ${p.sku} ${p.barcode??""} ${sectors[p.sector as keyof typeof sectors]??""}`,
           }))}
          />
         </Field>
         <Field label={"Unidades "+(i+1)}><input name={"units"+i} type="number" min="1" max="99" defaultValue="1"/></Field>
        </div>
       ))}
       <button>Crear combo</button>
      </form>
     </Operation>
    }
   />

   <SectionCard title="Combos registrados" subtitle="Ofertas combinadas activas e históricas" icon="sparkles" padded>
    {combos.length>0?(
     <div className="om-card-grid">
      {combos.map(c=>{
       const start=c.startsOn.toISOString().slice(0,10);
       const end=c.endsOn.toISOString().slice(0,10);
       const label=!c.active?"Desactivado":today<start?"Programado":today>end?"Finalizado":"Vigente";
       const cls=!c.active?"EXHAUSTED":today<start?"REVIEW":today>end?"BLOCKED":"AVAILABLE";
       return (
        <article className="om-list-card" key={c.id}>
         <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
          <strong>{c.name}</strong>
          <span className={"status "+cls}>{label}</span>
         </div>
         <strong className="mono" style={{fontSize:18}}>{money(c.priceCents)}</strong>
         <p style={{margin:0,fontSize:12.5}}>
          {(c.items as {productId:string;units:number}[]).map(i=>i.units+" × "+(products.find(p=>p.id===i.productId)?.name??"Producto inactivo")).join(" + ")}
         </p>
         <small className="mono">{start} a {end}</small>
         <form action={comboAction}>
          <input type="hidden" name="id" value={c.id}/>
          <input type="hidden" name="active" value={c.active?"no":"yes"}/>
          <button className="secondary">{c.active?"Desactivar combo":"Reactivar combo"}</button>
         </form>
        </article>
       );
      })}
     </div>
    ):(
     <EmptyState icon="sparkles" title="Sin combos registrados" description="Combiná productos por unidad con un precio promocional cerrado."/>
    )}
   </SectionCard>
  </Shell>
 );
}
