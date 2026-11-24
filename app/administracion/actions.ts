"use server";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {actionError} from "../../src/server/errors.mjs";
import {adminOperation} from "../../src/server/admin.mjs";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
export async function adminAction(f:FormData){
 const s=await requireSession();let error="";
 const kind=typeof f.get("kind")==="string"?String(f.get("kind")):"";
 try{await adminOperation(db,s,Object.fromEntries(["kind","name","email","password","role","userId"].map(k=>[k,typeof f.get(k)==="string"?String(f.get(k)):""])));}
 catch(e){error=actionError(e,"No se pudo completar la operación","Ya existe un registro con esos datos");}
 const okCode=kind==="BRANCH"?"branch":kind==="EMPLOYEE"?"employee":kind==="ROLE"?"role":kind==="REVOKE"?"revoke":"1";
 revalidatePath("/administracion");redirect("/administracion"+(error?"?error="+encodeURIComponent(error):"?ok="+okCode));
}
