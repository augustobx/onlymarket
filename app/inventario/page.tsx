import Link from "next/link";
import {randomUUID} from "node:crypto";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {classifyLot} from "../../src/domain/inventory.mjs";
import {localDay} from "../../src/domain/parse.mjs";
import {receiveAction,reviewAction} from "../actions";
import {Operation} from "../operations";
import {Shell,Field,Notice,money,amount,states} from "../ui";
import {PageHeader,SectionCard,EmptyState,formatMoney} from "../components/retail-ui";
import {Icon} from "../components/icons";
import {lotOperationAction} from "./actions";
import Purchase from "./purchase";

export const dynamic="force-dynamic";

export default async function Page({
 searchParams,
}:{
 searchParams:Promise<{error?:string;ok?:string;lot?:string;view?:string;q?:string;branch?:string;state?:string;page?:string}>;
}){
 const s=await requireSession();
 if(s.role==="CASHIER")return <Shell title="Inventario"/>;

 const query=await searchParams;
 const where={tenantId:s.tenantId};
 const term=(query.q??"").trim().slice(0,120);

 const [products,suppliers,branches,lots]=await Promise.all([
  db.product.findMany({where:{...where,active:true},orderBy:{name:"asc"}}),
  db.supplier.findMany({where,orderBy:{name:"asc"}}),
  db.branch.findMany({where,orderBy:{name:"asc"}}),
  db.lot.findMany({
   where:{
    ...where,
    quantityMilli:{gt:0n},
    ...(query.lot?{id:query.lot}:{}),
    ...(query.branch?{branchId:query.branch}:{}),
    ...(term?{OR:[{code:{contains:term,mode:"insensitive"}},{product:{name:{contains:term,mode:"insensitive"}}},{product:{sku:{contains:term,mode:"insensitive"}}}]}:{}),
   },
   include:{product:true,branch:true,supplier:true},
   orderBy:[{expiresOn:"asc"},{receivedAt:"asc"}],
   take:1500,
  }),
 ]);

 const today=localDay();
 const stateFilter=query.state&&Object.prototype.hasOwnProperty.call(states,query.state)?query.state:"";
 const lotRows=lots.map(l=>({
  l,
  state:classifyLot({
   today,
   expiresOn:l.expiresOn?.toISOString().slice(0,10)??null,
   reviewOn:l.reviewAt?localDay(l.reviewAt):null,
   alertDays:l.product.alertDays,
   status:l.status,
   quantityMilli:l.quantityMilli,
  }),
 })).filter(r=>!stateFilter||r.state===stateFilter);
 const pageSize=50,totalPages=Math.max(1,Math.ceil(lotRows.length/pageSize));
 const page=Math.min(totalPages,Math.max(1,Number(query.page??"1")||1));
 const lotSlice=lotRows.slice((page-1)*pageSize,page*pageSize);
 const lotUrl=(p:number)=>"/inventario?"+new URLSearchParams({...(term?{q:term}:{}),...(query.branch?{branch:query.branch}:{}),...(stateFilter?{state:stateFilter}:{}),...(query.lot?{lot:query.lot}:{}),...(p>1?{page:String(p)}:{})}).toString();
 const receipts=await db.receipt.findMany({
  where:{...where,purchaseId:null},
  include:{supplier:true,branch:true,lot:{include:{product:true}}},
  orderBy:{createdAt:"desc"},
  take:100,
 });
 const purchases=await db.purchase.findMany({
  where,
  include:{supplier:true,branch:true,receipts:{include:{lot:{include:{product:true}}}},_count:{select:{receipts:true}}},
  orderBy:{createdAt:"desc"},
  take:100,
 });

 if(query.view==="recepcion"){
  return (
   <Shell title="Inventario y lotes">
    <Notice query={query}/>
    <PageHeader
     kicker="Compras / Nueva recepción"
     title="Recibir mercadería"
     subtitle="Cargá el comprobante y los lotes físicos antes de confirmar."
     actions={
      <Link className="actionlink secondarylink" href="/inventario">
       <Icon name="chevronLeft" size={15}/>
       <span>Volver al historial</span>
      </Link>
     }
    />
    {products.length&&suppliers.length&&branches.length?(
     <Purchase
      products={products.map(p=>({id:p.id,name:p.name,unit:p.unit,sector:p.sector}))}
      suppliers={suppliers.map(p=>({id:p.id,name:p.name}))}
      branches={branches.map(p=>({id:p.id,name:p.name}))}
      today={today}
      requestKey={randomUUID()}
     />
    ):(
     <SectionCard title="Datos necesarios" icon="alert" padded>
      <EmptyState
       icon="truck"
       title="Faltan datos maestros"
       description="Para recibir compras necesitás al menos un producto activo, un proveedor y una sucursal."
       action={
        <div className="om-pagehead__actions">
         <Link className="actionlink" href="/catalogo">Ir a Productos</Link>
         <Link className="actionlink secondarylink" href="/proveedores">Ir a Proveedores</Link>
        </div>
       }
      />
     </SectionCard>
    )}
   </Shell>
  );
 }

 return (
  <Shell title="Inventario y lotes">
   <Notice query={query}/>

   <PageHeader
    kicker="Mercadería"
    title="Compras y recepción"
    subtitle="Comprobantes de proveedor, ingresos individuales y control físico de lotes."
    actions={
     <>
      <Link href="/inventario?view=recepcion" className="actionlink">
       <Icon name="plus" size={15}/>
       <span>Nueva recepción</span>
      </Link>
      <Operation
       title="Recepción individual de mercadería"
       trigger="Recibir lote"
       variant="secondary"
       wide
       description="Un registro por lote. Ingresá el costo total de la cantidad recibida."
      >
       {!products.length||!suppliers.length||!branches.length?(
        <p>Primero cargá productos, proveedores y una sucursal.</p>
       ):(
        <form action={receiveAction} className="formgrid">
         <input type="hidden" name="requestKey" value={randomUUID()}/>
         <Field label="Sucursal">
          <select name="branchId">{branches.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
         </Field>
         <Field label="Producto">
          <select name="productId">{products.map(x=><option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}</select>
         </Field>
         <Field label="Proveedor">
          <select name="supplierId">{suppliers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
         </Field>
         <Field label="Código de lote"><input name="code" required/></Field>
         <Field label="Cantidad (kg o unidades)"><input name="quantity" inputMode="decimal" required/></Field>
         <Field label="Costo total ($)"><input name="cost" inputMode="decimal" required/></Field>
         <Field label="Vencimiento"><input type="date" name="expiresOn" min={today}/></Field>
         <Field label="Comprobante"><input name="invoiceRef"/></Field>
         <button>Registrar recepción</button>
        </form>
       )}
      </Operation>
      <Link href="/proveedores" className="actionlink secondarylink">
       <Icon name="building" size={15}/>
       <span>Proveedores</span>
      </Link>
     </>
    }
   />

   {!query.lot&&(
    <div className="om-dashgrid">
     <SectionCard title="Compras registradas" subtitle="Últimos 100 comprobantes múltiples" icon="receipt">
      {purchases.length>0?(
       <div className="tablewrap">
        <table>
         <thead>
          <tr>
           <th>Comprobante</th>
           <th>Proveedor</th>
           <th>Sucursal</th>
           <th>Fecha</th>
           <th>Lotes</th>
           <th>Total</th>
           <th>Detalle</th>
          </tr>
         </thead>
         <tbody>
          {purchases.map(p=>(
           <tr key={p.id}>
            <td className="mono"><strong>{p.invoiceRef}</strong></td>
            <td>{p.supplier.name}</td>
            <td>{p.branch.name}</td>
            <td className="mono">{localDay(p.createdAt)}</td>
            <td className="mono">{p._count.receipts}</td>
            <td className="mono"><strong>{formatMoney(p.totalCostCents)}</strong></td>
            <td>
             <Operation title={`Comprobante · ${p.invoiceRef}`} trigger="Ver detalle" variant="secondary" drawer>
              <p><strong>{p.supplier.name}</strong> · {p.branch.name} · {localDay(p.createdAt)}</p>
              <p>Total comprobante: <strong className="mono">{formatMoney(p.totalCostCents)}</strong></p>
              <div className="v2-records">
               {p.receipts.map(rc=>(
                <div key={rc.id}>
                 <div>
                  <strong>{rc.lot.product.name}</strong>
                  <small className="mono">{rc.lot.code} · {amount(rc.quantityMilli,rc.lot.product.unit)} · {money(rc.totalCostCents)}</small>
                 </div>
                 <Link className="om-link-chip" href={"/trazabilidad?lot="+rc.lotId}>Kardex</Link>
                </div>
               ))}
              </div>
             </Operation>
            </td>
           </tr>
          ))}
         </tbody>
        </table>
       </div>
      ):(
       <EmptyState icon="receipt" title="Sin compras múltiples" description="Usá Nueva recepción para cargar comprobantes con varios renglones."/>
      )}
     </SectionCard>

     <SectionCard title="Recepciones individuales" subtitle="Últimos ingresos sin comprobante agrupado" icon="truck">
      {receipts.length>0?(
       <div className="tablewrap">
        <table>
         <thead>
          <tr>
           <th>Producto / lote</th>
           <th>Proveedor</th>
           <th>Sucursal</th>
           <th>Fecha</th>
           <th>Importe</th>
          </tr>
         </thead>
         <tbody>
          {receipts.map(r=>(
           <tr key={r.id}>
            <td>
             <Link href={"/inventario?lot="+r.lotId}><strong>{r.lot.product.name}</strong></Link>
             <small className="mono">{r.lot.code}</small>
            </td>
            <td>{r.supplier.name}</td>
            <td>{r.branch.name}</td>
            <td className="mono">{localDay(r.createdAt)}</td>
            <td className="mono"><strong>{formatMoney(r.totalCostCents)}</strong></td>
           </tr>
          ))}
         </tbody>
        </table>
       </div>
      ):(
       <EmptyState icon="truck" title="Sin recepciones individuales" description="Los ingresos de lote único aparecerán aquí."/>
      )}
     </SectionCard>
    </div>
   )}

   <SectionCard
    title="Lotes con stock"
    subtitle={`Mostrando ${lotSlice.length} de ${lotRows.length} lotes ordenados por vencimiento`}
    icon="box"
    actions={
     <Link className="actionlink secondarylink" href="/stock">
      <Icon name="layers" size={15}/>
      <span>Conteos y traslados</span>
     </Link>
    }
   >
    <form method="get" className="v2-toolbar">
     <label className="v2-search">
      <Icon name="search" size={16}/>
      <input name="q" aria-label="Buscar lote, producto o SKU" placeholder="Buscar por lote, producto o SKU..." defaultValue={term}/>
     </label>
     <select name="branch" aria-label="Sucursal" defaultValue={query.branch??""}>
      <option value="">Todas las sucursales</option>
      {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
     </select>
     <select name="state" aria-label="Estado" defaultValue={stateFilter}>
      <option value="">Todos los estados</option>
      {Object.entries(states).map(([k,v])=><option key={k} value={k}>{v}</option>)}
     </select>
     <button className="secondary">
      <Icon name="filter" size={15}/>
      <span>Buscar</span>
     </button>
     {(query.lot||term||query.branch||stateFilter)&&<Link className="actionlink secondarylink" href="/inventario">Ver todos</Link>}
    </form>

    {lotSlice.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Producto / lote</th>
         <th>Sucursal</th>
         <th>Ingreso / vencimiento</th>
         <th>Stock</th>
         <th>Costo restante</th>
         <th>Estado</th>
         <th>Control de calidad</th>
         <th>Movimientos</th>
        </tr>
       </thead>
       <tbody>
        {lotSlice.map(({l,state})=>{
         return (
          <tr key={l.id}>
           <td>
            <strong>{l.product.name}</strong>
            <small className="mono">{l.code} · {l.supplier?.name??"Transformación"}</small>
            <div className="om-row-actions" style={{marginTop:6}}>
             <Link className="om-link-chip" href={"/etiquetas/"+l.id}>Etiqueta</Link>
             <Link className="om-link-chip" href={"/trazabilidad?lot="+l.id}>Historial</Link>
             <Link className="om-link-chip" href={"/stock?lot="+l.id}>Control</Link>
            </div>
           </td>
           <td>{l.branch.name}</td>
           <td className="mono">
            {localDay(l.receivedAt)}
            <small>{l.expiresOn?.toISOString().slice(0,10)??"Sin fecha impresa"}</small>
            {l.openedAt&&<small>Abierto: {localDay(l.openedAt)}</small>}
           </td>
           <td className="mono"><strong>{amount(l.quantityMilli,l.product.unit)}</strong></td>
           <td className="mono">{money(l.remainingCostCents)}</td>
           <td><span className={"status "+state}>{states[state]}</span></td>
           <td>
            <Operation title={"Control de calidad · "+l.product.name} trigger="Registrar revisión" variant="secondary">
             <form action={reviewAction} className="fields">
              <input type="hidden" name="lotId" value={l.id}/>
              <Field label="Resultado de inspección">
               <select name="decision" aria-label="Resultado">
                <option value="REVIEW">Requiere revisión</option>
                <option value="BLOCKED">Bloquear</option>
                <option value="AVAILABLE">Apto tras inspección</option>
               </select>
              </Field>
              <Field label="Motivo / control realizado">
               <input name="reason" required placeholder="Motivo / control realizado" maxLength={300}/>
              </Field>
              {l.status==="BLOCKED"&&(
               <small>{["OWNER","MANAGER"].includes(s.role)?"Como propietario o encargado podés rehabilitar un lote bloqueado manualmente si no está vencido.":"Solo propietario o encargado pueden rehabilitar un lote bloqueado."}</small>
              )}
              <button>Guardar</button>
             </form>
            </Operation>
           </td>
           <td>
            <Operation title={"Movimiento · "+l.product.name} trigger="Merma / regalo / apertura" variant="secondary">
             <form action={lotOperationAction} className="fields">
              <input type="hidden" name="lotId" value={l.id}/>
              <input type="hidden" name="requestKey" value={randomUUID()}/>
              <Field label="Tipo de movimiento">
               <select name="kind" aria-label="Tipo de movimiento">
                <option value="WASTE">Merma / descarte</option>
                <option value="GIFT">Regalo</option>
                {!l.openedAt&&["DELI","BUTCHERY"].includes(l.product.sector)&&(
                 <option value="OPEN">Abrir pieza (todo el lote)</option>
                )}
               </select>
              </Field>
              <Field label="Cantidad (vacío en apertura)">
               <input name="quantity" inputMode="decimal" placeholder="Cantidad (no para apertura)"/>
              </Field>
              <Field label="Motivo">
               <input name="reason" required maxLength={300} placeholder="Motivo"/>
              </Field>
              <small>Para abrir una sola pieza, ingresala como lote separado. No se extiende el vencimiento.</small>
              <button>Registrar movimiento</button>
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
     <EmptyState icon="box" title="No hay lotes con stock" description="Cuando recibas mercadería aparecerá aquí para control y trazabilidad."/>
    )}
    {lotRows.length>0&&(
     <div className="v2-tablefoot" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <span>Mostrando {lotSlice.length} de {lotRows.length} lotes · Página {page} de {totalPages}</span>
      {totalPages>1&&(
       <div className="om-row-actions">
        {page>1&&<Link className="om-link-chip" href={lotUrl(page-1)}>‹ Anterior</Link>}
        {page<totalPages&&<Link className="om-link-chip" href={lotUrl(page+1)}>Siguiente ›</Link>}
       </div>
      )}
     </div>
    )}
   </SectionCard>
  </Shell>
 );
}
