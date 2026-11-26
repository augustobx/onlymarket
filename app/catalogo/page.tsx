import Link from "next/link";
import {Operation} from "../operations";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {addProduct,editProduct,bulkPrice} from "../actions";
import {Shell,Field,Notice,sectors,fixed,amount,states} from "../ui";
import {PageHeader,KpiCard,SectionCard,EmptyState,formatMoney,sectorIcons} from "../components/retail-ui";
import {showTransform} from "../../src/domain/settings.mjs";
import {WorkflowRail} from "../components/workflow-rail";
import {Icon} from "../components/icons";
import {localDay} from "../../src/domain/parse.mjs";
import {classifyLot} from "../../src/domain/inventory.mjs";
import {matchesSearch} from "../../src/domain/search.mjs";
import {balances} from "../../src/server/product-balance";

export const dynamic="force-dynamic";

export default async function Page({
 searchParams,
}:{
 searchParams:Promise<{error?:string;ok?:string;q?:string;sector?:string;state?:string;branch?:string;sort?:string;page?:string}>;
}){
 const s=await requireSession();
 if(s.role==="CASHIER")return <Shell title="Catálogo"/>;

 const query=await searchParams;
 const term=(query.q??"").slice(0,120).trim();
 const tenantId=s.tenantId;
 const today=localDay();

 const branches=await db.branch.findMany({where:{tenantId},orderBy:{name:"asc"}});
 const branch=branches.find(b=>b.id===query.branch)?.id;

 const [products,lots,targets]=await db.$transaction(
  async tx=>Promise.all([
   tx.product.findMany({where:{tenantId},orderBy:{name:"asc"}}),
   tx.lot.findMany({
    where:{tenantId,quantityMilli:{gt:0n},...(branch?{branchId:branch}:{})},
    include:{product:{select:{active:true,alertDays:true}},branch:true,supplier:true},
    orderBy:{receivedAt:"desc"},
   }),
   tx.stockTarget.findMany({where:{tenantId,...(branch?{branchId:branch}:{})}}),
  ] as const),
  {isolationLevel:"RepeatableRead"}
 );

 const b=balances(lots,today,localDay);
 const low=new Set(targets.filter(t=>(b.branches.get(t.branchId+":"+t.productId)??0n)<t.minimumMilli).map(t=>t.productId));
 const byProduct=new Map<string,typeof lots>();
 for(const l of lots){
  const ls=byProduct.get(l.productId)??[];
  ls.push(l);
  byProduct.set(l.productId,ls);
 }

 const rows=products.map(p=>{
  const a=b.products.get(p.id)??{usable:0n,held:0n,cost:0n,heldCost:0n};
  const cost=a.usable?a.cost*1000n/a.usable:null;
  const state=!p.active?"inactive":a.held>0n?"held":a.usable===0n?"empty":low.has(p.id)?"low":"normal";
  return {p,...a,unitCost:cost,state};
 });

 const sectorCounts=new Map<string,number>();
 for(const r of rows){
  sectorCounts.set(r.p.sector,(sectorCounts.get(r.p.sector)??0)+1);
 }

 const filtered=rows.filter(
  r=>
   matchesSearch(term,[r.p.name,r.p.sku,r.p.barcode??"",r.p.weightCode??"",sectors[r.p.sector as keyof typeof sectors]??""])&&
   (!query.sector||r.p.sector===query.sector)&&
   (!query.state||(query.state==="low"?r.p.active&&low.has(r.p.id):query.state==="empty"?r.p.active&&r.usable===0n:r.state===query.state))
 );

 if(query.sort==="price")filtered.sort((a,b)=>a.p.salePriceCents>b.p.salePriceCents?-1:a.p.salePriceCents<b.p.salePriceCents?1:0);
 if(query.sort==="stock")filtered.sort((a,b)=>a.usable>b.usable?-1:a.usable<b.usable?1:0);

 const pageSize=50,totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
 const page=Math.min(totalPages,Math.max(1,Number(query.page??"1")||1));
 const slice=filtered.slice((page-1)*pageSize,page*pageSize);
 const url=(sector:string,p=1)=>"/catalogo?"+new URLSearchParams({q:term,sector,state:query.state??"",branch:branch??"",sort:query.sort??"",...(p>1?{page:String(p)}:{})}).toString();
 const labels:Record<string,string>={normal:"Normal",inactive:"Inactivo",held:"Revisar",empty:"Sin stock apto",low:"Bajo mínimo"};
 const classes:Record<string,string>={normal:"AVAILABLE",inactive:"EXHAUSTED",held:"REVIEW",empty:"BLOCKED",low:"EXPIRING"};

 return (
  <Shell title="Catálogo de productos">
   <Notice query={query}/>

   <PageHeader
    kicker="Mercadería"
    title="Productos e inventario"
    subtitle={`Catálogo unificado · ${branches.find(x=>x.id===branch)?.name??"Todas las sucursales"}`}
    actions={
     <>
      <Link className="actionlink secondarylink" href="/inventario?view=recepcion">
       <Icon name="truck" size={15}/>
       <span>Nueva recepción</span>
      </Link>
      <Operation title="Nuevo producto" trigger="+ Nuevo producto" wide>
       <form action={addProduct} className="formgrid">
        <Field label="Nombre"><input name="name" required maxLength={120}/></Field>
        <Field label="SKU"><input name="sku" required maxLength={64}/></Field>
        <Field label="Código de barras"><input name="barcode" maxLength={64}/></Field>
        <Field label="Sector">
         <select name="sector">
          {Object.entries(sectors).map(([k,v])=><option key={k} value={k}>{v}</option>)}
         </select>
        </Field>
        <Field label="Unidad">
         <select name="unit">
          <option value="UNIT">Unidad</option>
          <option value="KG">Kilogramo</option>
         </select>
        </Field>
        <Field label="PLU de peso (5 dígitos, opcional)"><input name="weightCode" pattern="[0-9]{5}" maxLength={5}/></Field>
        <Field label="Precio de venta por unidad/kg ($)"><input name="price" inputMode="decimal" required defaultValue="0"/></Field>
        <Field label="Avisar antes de vencer (días)"><input name="alertDays" type="number" min="0" max="365" required defaultValue="3"/></Field>
        <Field label="Revisar frescura después de (días)"><input name="freshnessDays" type="number" min="1" max="365"/></Field>
        <Field label="Vida útil tras apertura (días)"><input name="openedLifeDays" type="number" min="1" max="365"/></Field>
        <Field label="Acceso rápido en POS">
         <select name="quickAccess" defaultValue="no">
          <option value="no">No</option>
          <option value="yes">Sí (fijar en grilla rápida)</option>
         </select>
        </Field>
        <button>Crear producto</button>
       </form>
      </Operation>
      {["OWNER","MANAGER"].includes(s.role)&&(
       <>
        <Link className="actionlink secondarylink" href="/catalogo/importar">
         <Icon name="layers" size={15}/>
         <span>Importar CSV</span>
        </Link>
        <Operation
         title="Actualización masiva de precios"
         trigger="Actualizar precios por sector"
         variant="secondary"
         description="El porcentaje se aplica a todos los productos activos del sector seleccionado."
        >
         <form action={bulkPrice} className="formgrid">
          <Field label="Sector">
           <select name="sector">
            {Object.entries(sectors).map(([k,v])=><option key={k} value={k}>{v}</option>)}
           </select>
          </Field>
          <Field label="Operación">
           <select name="direction">
            <option value="UP">Aumentar</option>
            <option value="DOWN">Reducir</option>
           </select>
          </Field>
          <Field label="Porcentaje"><input name="percent" inputMode="decimal" required/></Field>
          <label>
           <input type="checkbox" name="confirm" value="yes" required/>
           <span>Confirmar cambio de todos los productos activos del sector</span>
          </label>
          <button>Actualizar precios</button>
         </form>
        </Operation>
       </>
      )}
     </>
    }
   />

   <WorkflowRail current="catalog" showProduction={showTransform(s.profile)}/>

   <div className="om-kpi-grid">
    <KpiCard label="Artículos en catálogo" value={products.length} hint="Incluye inactivos e insumos" icon="box" tone="brand"/>
    <KpiCard label="Valor de stock apto" value={formatMoney(rows.reduce((a,r)=>a+r.cost,0n))} hint="Costo restante de lotes aptos" icon="wallet" tone="success"/>
    <KpiCard label="Bajo mínimo" value={rows.filter(r=>r.p.active&&low.has(r.p.id)).length} hint="Con objetivos configurados" icon="alert" tone="warning"/>
    <KpiCard label="Con mercadería retenida" value={rows.filter(r=>r.held>0n).length} hint="No disponible para venta" icon="clock" tone="danger"/>
   </div>

   <section className="om-card">
    <div className="v2-tabs">
     {[["","Todos",rows.length],...Object.entries(sectors).map(([k,l])=>[k,l,sectorCounts.get(k)??0] as const)].map(([k,label,cnt])=>(
      <Link key={String(k)} className={(query.sector??"")===k?"active":""} href={url(String(k))}>
       {label} ({cnt})
      </Link>
     ))}
    </div>

    <form method="get" className="v2-toolbar">
     <input type="hidden" name="sector" value={query.sector??""}/>
     <label className="v2-search">
      <Icon name="search" size={16}/>
      <input aria-label="Buscar por nombre, SKU o código" name="q" placeholder="Buscar por nombre, SKU o código de barras..." defaultValue={term}/>
     </label>
     <select name="branch" aria-label="Sucursal" defaultValue={branch??""}>
      <option value="">Todas las sucursales</option>
      {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
     </select>
     <select name="state" aria-label="Estado" defaultValue={query.state??""}>
      <option value="">Todos los estados</option>
      {Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}
     </select>
     <select name="sort" aria-label="Orden" defaultValue={query.sort??""}>
      <option value="">Nombre A–Z</option>
      <option value="price">Mayor precio</option>
      <option value="stock">Mayor existencia</option>
     </select>
     <button className="secondary">
      <Icon name="filter" size={15}/>
      <span>Buscar</span>
     </button>
    </form>

    {filtered.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Producto / código</th>
         <th>Sector</th>
         <th>Costo ref.</th>
         <th>Precio</th>
         <th>Margen ref.</th>
         <th>Stock apto</th>
         <th>Estado</th>
         <th>Ficha</th>
        </tr>
       </thead>
       <tbody>
        {slice.map(r=>{
         const {p}=r;
         const pct=r.unitCost!==null&&p.salePriceCents>0n
          ?(Number((p.salePriceCents-r.unitCost)*10000n/p.salePriceCents)/100).toLocaleString("es-AR")+"%"
          :"—";
         return (
          <tr key={p.id}>
           <td>
            <div className="v2-product-cell">
             <span className="v2-symbol"><Icon name={sectorIcons[p.sector]??"box"} size={16}/></span>
             <div>
              <strong>{p.name}{p.quickAccess?" ★":""}</strong>
              <small className="mono">{p.sku}{p.barcode?" · "+p.barcode:""}{p.weightCode?" · PLU "+p.weightCode:""}</small>
             </div>
            </div>
           </td>
           <td>{sectors[p.sector as keyof typeof sectors]}</td>
           <td className="mono">{r.unitCost===null?"—":formatMoney(r.unitCost)}</td>
           <td className="mono"><strong>{formatMoney(p.salePriceCents)}</strong></td>
           <td className="mono">{pct}</td>
           <td>
            <strong className="mono">{amount(r.usable,p.unit)}</strong>
            {r.held>0n&&<small>Retenido: {amount(r.held,p.unit)}</small>}
           </td>
           <td><span className={"status "+classes[r.state]}>{labels[r.state]}</span></td>
           <td>
            <Operation title={p.name} trigger="Ver ficha ›" variant="secondary" drawer>
             <div className="om-kpi-grid" style={{gridTemplateColumns:"repeat(2,minmax(0,1fr))"}}>
              <KpiCard label="Stock apto" value={amount(r.usable,p.unit)} hint="Selección actual" icon="box" tone="success"/>
              <KpiCard label="Retenido" value={amount(r.held,p.unit)} hint="No vendible" icon="alert" tone={r.held>0n?"warning":"default"}/>
             </div>
             <h3>Existencias por lote y sucursal</h3>
             {(byProduct.get(p.id)??[]).length>0?(
              <div className="v2-records">
               {(byProduct.get(p.id)??[]).map(l=>{
                const state=classifyLot({
                 today,
                 expiresOn:l.expiresOn?.toISOString().slice(0,10)??null,
                 reviewOn:l.reviewAt?localDay(l.reviewAt):null,
                 alertDays:p.alertDays,
                 status:l.status,
                 quantityMilli:l.quantityMilli,
                });
                return (
                 <div key={l.id}>
                  <div>
                   <strong className="mono">{l.code} · {l.branch.name}</strong>
                   <small>{l.supplier?.name??"Sin proveedor directo"} · {amount(l.quantityMilli,p.unit)} · {states[state]}</small>
                  </div>
                  <Link className="om-link-chip" href={"/inventario?lot="+l.id}>Gestionar lote</Link>
                 </div>
                );
               })}
              </div>
             ):(
              <p className="empty">Sin lotes con existencia activa.</p>
             )}
             <h3>Datos y edición del producto</h3>
             <form action={editProduct} className="fields">
              <input type="hidden" name="id" value={p.id}/>
              <div className="v2-fields">
               <Field label="Nombre"><input name="name" defaultValue={p.name} required/></Field>
               <Field label="SKU"><input name="sku" defaultValue={p.sku} required/></Field>
               <Field label="Código de barras"><input name="barcode" defaultValue={p.barcode??""}/></Field>
               <Field label="Sector">
                <select name="sector" defaultValue={p.sector}>
                 {Object.entries(sectors).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
               </Field>
               <Field label="PLU de peso (5 dígitos, opcional)"><input name="weightCode" defaultValue={p.weightCode??""} pattern="[0-9]{5}" maxLength={5}/></Field>
               <Field label="Precio por unidad/kg"><input name="price" defaultValue={fixed(p.salePriceCents,2)} required inputMode="decimal"/></Field>
               <Field label="Aviso (días)"><input name="alertDays" type="number" min="0" max="365" defaultValue={p.alertDays} required/></Field>
               <Field label="Frescura (días, futuros ingresos)"><input name="freshnessDays" type="number" min="1" max="365" defaultValue={p.freshnessDays??""}/></Field>
               <Field label="Vida útil tras apertura (días, futuras aperturas)"><input name="openedLifeDays" type="number" min="1" max="365" defaultValue={p.openedLifeDays??""}/></Field>
               <Field label="Acceso rápido en POS">
                <select name="quickAccess" defaultValue={p.quickAccess?"yes":"no"}>
                 <option value="no">No</option>
                 <option value="yes">Sí (fijar en grilla rápida)</option>
                </select>
               </Field>
               <Field label="Estado">
                <select name="active" defaultValue={p.active?"yes":"no"}>
                 <option value="yes">Activo</option>
                 <option value="no">Inactivo (no vendible)</option>
                </select>
               </Field>
              </div>
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
     <EmptyState icon="search" title="Sin productos coincidentes" description="Probá limpiando los filtros o creá un nuevo artículo en el catálogo."/>
    )}

    <div className="v2-tablefoot" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
     <span>Mostrando {slice.length} de {filtered.length} productos · Página {page} de {totalPages} · Costo promedio ponderado de referencia del stock apto.</span>
     {totalPages>1&&(
      <div className="om-row-actions">
       {page>1&&<Link className="om-link-chip" href={url(query.sector??"",page-1)}>‹ Anterior</Link>}
       {page<totalPages&&<Link className="om-link-chip" href={url(query.sector??"",page+1)}>Siguiente ›</Link>}
      </div>
     )}
    </div>
   </section>
  </Shell>
 );
}
