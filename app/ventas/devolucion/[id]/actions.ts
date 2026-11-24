"use server";
import {db} from "../../../../src/server/db";
import {requireSession} from "../../../../src/server/auth";
import {recordReturn} from "../../../../src/server/returns.mjs";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
export async function returnAction(f:FormData){
 const s=await requireSession(),str=(k:string)=>typeof f.get(k)==="string"?String(f.get(k)):"";
 const saleId=str("saleId");let error="";
 try{await recordReturn(db,s,{...Object.fromEntries(["saleId","saleLineId","shiftId","requestKey","reason","disposition","quantity","quoted","confirm"].map(k=>[k,str(k)])),parts:Object.fromEntries(["cashCents","debitCents","creditCents","transferCents"].map(k=>[k,str(k)]))});}
 catch(e){error=e instanceof Error&&!('code' in e)&&e.message.length<180&&!e.message.includes("\n")?e.message:"No se pudo registrar la devolución";}
 for(const p of ["/ventas","/pos","/inventario","/trazabilidad","/finanzas","/informes","/alertas","/"])revalidatePath(p);
 redirect("/ventas/devolucion/"+encodeURIComponent(saleId)+(error?"?error="+encodeURIComponent(error):"?ok=1"));
}
