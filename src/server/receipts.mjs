import {createHash} from "node:crypto";
import {decimal,dateInput,textField,localDay} from "../domain/parse.mjs";
export async function receiveLot(prisma,session,input){
  const {tenantId,actorUserId:actorId}=session;
  const branchId=textField(input.branchId,"Sucursal"),supplierId=textField(input.supplierId,"Proveedor"),productId=textField(input.productId,"Producto");
  const code=textField(input.code,"Lote"),requestKey=textField(input.requestKey,"Operación");
  const invoiceRef=textField(input.invoiceRef??"","Comprobante",100,true)||null;
  const quantityMilli=decimal(input.quantity,3,"Cantidad"),totalCostCents=decimal(input.cost,2,"Costo total",{allowZero:true});
  const expiresOn=dateInput(input.expiresOn);
  const requestHash=createHash("sha256").update(JSON.stringify([actorId,branchId,supplierId,productId,code,invoiceRef,quantityMilli.toString(),totalCostCents.toString(),expiresOn?.toISOString()])).digest("hex");
  for(let attempt=0;attempt<3;attempt++){
    try{return await prisma.$transaction(async tx=>{
      const member=await tx.membership.findUnique({where:{tenantId_userId:{tenantId,userId:actorId}},include:{user:true}});
      if(!member?.user.active||!["OWNER","MANAGER","INVENTORY"].includes(member.role))throw new Error("Sin permisos");
      const prior=await tx.receipt.findUnique({where:{tenantId_requestKey:{tenantId,requestKey}}});
      if(prior){if(prior.requestHash!==requestHash)throw new Error("Operación duplicada con datos distintos");return prior;}
      const [branch,supplier,product]=await Promise.all([
        tx.branch.findUnique({where:{tenantId_id:{tenantId,id:branchId}}}),
        tx.supplier.findUnique({where:{tenantId_id:{tenantId,id:supplierId}}}),
        tx.product.findUnique({where:{tenantId_id:{tenantId,id:productId}}})
      ]);
      if(!branch||!supplier||!product?.active)throw new Error("Sucursal, proveedor o producto inválido");
      if(product.unit==="UNIT"&&quantityMilli%1000n!==0n)throw new Error("El producto requiere unidades enteras");
      if(["BUTCHERY","DELI"].includes(product.sector)&&!expiresOn)throw new Error("El producto requiere vencimiento");
      const today=localDay();
      if(expiresOn&&expiresOn.toISOString().slice(0,10)<=today)throw new Error("No se permite recibir mercadería vencida");
      // For produce, missing freshness policy requires review rather than silent clearance.
      const reviewAt=product.freshnessDays!=null?new Date(Date.now()+product.freshnessDays*86400000):null;
      const status=product.sector==="PRODUCE"&&!reviewAt&&!expiresOn?"REVIEW":"AVAILABLE";
      const lot=await tx.lot.create({data:{tenantId,branchId,supplierId,productId,code,quantityMilli,remainingCostCents:totalCostCents,expiresOn,printedExpiresOn:expiresOn,reviewAt,status}});
      const receipt=await tx.receipt.create({data:{tenantId,branchId,supplierId,lotId:lot.id,actorId,requestKey,requestHash,invoiceRef,quantityMilli,totalCostCents}});
      await tx.stockMovement.create({data:{tenantId,lotId:lot.id,actorId,kind:"RECEIPT",deltaMilli:quantityMilli,deltaCostCents:totalCostCents,reason:"Recepción "+receipt.id}});
      return receipt;
    },{isolationLevel:"Serializable"});}
    catch(error){if(!["P2034","P2002"].includes(error?.code)||attempt===2)throw error;}
  }
}
