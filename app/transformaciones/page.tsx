import Link from "next/link";
import {randomUUID} from "node:crypto";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {deleteTemplate} from "../actions";
import {classifyLot} from "../../src/domain/inventory.mjs";
import {localDay} from "../../src/domain/parse.mjs";
import {Operation} from "../operations";
import {Shell,Notice,amount,money} from "../ui";
import {PageHeader,SectionCard,EmptyState} from "../components/retail-ui";
import {Icon,type IconName} from "../components/icons";
import Editor from "./editor";

export const dynamic="force-dynamic";

export default async function Page({
 searchParams,
}:{
 searchParams:Promise<{error?:string;ok?:string;view?:string;sector?:string}>;
}){
 const s=await requireSession();
 if(s.role==="CASHIER")return <Shell title="Transformaciones"/>;

 const where={tenantId:s.tenantId};
 const [products,lots,templates,history]=await Promise.all([
  db.product.findMany({where:{...where,unit:"KG",active:true},orderBy:{name:"asc"}}),
  db.lot.findMany({where:{...where,quantityMilli:{gt:0n},product:{unit:"KG"},status:"AVAILABLE"},include:{product:true,branch:true}}),
  db.transformTemplate.findMany({where,orderBy:{name:"asc"}}),
  db.transformation.findMany({
   where,
   include:{sourceLot:{include:{product:true}},outputs:{include:{product:true}},movements:true},
   orderBy:{createdAt:"desc"},
   take:50,
  }),
 ]);

 const query=await searchParams;
 const today=localDay();
 const available=lots.filter(l=>
  l.product.active&&
  l.expiresOn&&
  ["AVAILABLE","EXPIRING"].includes(
   classifyLot({
    today,
    expiresOn:l.expiresOn.toISOString().slice(0,10),
    reviewOn:l.reviewAt?localDay(l.reviewAt):null,
    alertDays:l.product.alertDays,
    status:l.status,
    quantityMilli:l.quantityMilli,
   })
  )
 );
 const selectedSector=query.sector==="DELI"?"DELI":query.sector==="BUTCHERY"?"BUTCHERY":"";
 const eligible=selectedSector?available.filter(l=>l.product.sector===selectedSector):available;

 if(query.view==="nueva"){
  return (
   <Shell title="Desposte y fraccionamiento">
    <Notice query={query}/>
    <PageHeader
     kicker="Producción / Nueva operación"
     title={selectedSector==="DELI"?"Mesa de fraccionamiento":selectedSector==="BUTCHERY"?"Mesa de desposte":"Mesa de producción"}
     subtitle="Asigná el peso de entrada a cortes comerciales, regalos o mermas."
     actions={
      <Link className="actionlink secondarylink" href="/transformaciones">
       <Icon name="chevronLeft" size={15}/>
       <span>Volver al historial</span>
      </Link>
     }
    />
    {eligible.length?(
     <Editor
      products={products.map(p=>({id:p.id,name:p.name}))}
      lots={eligible.map(l=>({
       id:l.id,
       branchId:l.branchId,
       label:`${l.branch.name} · ${l.product.name} · ${l.code} · ${amount(l.quantityMilli,"KG")}`,
       quantity:l.quantityMilli.toString(),
       cost:l.remainingCostCents.toString(),
      }))}
      templates={templates.map(t=>({
       id:t.id,
       name:t.name,
       lines:t.lines as {disposition:string;productId:string;reason:string}[],
      }))}
      requestKey={randomUUID()}
     />
    ):(
     <SectionCard title="Sin lotes elegibles" icon="scale" padded>
      <EmptyState
       icon="scale"
       title="No hay lotes por peso aptos con vencimiento registrado"
       description="Recibí un lote por kilogramo con fecha de vencimiento vigente para iniciar el desposte o fraccionamiento."
       action={<Link className="actionlink" href="/inventario?view=recepcion">Ir a Compras y recepción</Link>}
      />
     </SectionCard>
    )}
   </Shell>
  );
 }

 const areas:[string,string,string,IconName][]=[
  ["Carnicería","Desposte de medias reses y cortes","/transformaciones?view=nueva&sector=BUTCHERY","beef"],
  ["Fiambrería","Fraccionamiento de piezas enteras","/transformaciones?view=nueva&sector=DELI","cheese"],
  ["Verdulería","Control de frescura y descartes","/alertas?sector=PRODUCE","apple"],
 ];

 return (
  <Shell title="Desposte y fraccionamiento">
   <Notice query={query}/>

   <PageHeader
    kicker="Producción y frescos"
    title="Control de cortes y rendimiento"
    subtitle="Desposte, fraccionamiento, recortes y rendimiento comercial por lote."
    actions={
     <Link className="actionlink" href="/transformaciones?view=nueva">
      <Icon name="plus" size={15}/>
      <span>Nueva transformación</span>
     </Link>
    }
   />

   <div className="om-grid3">
    {areas.map(([title,subtitle,href,icon])=>(
     <SectionCard key={title} title={title} subtitle={subtitle} icon={icon} padded>
      <Link className="actionlink secondarylink" href={href}>
       <span>Abrir área</span>
       <Icon name="arrowUpRight" size={14}/>
      </Link>
     </SectionCard>
    ))}
   </div>

   <div className="om-dashgrid">
    <SectionCard title="Plantillas guardadas" subtitle="Estructuras de cortes reutilizables" icon="layers" padded>
     {templates.length>0?(
      <div className="om-card-grid">
       {templates.map(t=>(
        <form action={deleteTemplate} key={t.id} className="om-list-card">
         <input type="hidden" name="id" value={t.id}/>
         <strong>{t.name}</strong>
         <small>{(t.lines as unknown[]).length} líneas configuradas</small>
         <div>
          <button className="secondary">
           <Icon name="trash" size={14}/>
           <span>Eliminar plantilla</span>
          </button>
         </div>
        </form>
       ))}
      </div>
     ):(
      <EmptyState icon="layers" title="Sin plantillas guardadas" description="Guardá una distribución de cortes desde la mesa de producción."/>
     )}
    </SectionCard>

    <SectionCard title="Últimas transformaciones" subtitle="Historial reciente de producción" icon="scale" padded>
     {history.length>0?(
      <div>
       {history.map(h=>(
        <div className="om-record-row" key={h.id}>
         <div>
          <strong>{h.sourceLot.product.name}</strong>
          <small className="mono">
           {amount(h.inputMilli,"KG")} · {money(h.inputCostCents)} · {h.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}
          </small>
         </div>
         <Operation title={"Transformación · "+h.sourceLot.product.name} trigger="Ver detalle" variant="secondary" wide>
          <p><strong>Lote origen:</strong> <span className="mono">{h.sourceLot.code}</span></p>
          <h3>Salidas generadas</h3>
          <div className="v2-records">
           {h.outputs.map(o=>(
            <div key={o.id}>
             <span>{o.product.name} · lote <span className="mono">{o.code}</span></span>
             <strong className="mono">{amount(o.quantityMilli,"KG")}</strong>
            </div>
           ))}
           {h.movements.filter(m=>m.kind==="GIFT"||m.kind==="WASTE").map(m=>(
            <div key={m.id}>
             <span>{m.kind==="GIFT"?"Regalo":"Merma"}: {m.reason}</span>
             <strong className="mono">{amount(-m.deltaMilli,"KG")} · {money(-m.deltaCostCents)}</strong>
            </div>
           ))}
          </div>
         </Operation>
        </div>
       ))}
      </div>
     ):(
      <EmptyState icon="scale" title="Sin transformaciones" description="Todavía no se registraron despostes ni fraccionamientos."/>
     )}
    </SectionCard>
   </div>
  </Shell>
 );
}
