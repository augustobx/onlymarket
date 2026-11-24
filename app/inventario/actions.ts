"use server";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {receivePurchase} from "../../src/server/receipts.mjs";
import {lotOperation} from "../../src/server/lot-operations.mjs";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
export async function lotOperationAction(f:FormData){
 const s=await requireSession();let error="";
 try{await lotOperation(db,s,Object.fromEntries(["lotId","requestKey","kind","quantity","reason"].map(k=>[k,typeof f.get(k)==="string"?String(f.get(k)):""])));}
 catch(e){error=e instanceof Error&&!('code' in e)&&e.message.length<180&&!e.message.includes("\n")?e.message:"No se pudo completar la operación";}
 revalidatePath("/inventario");revalidatePath("/pos");revalidatePath("/");redirect("/inventario"+(error?"?error="+encodeURIComponent(error):"?ok=1"));
}

export async function purchaseAction(f:FormData){
 const s=await requireSession();let error="";
 const str=(key:string)=>typeof f.get(key)==="string"?String(f.get(key)):"";
 try{
  const raw=str("lines");if(raw.length>40000)throw new Error("Compra demasiado extensa");
  await receivePurchase(db,s,{branchId:str("branchId"),supplierId:str("supplierId"),invoiceRef:str("invoiceRef"),requestKey:str("requestKey"),total:str("total"),lines:JSON.parse(raw)});
 }catch(e){error=e instanceof Error&&!('code' in e)&&e.message.length<180&&!e.message.includes("\n")?e.message:"No se pudo registrar la compra";}
 for(const path of ["/inventario","/pos","/finanzas","/proveedores","/"])revalidatePath(path);
 redirect("/inventario"+(error?"?error="+encodeURIComponent(error):"?ok=1"));
}
