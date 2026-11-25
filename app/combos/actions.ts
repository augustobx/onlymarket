"use server";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {actionError} from "../../src/server/errors.mjs";
import {serial,authorizeSale} from "../../src/server/sales.mjs";
import {textField,decimal,dateInput} from "../../src/domain/parse.mjs";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
export async function comboAction(f:FormData){
 const s=await requireSession();let error="";
 const isToggle=Boolean(String(f.get("id")??""));
 const enable=isToggle&&String(f.get("active")??"")==="yes";
 try{await serial(db,async (tx:import("@prisma/client").Prisma.TransactionClient)=>{
  await authorizeSale(tx,s,["OWNER","MANAGER"]);
  const id=String(f.get("id")??"");if(id){await tx.combo.update({where:{tenantId_id:{tenantId:s.tenantId,id}},data:{active:enable}});return;}
  const name=textField(String(f.get("name")??""),"Nombre",120),priceCents=decimal(String(f.get("price")??""),2,"Precio",{allowZero:true});
  const startsOn=dateInput(String(f.get("start")??"")),endsOn=dateInput(String(f.get("end")??""));
  if(!startsOn||!endsOn||startsOn>endsOn)throw new Error("Fechas inválidas");
  const items=[];for(let i=0;i<8;i++){const productId=String(f.get("product"+i)??"");if(!productId)continue;const raw=String(f.get("units"+i)??"");const units=Number(raw);if(!/^\d{1,2}$/.test(raw)||units<1||units>99)throw new Error("Unidades inválidas");items.push({productId,units});}
  if(items.length<2||new Set(items.map(x=>x.productId)).size!==items.length)throw new Error("Seleccioná al menos dos productos diferentes");
  if(await tx.product.count({where:{tenantId:s.tenantId,id:{in:items.map(x=>x.productId)},unit:"UNIT",active:true}})!==items.length)throw new Error("Productos inválidos");
  await tx.combo.create({data:{tenantId:s.tenantId,name,priceCents,startsOn,endsOn,items}});
 });}catch(e){error=actionError(e,"No se pudo guardar el combo");}
 revalidatePath("/combos");revalidatePath("/pos");
 redirect("/combos?"+(error?"error="+encodeURIComponent(error):"ok="+(isToggle?(enable?"combo_enabled":"combo_disabled"):"combo_created")));
}
