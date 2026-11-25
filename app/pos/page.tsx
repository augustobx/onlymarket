import Link from "next/link";
import {randomUUID} from "node:crypto";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {classifyLot} from "../../src/domain/inventory.mjs";
import {localDay} from "../../src/domain/parse.mjs";
import {expectedCash} from "../../src/server/sales.mjs";
import {eligiblePromotions} from "../../src/domain/sales.mjs";
import {logoutAction} from "../actions";
import {Operation} from "../operations";
import {Shell,Notice,Field,money} from "../ui";
import {KpiCard,SectionCard,EmptyState,formatMoney} from "../components/retail-ui";
import {Icon} from "../components/icons";
import {openAction,closeAction,cashMovementAction} from "./actions";
import Cart from "./cart";

export const dynamic="force-dynamic";

const dateOnly=(d:Date|null)=>d?.toISOString().slice(0,10)??null;
const labels:Record<string,string>={CASH:"Efectivo",DEBIT:"Débito",CREDIT:"Crédito",TRANSFER:"Transferencia",MIXED:"Mixto"};

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;ok?:string}>}){
 const s=await requireSession();
 const query=await searchParams;

 if(!["OWNER","MANAGER","CASHIER"].includes(s.role)){
  return <Shell title="Punto de venta"><p className="error">Sin permisos para operar caja.</p></Shell>;
 }

 const where={tenantId:s.tenantId,actorId:s.actorUserId};
 const [shift,branches,closed]=await Promise.all([
  db.cashShift.findFirst({where:{...where,closedAt:null},include:{branch:true}}),
  db.branch.findMany({where:{tenantId:s.tenantId},orderBy:{name:"asc"}}),
  db.cashShift.findMany({where:{...where,closedAt:{not:null}},include:{branch:true},orderBy:{closedAt:"desc"},take:10}),
 ]);

 const today=localDay();
 const [settings,customers,combos]=await Promise.all([
  db.tenant.findUniqueOrThrow({where:{id:s.tenantId},select:{weightPrefix:true,memberDiscountBps:true}}),
  db.customer.findMany({where:{tenantId:s.tenantId,active:true},select:{id:true,name:true,code:true},orderBy:{name:"asc"},take:500}),
  db.combo.findMany({where:{tenantId:s.tenantId,active:true,startsOn:{lte:new Date(today+"T00:00:00Z")},endsOn:{gte:new Date(today+"T00:00:00Z")}}}),
 ]);

 const [lots,promos,sales,totals,movements,returns]=shift
  ?await Promise.all([
   db.lot.findMany({where:{tenantId:s.tenantId,branchId:shift.branchId,quantityMilli:{gt:0n},status:"AVAILABLE",product:{active:true}},include:{product:true},orderBy:[{expiresOn:"asc"},{receivedAt:"asc"}]}),
   db.promotion.findMany({where:{tenantId:s.tenantId,active:true}}),
   db.sale.findMany({where:{tenantId:s.tenantId,shiftId:shift.id},include:{cancellation:true,returns:{take:1}},orderBy:{createdAt:"desc"},take:30}),
   db.sale.aggregate({where:{tenantId:s.tenantId,shiftId:shift.id,cancellation:null},_sum:{cashCents:true,debitCents:true,creditCents:true,transferCents:true}}),
   db.cashMovement.findMany({where:{tenantId:s.tenantId,shiftId:shift.id},orderBy:{createdAt:"desc"},take:50}),
   db.saleReturn.aggregate({where:{tenantId:s.tenantId,shiftId:shift.id},_sum:{cashCents:true,debitCents:true,creditCents:true,transferCents:true,refundCents:true}}),
  ])
  :[[],[],[],null,[],null];

 const promoDates=promos.map(p=>({...p,startsOn:dateOnly(p.startsOn),endsOn:dateOnly(p.endsOn)}));
 const available=lots.flatMap(l=>{
  const info={...l,expiresOn:dateOnly(l.expiresOn),reviewOn:l.reviewAt?localDay(l.reviewAt):null,alertDays:l.product.alertDays};
  if(!["AVAILABLE","EXPIRING"].includes(classifyLot({...info,today})))return [];
  const eligible=eligiblePromotions(promoDates,info,today);
  return [{
   id:l.id,
   productId:l.productId,
   weightCode:l.product.weightCode,
   name:l.product.name,
   sku:l.product.sku,
   barcode:l.product.barcode,
   code:l.code,
   unit:l.product.unit,
   sector:l.product.sector,
   quantity:l.quantityMilli.toString(),
   price:l.product.salePriceCents.toString(),
   promotions:eligible.map((p:typeof promoDates[number])=>({
    id:p.id,
    name:p.name,
    discountBps:p.discountBps,
    minimumMilli:p.minimumMilli?.toString()??null,
    buyUnits:p.buyUnits,
    payUnits:p.payUnits,
   })),
   expiry:info.expiresOn,
  }];
 });

 const expected=shift?await expectedCash(db,shift):0n;
 const paymentTotals:[string,bigint][]=[
  ["Efectivo",totals?._sum.cashCents??0n],
  ["Débito",totals?._sum.debitCents??0n],
  ["Crédito",totals?._sum.creditCents??0n],
  ["Transferencia",totals?._sum.transferCents??0n],
 ];

 const ticketAction=query.ok==="sale"&&sales[0]?(
  <Link href={"/pos/ticket/"+sales[0].id} className="actionlink secondarylink">
   <Icon name="printer" size={14}/>
   <span>Imprimir último ticket</span>
  </Link>
 ):undefined;

 return (
  <div className="market-terminal">
   <header className="v2-poshead">
    <div className="v2-posbrand">
     <span className="brandmark"><Icon name="cart" size={19}/></span>
     <div>
      <strong>OnlyMarket POS</strong>
      <small>{s.tenantName}</small>
     </div>
    </div>

    <div className="v2-posmeta">
     <span className={shift?"v2-open":"v2-closed"}>
      {shift?"● Caja abierta":"● Caja cerrada"}
     </span>
     <span>{shift?.branch.name??"Sin turno activo"} · {s.email}</span>
     {shift&&(
      <div className="om-pos-kbd-strip" aria-hidden="true">
       <span className="om-kbd">F2 Escáner</span>
       <span className="om-kbd">F4 Cantidad</span>
       <span className="om-kbd">F12 Cobrar</span>
      </div>
     )}
    </div>

    <div className="v2-actions">
     {s.role!=="CASHIER"&&(
      <Link href="/" className="v2-posback">
       <Icon name="chevronLeft" size={15}/>
       <span>Administración</span>
      </Link>
     )}
     <Link href="/cuenta" className="v2-posback">
      <Icon name="user" size={14}/>
      <span>Mi cuenta</span>
     </Link>
     <form action={logoutAction}>
      <button className="secondary">
       <Icon name="logOut" size={14}/>
       <span>Salir</span>
      </button>
     </form>
    </div>
   </header>

   <main className="v2-posmain">
    <Notice query={query} action={ticketAction}/>

    {!shift?(
     <SectionCard title="Abrir caja" subtitle="Iniciá un turno para comenzar a cobrar en esta sucursal" icon="cart" padded>
      <form action={openAction} className="formgrid">
       <Field label="Sucursal">
        <select name="branchId">
         {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
       </Field>
       <Field label="Fondo inicial ($)">
        <input name="opening" required defaultValue="0" inputMode="decimal"/>
       </Field>
       <button>Abrir caja</button>
      </form>
     </SectionCard>
    ):(
     <>
      <Cart
       key={shift.id+":"+String(sales[0]?.id??"")}
       lots={available}
       customers={customers}
       weightPrefix={settings.weightPrefix}
       memberBps={settings.memberDiscountBps}
       combos={combos.map(c=>({
        id:c.id,
        name:c.name,
        items:c.items as {productId:string;units:number}[],
        priceCents:c.priceCents.toString(),
       }))}
       shiftId={shift.id}
       requestKey={randomUUID()}
      />

      <div className="v2-posadmin">
       <SectionCard
        title={`Turno actual · ${shift.branch.name}`}
        subtitle="Totales cobrados antes de reintegros"
        icon="wallet"
        actions={
         <Operation
          title="Cierre de caja"
          trigger="Realizar arqueo"
          variant="secondary"
          description={`Efectivo esperado en caja: ${money(expected)}. Reintegros en efectivo: ${money(returns?._sum.cashCents??0n)}.`}
         >
          <form action={closeAction} className="fields">
           <input type="hidden" name="shiftId" value={shift.id}/>
           <Field label="Efectivo contado ($)">
            <input name="counted" inputMode="decimal" required/>
           </Field>
           <button>Cerrar caja</button>
          </form>
         </Operation>
        }
       >
        <div className="v2-pos-turn-summary">
         <div className="om-kpi-grid">
          <KpiCard label="Fondo inicial" value={formatMoney(shift.openingCents)} hint="Apertura del turno" icon="banknote" tone="brand"/>
          <KpiCard label="Efectivo esperado" value={formatMoney(expected)} hint="Incluye ingresos, retiros y reintegros" icon="wallet" tone="success"/>
          {paymentTotals.slice(0,2).map(([label,value])=>(
           <KpiCard key={label} label={`${label} cobrado`} value={formatMoney(value)} hint="Ventas vigentes del turno" icon="creditCard"/>
          ))}
         </div>
         <div className="om-kpi-grid" style={{marginBottom:0}}>
          {paymentTotals.slice(2).map(([label,value])=>(
           <KpiCard key={label} label={`${label} cobrado`} value={formatMoney(value)} hint="Ventas vigentes del turno" icon="landmark"/>
          ))}
         </div>
        </div>
       </SectionCard>

       <div className="om-dashgrid">
        <SectionCard title="Últimas ventas del turno" subtitle="Hasta 30 comprobantes recientes" icon="receipt">
         {sales.length>0?(
          <div className="tablewrap">
           <table>
            <thead>
             <tr>
              <th>Hora</th>
              <th>Operación</th>
              <th>Pago</th>
              <th>Importe</th>
              <th>Vuelto</th>
              <th>Estado</th>
              <th>Ticket</th>
             </tr>
            </thead>
            <tbody>
             {sales.map(v=>(
              <tr key={v.id}>
               <td className="mono">{v.createdAt.toLocaleTimeString("es-AR",{timeZone:"America/Argentina/Buenos_Aires",hour:"2-digit",minute:"2-digit"})}</td>
               <td className="mono">{v.id.slice(0,8)}</td>
               <td>{labels[v.payment]}</td>
               <td className="mono"><strong>{money(v.totalCents)}</strong></td>
               <td className="mono">{v.changeCents===null?"—":money(v.changeCents)}</td>
               <td>
                <span className={"status "+(v.cancellation?"BLOCKED":v.returns.length?"REVIEW":"AVAILABLE")}>
                 {v.cancellation?"Anulada":v.returns.length?"Con devoluciones":"Registrada"}
                </span>
               </td>
               <td>
                <Link className="om-link-chip" href={"/pos/ticket/"+v.id}>
                 <Icon name="printer" size={13}/>
                 <span>Ver / imprimir</span>
                </Link>
               </td>
              </tr>
             ))}
            </tbody>
           </table>
          </div>
         ):(
          <EmptyState icon="receipt" title="Sin ventas en este turno" description="Las ventas confirmadas aparecerán aquí con acceso inmediato al comprobante."/>
         )}
        </SectionCard>

        <SectionCard
         title="Movimientos de efectivo"
         subtitle="Ingresos y retiros de caja"
         icon="banknote"
         actions={
          <Operation
           title="Movimientos de efectivo"
           trigger="Registrar ingreso / retiro"
           variant="secondary"
           description="Aportes o retiros de efectivo durante el turno. Si corresponde a un gasto o pago a proveedor, registralo también en Finanzas."
          >
           <form action={cashMovementAction} className="fields">
            <input type="hidden" name="shiftId" value={shift.id}/>
            <input type="hidden" name="requestKey" value={randomUUID()}/>
            <Field label="Tipo">
             <select name="kind">
              <option value="IN">Ingreso</option>
              <option value="OUT">Retiro</option>
             </select>
            </Field>
            <Field label="Importe ($)">
             <input name="amount" inputMode="decimal" required/>
            </Field>
            <Field label="Motivo">
             <input name="reason" maxLength={300} required/>
            </Field>
            <button>Registrar movimiento</button>
           </form>
          </Operation>
         }
         padded
        >
         {movements.length>0?(
          <div>
           {movements.map(m=>(
            <div className="om-record-row" key={m.id}>
             <div>
              <strong>{m.kind==="IN"?"Ingreso":"Retiro"} · {m.reason}</strong>
              <small>{m.createdAt.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</small>
             </div>
             <span className={"status "+(m.kind==="IN"?"AVAILABLE":"REVIEW")}>
              {m.kind==="IN"?"+ ":"− "}{money(m.amountCents)}
             </span>
            </div>
           ))}
          </div>
         ):(
          <EmptyState icon="banknote" title="Sin movimientos" description="No hay ingresos ni retiros de efectivo en este turno."/>
         )}
        </SectionCard>
       </div>
      </div>
     </>
    )}

    <SectionCard title="Últimos cierres" subtitle="Historial reciente de arqueos del operador" icon="clock">
     {closed.length>0?(
      <div className="tablewrap">
       <table>
        <thead>
         <tr>
          <th>Sucursal</th>
          <th>Cierre</th>
          <th>Esperado</th>
          <th>Contado</th>
          <th>Diferencia</th>
         </tr>
        </thead>
        <tbody>
         {closed.map(c=>{
          const diff=(c.countedCents??0n)-(c.expectedCents??0n);
          return (
           <tr key={c.id}>
            <td><strong>{c.branch.name}</strong></td>
            <td>{c.closedAt?.toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</td>
            <td className="mono">{money(c.expectedCents??0n)}</td>
            <td className="mono">{money(c.countedCents??0n)}</td>
            <td className="mono">
             <span className={"status "+(diff===0n?"AVAILABLE":diff<0n?"BLOCKED":"REVIEW")}>
              {money(diff)}
             </span>
            </td>
           </tr>
          );
         })}
        </tbody>
       </table>
      </div>
     ):(
      <EmptyState icon="clock" title="Sin cierres registrados" description="Cuando cierres un turno aparecerá aquí el resumen de arqueo."/>
     )}
    </SectionCard>
   </main>

   <footer className="v2-posfoot">
    <span>OnlyMarket · Estación de caja independiente</span>
    <span>Comprobantes internos · pagos registrados manualmente</span>
   </footer>
  </div>
 );
}
