import {createHash} from "node:crypto";
import {decimal,textField,localDay} from "../domain/parse.mjs";
import {consumeCost,classifyLot} from "../domain/inventory.mjs";
import {eligiblePromotions,quotePromotion,paymentBreakdown,checked} from "../domain/sales.mjs";
const dayOnly=d=>d?.toISOString().slice(0,10)??null;
const roles=["OWNER","MANAGER","CASHIER"];
export async function authorizeSale(tx,s,allowed=roles){
 const m=await tx.membership.findUnique({where:{tenantId_userId:{tenantId:s.tenantId,userId:s.actorUserId}},include:{user:true}});
 if(!m?.user.active||!allowed.includes(m.role))throw new Error("Sin permisos");
 return m.role;
}
export async function serial(prisma,fn){
 for(let i=0;i<4;i++){try{return await prisma.$transaction(fn,{isolationLevel:"Serializable"});}
 catch(e){if(!["P2034","P2002"].includes(e?.code)||i===3)throw e;}}
}
export async function openShift(prisma,s,input){
 const branchId=textField(input.branchId,"Sucursal"),openingCents=decimal(input.opening,2,"Fondo inicial",{allowZero:true});
 return serial(prisma,async tx=>{
  await authorizeSale(tx,s);
  const branch=await tx.branch.findUnique({where:{tenantId_id:{tenantId:s.tenantId,id:branchId}}});
  if(!branch)throw new Error("Sucursal inválida");
  const existing=await tx.cashShift.findUnique({where:{tenantId_activeKey:{tenantId:s.tenantId,activeKey:s.actorUserId}}});
  if(existing)throw new Error("Ya tenés una caja abierta");
  return tx.cashShift.create({data:{tenantId:s.tenantId,branchId,actorId:s.actorUserId,activeKey:s.actorUserId,openingCents}});
 });
}
export async function closeShift(prisma,s,input){
 const id=textField(input.shiftId,"Caja"),countedCents=decimal(input.counted,2,"Efectivo contado",{allowZero:true});
 return serial(prisma,async tx=>{
  await authorizeSale(tx,s);
  const shift=await tx.cashShift.findUnique({where:{tenantId_id:{tenantId:s.tenantId,id}}});
  if(!shift||shift.actorId!==s.actorUserId)throw new Error("Caja inválida");
  if(shift.closedAt){if(shift.countedCents===countedCents)return shift;throw new Error("Caja cerrada");}
  const expectedCents=await expectedCash(tx,shift);
  return tx.cashShift.update({where:{tenantId_id:{tenantId:s.tenantId,id}},data:{activeKey:null,closedAt:new Date(),expectedCents,countedCents}});
 });
}
export async function recordSale(prisma,s,input){
 const shiftId=textField(input.shiftId,"Caja"),requestKey=textField(input.requestKey,"Operación"),payment=input.payment;
 if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100)throw new Error("Venta sin artículos o demasiado extensa");
 const quantities=new Map();
 for(const l of input.lines){const id=textField(l.lotId,"Lote"),q=decimal(l.quantity,3,"Cantidad");quantities.set(id,checked((quantities.get(id)??0n)+q));}
 const lines=[...quantities].sort(([a],[b])=>a.localeCompare(b));
 const quoted=decimal(input.quotedTotal,2,"Total confirmado",{allowZero:true});
 const parts=payment==="MIXED"?Object.fromEntries(["cashCents","debitCents","creditCents","transferCents"].map(k=>[k,decimal(input.parts?.[k]||"0",2,"Importe del medio",{allowZero:true})])):{};
 const tendered=payment==="CASH"||(parts.cashCents??0n)>0n?decimal(input.tendered,2,"Efectivo recibido",{allowZero:true}):null;
 const paid=paymentBreakdown(quoted,payment,tendered,parts);
 const payload=[s.actorUserId,shiftId,payment,tendered,quoted,lines];
 if(payment==="MIXED")payload.push(parts);
 const requestHash=createHash("sha256").update(JSON.stringify(payload,(_,v)=>typeof v==="bigint"?v.toString():v)).digest("hex");
 return serial(prisma,async tx=>{
  await authorizeSale(tx,s);
  const tenantId=s.tenantId;
  const old=await tx.sale.findUnique({where:{tenantId_requestKey:{tenantId,requestKey}}});
  if(old){if(old.requestHash!==requestHash)throw new Error("Operación duplicada con otros datos");return old;}
  const shift=await tx.cashShift.findUnique({where:{tenantId_id:{tenantId,id:shiftId}}});
  if(!shift||shift.actorId!==s.actorUserId||shift.closedAt||!shift.activeKey)throw new Error("Caja no disponible");
  const today=localDay(), items=[];
  const saleLots=await tx.lot.findMany({where:{tenantId,branchId:shift.branchId,id:{in:lines.map(([id])=>id)}},include:{product:true}});
  const byId=new Map(saleLots.map(l=>[l.id,l]));
  const promos=await tx.promotion.findMany({where:{tenantId,productId:{in:[...new Set(saleLots.map(l=>l.productId))]},active:true}});
  const promoDates=promos.map(p=>({...p,startsOn:dayOnly(p.startsOn),endsOn:dayOnly(p.endsOn)}));
  for(const [id,quantityMilli] of lines){
   const lot=byId.get(id);
   if(!lot||lot.branchId!==shift.branchId||!lot.product.active)throw new Error("Lote inválido para esta caja");
   if(lot.product.unit==="UNIT"&&quantityMilli%1000n)throw new Error("Se requieren unidades enteras");
   const info={...lot,expiresOn:dayOnly(lot.expiresOn),reviewOn:lot.reviewAt?localDay(lot.reviewAt):null,alertDays:lot.product.alertDays};
   if(!["AVAILABLE","EXPIRING"].includes(classifyLot({...info,today})))throw new Error("Lote no apto para venta");
   const costCents=consumeCost(lot.quantityMilli,lot.remainingCostCents,quantityMilli);
   const eligible=eligiblePromotions(promoDates,info,today);
   const price=quotePromotion(lot.product.salePriceCents,quantityMilli,lot.product.unit,eligible);
   items.push({lot,quantityMilli,costCents,price});
  }
  const sum=fn=>checked(items.reduce((a,l)=>a+fn(l),0n));
  const totalCents=sum(l=>l.price.total);
  if(totalCents!==quoted)throw new Error("El precio cambió. Revisá y confirmá nuevamente.");
  const sale=await tx.sale.create({data:{tenantId,shiftId,actorId:s.actorUserId,requestKey,requestHash,payment,totalCents,subtotalCents:sum(l=>l.price.subtotal),costCents:sum(l=>l.costCents),...paid}});
  for(const {lot,quantityMilli,costCents,price} of items){
   const remaining=lot.quantityMilli-quantityMilli;
   await tx.lot.update({where:{tenantId_id:{tenantId,id:lot.id}},data:{quantityMilli:remaining,remainingCostCents:lot.remainingCostCents-costCents,status:remaining===0n?"EXHAUSTED":lot.status}});
   await tx.saleLine.create({data:{tenantId,saleId:sale.id,lotId:lot.id,productId:lot.productId,productName:lot.product.name,quantityMilli,unitPriceCents:lot.product.salePriceCents,subtotalCents:price.subtotal,totalCents:price.total,costCents,discountBps:price.discountBps,promotionId:price.promotionId,promotionLabel:price.promotionLabel}});
   await tx.stockMovement.create({data:{tenantId,lotId:lot.id,saleId:sale.id,actorId:s.actorUserId,kind:"SALE",deltaMilli:-quantityMilli,deltaCostCents:-costCents,reason:"Venta "+sale.id}});
  }
  return sale;
 });
}

