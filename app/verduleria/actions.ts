"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {actionError} from "../../src/server/errors.mjs";
import {reviewLot} from "../../src/server/lot-review.mjs";
import {lotOperation} from "../../src/server/lot-operations.mjs";

const str=(f:FormData,k:string)=>typeof f.get(k)==="string"?String(f.get(k)):"";

export async function reviewProduceAction(f:FormData){
 const s=await requireSession();
 let error="";
 try{
  await reviewLot(db,s,{
   lotId:str(f,"lotId"),
   decision:str(f,"decision"),
   reason:str(f,"reason"),
   reviewDays:str(f,"reviewDays")||"1",
   requiredSector:"PRODUCE",
  });
 }catch(e){
  error=actionError(e,"No se pudo registrar el control de frescura");
 }
 for(const p of ["/verduleria","/inventario","/alertas","/pos","/catalogo"])revalidatePath(p);
 redirect("/verduleria"+(error?"?error="+encodeURIComponent(error):"?ok=produce_review"));
}

export async function wasteProduceAction(f:FormData){
 const s=await requireSession();
 let error="";
 const kind=str(f,"kind")==="GIFT"?"GIFT":"WASTE";
 try{
  const lotId=str(f,"lotId");
  const lot=await db.lot.findUnique({where:{tenantId_id:{tenantId:s.tenantId,id:lotId}},include:{product:{select:{sector:true}}}});
  if(!lot||lot.product.sector!=="PRODUCE")throw new Error("El lote no pertenece a verdulería");
  await lotOperation(db,s,{
   lotId,
   requestKey:str(f,"requestKey"),
   kind,
   quantity:str(f,"quantity"),
   reason:str(f,"reason"),
  });
 }catch(e){
  error=actionError(e,"No se pudo registrar el movimiento en verdulería");
 }
 for(const p of ["/verduleria","/inventario","/alertas","/pos","/"])revalidatePath(p);
 redirect("/verduleria"+(error?"?error="+encodeURIComponent(error):"?ok="+(kind==="WASTE"?"produce_waste":"lot_op")));
}
