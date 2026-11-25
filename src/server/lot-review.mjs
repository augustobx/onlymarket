import {textField,localDay} from "../domain/parse.mjs";
import {serial,authorizeSale} from "./sales.mjs";

export async function reviewLot(prisma,s,input){
 const reason=textField(input.reason,"Motivo",300);
 const id=textField(input.lotId,"Lote");
 const decision=input.decision;
 if(!["AVAILABLE","BLOCKED","REVIEW"].includes(decision))throw new Error("Decisión inválida");

 const rawDays=input.reviewDays!=null&&String(input.reviewDays).trim()!==""?String(input.reviewDays).trim():"1";
 if(!/^\d{1,2}$/.test(rawDays)||Number(rawDays)<1||Number(rawDays)>30)throw new Error("Plazo de próxima revisión inválido (1 a 30 días)");
 const reviewDays=Number(rawDays);

 return serial(prisma,async tx=>{
  const role=await authorizeSale(tx,s,["OWNER","MANAGER","INVENTORY"]);
  const lot=await tx.lot.findUnique({where:{tenantId_id:{tenantId:s.tenantId,id}},include:{product:true}});
  if(!lot||lot.quantityMilli<=0n)throw new Error("Lote sin stock");
  if(input.requiredSector&&lot.product.sector!==input.requiredSector)throw new Error("El lote no pertenece al sector esperado");
  if(lot.status==="BLOCKED"&&decision!=="BLOCKED"&&!["OWNER","MANAGER"].includes(role)){
   throw new Error("Solo propietario o encargado pueden rehabilitar un lote bloqueado");
  }
  if(decision==="AVAILABLE"){
   if(lot.expiresOn&&lot.expiresOn.toISOString().slice(0,10)<=localDay())throw new Error("Lote vencido");
   if(lot.product.sector==="PRODUCE"&&!lot.expiresOn&&lot.product.freshnessDays==null){
    throw new Error("Configurar plazo de revisión antes de liberar");
   }
  }
  const needsFreshnessSchedule=lot.product.sector==="PRODUCE"||lot.reviewAt!==null||lot.product.freshnessDays!==null;
  const nextReviewAt=decision==="AVAILABLE"?(needsFreshnessSchedule?new Date(Date.now()+reviewDays*86400000):null):lot.reviewAt;
  const updated=await tx.lot.update({
   where:{tenantId_id:{tenantId:s.tenantId,id}},
   data:{status:decision,reviewAt:nextReviewAt},
  });
  await tx.stockMovement.create({
   data:{
    tenantId:s.tenantId,
    lotId:id,
    actorId:s.actorUserId,
    kind:"ADJUSTMENT",
    deltaMilli:0n,
    deltaCostCents:0n,
    reason:"Revisión "+decision+": "+reason,
   },
  });
  return updated;
 });
}
