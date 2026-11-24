import {createHash} from "node:crypto";
import {decimal,textField,dateInput,localDay} from "../domain/parse.mjs";
import {authorizeSale,serial} from "./sales.mjs";
export async function recordFinance(prisma,s,input,kind){
 const requestKey=textField(input.requestKey,"Operación"),amountCents=decimal(input.amount,2,"Importe");
 const occurredOn=dateInput(input.date);
 if(!occurredOn||input.date>localDay())throw new Error("Fecha inválida o futura");
 let values;
 if(kind==="EXPENSE")values={category:textField(input.category,"Categoría",80),description:textField(input.description,"Detalle",300)};
 else if(kind==="PAYMENT"){
  if(!["CASH","DEBIT","CREDIT","TRANSFER"].includes(input.payment))throw new Error("Medio de pago inválido");
  values={supplierId:textField(input.supplierId,"Proveedor"),payment:input.payment,reference:textField(input.reference??"","Referencia",120,true)||null};
 }else throw new Error("Operación inválida");
 const requestHash=createHash("sha256").update(JSON.stringify([kind,s.actorUserId,amountCents.toString(),input.date,values])).digest("hex");
 return serial(prisma,async tx=>{
  await authorizeSale(tx,s,["OWNER","MANAGER"]);
  const tenantId=s.tenantId, model=kind==="EXPENSE"?tx.expense:tx.supplierPayment;
  const old=await model.findUnique({where:{tenantId_requestKey:{tenantId,requestKey}}});
  if(old){if(old.requestHash!==requestHash)throw new Error("Operación duplicada con otros datos");return old;}
  if(kind==="PAYMENT"&&!await tx.supplier.findUnique({where:{tenantId_id:{tenantId,id:values.supplierId}}}))throw new Error("Proveedor inválido");
  return model.create({data:{tenantId,actorId:s.actorUserId,requestKey,requestHash,amountCents,occurredOn,...values}});
 });
}
