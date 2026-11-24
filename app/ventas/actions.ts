"use server";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {actionError} from "../../src/server/errors.mjs";
import {cancelSale} from "../../src/server/sales.mjs";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
export async function cancelAction(f:FormData){
 const s=await requireSession();let error="";
 try{await cancelSale(db,s,Object.fromEntries(["saleId","requestKey","reason","disposition","confirm"].map(k=>[k,typeof f.get(k)==="string"?String(f.get(k)):""])));}
 catch(e){error=actionError(e,"No se pudo anular la venta");}
 for(const path of ["/ventas","/pos","/inventario","/finanzas","/informes","/"])revalidatePath(path);
 redirect("/ventas"+(error?"?error="+encodeURIComponent(error):"?ok=cancel"));
}
