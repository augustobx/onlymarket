"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {actionError} from "../../src/server/errors.mjs";
import {openShift,closeShift,recordSale,recordCashMovement} from "../../src/server/sales.mjs";
const str=(f:FormData,k:string)=>typeof f.get(k)==="string"?String(f.get(k)):"";
async function operation(okCode:string,fn:()=>Promise<unknown>){
 let error="";
 try{await fn();}catch(e){error=actionError(e,"No se pudo completar la operación");}
 revalidatePath("/pos");revalidatePath("/inventario");revalidatePath("/ventas");revalidatePath("/");
 redirect("/pos"+(error?"?error="+encodeURIComponent(error):"?ok="+okCode));
}
export async function openAction(f:FormData){const s=await requireSession();await operation("open",()=>openShift(db,s,{branchId:str(f,"branchId"),opening:str(f,"opening")}));}
export async function closeAction(f:FormData){const s=await requireSession();await operation("close",()=>closeShift(db,s,{shiftId:str(f,"shiftId"),counted:str(f,"counted")}));}
export async function saleAction(f:FormData){
 const s=await requireSession();await operation("sale",async()=>{
  const raw=str(f,"lines");if(raw.length>25000)throw new Error("Venta demasiado extensa");
  let lines;try{lines=JSON.parse(raw);}catch{throw new Error("Artículos inválidos");}
  await recordSale(db,s,{shiftId:str(f,"shiftId"),requestKey:str(f,"requestKey"),customerId:str(f,"customerId"),payment:str(f,"payment"),quotedTotal:str(f,"quotedTotal"),tendered:str(f,"tendered"),parts:Object.fromEntries(["cashCents","debitCents","creditCents","transferCents"].map(k=>[k,str(f,k)])),lines});
 });
}
export async function cashMovementAction(f:FormData){
 const s=await requireSession();
 const kind=str(f,"kind");
 await operation(kind==="IN"?"cash_in":"cash_out",()=>recordCashMovement(db,s,Object.fromEntries(["shiftId","requestKey","kind","amount","reason"].map(k=>[k,str(f,k)]))));
}
