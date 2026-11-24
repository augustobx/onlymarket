"use server";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {actionError} from "../../src/server/errors.mjs";
import {stockControl,setTarget} from "../../src/server/stock-control.mjs";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
const str=(f:FormData,k:string)=>typeof f.get(k)==="string"?String(f.get(k)):"";
async function run(f:FormData,kind:"control"|"target"){
 const s=await requireSession();let error="";
 const opKind=str(f,"kind");
 try{
  if(kind==="control"){
   await stockControl(db,s,Object.fromEntries(["lotId","requestKey","kind","quantity","addedCost","destinationBranchId","snapshot","reason"].map(k=>[k,str(f,k)])));
  }else await setTarget(db,s,Object.fromEntries(["branchId","productId","minimum","target"].map(k=>[k,str(f,k)])));
 }catch(e){error=actionError(e,"No se pudo registrar la operación");}
 for(const p of ["/","/stock","/reposicion","/inventario","/trazabilidad","/pos","/finanzas","/informes","/alertas"])revalidatePath(p);
 const path=kind==="target"?"/reposicion":"/stock";
 const okCode=kind==="target"?"target":opKind==="TRANSFER"?"transfer":"count";
 redirect(path+"?"+(error?"error="+encodeURIComponent(error):"ok="+okCode));
}
export async function controlAction(f:FormData){await run(f,"control");}
export async function targetAction(f:FormData){await run(f,"target");}
