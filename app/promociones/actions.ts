"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {decimal,dateInput,textField} from "../../src/domain/parse.mjs";
import {authorizeSale,serial} from "../../src/server/sales.mjs";
const str=(f:FormData,k:string)=>typeof f.get(k)==="string"?String(f.get(k)):"";
async function run(f:FormData,disable=false){
 const s=await requireSession();let error="";
 try{await serial(db,async tx=>{
  await authorizeSale(tx,s,["OWNER","MANAGER"]);
  if(disable){const id=textField(str(f,"id"),"Promoción");await tx.promotion.update({where:{tenantId_id:{tenantId:s.tenantId,id}},data:{active:false}});return;}
  const productId=textField(str(f,"productId"),"Producto"),lotId=textField(str(f,"lotId"),"Lote",128,true)||null;
  const name=textField(str(f,"name"),"Nombre"),discount=decimal(str(f,"discount"),2,"Descuento");
  if(discount>=10000n)throw new Error("Descuento debe ser menor al 100%");
  const startsOn=dateInput(str(f,"startsOn")),endsOn=dateInput(str(f,"endsOn"));
  if(!startsOn||!endsOn||startsOn>endsOn)throw new Error("Fechas inválidas");
  const days=str(f,"expiryDays");if(days&&(!/^\d{1,3}$/.test(days)||Number(days)<1||Number(days)>365))throw new Error("Días inválidos");
  const product=await tx.product.findUnique({where:{tenantId_id:{tenantId:s.tenantId,id:productId}}});if(!product?.active)throw new Error("Producto inválido");
  if(lotId){const lot=await tx.lot.findUnique({where:{tenantId_id:{tenantId:s.tenantId,id:lotId}}});if(!lot||lot.productId!==productId)throw new Error("El lote no corresponde al producto");}
  await tx.promotion.create({data:{tenantId:s.tenantId,productId,lotId,name,discountBps:Number(discount),startsOn,endsOn,expiryWithinDays:days?Number(days):null}});
 });}catch(e){error=e instanceof Error&&!('code' in e)&&e.message.length<180&&!e.message.includes("\n")?e.message:"No se pudo guardar";}
 revalidatePath("/pos");revalidatePath("/promociones");redirect("/promociones"+(error?"?error="+encodeURIComponent(error):"?ok=1"));
}
export async function createPromotion(f:FormData){await run(f);}
export async function disablePromotion(f:FormData){await run(f,true);}
