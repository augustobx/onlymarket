"use server";
import {db} from "../../../src/server/db";
import {requireSession} from "../../../src/server/auth";
import {parseCatalogCsv} from "../../../src/domain/catalog-import.mjs";
import {serial,authorizeSale} from "../../../src/server/sales.mjs";
import type {Prisma} from "@prisma/client";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
export async function importCatalog(f:FormData){
 const s=await requireSession();let error="",count=0;
 try{
  if(f.get("confirm")!=="yes")throw new Error("Confirmá el alta de productos");
  const raw=f.get("csv");if(typeof raw!=="string")throw new Error("CSV inválido");
  const items=parseCatalogCsv(raw);
  count=await serial(db,async (tx:Prisma.TransactionClient)=>{
   await authorizeSale(tx,s,["OWNER","MANAGER"]);
   const result=await tx.product.createMany({data:items.map((p:Omit<Prisma.ProductCreateManyInput,"tenantId">)=>({...p,tenantId:s.tenantId}))});
   return result.count;
  });
 }catch(e){error=e&&typeof e==="object"&&"code" in e&&e.code==="P2002"?"Ya existe un SKU o código de barras. No se importó ningún producto.":e instanceof Error&&!('code' in e)&&e.message.length<220&&!e.message.includes("\n")?e.message:"No se pudo importar el catálogo";}
 revalidatePath("/catalogo");redirect("/catalogo/importar"+(error?"?error="+encodeURIComponent(error):"?count="+count));
}