export async function expectedCash(tx,shift){
 const where={tenantId:shift.tenantId,shiftId:shift.id};
 const [sales,moves]=await Promise.all([
  tx.sale.aggregate({where:{...where,cancellation:null},_sum:{cashCents:true}}),
  tx.cashMovement.groupBy({by:["kind"],where,_sum:{amountCents:true}})
 ]);
 const sum=kind=>moves.find(m=>m.kind===kind)?._sum.amountCents??0n;
 return checked(shift.openingCents+(sales._sum.cashCents??0n)+sum("IN")-sum("OUT"));
}
export async function recordCashMovement(prisma,s,input){
 const shiftId=textField(input.shiftId,"Caja"),requestKey=textField(input.requestKey,"Operación"),reason=textField(input.reason,"Motivo",300);
 const kind=input.kind,amountCents=decimal(input.amount,2,"Importe");
 if(!["IN","OUT"].includes(kind))throw new Error("Tipo de movimiento inválido");
 const requestHash=createHash("sha256").update(JSON.stringify([s.actorUserId,shiftId,kind,amountCents.toString(),reason])).digest("hex");
 return serial(prisma,async tx=>{
  await authorizeSale(tx,s);
  const tenantId=s.tenantId;
  const old=await tx.cashMovement.findUnique({where:{tenantId_requestKey:{tenantId,requestKey}}});
  if(old){if(old.requestHash!==requestHash)throw new Error("Operación duplicada con otros datos");return old;}
  const shift=await tx.cashShift.findUnique({where:{tenantId_id:{tenantId,id:shiftId}}});
  if(!shift||shift.actorId!==s.actorUserId||shift.closedAt)throw new Error("Caja no disponible");
  const available=await expectedCash(tx,shift);
  if(kind==="OUT"&&available<amountCents)throw new Error("Efectivo insuficiente en caja");
  if(kind==="IN")checked(available+amountCents);
  return tx.cashMovement.create({data:{tenantId,shiftId,actorId:s.actorUserId,requestKey,requestHash,kind,amountCents,reason}});
 });
}
export async function cancelSale(prisma,s,input){
 const saleId=textField(input.saleId,"Venta"),requestKey=textField(input.requestKey,"Operación"),reason=textField(input.reason,"Motivo",300),disposition=input.disposition;
 if(!["REVIEW","WASTE"].includes(disposition)||input.confirm!=="yes")throw new Error("Confirmá el reintegro y destino de la mercadería");
 const requestHash=createHash("sha256").update(JSON.stringify([s.actorUserId,saleId,reason,disposition])).digest("hex");
 return serial(prisma,async tx=>{
  await authorizeSale(tx,s,["OWNER","MANAGER"]);
  const tenantId=s.tenantId;
  const old=await tx.saleCancellation.findUnique({where:{tenantId_requestKey:{tenantId,requestKey}}});
  if(old){if(old.requestHash!==requestHash)throw new Error("Operación duplicada con otros datos");return old;}
  const sale=await tx.sale.findUnique({where:{tenantId_id:{tenantId,id:saleId}},include:{shift:true,lines:{include:{lot:true}},cancellation:true}});
  if(!sale||sale.cancellation)throw new Error("Venta inexistente o ya anulada");
  if(sale.shift.closedAt||localDay(sale.createdAt)!==localDay())throw new Error("Solo ventas del día con caja abierta");
  if(sale.cashCents>0n&&await expectedCash(tx,sale.shift)<sale.cashCents)throw new Error("Efectivo insuficiente para reintegro");
  const cancellation=await tx.saleCancellation.create({data:{tenantId,saleId,actorId:s.actorUserId,requestKey,requestHash,reason,disposition}});
  for(const line of sale.lines){
   const lot=await tx.lot.findUniqueOrThrow({where:{tenantId_id:{tenantId,id:line.lotId}}});
   const base={tenantId,lotId:lot.id,saleId,actorId:s.actorUserId,reason:"Anulación "+cancellation.id+": "+reason};
   await tx.stockMovement.create({data:{...base,kind:"RETURN",deltaMilli:line.quantityMilli,deltaCostCents:line.costCents}});
   if(disposition==="WASTE"){
    await tx.stockMovement.create({data:{...base,kind:"WASTE",deltaMilli:-line.quantityMilli,deltaCostCents:-line.costCents}});
   }else{
    await tx.lot.update({where:{tenantId_id:{tenantId,id:lot.id}},data:{quantityMilli:checked(lot.quantityMilli+line.quantityMilli),remainingCostCents:checked(lot.remainingCostCents+line.costCents),status:lot.status==="BLOCKED"?"BLOCKED":"REVIEW"}});
   }
  }
  return cancellation;
 });
}
