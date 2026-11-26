import Link from "next/link";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {localDay} from "../../src/domain/parse.mjs";
import {Operation} from "../operations";
import {Shell,Notice,Field,amount,money,sectors} from "../ui";
import {PageHeader,SectionCard,EmptyState,InfoCallout} from "../components/retail-ui";
import {Icon} from "../components/icons";
import {SearchPicker,type SearchPickerItem} from "../components/search-picker";
import RuleFields from "./rule-fields";
import {createPromotion,disablePromotion} from "./actions";

export const dynamic="force-dynamic";

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;ok?:string;lot?:string;q?:string;state?:string}>}){
 const s=await requireSession();
 if(!["OWNER","MANAGER"].includes(s.role))return <Shell title="Promociones"><p className="error">Sin permisos.</p></Shell>;

 const query=await searchParams;
 const term=(query.q??"").trim().slice(0,120).toLowerCase();
 const stateFilter=query.state??"";
 const where={tenantId:s.tenantId};
 const [products,lots,promos]=await Promise.all([
  db.product.findMany({where:{...where,active:true},orderBy:{name:"asc"}}),
  db.lot.findMany({where:{...where,quantityMilli:{gt:0n}},include:{product:true,branch:true}}),
  db.promotion.findMany({where,include:{product:true,lot:true},orderBy:{startsOn:"desc"},take:500}),
 ]);
 const selected=lots.find(l=>l.id===query.lot&&l.product.active);
 const today=localDay();

 const rows=promos.map(p=>{
  const start=p.startsOn.toISOString().slice(0,10);
  const end=p.endsOn.toISOString().slice(0,10);
  const statusKey=!p.active?"inactive":today<start?"scheduled":today>end?"ended":"active";
  return {p,start,end,statusKey};
 }).filter(({p,statusKey})=>
  (!stateFilter||statusKey===stateFilter)&&
  (!term||p.name.toLowerCase().includes(term)||p.product.name.toLowerCase().includes(term)||(p.lot?.code??"").toLowerCase().includes(term))
 );

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
        <SearchPicker
         name="productId"
         ariaLabel="Producto"
         required
         defaultValue={selected?.productId??""}
         placeholder="Buscar producto por nombre, SKU, EAN o sector..."
         items={products.map((p):SearchPickerItem=>({
          id:p.id,
          title:p.name,
          badge:sectors[p.sector as keyof typeof sectors],
          subtitle:`SKU ${p.sku}${p.barcode?" · EAN "+p.barcode:""}${p.weightCode?" · PLU "+p.weightCode:""}`,
          meta:p.unit==="KG"?"Por kilogramo":"Por unidad",
          price:`${money(p.salePriceCents)}/${p.unit==="KG"?"kg":"u."}`,
          searchText:`${p.name} ${p.sku} ${p.barcode??""} ${p.weightCode??""} ${sectors[p.sector as keyof typeof sectors]??""}`,
         }))}
        />
       </Field>
       <Field label="Lote (opcional)">
        <SearchPicker
         name="lotId"
         ariaLabel="Lote (opcional)"
         allowEmpty
         emptyLabel="Todos los lotes del producto"
         defaultValue={selected?.id??""}
         placeholder="Buscar lote por código, producto o sucursal..."
         items={lots.map((l):SearchPickerItem=>({
          id:l.id,
          title:`${l.product.name} · Lote ${l.code}`,
          badge:l.branch.name,
          subtitle:`SKU ${l.product.sku}${l.expiresOn?" · Vence "+l.expiresOn.toISOString().slice(0,10):""}`,
          stock:amount(l.quantityMilli,l.product.unit),
          price:money(l.product.salePriceCents),
          searchText:`${l.product.name} ${l.product.sku} ${l.code} ${l.branch.name}`,
         }))}
        />
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

   <SectionCard title="Promociones registradas" subtitle={`${rows.length} de ${promos.length} reglas`} icon="tag">
    <div className="om-card__body--pad" style={{paddingBottom:0}}>
     <InfoCallout icon="info">
      En caja se aplica automáticamente la promoción vigente que mayor ahorro genere para el cliente, sin acumulaciones indebidas.
     </InfoCallout>
     <form method="get" className="v2-toolbar" style={{marginTop:14,marginBottom:0,padding:0,borderBottom:"none"}}>
      <label className="v2-search">
       <Icon name="search" size={16}/>
       <input name="q" aria-label="Buscar promoción o producto" placeholder="Buscar promoción, producto o lote..." defaultValue={query.q??""}/>
      </label>
      <select name="state" aria-label="Estado" defaultValue={stateFilter}>
       <option value="">Todos los estados</option>
       <option value="active">Vigente</option>
       <option value="scheduled">Programada</option>
       <option value="ended">Finalizada</option>
       <option value="inactive">Desactivada</option>
      </select>
      <button className="secondary">
       <Icon name="filter" size={15}/>
       <span>Filtrar</span>
      </button>
      {(term||stateFilter)&&<Link className="actionlink secondarylink" href="/promociones">Limpiar</Link>}
     </form>
    </div>

    {rows.length>0?(
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
        {rows.map(({p,start,end,statusKey})=>{
         const label=statusKey==="inactive"?"Desactivada":statusKey==="scheduled"?"Programada":statusKey==="ended"?"Finalizada":"Vigente";
         const cls=statusKey==="inactive"?"EXHAUSTED":statusKey==="scheduled"?"REVIEW":statusKey==="ended"?"BLOCKED":"AVAILABLE";
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
            <form action={disablePromotion}>
             <input type="hidden" name="id" value={p.id}/>
             <input type="hidden" name="active" value={p.active?"no":"yes"}/>
             <button className="secondary">{p.active?"Desactivar":"Reactivar"}</button>
            </form>
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
