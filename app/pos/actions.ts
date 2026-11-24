"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {openShift,closeShift,recordSale,recordCashMovement} from "../../src/server/sales.mjs";
const str=(f:FormData,k:string)=>typeof f.get(k)==="string"?String(f.get(k)):"";
async function operation(fn:()=>Promise<unknown>){
 let error="";
 try{await fn();}catch(e){error=e instanceof Error&&!('code' in e)&&e.message.length<180&&!e.message.includes("\n")?e.message:"No se pudo completar la operación";}
 revalidatePath("/pos");revalidatePath("/inventario");revalidatePath("/");
 redirect("/pos"+(error?"?error="+encodeURIComponent(error):"?ok=1"));
}
export async function openAction(f:FormData){const s=await requireSession();await operation(()=>openShift(db,s,{branchId:str(f,"branchId"),opening:str(f,"opening")}));}
export async function closeAction(f:FormData){const s=await requireSession();await operation(()=>closeShift(db,s,{shiftId:str(f,"shiftId"),counted:str(f,"counted")}));}
export async function saleAction(f:FormData){
 const s=await requireSession();await operation(async()=>{
  const raw=str(f,"lines");if(raw.length>25000)throw new Error("Venta demasiado extensa");
  let lines;try{lines=JSON.parse(raw);}catch{throw new Error("Artículos inválidos");}
  await recordSale(db,s,{shiftId:str(f,"shiftId"),requestKey:str(f,"requestKey"),payment:str(f,"payment"),quotedTotal:str(f,"quotedTotal"),tendered:str(f,"tendered"),lines});
 });
}

export async function cashMovementAction(f:FormData){const s=await requireSession();await operation(()=>recordCashMovement(db,s,Object.fromEntries(["shiftId","requestKey","kind","amount","reason"].map(k=>[k,str(f,k)]))));}
