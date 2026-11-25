"use server";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {actionError} from "../../src/server/errors.mjs";
import {serial,authorizeSale} from "../../src/server/sales.mjs";
import {redeemPoints} from "../../src/server/loyalty.mjs";
import {textField} from "../../src/domain/parse.mjs";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
export async function customerAction(f:FormData){
 const s=await requireSession();let error="";
 const isToggle=Boolean(String(f.get("id")??""));
 try{await serial(db,async (tx:import("@prisma/client").Prisma.TransactionClient)=>{
  await authorizeSale(tx,s,["OWNER","MANAGER"]);
  const id=String(f.get("id")??"");
  if(id){
   const data:{active?:boolean;name?:string}={};
   if(f.has("active"))data.active=f.get("active")==="yes";
   if(f.has("name"))data.name=textField(String(f.get("name")??""),"Nombre",120);
   if(!Object.keys(data).length)throw new Error("Sin cambios");
   await tx.customer.update({where:{tenantId_id:{tenantId:s.tenantId,id}},data});
   return;
  }
  const code=textField(String(f.get("code")??""),"Código",64),name=textField(String(f.get("name")??""),"Nombre",120);
  await tx.customer.create({data:{tenantId:s.tenantId,code,name}});
 });}catch(e){error=actionError(e,"No se pudo registrar el cliente","Ya existe un cliente con ese código de socio");}
 revalidatePath("/clientes");revalidatePath("/pos");
 redirect("/clientes?"+(error?"error="+encodeURIComponent(error):"ok="+(isToggle?"customer_updated":"customer_created")));
}

export async function redeemAction(f:FormData){
 const s=await requireSession();let error="";
 const str=(k:string)=>typeof f.get(k)==="string"?String(f.get(k)):"";
 try{
  await redeemPoints(db,s,{
   customerId:str("customerId"),
   points:str("points"),
   reason:str("reason"),
   requestKey:str("requestKey"),
  });
 }catch(e){
  error=actionError(e,"No se pudo registrar el canje");
 }
 revalidatePath("/clientes");revalidatePath("/pos");
 redirect("/clientes?"+(error?"error="+encodeURIComponent(error):"ok=points_redeemed"));
}
