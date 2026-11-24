"use server";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {actionError} from "../../src/server/errors.mjs";
import {recordFinance} from "../../src/server/finance.mjs";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
async function run(f:FormData,kind:string){
 const s=await requireSession();let error="";
 try{await recordFinance(db,s,Object.fromEntries(["requestKey","amount","date","category","description","supplierId","payment","reference"].map(k=>[k,typeof f.get(k)==="string"?String(f.get(k)):""])),kind);}
 catch(e){error=actionError(e,"No se pudo registrar");}
 revalidatePath("/finanzas");revalidatePath("/");
 redirect("/finanzas"+(error?"?error="+encodeURIComponent(error):"?ok="+(kind==="EXPENSE"?"expense":"payment")));
}
export async function expenseAction(f:FormData){await run(f,"EXPENSE");}
export async function paymentAction(f:FormData){await run(f,"PAYMENT");}
