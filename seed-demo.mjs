// Explicit, one-shot demo provisioning. Run from /app or repository root.
import {PrismaClient} from "@prisma/client";
import {randomBytes,randomUUID} from "node:crypto";
import {hashPassword} from "./src/server/password.mjs";
import {checkSlugAvailability} from "./src/server/slug-availability.mjs";
import {buildTenantUrl} from "./src/domain/domains.mjs";
import {licenseActive} from "./src/domain/settings.mjs";
import {receivePurchase,receiveLot} from "./src/server/receipts.mjs";
import {openShift,closeShift,recordSale,recordCashMovement,expectedCash,cancelSale} from "./src/server/sales.mjs";
import {recordReturn} from "./src/server/returns.mjs";
import {stockControl,stockSnapshot,setTarget} from "./src/server/stock-control.mjs";
import {lotOperation} from "./src/server/lot-operations.mjs";
import {transformLot} from "./src/server/transform.mjs";
import {recordFinance} from "./src/server/finance.mjs";
import {localDay} from "./src/domain/parse.mjs";
import {eligiblePromotions,quotePromotion} from "./src/domain/sales.mjs";
import {basketQuote} from "./src/domain/combos.mjs";
import {returnQuote,refundAllocation} from "./src/domain/returns.mjs";
import assert from "node:assert/strict";

