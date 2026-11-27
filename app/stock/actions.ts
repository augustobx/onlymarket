"use server";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {actionError} from "../../src/server/errors.mjs";
import {stockControl,setTarget} from "../../src/server/stock-control.mjs";
import {reviewLot} from "../../src/server/lot-review.mjs";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
const str=(f:FormData,k:string)=>typeof f.get(k)==="string"?String(f.get(k)):"";
const paths=["/","/stock","/reposicion","/inventario","/trazabilidad","/pos","/finanzas","/informes","/alertas"];
async function run(f:FormData,kind:"control"|"target"){
 const s=await requireSession();let error="";
 const opKind=str(f,"kind");
 try{
  if(kind==="control"){
   const res=await stockControl(db,s,Object.fromEntries(["lotId","requestKey","kind","quantity","addedCost","destinationBranchId","snapshot","reason"].map(k=>[k,str(f,k)])));
   if(opKind==="TRANSFER"&&str(f,"approveDestination")==="yes"&&"destinationLotId" in res&&res.destinationLotId){
    await reviewLot(db,s,{lotId:res.destinationLotId,decision:"AVAILABLE",reason:"Habilitado directo al trasladar"});
   }
  }else await setTarget(db,s,Object.fromEntries(["branchId","productId","minimum","target"].map(k=>[k,str(f,k)])));
 }catch(e){error=actionError(e,"No se pudo registrar la operación");}
 for(const p of paths)revalidatePath(p);
 const path=kind==="target"?"/reposicion":"/stock";
 const okCode=kind==="target"?"target":opKind==="TRANSFER"?"transfer":"count";
 redirect(path+"?"+(error?"error="+encodeURIComponent(error):"ok="+okCode));
}
export async function controlAction(f:FormData){await run(f,"control");}
export async function targetAction(f:FormData){await run(f,"target");}
export async function approveStockLotAction(f:FormData){
 const s=await requireSession();let error="";
 try{
  await reviewLot(db,s,{lotId:str(f,"lotId"),decision:"AVAILABLE",reason:str(f,"reason")||"Habilitado desde Conteos y traslados"});
 }catch(e){error=actionError(e,"No se pudo habilitar el lote");}
 for(const p of paths)revalidatePath(p);
 redirect("/stock?"+(error?"error="+encodeURIComponent(error):"ok=review"));
}
