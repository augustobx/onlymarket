"use server";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {serial,authorizeSale} from "../../src/server/sales.mjs";
import {textField} from "../../src/domain/parse.mjs";
import {redirect} from "next/navigation";
export async function customerAction(f:FormData){
 const s=await requireSession();let error="";
 try{await serial(db,async (tx:import("@prisma/client").Prisma.TransactionClient)=>{
 await authorizeSale(tx,s,["OWNER","MANAGER"]);
 const id=String(f.get("id")??"");if(id){await tx.customer.update({where:{tenantId_id:{tenantId:s.tenantId,id}},data:{active:f.get("active")==="yes"}});return;}
 const code=textField(String(f.get("code")??""),"Código",64),name=textField(String(f.get("name")??""),"Nombre",120);
 await tx.customer.create({data:{tenantId:s.tenantId,code,name}});
 });}catch(e){error=e instanceof Error&&!('code' in e)?e.message:"No se pudo registrar el cliente";}
 redirect("/clientes?"+(error?"error="+encodeURIComponent(error):"ok=1"));
}
