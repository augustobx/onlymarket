import {createHash,randomUUID} from "node:crypto";
import {decimal,textField} from "../domain/parse.mjs";
import {returnQuote,refundAllocation,refundFields} from "../domain/returns.mjs";
import {serial,authorizeSale,expectedCash} from "./sales.mjs";
export async function recordReturn(prisma,s,input){
 const saleId=textField(input.saleId,"Venta"),saleLineId=textField(input.saleLineId,"Renglón"),shiftId=textField(input.shiftId,"Caja"),requestKey=textField(input.requestKey,"Operación"),reason=textField(input.reason,"Motivo",300),disposition=input.disposition;
 const quantityMilli=decimal(input.quantity,3,"Cantidad"),quoted=decimal(input.quoted,2,"Reintegro confirmado",{allowZero:true});
 if(input.confirm!=="yes"||!["REVIEW","WASTE"].includes(disposition))throw new Error("Confirmá el reintegro y destino");
 const confirmed=Object.fromEntries(refundFields.map(k=>[k,decimal(input.parts?.[k]||"0",2,"Medio de reintegro",{allowZero:true})]));
 const requestHash=createHash("sha256").update(JSON.stringify([s.actorUserId,saleId,saleLineId,shiftId,quantityMilli,quoted,confirmed,reason,disposition],(_,v)=>typeof v==="bigint"?v.toString():v)).digest("hex");
 return serial(prisma,async tx=>{
  await authorizeSale(tx,s,["OWNER","MANAGER"]);
  const tenantId=s.tenantId,old=await tx.saleReturn.findUnique({where:{tenantId_requestKey:{tenantId,requestKey}}});
  if(old){if(old.requestHash!==requestHash)throw new Error("Operación duplicada con otros datos");return old;}
  const sale=await tx.sale.findUnique({where:{tenantId_id:{tenantId,id:saleId}},include:{shift:true,cancellation:true,returns:true,lines:{include:{lot:true,product:true}}}});
  if(!sale||sale.cancellation)throw new Error("Venta inexistente o anulada");
  const line=sale.lines.find(l=>l.id===saleLineId);
  if(!line)throw new Error("Renglón inválido");
  if(line.product.unit==="UNIT"&&quantityMilli%1000n)throw new Error("Se requieren unidades enteras");
  const shift=await tx.cashShift.findUnique({where:{tenantId_id:{tenantId,id:shiftId}}});
  if(!shift||shift.closedAt||shift.actorId!==s.actorUserId||shift.branchId!==sale.shift.branchId)throw new Error("Abrí tu caja en la sucursal original");
  const previous=sale.returns.filter(r=>r.saleLineId===line.id).reduce((sum,r)=>sum+r.quantityMilli,0n);
  const quote=returnQuote(line,{quantityMilli:previous},quantityMilli);
  const prior=Object.fromEntries(refundFields.map(k=>[k,sale.returns.reduce((sum,r)=>sum+r[k],0n)]));
  const parts=refundAllocation(sale,prior,quote.refundCents);
  if(quoted!==quote.refundCents||refundFields.some(k=>confirmed[k]!==parts[k]))throw new Error("El reintegro cambió. Revisá los importes nuevamente.");
  if(parts.cashCents>0n&&await expectedCash(tx,shift)<parts.cashCents)throw new Error("Efectivo insuficiente en caja");
  const lot=line.lot,actorId=s.actorUserId;
  let returnedLotId=null;
  if(disposition==="REVIEW"){
   const child=await tx.lot.create({data:{tenantId,branchId:shift.branchId,productId:lot.productId,supplierId:lot.supplierId,code:lot.code.slice(0,70)+"-R-"+randomUUID(),receivedAt:lot.receivedAt,expiresOn:lot.expiresOn,printedExpiresOn:lot.printedExpiresOn,openedAt:lot.openedAt,reviewAt:lot.reviewAt,quantityMilli,remainingCostCents:quote.costCents,status:lot.status==="BLOCKED"?"BLOCKED":"REVIEW"}});
   returnedLotId=child.id;
  }
  const result=await tx.saleReturn.create({data:{tenantId,saleId,saleLineId,shiftId,returnedLotId,actorId,requestKey,requestHash,quantityMilli,...quote,...parts,disposition,reason}});
  const movement={tenantId,lotId:returnedLotId??lot.id,saleId,actorId,reason:"Devolución "+result.id+": "+reason};
  await tx.stockMovement.create({data:{...movement,kind:"RETURN",deltaMilli:quantityMilli,deltaCostCents:quote.costCents}});
  if(disposition==="WASTE")await tx.stockMovement.create({data:{...movement,kind:"WASTE",deltaMilli:-quantityMilli,deltaCostCents:-quote.costCents}});
  return result;
 });
}
