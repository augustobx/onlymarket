"use server";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {adminOperation} from "../../src/server/admin.mjs";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
export async function adminAction(f:FormData){
 const s=await requireSession();let error="";
 try{await adminOperation(db,s,Object.fromEntries(["kind","name","email","password","role","userId"].map(k=>[k,typeof f.get(k)==="string"?String(f.get(k)):""])));}
 catch(e){error=e instanceof Error&&!('code' in e)&&e.message.length<180&&!e.message.includes("\n")?e.message:"No se pudo completar la operación";}
 revalidatePath("/administracion");redirect("/administracion"+(error?"?error="+encodeURIComponent(error):"?ok=1"));
}
