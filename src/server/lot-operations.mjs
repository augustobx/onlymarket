import {createHash} from "node:crypto";
import {decimal,textField,localDay} from "../domain/parse.mjs";
import {consumeCost,classifyLot} from "../domain/inventory.mjs";
import {openedExpiry} from "../domain/shelf-life.mjs";
import {serial,authorizeSale} from "./sales.mjs";
export async function lotOperation(prisma,s,input){
 const id=textField(input.lotId,"Lote"),requestKey=textField(input.requestKey,"Operación"),reason=textField(input.reason,"Motivo",300),kind=input.kind;
 if(!["OPEN","GIFT","WASTE"].includes(kind))throw new Error("Operación inválida");
 const q=kind==="OPEN"?0n:decimal(input.quantity,3,"Cantidad");
 const requestHash=createHash("sha256").update(JSON.stringify([s.actorUserId,id,kind,q.toString(),reason])).digest("hex");
 return serial(prisma,async tx=>{
  await authorizeSale(tx,s,["OWNER","MANAGER","INVENTORY"]);
  const tenantId=s.tenantId;
  const old=await tx.lotOperation.findUnique({where:{tenantId_requestKey:{tenantId,requestKey}}});
  if(old){if(old.requestHash!==requestHash)throw new Error("Operación duplicada con otros datos");return old;}
  const lot=await tx.lot.findUnique({where:{tenantId_id:{tenantId,id}},include:{product:true}});
  if(!lot||lot.quantityMilli<=0n)throw new Error("Lote sin stock");
  const today=localDay(), expiry=lot.expiresOn?.toISOString().slice(0,10)??null;
  const state=classifyLot({today,expiresOn:expiry,reviewOn:lot.reviewAt?localDay(lot.reviewAt):null,status:lot.status,quantityMilli:lot.quantityMilli,alertDays:lot.product.alertDays});
  let costCents=0n;
  if(kind==="OPEN"){
   if(lot.openedAt)throw new Error("El lote ya está abierto");
   if(!["AVAILABLE","EXPIRING"].includes(state))throw new Error("Lote no apto");
   if(!["DELI","BUTCHERY"].includes(lot.product.sector))throw new Error("Solo piezas de carnicería o fiambrería");
   const expiresOn=openedExpiry({today,printedExpiry:expiry,lifeDays:lot.product.openedLifeDays});
   await tx.lot.update({where:{tenantId_id:{tenantId,id}},data:{openedAt:new Date(),printedExpiresOn:lot.printedExpiresOn??lot.expiresOn,expiresOn}});
  }else{
   if(kind==="GIFT"&&!["AVAILABLE","EXPIRING"].includes(state))throw new Error("No se puede regalar mercadería no apta");
   if(lot.product.unit==="UNIT"&&q%1000n)throw new Error("Se requieren unidades enteras");
   costCents=consumeCost(lot.quantityMilli,lot.remainingCostCents,q);
   const remaining=lot.quantityMilli-q;
   await tx.lot.update({where:{tenantId_id:{tenantId,id}},data:{quantityMilli:remaining,remainingCostCents:lot.remainingCostCents-costCents,status:remaining===0n?"EXHAUSTED":lot.status}});
  }
  const operation=await tx.lotOperation.create({data:{tenantId,lotId:id,actorId:s.actorUserId,requestKey,requestHash,kind,quantityMilli:q,costCents,reason}});
  await tx.stockMovement.create({data:{tenantId,lotId:id,actorId:s.actorUserId,kind:kind==="OPEN"?"ADJUSTMENT":kind,deltaMilli:-q,deltaCostCents:-costCents,reason:kind+" "+operation.id+": "+reason}});
  return operation;
 });
}