const db=new PrismaClient();
const slug=process.env.DEMO_SLUG?.trim();
const existingMode=process.env.DEMO_MODE==="existing";
const today=localDay();
const day=(offset)=>new Date(Date.parse(today+"T00:00:00Z")+offset*86400000).toISOString().slice(0,10);
const date=(offset)=>new Date(day(offset)+"T00:00:00Z");
const at=(offset,h,m=0)=>new Date(day(offset)+"T"+String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":00-03:00");
const cents=n=>BigInt(n)*100n;
const str=(n,scale=2)=>{const v=n.toString().padStart(scale+1,"0");return v.slice(0,-scale)+"."+v.slice(-scale)};
const key=()=>randomUUID();
const ean=i=>{const digits=(existingMode?"7799010":"7799000")+String(i).padStart(5,"0");return digits+((10-[...digits].reduce((a,v,j)=>a+Number(v)*(j%2?3:1),0)%10)%10)};
const dataset=[
 // SKU, description, sector, unit, sale ARS, cost ARS, supplier group, quantity central
 ["YER","Yerba mate 1 kg","GROCERY","UNIT",4800,3300,0,180],
 ["LEC","Leche entera 1 L","GROCERY","UNIT",1850,1300,1,180],
 ["ARR","Arroz largo fino 1 kg","GROCERY","UNIT",2400,1650,0,180],
 ["FIDE","Fideos tirabuzón 500 g","GROCERY","UNIT",1650,1100,0,180],
 ["ACE","Aceite girasol 900 ml","GROCERY","UNIT",4200,3100,0,160],
 ["AZU","Azúcar 1 kg","GROCERY","UNIT",1600,1080,0,120],
 ["HAR","Harina 000 1 kg","GROCERY","UNIT",1300,850,0,120],
 ["GAL","Galletitas chocolate 150 g","GROCERY","UNIT",1900,1250,0,180],
 ["SAL","Salsa de tomate 340 g","GROCERY","UNIT",1750,1100,0,140],
 ["CAF","Café molido 250 g","GROCERY","UNIT",9800,6900,0,70],
 ["TE","Té negro 25 saquitos","GROCERY","UNIT",2250,1500,0,65],
 ["COL","Gaseosa cola 2,25 L","GROCERY","UNIT",3900,2600,2,180],
 ["AGU","Agua mineral 1,5 L","GROCERY","UNIT",1250,780,2,180],
 ["JUG","Jugo naranja 1 L","GROCERY","UNIT",2450,1550,2,95],
 ["CER","Cerveza sin alcohol 473 ml","GROCERY","UNIT",2200,1400,2,90],
 ["YOG","Yogur vainilla 190 g","GROCERY","UNIT",1450,900,1,80],
 ["MANT","Manteca 200 g","GROCERY","UNIT",4200,3050,1,65],
 ["HUE","Huevos docena","GROCERY","UNIT",5300,3850,0,80],
 ["JAB","Jabón líquido 800 ml","OTHER","UNIT",3900,2400,5,45],
 ["DET","Detergente 750 ml","OTHER","UNIT",2800,1700,5,35],
 ["PAP","Papel higiénico x4","OTHER","UNIT",5200,3500,5,4],
 ["LAV","Lavandina 1 L","OTHER","UNIT",1750,950,5,0],
 ["RES","Media res vacuna","BUTCHERY","KG",7200,5900,3,100],
 ["ASA","Asado de tira","BUTCHERY","KG",13500,8900,3,22],
 ["VAC","Vacío","BUTCHERY","KG",15900,10200,3,18],
 ["NAL","Nalga","BUTCHERY","KG",14800,9800,3,20],
 ["PIC","Carne picada","BUTCHERY","KG",9200,6500,3,20],
 ["PALE","Paleta vacuna","BUTCHERY","KG",11900,7800,3,20],
 ["POL","Pollo entero","BUTCHERY","KG",6200,4250,3,28],
 ["QUE","Queso cremoso pieza","DELI","KG",12500,8700,1,12],
 ["QFR","Queso cremoso fraccionado","DELI","KG",13900,9400,1,8],
 ["JAM","Jamón cocido","DELI","KG",15900,10800,1,12],
 ["SALM","Salame milán","DELI","KG",18500,12000,1,9],
 ["MOR","Mortadela","DELI","KG",9800,6500,1,10],
 ["TOM","Tomate redondo","PRODUCE","KG",3100,1850,4,35],
 ["PAT","Papa blanca","PRODUCE","KG",1750,950,4,50],
 ["CEB","Cebolla","PRODUCE","KG",1650,850,4,35],
 ["ZAN","Zanahoria","PRODUCE","KG",2200,1300,4,25],
 ["BAN","Banana","PRODUCE","KG",3800,2400,4,25],
 ["MAN","Manzana roja","PRODUCE","KG",4200,2600,4,25],
 ["LECH","Lechuga mantecosa","PRODUCE","KG",3400,1800,4,10],
 ["NAR","Naranja de jugo","PRODUCE","KG",2400,1400,4,25],
 ["PAN","Pan francés","OTHER","KG",3600,2100,0,25],
 ["DES","Producto discontinuado demo","OTHER","UNIT",1000,500,5,0]
];
const supplierNames=["Distribuidora Pampeana DEMO","Lácteos del Valle DEMO","Bebidas del Paraná DEMO","Frigorífico Los Álamos DEMO","Mercado de Frutas DEMO","Higiene y Hogar DEMO"];
let tenantId,stage="prevalidación";
try{
 if(existingMode){
  if(process.env.DEMO_CONFIRM!=="CARGAR_SUPER_DEMO"||!slug||!(slug==="superprueba"||(/^demo-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug.length<=63)))throw new Error("Modo existente: confirmar CARGAR_SUPER_DEMO y slug superprueba o demo-*");
 }else if(process.env.DEMO_CONFIRM!=="CREAR_DEMO"||!slug||!/^demo-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>63)throw new Error("Se requiere DEMO_CONFIRM=CREAR_DEMO y DEMO_SLUG=demo-...");
 const availability=existingMode?{available:true,url:buildTenantUrl(slug)}:await checkSlugAvailability(db,slug);
 if(!availability.available)throw new Error(availability.reason);
 const accounts=[[existingMode?"operador":"owner",existingMode?"MANAGER":"OWNER"],["encargado","MANAGER"],["caja1","CASHIER"],["caja2","CASHIER"],["deposito","INVENTORY"]].map(([name,role])=>({role,email:(existingMode?"seed-":"")+name+"@"+slug+".example.invalid",password:randomBytes(18).toString("base64url")}));
 for(const a of accounts)a.hash=await hashPassword(a.password);
 stage="alta de comercio aislado";
 const initial=await db.$transaction(async tx=>{
  const found=await tx.tenant.findUnique({where:{slug}});
  if(existingMode){
   if(!found)throw new Error("No existe el comercio solicitado; no se crea otro");
   if(!licenseActive(found,today))throw new Error("Comercio suspendido o licencia vencida");
   if(!["MARKET","SUPERMARKET"].includes(found.profile))throw new Error("El comercio debe tener perfil Mercado o Supermercado");
   if(await tx.product.count({where:{tenantId:found.id,sku:{startsWith:"OMDEMO-"}}})||await tx.branch.count({where:{tenantId:found.id,name:{startsWith:"OMDEMO · "}}}))throw new Error("La seed ya fue iniciada en este comercio; no se duplica");
  }else if(found)throw new Error("El comercio ya existe, no se toca");
  if(await tx.user.count({where:{email:{in:accounts.map(a=>a.email)}}}))throw new Error("Ya existen usuarios con estos correos");
  const tenant=existingMode?found:await tx.tenant.create({data:{name:"Supermercado Horizonte · DEMO",slug,profile:"SUPERMARKET",plan:"PILOT",licenseUntil:date(90),weightPrefix:"20",pointsEveryCents:100000n,memberDiscountBps:300}});
  const users=[];
  for(const a of accounts){const u=await tx.user.create({data:{email:a.email,passwordHash:a.hash}});await tx.membership.create({data:{tenantId:tenant.id,userId:u.id,role:a.role}});users.push(u);}
  const branches=[];for(const name of ["Casa central","Sucursal Barrio Norte"])branches.push(await tx.branch.create({data:{tenantId:tenant.id,name:(existingMode?"OMDEMO · ":"")+name}}));
  const suppliers=[];for(const name of supplierNames)suppliers.push(await tx.supplier.create({data:{tenantId:tenant.id,name}}));
  const products=[];
  for(const [i,[sku,name,sector,unit,price,cost,supplier,quantity]] of dataset.entries()){
   const p=await tx.product.create({data:{tenantId:tenant.id,sku:(existingMode?"OMDEMO-":"")+sku,name:existingMode?name+" · DEMO":name,sector,unit,salePriceCents:cents(price),barcode:unit==="UNIT"?ean(i+1):null,weightCode:unit==="KG"?String((existingMode?90000:0)+i+1).padStart(5,"0"):null,active:sku!=="DES",alertDays:3,freshnessDays:sector==="PRODUCE"?3:null,openedLifeDays:sector==="DELI"?4:sector==="BUTCHERY"?3:null}});
   products.push({...p,sku,cost,supplier,quantity});
  }
  const customers=[];for(const [i,name] of ["Ana Demo","Carlos Demo","Lucía Demo","Martín Demo","Sofía Demo","Diego Demo","Valentina Demo","Pablo Demo","Elena Demo","Familia Demo"].entries())customers.push(await tx.customer.create({data:{tenantId:tenant.id,code:(existingMode?"OMDEMO-":"")+"SOCIO-"+String(i+1).padStart(3,"0"),name}}));
  return {tenant,users,branches,suppliers,products,customers};
 },{isolationLevel:"Serializable",timeout:30000});
 tenantId=initial.tenant.id;const where={tenantId},scope=i=>({tenantId,actorUserId:initial.users[i].id}),owner=scope(0),manager=scope(1),depo=scope(4);
 const {branches,suppliers,products,customers}=initial;
 const branchIds=branches.map(b=>b.id),actorIds=initial.users.map(u=>u.id),productIds=products.map(p=>p.id);
 const P=Object.fromEntries(products.map(p=>[p.sku,p])),lotMap=new Map();
 const L=(b,sku)=>{const l=lotMap.get(b+":"+sku);if(!l)throw Error("Lote demo ausente "+b+":"+sku);return l};
 const lotWhere=id=>({tenantId_id:{tenantId,id}});
 const log=msg=>console.log("[DEMO]",msg);
 stage="recepciones y compras";log(stage);
 for(let b=0;b<2;b++)for(let group=0;group<suppliers.length;group++)for(const dry of [true,false]){
  const selected=products.filter(p=>p.supplier===group&&(p.unit==="UNIT")===dry&&p.quantity>0&&p.active&&!(b===1&&p.sku==="RES"));
  if(!selected.length)continue;
  const lines=selected.map(p=>{const q=b===0?p.quantity:Math.max(1,Math.floor(p.quantity*0.65));return {productId:p.id,code:"D-"+b+"-"+p.sku,quantity:String(q),cost:String(q*p.cost),expiresOn: p.sku==="YOG"?day(2):p.sku==="MANT"?day(3):p.sector==="BUTCHERY"?day(8):p.sector==="DELI"?day(16):p.sector==="PRODUCE"?day(7):day(90)}});
  const total=lines.reduce((a,l)=>a+BigInt(l.cost),0n);
  const purchase=await receivePurchase(db,depo,{branchId:branches[b].id,supplierId:suppliers[group].id,invoiceRef:"DEMO-C-"+b+"-"+group+"-"+(dry?"U":"K"),requestKey:key(),total:String(total),lines});
  // Historic grocery purchases only: backdate the complete document and its associated stock movements.
  const historical=selected.every(p=>p.unit==="UNIT"&&p.sector!=="DELI"&&p.sector!=="BUTCHERY"&&p.sector!=="PRODUCE");
  const stamp=at(-8,8,group);
  if(historical)await db.purchase.update({where:lotWhere(purchase.id),data:{createdAt:stamp}});
  for(const r of purchase.receipts){
   const l=await db.lot.findUniqueOrThrow({where:lotWhere(r.lotId)});
   lotMap.set(b+":"+products.find(x=>x.id===l.productId).sku,l);
   if(historical){await db.receipt.update({where:lotWhere(r.id),data:{createdAt:stamp}});await db.lot.update({where:lotWhere(l.id),data:{receivedAt:stamp}});await db.stockMovement.updateMany({where:{tenantId,lotId:l.id,kind:"RECEIPT"},data:{createdAt:stamp}});}
  }
 }
 // Distinct historical shelf-life scenarios: create a valid receipt, then model time elapsed.
 async function extraLot(sku,code,qty,expiry,oldDays,reviewOffset){
  const p=P[sku],r=await receiveLot(db,depo,{branchId:branches[0].id,supplierId:suppliers[p.supplier].id,productId:p.id,code,quantity:String(qty),cost:String(qty*p.cost),expiresOn:day(12),requestKey:key(),invoiceRef:"DEMO-"+code});
  const stamp=at(oldDays,7);
  await db.$transaction([db.receipt.update({where:lotWhere(r.id),data:{createdAt:stamp}}),db.lot.update({where:lotWhere(r.lotId),data:{receivedAt:stamp,expiresOn:date(expiry),printedExpiresOn:date(expiry),reviewAt:reviewOffset===null?null:at(reviewOffset,7)}}),db.stockMovement.updateMany({where:{tenantId,lotId:r.lotId,kind:"RECEIPT"},data:{createdAt:stamp}})]);
  return r.lotId;
 }
 await extraLot("YOG","DEMO-VENCIDO",9,-1,-7,null);
 await extraLot("LECH","DEMO-FRESCURA",5,2,-4,-1);
 const blocked=await extraLot("POL","DEMO-BLOQUEADO",4,4,-3,null);
 await db.$transaction([db.lot.update({where:lotWhere(blocked),data:{status:"BLOCKED"}}),db.stockMovement.create({data:{tenantId,lotId:blocked,actorId:owner.actorUserId,kind:"ADJUSTMENT",deltaMilli:0n,deltaCostCents:0n,reason:"DEMO · rechazo de control de calidad"}})]);
 stage="objetivos, ofertas y combos";log(stage);
 for(const b of branches)for(const p of products.filter(p=>p.active))await setTarget(db,manager,{branchId:b.id,productId:p.id,minimum:p.unit==="KG"?"8":"12",target:p.unit==="KG"?"30":"60"});
 const promoData=[
  {productId:P.GAL.id,name:"3×2 en galletitas",discountBps:0,buyUnits:3,payUnits:2},
  {productId:P.YER.id,name:"15% en yerba",discountBps:1500},
  {productId:P.PAT.id,name:"10% desde 2 kg de papa",discountBps:1000,minimumMilli:2000n},
  {productId:P.YOG.id,name:"Salida rápida: yogur próximo a vencer",discountBps:2500,expiryWithinDays:3},
  {productId:P.COL.id,name:"Oferta finalizada",discountBps:1000,startsOn:date(-12),endsOn:date(-9)},
  {productId:P.CAF.id,name:"Promoción futura",discountBps:1000,startsOn:date(2),endsOn:date(12)},
  {productId:P.MANT.id,name:"Descuento desactivado",discountBps:1000,active:false}
 ];
 for(const p of promoData)await db.promotion.create({data:{tenantId,startsOn:date(-8),endsOn:date(7),...p}});
 for(const [name,skus,price] of [["Combo pasta y salsa",["FIDE","SAL"],2800],["Combo merienda",["GAL","LEC"],3000]])await db.combo.create({data:{tenantId,name,items:skus.map(sku=>({productId:P[sku].id,units:1})),priceCents:cents(price),startsOn:date(-8),endsOn:date(7)}});
 const promos=(await db.promotion.findMany({where:{tenantId,productId:{in:productIds}}})).map(p=>({...p,startsOn:p.startsOn.toISOString().slice(0,10),endsOn:p.endsOn.toISOString().slice(0,10)}));
 const combos=(await db.combo.findMany({where:{tenantId,active:true,startsOn:{lte:date(0)},endsOn:{gte:date(0)}}})).filter(c=>Array.isArray(c.items)&&c.items.every(i=>productIds.includes(i.productId)));
 // Use exactly the same price engine and sorted lot order as recordSale.
 async function sell(s,shift,b,items,payment,customer,stamp){
  const lines=items.map(([sku,q])=>({lotId:L(b,sku).id,quantity:String(q)})).sort((a,b)=>a.lotId.localeCompare(b.lotId));
  const quoted=basketQuote(lines.map(l=>{
   const lot=[...lotMap.values()].find(v=>v.id===l.lotId),p=products.find(p=>p.id===lot.productId),q=BigInt(Math.round(Number(l.quantity)*1000));
   return {productId:p.id,unit:p.unit,unitPrice:p.salePriceCents,quantity:q,price:quotePromotion(p.salePriceCents,q,p.unit,eligiblePromotions(promos,{...lot,expiresOn:lot.expiresOn?.toISOString().slice(0,10)??null},today))};
  }),combos,customer?initial.tenant.memberDiscountBps:0).reduce((a,r)=>a+r.total,0n);
  const cash=payment==="MIXED"?quoted/2n:quoted;
  const sale=await recordSale(db,s,{shiftId:shift.id,requestKey:key(),lines,quotedTotal:str(quoted),payment,customerId:customer?.id,tendered:payment==="CASH"||payment==="MIXED"?str(cash+100000n):undefined,parts:payment==="MIXED"?{cashCents:str(cash),debitCents:str(quoted-cash)}:undefined});
  if(stamp)await db.$transaction([db.sale.update({where:lotWhere(sale.id),data:{createdAt:stamp}}),db.stockMovement.updateMany({where:{tenantId,saleId:sale.id},data:{createdAt:stamp}})]);
  return sale;
 }
 const close=async(s,sh,diff=0n,stamp)=>{const amount=await expectedCash(db,sh);const closed=await closeShift(db,s,{shiftId:sh.id,counted:str(amount+diff)});if(stamp)await db.cashShift.update({where:lotWhere(closed.id),data:{closedAt:stamp}});return closed};
 stage="ventas históricas y cajas";log(stage);
 // These products were received eight days ago and have no freshness review schedule.
 const baskets=[[["YER",1],["ARR",2]],[["FIDE",1],["SAL",1]],[["GAL",3],["COL",1]],[["ACE",1],["AZU",1],["AGU",2]],[["CAF",1],["TE",1]]];
 const payments=["CASH","DEBIT","CREDIT","TRANSFER","MIXED"];
 for(let offset=-7;offset<0;offset++)for(let b=0;b<2;b++){
  const s=scope(b+2),sh=await openShift(db,s,{branchId:branches[b].id,opening:"30000"});
  await db.cashShift.update({where:lotWhere(sh.id),data:{openedAt:at(offset,8)}});
  for(let i=0;i<5;i++)await sell(s,sh,b,baskets[(i-offset)%5],payments[(i+b)%5],i%2?customers[(i-offset)%customers.length]:null,at(offset,9+i*2,12+b));
  await close(s,sh,offset===-1&&b===1?-150000n:0n,at(offset,20));
 }
 stage="ventas y devoluciones de hoy";log(stage);
 const open=await openShift(db,owner,{branchId:branches[0].id,opening:"50000"});
 const other=await openShift(db,scope(3),{branchId:branches[1].id,opening:"30000"});
 // Leave owner and cashier1 available for interactive use. Today's owner shift remains open.
 for(let i=0;i<10;i++)await sell(owner,open,0,baskets[i%5],payments[i%5],i%2?customers[i%customers.length]:null);
 for(let i=0;i<6;i++)await sell(scope(3),other,1,baskets[i%5],payments[(i+1)%5],customers[i]);
 await sell(owner,open,0,[["ASA",1.25],["TOM",0.75],["PAN",0.5]],"DEBIT",customers[0]);
 await sell(owner,open,0,[["PAT",2.5],["JAM",0.3],["YOG",2]],"TRANSFER",customers[1]);
 await sell(owner,open,0,[["FIDE",1],["SAL",1]],"MIXED",customers[2]);
 const cancel=await sell(owner,open,0,[["AGU",2]],"CASH");
 await cancelSale(db,owner,{saleId:cancel.id,requestKey:key(),disposition:"WASTE",reason:"DEMO · anulación de ticket",confirm:"yes"});
 const partial=await sell(owner,open,0,[["COL",3]],"DEBIT",customers[3]);
 const line=await db.saleLine.findFirstOrThrow({where:{tenantId,saleId:partial.id}});
 const quote=returnQuote(line,{quantityMilli:0n},1000n),allocation=refundAllocation(partial,{},quote.refundCents);
 await recordReturn(db,owner,{saleId:partial.id,saleLineId:line.id,shiftId:open.id,requestKey:key(),quantity:"1",quoted:str(quote.refundCents),parts:Object.fromEntries(Object.entries(allocation).map(([k,v])=>[k,str(v)])),reason:"DEMO · devolución parcial",disposition:"REVIEW",confirm:"yes"});
 await recordCashMovement(db,owner,{shiftId:open.id,requestKey:key(),kind:"IN",amount:"5000",reason:"DEMO · refuerzo de cambio"});
 await recordCashMovement(db,owner,{shiftId:open.id,requestKey:key(),kind:"OUT",amount:"2500",reason:"DEMO · retiro de efectivo"});
 await close(scope(3),other,-100000n);
 stage="desposte, fraccionamiento y controles";log(stage);
 const transform=async(sku,input,outputs)=>transformLot(db,depo,{sourceLotId:L(0,sku).id,branchId:branches[0].id,requestKey:key(),inputMilli:String(input*1000),outputs:outputs.map(([disposition,productId,q,reason])=>({disposition,productId:productId?P[productId].id:null,quantityMilli:String(q*1000),reason}))});
 await transform("RES",100,[["STOCK","ASA",24,"Asado"],["STOCK","VAC",20,"Vacío"],["STOCK","NAL",16,"Nalga"],["STOCK","PALE",15,"Paleta"],["STOCK","PIC",12,"Carne para picar"],["WASTE",null,10,"Hueso y grasa no comercial"],["GIFT",null,3,"Regalo autorizado"]]);
 await lotOperation(db,depo,{lotId:L(0,"QUE").id,requestKey:key(),kind:"OPEN",reason:"DEMO · apertura de pieza"});
 await transform("QUE",6,[["STOCK","QFR",5.8,"Fraccionado para mostrador"],["WASTE",null,0.2,"Recorte"]]);
 await db.transformTemplate.create({data:{tenantId,name:(existingMode?"OMDEMO · ":"")+"Desposte estándar DEMO",lines:[...["ASA","VAC","NAL","PALE","PIC"].map(sku=>({disposition:"STOCK",productId:P[sku].id,reason:P[sku].name})),{disposition:"WASTE",productId:"",reason:"Hueso y grasa"}]}});
 await db.transformTemplate.create({data:{tenantId,name:(existingMode?"OMDEMO · ":"")+"Fraccionamiento de queso DEMO",lines:[{disposition:"STOCK",productId:P.QFR.id,reason:"Porciones"},{disposition:"WASTE",productId:"",reason:"Recortes"}]}});
 await lotOperation(db,depo,{lotId:L(0,"BAN").id,requestKey:key(),kind:"WASTE",quantity:"2.5",reason:"DEMO · deterioro por maduración"});
 await lotOperation(db,depo,{lotId:L(0,"PAN").id,requestKey:key(),kind:"GIFT",quantity:"1",reason:"DEMO · donación de pan apto"});
 async function control(sku,kind,quantity,addedCost){
  const lot=await db.lot.findUniqueOrThrow({where:lotWhere(L(0,sku).id)}),last=await db.stockMovement.findFirst({where:{tenantId,lotId:lot.id},orderBy:[{createdAt:"desc"},{id:"desc"}],select:{id:true}});
  return stockControl(db,manager,{lotId:lot.id,requestKey:key(),kind,quantity,addedCost,destinationBranchId:branches[1].id,reason:"DEMO · "+kind,snapshot:stockSnapshot(lot,last?.id)});
 }
 await control("DET","COUNT","33");
 await control("JAB","COUNT","47","4800");
 await control("HAR","TRANSFER","12");
 stage="finanzas";log(stage);
 for(const [category,description,amount,offset] of [["Alquiler","Alquiler mensual",250000,-6],["Servicios","Energía eléctrica",85000,-4],["Personal","Jornada de reposición",35000,-2],["Mantenimiento","Reparación cámara de frío",65000,0],["Limpieza","Insumos de limpieza",18000,0]])await recordFinance(db,owner,{requestKey:key(),category,description,amount:String(amount),date:day(offset)},"EXPENSE");
 for(let i=0;i<suppliers.length;i++)await recordFinance(db,owner,{requestKey:key(),supplierId:suppliers[i].id,amount:String(45000+10000*i),date:day(-i%3),payment:i%2?"CASH":"TRANSFER",reference:"DEMO-PAGO-"+i},"PAYMENT");
 stage="conciliación final";log(stage);
 const lots=await db.lot.findMany({where:{tenantId,productId:{in:productIds},branchId:{in:branchIds}}});
 const movementSums=await db.stockMovement.groupBy({by:["lotId"],where:{tenantId,lotId:{in:lots.map(l=>l.id)}},_sum:{deltaMilli:true,deltaCostCents:true}});
 const byLot=new Map(movementSums.map(m=>[m.lotId,m._sum]));
 for(const l of lots){assert.equal(byLot.get(l.id)?.deltaMilli??0n,l.quantityMilli,"Stock "+l.code);assert.equal(byLot.get(l.id)?.deltaCostCents??0n,l.remainingCostCents,"Costo "+l.code);}
 const sales=await db.sale.findMany({where:{tenantId,actorId:{in:actorIds}},include:{lines:true}});
 for(const s of sales){assert.equal(s.lines.reduce((a,l)=>a+l.totalCents,0n),s.totalCents);assert.equal(s.lines.reduce((a,l)=>a+l.costCents,0n),s.costCents);assert.equal(s.cashCents+s.debitCents+s.creditCents+s.transferCents,s.totalCents);}
 const closed=await db.cashShift.findMany({where:{tenantId,actorId:{in:actorIds},branchId:{in:branchIds},closedAt:{not:null}}});
 for(const sh of closed)assert.equal(await expectedCash(db,sh),sh.expectedCents);
 assert.equal(await db.transformation.count({where:{tenantId,actorId:{in:actorIds}}}),2);
 assert.equal(await db.saleReturn.count({where:{tenantId,actorId:{in:actorIds}}}),1);
 assert.equal(await db.saleCancellation.count({where:{tenantId,actorId:{in:actorIds}}}),1);
 console.log("\nDEMO CREADA Y CONCILIADA");
 console.log("URL:",availability.url);
 console.log("Comercio:",slug,"· licencia",initial.tenant.licenseUntil?.toISOString().slice(0,10)??"sin fecha asignada");
 if(existingMode)console.log("Configuración y credenciales anteriores conservadas. Nuevas sucursales OMDEMO.");
 console.log("Productos:",products.length,"· sucursales:",branches.length,"· proveedores:",suppliers.length,"· lotes:",lots.length,"· ventas:",sales.length,"· cierres:",closed.length);
 console.log("Credenciales únicas (guardarlas; no se vuelven a mostrar):");
 for(const a of accounts)console.log(a.role+" | "+a.email+" | "+a.password);
 console.log("Usuario "+accounts[0].email+" con caja abierta. Pagos y operaciones ficticios; no se envían a bancos ni ARCA.");
}catch(error){
 console.error("Seed DEMO falló en:",stage,error.message);
 if(tenantId&&existingMode){console.error("Carga parcial posible: solo registros nuevos de la seed; comercio existente NO suspendido. No reintentar automáticamente. Revisar el respaldo y la etapa indicada.");}
 else if(tenantId){try{await db.tenant.update({where:{id:tenantId},data:{suspended:true}});console.error("Solo el nuevo comercio demo quedó suspendido. No se eliminó información. Usar otro slug demo para un nuevo intento.");}catch(e){console.error("No se pudo suspender automáticamente el comercio nuevo:",tenantId,e.message);}}
 process.exitCode=1;
}finally{await db.$disconnect();}
