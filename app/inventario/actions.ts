"use server";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {lotOperation} from "../../src/server/lot-operations.mjs";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
export async function lotOperationAction(f:FormData){
 const s=await requireSession();let error="";
 try{await lotOperation(db,s,Object.fromEntries(["lotId","requestKey","kind","quantity","reason"].map(k=>[k,typeof f.get(k)==="string"?String(f.get(k)):""])));}
 catch(e){error=e instanceof Error&&!('code' in e)&&e.message.length<180&&!e.message.includes("\n")?e.message:"No se pudo completar la operación";}
 revalidatePath("/inventario");revalidatePath("/pos");revalidatePath("/");redirect("/inventario"+(error?"?error="+encodeURIComponent(error):"?ok=1"));
}
