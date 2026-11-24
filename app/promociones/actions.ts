"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import type {Prisma} from "@prisma/client";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {actionError} from "../../src/server/errors.mjs";
import {decimal,dateInput,textField} from "../../src/domain/parse.mjs";
import {authorizeSale,serial} from "../../src/server/sales.mjs";
const str=(f:FormData,k:string)=>typeof f.get(k)==="string"?String(f.get(k)):"";
async function run(f:FormData,disable=false){
 const s=await requireSession();let error="";
 try{await serial(db,async (tx:Prisma.TransactionClient)=>{
  await authorizeSale(tx,s,["OWNER","MANAGER"]);
  if(disable){const id=textField(str(f,"id"),"Promoción");await tx.promotion.update({where:{tenantId_id:{tenantId:s.tenantId,id}},data:{active:false}});return;}
  const productId=textField(str(f,"productId"),"Producto"),lotId=textField(str(f,"lotId"),"Lote",128,true)||null;
  const name=textField(str(f,"name"),"Nombre"),kind=str(f,"kind")||"PERCENT";
  if(!["PERCENT","QUANTITY","BUNDLE"].includes(kind))throw new Error("Tipo inválido");
  const discount=kind==="BUNDLE"?0n:decimal(str(f,"discount"),2,"Descuento");
  if(discount>=10000n)throw new Error("Descuento debe ser menor al 100%");
  const minimumMilli=kind==="QUANTITY"?decimal(str(f,"minimum"),3,"Cantidad mínima"):null;
  const integer=(v:string)=>/^\d{1,3}$/.test(v)?Number(v):0;
  const buyUnits=kind==="BUNDLE"?integer(str(f,"buyUnits")):null,payUnits=kind==="BUNDLE"?integer(str(f,"payUnits")):null;
  if(kind==="BUNDLE"&&(buyUnits===null||payUnits===null||buyUnits<2||buyUnits>100||payUnits<1||payUnits>=buyUnits))throw new Error("Unidades de la oferta inválidas");
  const startsOn=dateInput(str(f,"startsOn")),endsOn=dateInput(str(f,"endsOn"));
  if(!startsOn||!endsOn||startsOn>endsOn)throw new Error("Fechas inválidas");
  const days=str(f,"expiryDays");if(days&&(!/^\d{1,3}$/.test(days)||Number(days)<1||Number(days)>365))throw new Error("Días inválidos");
  const product=await tx.product.findUnique({where:{tenantId_id:{tenantId:s.tenantId,id:productId}}});if(!product?.active)throw new Error("Producto inválido");
  if(kind==="BUNDLE"&&product.unit!=="UNIT")throw new Error("Las ofertas NxM requieren venta por unidad");
  if(product.unit==="UNIT"&&minimumMilli!==null&&minimumMilli%1000n)throw new Error("Cantidad mínima debe ser entera");
  if(lotId){const lot=await tx.lot.findUnique({where:{tenantId_id:{tenantId:s.tenantId,id:lotId}}});if(!lot||lot.productId!==productId)throw new Error("El lote no corresponde al producto");}
  await tx.promotion.create({data:{tenantId:s.tenantId,productId,lotId,name,discountBps:Number(discount),minimumMilli,buyUnits,payUnits,startsOn,endsOn,expiryWithinDays:days?Number(days):null}});
 });}catch(e){error=actionError(e,"No se pudo guardar");}
 revalidatePath("/pos");revalidatePath("/promociones");
 redirect("/promociones"+(error?"?error="+encodeURIComponent(error):"?ok="+(disable?"promo_disabled":"promo_created")));
}
export async function createPromotion(f:FormData){await run(f);}
export async function disablePromotion(f:FormData){await run(f,true);}
