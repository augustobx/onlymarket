import {createHash,randomUUID} from "node:crypto";
import {decimal,textField,localDay} from "../domain/parse.mjs";
import {consumeCost,classifyLot} from "../domain/inventory.mjs";
import {checked} from "../domain/sales.mjs";
import {serial,authorizeSale} from "./sales.mjs";
const hash=v=>createHash("sha256").update(JSON.stringify(v,(_,x)=>typeof x==="bigint"?x.toString():x)).digest("hex");
export function stockSnapshot(lot,lastMovement){return hash([lot.id,lot.quantityMilli,lot.remainingCostCents,lot.status,lot.expiresOn,lot.reviewAt,lot.openedAt,lastMovement??null]);}
export async function stockControl(prisma,s,input){
 const sourceLotId=textField(input.lotId,"Lote"),requestKey=textField(input.requestKey,"Operación"),reason=textField(input.reason,"Motivo",300),kind=input.kind;
 if(!["COUNT","TRANSFER"].includes(kind))throw new Error("Operación inválida");
 const quantity=decimal(input.quantity,3,"Cantidad",{allowZero:kind==="COUNT"});
 const addedCost=kind==="COUNT"&&input.addedCost?decimal(input.addedCost,2,"Costo del sobrante",{allowZero:true}):null;
 const destinationBranchId=kind==="TRANSFER"?textField(input.destinationBranchId,"Sucursal destino"):null;
 const snapshot=textField(input.snapshot,"Versión de stock",64);
 const requestHash=hash([s.actorUserId,sourceLotId,kind,quantity,addedCost,destinationBranchId,snapshot,reason]);
 return serial(prisma,async tx=>{
  await authorizeSale(tx,s,kind==="COUNT"?["OWNER","MANAGER"]:["OWNER","MANAGER","INVENTORY"]);
  const tenantId=s.tenantId;
  const old=await tx.stockControl.findUnique({where:{tenantId_requestKey:{tenantId,requestKey}}});
  if(old){if(old.requestHash!==requestHash)throw new Error("Operación duplicada con otros datos");return old;}
  const lot=await tx.lot.findUnique({where:{tenantId_id:{tenantId,id:sourceLotId}},include:{product:true}});
  if(!lot)throw new Error("Lote inválido");
  const last=await tx.stockMovement.findFirst({where:{tenantId,lotId:lot.id},orderBy:[{createdAt:"desc"},{id:"desc"}],select:{id:true}});
  if(stockSnapshot(lot,last?.id)!==snapshot)throw new Error("El lote cambió. Actualizá y repetí el conteo o traslado.");
  if(lot.product.unit==="UNIT"&&quantity%1000n)throw new Error("Se requieren unidades enteras");
  const before=lot.quantityMilli,after=kind==="COUNT"?quantity:before-quantity;
  if(after<0n)throw new Error("Stock insuficiente");
  const delta=after-before,abs=delta<0n?-delta:delta;
  let cost=0n,destinationLotId=null,status=lot.status;
  if(kind==="TRANSFER"){
   if(destinationBranchId===lot.branchId)throw new Error("Elegí otra sucursal");
   if(!await tx.branch.findUnique({where:{tenantId_id:{tenantId,id:destinationBranchId}}}))throw new Error("Sucursal inválida");
   const state=classifyLot({today:localDay(),expiresOn:lot.expiresOn?.toISOString().slice(0,10)??null,reviewOn:lot.reviewAt?localDay(lot.reviewAt):null,alertDays:lot.product.alertDays,status:lot.status,quantityMilli:before});
   if(!lot.product.active||!["AVAILABLE","EXPIRING"].includes(state))throw new Error("Lote no apto para traslado");
   cost=consumeCost(before,lot.remainingCostCents,quantity);
   const child=await tx.lot.create({data:{tenantId,branchId:destinationBranchId,productId:lot.productId,supplierId:lot.supplierId,code:lot.code.slice(0,70)+"-T-"+randomUUID(),receivedAt:lot.receivedAt,expiresOn:lot.expiresOn,printedExpiresOn:lot.printedExpiresOn,openedAt:lot.openedAt,reviewAt:lot.reviewAt,quantityMilli:quantity,remainingCostCents:cost,status:"REVIEW"}});
   destinationLotId=child.id;
  }else if(delta<0n){
   if(addedCost!==null)throw new Error("No ingreses costo para un faltante");
   cost=consumeCost(before,lot.remainingCostCents,abs);
  }else if(delta>0n){
   if(before===0n||lot.status==="EXHAUSTED")throw new Error("No se puede reactivar un lote agotado; registrá una recepción documentada");
   if(addedCost===null)throw new Error("Ingresá costo total documentado del sobrante");
   cost=addedCost;status=lot.status==="BLOCKED"?"BLOCKED":"REVIEW";
  }else if(addedCost!==null)throw new Error("No ingreses costo si no hay diferencia");
  const newCost=checked(lot.remainingCostCents+(delta>0n?cost:-cost));
  const control=await tx.stockControl.create({data:{tenantId,sourceLotId,destinationLotId,actorId:s.actorUserId,requestKey,requestHash,kind,beforeMilli:before,afterMilli:after,quantityMilli:abs,costCents:cost,reason}});
  await tx.lot.update({where:{tenantId_id:{tenantId,id:lot.id}},data:{quantityMilli:after,remainingCostCents:newCost,status:after===0n?"EXHAUSTED":status}});
  const movement={tenantId,actorId:s.actorUserId,reason:kind+" "+control.id+": "+reason};
  await tx.stockMovement.create({data:{...movement,lotId:lot.id,kind:kind==="COUNT"&&delta<0n?"WASTE":"ADJUSTMENT",deltaMilli:delta,deltaCostCents:delta>0n?cost:-cost}});
  if(destinationLotId)await tx.stockMovement.create({data:{...movement,lotId:destinationLotId,kind:"ADJUSTMENT",deltaMilli:quantity,deltaCostCents:cost}});
  return control;
 });
}
export async function setTarget(prisma,s,input){
 const branchId=textField(input.branchId,"Sucursal"),productId=textField(input.productId,"Producto"),minimumMilli=decimal(input.minimum,3,"Mínimo",{allowZero:true}),targetMilli=decimal(input.target,3,"Objetivo",{allowZero:true});
 if(targetMilli<minimumMilli)throw new Error("El objetivo no puede ser menor al mínimo");
 return serial(prisma,async tx=>{
  await authorizeSale(tx,s,["OWNER","MANAGER"]);
  const tenantId=s.tenantId;
  const [branch,p]=await Promise.all([tx.branch.findUnique({where:{tenantId_id:{tenantId,id:branchId}}}),tx.product.findUnique({where:{tenantId_id:{tenantId,id:productId}}})]);
  if(!branch||!p?.active)throw new Error("Sucursal o producto inválido");
  if(p.unit==="UNIT"&&(minimumMilli%1000n||targetMilli%1000n))throw new Error("Se requieren unidades enteras");
  return tx.stockTarget.upsert({where:{tenantId_branchId_productId:{tenantId,branchId,productId}},create:{tenantId,branchId,productId,minimumMilli,targetMilli},update:{minimumMilli,targetMilli}});
 });
}
