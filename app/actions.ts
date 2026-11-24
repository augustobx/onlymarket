"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {db} from "../src/server/db";
import {login,logout,requireSession} from "../src/server/auth";
import {decimal,textField,localDay} from "../src/domain/parse.mjs";
import {receiveLot} from "../src/server/receipts.mjs";
import {transformLot} from "../src/server/transform.mjs";
import type {Prisma} from "@prisma/client";

const str=(f:FormData,k:string)=>typeof f.get(k)==="string"?String(f.get(k)):"";
const allowed=["OWNER","MANAGER","INVENTORY"];
function days(v:string,optional=false){if(optional&&!v)return null;if(!/^\d{1,3}$/.test(v)||Number(v)>365||(optional&&Number(v)<1))throw new Error("Días inválidos");return Number(v);}
function knownError(error:unknown){
 if(error instanceof Error&&!('code' in error)&&!error.message.includes("\n")&&error.message.length<=160)return error.message;
 if(error&&typeof error==="object"&&"code" in error&&error.code==="P2002")return "Ya existe un registro con esos datos";
 return "No se pudo completar la operación";
}
async function write(path:string,operation:()=>Promise<unknown>){
 let message="";
 try{await operation();}catch(error){message=knownError(error);}
 revalidatePath(path);
 redirect(path+(message?"?error="+encodeURIComponent(message):"?ok=1"));
}
async function manager(){
 const s=await requireSession();if(!allowed.includes(s.role))redirect("/?error=Sin%20permisos");return s;
}
async function authorize(tx:Prisma.TransactionClient,s:Awaited<ReturnType<typeof manager>>){
 const m=await tx.membership.findUnique({where:{tenantId_userId:{tenantId:s.tenantId,userId:s.actorUserId}},include:{user:true}});
 if(!m?.user.active||!allowed.includes(m.role))throw new Error("Sin permisos");
}
export async function loginAction(f:FormData){
 const ok=await login(str(f,"email"),str(f,"password"),str(f,"slug"));
 redirect(ok?"/":"/login?error=1");
}
export async function logoutAction(){await logout();redirect("/login");}
export async function addProduct(f:FormData){
 const s=await manager();
 await write("/catalogo",async()=>{
  const sku=textField(str(f,"sku"),"SKU",64),name=textField(str(f,"name"),"Nombre");
  const barcode=textField(str(f,"barcode"),"Código de barras",64,true)||null;
  const unit=str(f,"unit"),sector=str(f,"sector");
  if(unit!=="KG"&&unit!=="UNIT")throw new Error("Unidad inválida");
  if(sector!=="BUTCHERY"&&sector!=="DELI"&&sector!=="PRODUCE"&&sector!=="GROCERY"&&sector!=="OTHER")throw new Error("Sector inválido");
  const salePriceCents=decimal(str(f,"price"),2,"Precio",{allowZero:true});
  const alertDays=days(str(f,"alertDays"))!,freshnessDays=days(str(f,"freshnessDays"),true),openedLifeDays=days(str(f,"openedLifeDays"),true);
  await db.$transaction(async tx=>{await authorize(tx,s);await tx.product.create({data:{tenantId:s.tenantId,sku,name,barcode,unit,sector,salePriceCents,alertDays,freshnessDays,openedLifeDays}});},{isolationLevel:"Serializable"});
 });
}
export async function addSupplier(f:FormData){
 const s=await manager();
 await write("/proveedores",async()=>{
 const name=textField(str(f,"name"),"Nombre"),phone=textField(str(f,"phone"),"Teléfono",64,true)||null;
 await db.$transaction(async tx=>{await authorize(tx,s);await tx.supplier.create({data:{tenantId:s.tenantId,name,phone}});},{isolationLevel:"Serializable"});
 });
}
export async function receiveAction(f:FormData){
 const s=await manager();
 await write("/inventario",()=>receiveLot(db,s,Object.fromEntries(["branchId","supplierId","productId","code","requestKey","invoiceRef","quantity","cost","expiresOn"].map(k=>[k,str(f,k)]))));
}
export async function transformAction(f:FormData){
 const s=await manager();
 await write("/transformaciones",async()=>{
  const outputs=[];
  for(let i=0;i<8;i++){
   const q=str(f,"quantity"+i);if(!q.trim())continue;
   outputs.push({quantityMilli:decimal(q,3,"Peso").toString(),productId:str(f,"product"+i),disposition:str(f,"disposition"+i),reason:str(f,"reason"+i)});
  }
  await transformLot(db,s,{branchId:str(f,"branchId"),sourceLotId:str(f,"sourceLotId"),requestKey:str(f,"requestKey"),inputMilli:decimal(str(f,"input"),3,"Peso de entrada").toString(),outputs});
 });
}
export async function reviewAction(f:FormData){
 const s=await manager();
 await write("/inventario",async()=>{
  const reason=textField(str(f,"reason"),"Motivo",300),id=textField(str(f,"lotId"),"Lote"),decision=str(f,"decision");
  if(!["AVAILABLE","BLOCKED","REVIEW"].includes(decision))throw new Error("Decisión inválida");
  await db.$transaction(async tx=>{
   await authorize(tx,s);
   const lot=await tx.lot.findUnique({where:{tenantId_id:{tenantId:s.tenantId,id}},include:{product:true}});
   if(!lot||lot.quantityMilli<=0n)throw new Error("Lote sin stock");
   if(lot.status==="BLOCKED"&&decision!=="BLOCKED")throw new Error("Un lote bloqueado no se puede rehabilitar en esta versión");
   if(decision==="AVAILABLE"){
     if(lot.expiresOn&&lot.expiresOn.toISOString().slice(0,10)<=localDay())throw new Error("Lote vencido");
     if(lot.product.sector==="PRODUCE"&&!lot.expiresOn&&lot.product.freshnessDays==null)throw new Error("Configurar plazo de revisión antes de liberar");
   }
   // A quality review never changes the printed expiry; schedule the next review within 24h.
   await tx.lot.update({where:{tenantId_id:{tenantId:s.tenantId,id}},data:{status:decision as "AVAILABLE"|"BLOCKED"|"REVIEW",reviewAt:decision==="AVAILABLE"?new Date(Date.now()+86400000):lot.reviewAt}});
   await tx.stockMovement.create({data:{tenantId:s.tenantId,lotId:id,actorId:s.actorUserId,kind:"ADJUSTMENT",deltaMilli:0n,deltaCostCents:0n,reason:"Revisión "+decision+": "+reason}});
  },{isolationLevel:"Serializable"});
 });
}

