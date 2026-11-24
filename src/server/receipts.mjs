import {createHash} from "node:crypto";
import {decimal,dateInput,textField,localDay} from "../domain/parse.mjs";
import {serial,authorizeSale} from "./sales.mjs";
import {checked} from "../domain/sales.mjs";
const hash=value=>createHash("sha256").update(JSON.stringify(value,(_,v)=>typeof v==="bigint"?v.toString():v)).digest("hex");
const inventoryRoles=["OWNER","MANAGER","INVENTORY"];
function parseLine(input){
 return {productId:textField(input.productId,"Producto"),code:textField(input.code,"Lote"),quantityMilli:decimal(input.quantity,3,"Cantidad"),totalCostCents:decimal(input.cost,2,"Costo total",{allowZero:true}),expiresOn:dateInput(input.expiresOn)};
}
async function createLine(tx,{tenantId,actorId,branchId,supplierId,invoiceRef,requestKey,requestHash,purchaseId=null,line}){
 const {productId,code,quantityMilli,totalCostCents,expiresOn}=line;
 const [branch,supplier,product]=await Promise.all([
  tx.branch.findUnique({where:{tenantId_id:{tenantId,id:branchId}}}),
  tx.supplier.findUnique({where:{tenantId_id:{tenantId,id:supplierId}}}),
  tx.product.findUnique({where:{tenantId_id:{tenantId,id:productId}}})
 ]);
 if(!branch||!supplier||!product?.active)throw new Error("Sucursal, proveedor o producto inválido");
 if(product.unit==="UNIT"&&quantityMilli%1000n!==0n)throw new Error("El producto requiere unidades enteras");
 if(["BUTCHERY","DELI"].includes(product.sector)&&!expiresOn)throw new Error("El producto requiere vencimiento");
 if(expiresOn&&expiresOn.toISOString().slice(0,10)<=localDay())throw new Error("No se permite recibir mercadería vencida");
 const reviewAt=product.freshnessDays!=null?new Date(Date.now()+product.freshnessDays*86400000):null;
 const status=product.sector==="PRODUCE"&&!reviewAt&&!expiresOn?"REVIEW":"AVAILABLE";
 const lot=await tx.lot.create({data:{tenantId,branchId,supplierId,productId,code,quantityMilli,remainingCostCents:totalCostCents,expiresOn,printedExpiresOn:expiresOn,reviewAt,status}});
 const receipt=await tx.receipt.create({data:{tenantId,branchId,supplierId,lotId:lot.id,actorId,requestKey,requestHash,invoiceRef,purchaseId,quantityMilli,totalCostCents}});
 await tx.stockMovement.create({data:{tenantId,lotId:lot.id,actorId,kind:"RECEIPT",deltaMilli:quantityMilli,deltaCostCents:totalCostCents,reason:"Recepción "+receipt.id}});
 return receipt;
}
export async function receiveLot(prisma,session,input){
 const {tenantId,actorUserId:actorId}=session;
 const branchId=textField(input.branchId,"Sucursal"),supplierId=textField(input.supplierId,"Proveedor"),requestKey=textField(input.requestKey,"Operación");
 const invoiceRef=textField(input.invoiceRef??"","Comprobante",100,true)||null,line=parseLine(input);
 const {productId,code,quantityMilli,totalCostCents,expiresOn}=line;
 const requestHash=hash([actorId,branchId,supplierId,productId,code,invoiceRef,quantityMilli.toString(),totalCostCents.toString(),expiresOn?.toISOString()]);
 return serial(prisma,async tx=>{
  await authorizeSale(tx,session,inventoryRoles);
  const old=await tx.receipt.findUnique({where:{tenantId_requestKey:{tenantId,requestKey}}});
  if(old){if(old.requestHash!==requestHash||old.purchaseId)throw new Error("Operación duplicada con datos distintos");return old;}
  if(invoiceRef&&await tx.purchase.findUnique({where:{tenantId_supplierId_invoiceRef:{tenantId,supplierId,invoiceRef}}}))throw new Error("El comprobante ya se registró como compra múltiple");
  return createLine(tx,{tenantId,actorId,branchId,supplierId,invoiceRef,requestKey,requestHash,line});
 });
}
export async function receivePurchase(prisma,s,input){
 const {tenantId,actorUserId:actorId}=s;
 const branchId=textField(input.branchId,"Sucursal"),supplierId=textField(input.supplierId,"Proveedor"),requestKey=textField(input.requestKey,"Operación"),invoiceRef=textField(input.invoiceRef,"Comprobante",100);
 if(!Array.isArray(input.lines)||input.lines.length<1||input.lines.length>50)throw new Error("Se requieren entre 1 y 50 lotes");
 const lines=input.lines.map(parseLine),totalCostCents=checked(lines.reduce((sum,l)=>sum+l.totalCostCents,0n));
 if(decimal(input.total,2,"Total del comprobante",{allowZero:true})!==totalCostCents)throw new Error("El total del comprobante no coincide con la suma");
 const requestHash=hash([actorId,branchId,supplierId,invoiceRef,lines]);
 return serial(prisma,async tx=>{
  await authorizeSale(tx,s,inventoryRoles);
  const old=await tx.purchase.findUnique({where:{tenantId_requestKey:{tenantId,requestKey}},include:{receipts:true}});
  if(old){if(old.requestHash!==requestHash)throw new Error("Operación duplicada con datos distintos");return old;}
  if(await tx.receipt.findFirst({where:{tenantId,supplierId,invoiceRef}}))throw new Error("El comprobante ya tiene recepciones registradas");
  const purchase=await tx.purchase.create({data:{tenantId,branchId,supplierId,actorId,requestKey,requestHash,invoiceRef,totalCostCents}});
  for(const [i,line] of lines.entries()){
   const lineKey=hash(["purchase",requestKey,i]);
   await createLine(tx,{tenantId,actorId,branchId,supplierId,invoiceRef,requestKey:lineKey,requestHash:hash([requestHash,i]),purchaseId:purchase.id,line});
  }
  return tx.purchase.findUniqueOrThrow({where:{tenantId_id:{tenantId,id:purchase.id}},include:{receipts:true}});
 });
}
