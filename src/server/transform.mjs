import {localDay} from "../domain/parse.mjs";
import {createHash} from "node:crypto";
import {consumeCost,planTransformation,classifyLot} from "../domain/inventory.mjs";

const dateOnly = date => date?.toISOString().slice(0,10) ?? null;
const validId = value => typeof value === "string" && value.length > 0 && value.length <= 128;
const MAX = 9223372036854775807n;
function quantity(value) {
  if (typeof value !== "string" || !/^\d{1,19}$/.test(value)) throw new Error("Cantidad inválida");
  const n=BigInt(value); if(n<=0n||n>MAX) throw new Error("Cantidad fuera de rango"); return n;
}
function validate(input){
  if(!validId(input.branchId)||!validId(input.sourceLotId)||!validId(input.requestKey)||
     !Array.isArray(input.outputs)||input.outputs.length<1||input.outputs.length>100) throw new Error("Solicitud inválida");
  return {branchId:input.branchId,sourceLotId:input.sourceLotId,requestKey:input.requestKey,
    inputMilli:quantity(input.inputMilli),outputs:input.outputs.map(o=>{
      if(!["STOCK","GIFT","WASTE"].includes(o.disposition)||typeof o.reason!=="string"||!o.reason.trim()||o.reason.length>300||
       (o.disposition==="STOCK"&&!validId(o.productId))) throw new Error("Salida inválida");
      return {disposition:o.disposition,reason:o.reason.trim(),productId:o.disposition==="STOCK"?o.productId:null,quantityMilli:quantity(o.quantityMilli)};
    })};
}
// Server-only service. actorUserId MUST be derived from authenticated session.
// No HTTP routes are exposed until authentication and CSRF protection are implemented.
export async function transformLot(prisma, session, input) {
  if(!validId(session?.tenantId)||!validId(session?.actorUserId)) throw new Error("Sesión inválida");
  const {tenantId,actorUserId:actorId}=session;
  const request=validate(input);
  const requestHash=createHash("sha256").update(JSON.stringify({actorId,...request},(_,v)=>typeof v==="bigint"?v.toString():v)).digest("hex");
  for(let attempt=0;attempt<3;attempt++){
    try{
      return await prisma.$transaction(async tx=>{
        const member=await tx.membership.findUnique({where:{tenantId_userId:{tenantId,userId:actorId}},include:{user:true}});
        if(!member?.user.active||!["OWNER","MANAGER","INVENTORY"].includes(member.role)) throw new Error("Sin permisos");
        const prior=await tx.transformation.findUnique({where:{tenantId_requestKey:{tenantId,requestKey:request.requestKey}},include:{outputs:true}});
        if(prior){if(prior.requestHash!==requestHash)throw new Error("Clave de operación ya utilizada");return prior;}
        const source=await tx.lot.findUnique({where:{tenantId_id:{tenantId,id:request.sourceLotId}},include:{product:true}});
        if(!source||source.branchId!==request.branchId||source.product.unit!=="KG")throw new Error("Lote origen inválido");
        const today=localDay(new Date());
        if(!["AVAILABLE","EXPIRING"].includes(classifyLot({today,expiresOn:dateOnly(source.expiresOn),
          reviewOn:source.reviewAt?localDay(source.reviewAt):null,alertDays:source.product.alertDays,status:source.status,quantityMilli:source.quantityMilli})))throw new Error("Lote no apto");
        // Require a known expiry for transformations until a validated product-specific shelf-life policy exists.
        if(!source.expiresOn)throw new Error("El lote origen requiere fecha de vencimiento");
        const inputCostCents=consumeCost(source.quantityMilli,source.remainingCostCents,request.inputMilli);
        const lines=planTransformation(request.inputMilli,inputCostCents,request.outputs);
        const ids=[...new Set(lines.filter(l=>l.disposition==="STOCK").map(l=>l.productId))];
        const products=await tx.product.findMany({where:{tenantId,id:{in:ids},unit:"KG",active:true}});
        if(products.length!==ids.length)throw new Error("Producto de salida inválido");
        const batch=await tx.transformation.create({data:{tenantId,branchId:source.branchId,sourceLotId:source.id,actorId,requestKey:request.requestKey,requestHash,inputMilli:request.inputMilli,inputCostCents}});
        const remaining=source.quantityMilli-request.inputMilli;
        await tx.lot.update({where:{tenantId_id:{tenantId,id:source.id}},data:{quantityMilli:remaining,
          remainingCostCents:source.remainingCostCents-inputCostCents,status:remaining===0n?"EXHAUSTED":source.status}});
        // Partition the source debit by disposition, so gifts/waste are not counted twice.
        for(const [index,line] of lines.entries()){
          await tx.stockMovement.create({data:{tenantId,lotId:source.id,transformationId:batch.id,actorId,
            kind:line.disposition==="STOCK"?"TRANSFORM_OUT":line.disposition,deltaMilli:-line.quantityMilli,deltaCostCents:-line.costCents,reason:line.reason}});
          if(line.disposition!=="STOCK")continue;
          const lot=await tx.lot.create({data:{tenantId,branchId:source.branchId,productId:line.productId,supplierId:source.supplierId,
            code:batch.id+"-"+index,quantityMilli:line.quantityMilli,remainingCostCents:line.costCents,
            expiresOn:source.expiresOn,reviewAt:source.reviewAt,openedAt:source.openedAt,status:"REVIEW",producedById:batch.id}});
          // Output is held for manual review; no silent extension of shelf life.
          await tx.stockMovement.create({data:{tenantId,lotId:lot.id,transformationId:batch.id,actorId,kind:"TRANSFORM_IN",
            deltaMilli:line.quantityMilli,deltaCostCents:line.costCents,reason:line.reason}});
        }
        return tx.transformation.findUniqueOrThrow({where:{tenantId_id:{tenantId,id:batch.id}},include:{outputs:true}});
      },{isolationLevel:"Serializable"});
    }catch(error){
      if(!["P2034","P2002"].includes(error?.code)||attempt===2)throw error;
    }
  }
}