export async function editProduct(f:FormData){
 const s=await manager();
 await write("/catalogo",async()=>{
 const id=textField(str(f,"id"),"Producto"),name=textField(str(f,"name"),"Nombre"),sku=textField(str(f,"sku"),"SKU",64);
 const barcode=textField(str(f,"barcode"),"Código de barras",64,true)||null;
 const price=decimal(str(f,"price"),2,"Precio",{allowZero:true});
 const alertDays=days(str(f,"alertDays"))!,freshnessDays=days(str(f,"freshnessDays"),true),openedLifeDays=days(str(f,"openedLifeDays"),true);
 await db.$transaction(async tx=>{
   await authorize(tx,s);
   const p=await tx.product.findUnique({where:{tenantId_id:{tenantId:s.tenantId,id}}});if(!p)throw new Error("Producto inexistente");
   const old={name:p.name,sku:p.sku,barcode:p.barcode,price:p.salePriceCents.toString(),alertDays:p.alertDays,freshnessDays:p.freshnessDays,openedLifeDays:p.openedLifeDays,active:p.active};
   const active=str(f,"active")==="yes";
   await tx.product.update({where:{tenantId_id:{tenantId:s.tenantId,id}},data:{name,sku,barcode,salePriceCents:price,alertDays,freshnessDays,openedLifeDays,active}});
   await tx.catalogChange.create({data:{tenantId:s.tenantId,productId:id,actorId:s.actorUserId,previous:JSON.stringify(old),next:JSON.stringify({name,sku,barcode,price:price.toString(),alertDays,freshnessDays,openedLifeDays,active})}});
 },{isolationLevel:"Serializable"});
 revalidatePath("/pos");revalidatePath("/inventario");
 });
}
export async function bulkPrice(f:FormData){
 const s=await requireSession();
 await write("/catalogo",async()=>{
 const sector=str(f,"sector"),direction=str(f,"direction"),bps=decimal(str(f,"percent"),2,"Porcentaje");
 if(!["BUTCHERY","DELI","PRODUCE","GROCERY","OTHER"].includes(sector)||!["UP","DOWN"].includes(direction)||bps>=10000n)throw new Error("Porcentaje o sector inválido (menor a 100%)");
 if(str(f,"confirm")!=="yes")throw new Error("Confirmá la actualización masiva");
 await db.$transaction(async tx=>{
 const m=await tx.membership.findUnique({where:{tenantId_userId:{tenantId:s.tenantId,userId:s.actorUserId}},include:{user:true}});
 if(!m?.user.active||!["OWNER","MANAGER"].includes(m.role))throw new Error("Sin permisos");
 const products=await tx.product.findMany({where:{tenantId:s.tenantId,active:true,sector:sector as "BUTCHERY"|"DELI"|"PRODUCE"|"GROCERY"|"OTHER"}});
 if(products.length>500)throw new Error("Máximo 500 productos por actualización");
 const factor=direction==="UP"?10000n+bps:10000n-bps;
 for(const p of products){
 const next=(p.salePriceCents*factor+5000n)/10000n;
 if(next>9223372036854775807n)throw new Error("Precio fuera de rango");
 await tx.product.update({where:{tenantId_id:{tenantId:s.tenantId,id:p.id}},data:{salePriceCents:next}});
 await tx.catalogChange.create({data:{tenantId:s.tenantId,productId:p.id,actorId:s.actorUserId,previous:JSON.stringify({price:p.salePriceCents.toString()}),next:JSON.stringify({price:next.toString(),bulk:true})}});
 }
 },{isolationLevel:"Serializable",timeout:20000});
 revalidatePath("/pos");
 });
}
