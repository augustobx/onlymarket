import Link from "next/link";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {Shell,money,amount} from "../ui";
import {PageHeader,KpiCard,SectionCard,EmptyState} from "../components/retail-ui";
import {Icon} from "../components/icons";

export const dynamic="force-dynamic";

const kinds:Record<string,string>={
 RECEIPT:"Recepción",
 TRANSFORM_IN:"Ingreso por transformación",
 TRANSFORM_OUT:"Salida por transformación",
 SALE:"Venta",
 RETURN:"Devolución",
 WASTE:"Merma",
 GIFT:"Regalo",
 ADJUSTMENT:"Control / ajuste",
};

export default async function Page({searchParams}:{searchParams:Promise<{q?:string;lot?:string}>}){
 const s=await requireSession();
 if(s.role==="CASHIER")return <Shell title="Trazabilidad"/>;

 const {q="",lot=""}=await searchParams;
 const tenantId=s.tenantId;
 const term=q.slice(0,120);

 const [lots,detail,members]=await Promise.all([
  db.lot.findMany({
   where:{tenantId,...(term?{OR:[{code:{contains:term,mode:"insensitive"}},{product:{name:{contains:term,mode:"insensitive"}}}]}:{})},
   include:{product:true,branch:true},
   orderBy:{receivedAt:"desc"},
   take:100,
  }),
  lot
   ?db.lot.findUnique({
    where:{tenantId_id:{tenantId,id:lot}},
    include:{
     product:true,
     branch:true,
     supplier:true,
     receipt:true,
     producedBy:{include:{sourceLot:{include:{product:true}}}},
     inputs:{include:{outputs:{include:{product:true}}}},
     returnedStock:{include:{line:{include:{lot:true}}}},
     controls:{include:{destination:true},orderBy:{createdAt:"desc"}},
     transfersIn:{include:{source:true}},
     movements:{orderBy:{createdAt:"asc"}},
    },
   })
   :Promise.resolve(null),
  db.membership.findMany({where:{tenantId},include:{user:{select:{id:true,email:true}}}}),
 ]);

 const actors=new Map(members.map(m=>[m.userId,m.user.email]));

 return (
  <Shell title="Trazabilidad de mercadería">
   <PageHeader
    kicker="Historial de lotes"
    title="Origen y recorrido"
    subtitle="Buscá un lote para reconstruir su cadena completa desde la recepción hasta la venta o pérdida."
   />

   <SectionCard title="Lotes recientes" subtitle="Últimos 100 lotes coincidentes, incluidos agotados" icon="trace">
    <form method="get" className="v2-toolbar">
     <label className="v2-search">
      <Icon name="search" size={16}/>
      <input name="q" aria-label="Buscar lote o producto" placeholder="Buscar por código de lote o nombre de producto..." defaultValue={term}/>
     </label>
     <button className="secondary">
      <Icon name="search" size={15}/>
      <span>Buscar</span>
     </button>
    </form>

    {lots.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Producto</th>
         <th>Lote</th>
         <th>Sucursal</th>
         <th>Saldo actual</th>
        </tr>
       </thead>
       <tbody>
        {lots.map(l=>(
         <tr key={l.id}>
          <td><strong>{l.product.name}</strong></td>
          <td><Link className="om-link-chip mono" href={"/trazabilidad?lot="+encodeURIComponent(l.id)}>{l.code}</Link></td>
          <td>{l.branch.name}</td>
          <td className="mono">{amount(l.quantityMilli,l.product.unit)}</td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="trace" title="Sin lotes coincidentes" description="Ingresá otro término de búsqueda."/>
    )}
   </SectionCard>

   {lot&&!detail&&<p className="error">Lote no encontrado.</p>}

   {detail&&(
    <>
     <div className="om-kpi-grid om-kpi-grid--3">
      <KpiCard label="Saldo físico" value={amount(detail.quantityMilli,detail.product.unit)} hint={detail.branch.name} icon="box" tone="brand"/>
      <KpiCard label="Costo restante" value={money(detail.remainingCostCents)} hint={detail.supplier?.name??"Sin proveedor directo"} icon="wallet" tone="success"/>
      <KpiCard label="Movimientos registrados" value={detail.movements.length} hint="Kardex completo del lote" icon="trace"/>
     </div>

     <SectionCard
      title={`${detail.product.name} · ${detail.code}`}
      subtitle={`Ingreso ${detail.receivedAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}`}
      icon="trace"
     >
      <div className="om-card__body--pad">
       <p>
        Vencimiento impreso: <strong className="mono">{detail.printedExpiresOn?.toISOString().slice(0,10)??"No registrado"}</strong> ·
        Vencimiento efectivo: <strong className="mono">{detail.expiresOn?.toISOString().slice(0,10)??"Sin fecha"}</strong>
       </p>
       {detail.receipt&&<p>Compra: <strong className="mono">{detail.receipt.invoiceRef??detail.receipt.id}</strong> · {money(detail.receipt.totalCostCents)}</p>}
       {detail.producedBy&&<p>Origen: <Link href={"/trazabilidad?lot="+detail.producedBy.sourceLotId}>{detail.producedBy.sourceLot.product.name} · {detail.producedBy.sourceLot.code}</Link></p>}
       {detail.inputs.flatMap(i=>i.outputs).map(o=>(
        <p key={o.id}>Lote derivado: <Link href={"/trazabilidad?lot="+o.id}>{o.product.name} · {o.code}</Link></p>
       ))}
       {detail.transfersIn.map(t=>(
        <p key={t.id}>Trasladado desde: <Link href={"/trazabilidad?lot="+t.source.id}>{t.source.code}</Link></p>
       ))}
       {detail.controls.filter(c=>c.destination).map(c=>(
        <p key={c.id}>Traslado de {amount(c.quantityMilli,detail.product.unit)} a <Link href={"/trazabilidad?lot="+c.destination!.id}>{c.destination!.code}</Link></p>
       ))}
       {detail.returnedStock.map(r=>(
        <p key={r.id}>Devuelto desde: <Link href={"/trazabilidad?lot="+r.line.lot.id}>{r.line.lot.code}</Link> · <Link href={"/pos/ticket/"+r.saleId}>Venta original</Link></p>
       ))}
      </div>

      <div className="tablewrap">
       <table>
        <thead>
         <tr>
          <th>Fecha y hora</th>
          <th>Movimiento</th>
          <th>Cantidad</th>
          <th>Costo</th>
          <th>Motivo</th>
          <th>Responsable</th>
         </tr>
        </thead>
        <tbody>
         {detail.movements.map(m=>(
          <tr key={m.id}>
           <td className="mono">{m.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</td>
           <td><strong>{kinds[m.kind]??m.kind}</strong></td>
           <td className="mono">{amount(m.deltaMilli,detail.product.unit)}</td>
           <td className="mono">{money(m.deltaCostCents)}</td>
           <td>{m.reason}</td>
           <td>{actors.get(m.actorId)??m.actorId.slice(0,8)}</td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     </SectionCard>
    </>
   )}
  </Shell>
 );
}
