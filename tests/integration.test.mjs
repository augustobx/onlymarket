import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import {receiveLot,receivePurchase} from "../src/server/receipts.mjs";
import {transformLot} from "../src/server/transform.mjs";
import {openShift,recordSale,closeShift,recordCashMovement,cancelSale} from "../src/server/sales.mjs";
import {lotOperation} from "../src/server/lot-operations.mjs";
import {recordFinance} from "../src/server/finance.mjs";
import {localDay} from "../src/domain/parse.mjs";
import {recordReturn} from "../src/server/returns.mjs";
import {stockSnapshot,stockControl,setTarget} from "../src/server/stock-control.mjs";
const key=()=>randomUUID();
test("PostgreSQL: compra, desposte, venta, pérdidas, saldo, concurrencia y aislamiento",{skip:process.env.RUN_DB_TESTS!=="1"},async()=>{
 const db=new PrismaClient();
 try{
  // A fresh disposable CI database is mandatory. No deletes against existing records.
  const makeTenant=async()=>{
   const tenant=await db.tenant.create({data:{name:"Integration "+key(),slug:key()}});
   const user=await db.user.create({data:{email:key()+"@example.invalid",passwordHash:"not-a-login"}});
   await db.membership.create({data:{tenantId:tenant.id,userId:user.id,role:"OWNER"}});
   const branch=await db.branch.create({data:{tenantId:tenant.id,name:"Central"}});
   return {tenantId:tenant.id,actorUserId:user.id,branchId:branch.id};
  };
  const s=await makeTenant(),other=await makeTenant(),tenantId=s.tenantId;
  const product=async(name,price)=>db.product.create({data:{tenantId,sku:key(),name,unit:"KG",sector:"BUTCHERY",salePriceCents:price,openedLifeDays:2}});
  const source=await product("Media res",0n),cut=await product("Corte",120000n);
  const supplier=await db.supplier.create({data:{tenantId,name:"Proveedor"}});
  const future=new Date(Date.now()+10*86400000),expiresOn=localDay(future);
  const receive={branchId:s.branchId,productId:source.id,supplierId:supplier.id,code:key(),requestKey:key(),quantity:"10",cost:"10000",expiresOn,invoiceRef:"Test"};
  const multi={branchId:s.branchId,supplierId:supplier.id,invoiceRef:"Multi",requestKey:key(),total:"30",lines:[{productId:cut.id,code:key(),quantity:"1",cost:"10",expiresOn},{productId:source.id,code:key(),quantity:"2",cost:"20",expiresOn}]};
  const purchase=await receivePurchase(db,s,multi);
  assert.equal(purchase.receipts.length,2);assert.equal((await receivePurchase(db,s,multi)).id,purchase.id);
  const before=await db.lot.count({where:{tenantId}});
  await assert.rejects(receivePurchase(db,s,{...multi,requestKey:key(),invoiceRef:"Invalid",lines:[{...multi.lines[0],code:key()},{...multi.lines[1],productId:key()}]}));
  assert.equal(await db.lot.count({where:{tenantId}}),before);
  await assert.rejects(receivePurchase(db,s,{...multi,requestKey:key()}));
  // Physical count and inter-branch transfer: preserve stock ledger and costs.
  const countedLotId=purchase.receipts[0].lotId;
  const readSnapshot=async id=>{
   const l=await db.lot.findUniqueOrThrow({where:{tenantId_id:{tenantId,id}}});
   const m=await db.stockMovement.findFirst({where:{tenantId,lotId:id},orderBy:[{createdAt:"desc"},{id:"desc"}]});
   return {l,snapshot:stockSnapshot(l,m?.id)};
  };
  const initial=await readSnapshot(countedLotId);
  const countInput={lotId:countedLotId,requestKey:key(),kind:"COUNT",quantity:"0.8",addedCost:"",snapshot:initial.snapshot,reason:"Faltante físico"};
  await assert.rejects(stockControl(db,other,countInput));
  const count=await stockControl(db,s,countInput);
  assert.equal(count.costCents,200n);
  assert.equal((await stockControl(db,s,countInput)).id,count.id);
  await assert.rejects(stockControl(db,s,{...countInput,requestKey:key()}),/cambió/);
  const current=await readSnapshot(countedLotId);
  const dest=await db.branch.create({data:{tenantId,name:"Sucursal 2"}});
  const move={lotId:countedLotId,requestKey:key(),kind:"TRANSFER",quantity:"0.3",destinationBranchId:dest.id,snapshot:current.snapshot,reason:"Remito interno"};
  await assert.rejects(stockControl(db,s,{...move,destinationBranchId:other.branchId}));
  await assert.rejects(stockControl(db,s,{...move,quantity:"0.9"}));
  const transfer=await stockControl(db,s,move);
  assert.equal((await stockControl(db,s,move)).id,transfer.id);
  const child=await readSnapshot(transfer.destinationLotId),origin=await readSnapshot(countedLotId);
  assert.equal(child.l.status,"REVIEW");
  assert.equal(child.l.supplierId,origin.l.supplierId);
  assert.equal(+child.l.expiresOn,+origin.l.expiresOn);
  assert.equal(+child.l.receivedAt,+origin.l.receivedAt);
  assert.equal(child.l.quantityMilli+origin.l.quantityMilli,800n);
  assert.equal(child.l.remainingCostCents+origin.l.remainingCostCents,800n);
  await assert.rejects(stockControl(db,s,{...countInput,lotId:child.l.id,requestKey:key(),quantity:"0.4",snapshot:child.snapshot}));
  const gain=await stockControl(db,s,{...countInput,lotId:child.l.id,requestKey:key(),quantity:"0.4",addedCost:"1",snapshot:child.snapshot});
  assert.equal(gain.costCents,100n);
  const updatedChild=await readSnapshot(child.l.id);
  assert.equal(updatedChild.l.quantityMilli,400n);
  assert.equal(updatedChild.l.remainingCostCents,400n);
  for(const id of [countedLotId,child.l.id]){
   const {l}=await readSnapshot(id);
   const ledger=await db.stockMovement.findMany({where:{tenantId,lotId:id}});
   assert.equal(ledger.reduce((a,m)=>a+m.deltaMilli,0n),l.quantityMilli);
   assert.equal(ledger.reduce((a,m)=>a+m.deltaCostCents,0n),l.remainingCostCents);
  }
  const target=await setTarget(db,s,{branchId:dest.id,productId:cut.id,minimum:"1",target:"2"});
  assert.equal(target.targetMilli,2000n);
  await assert.rejects(setTarget(db,s,{branchId:other.branchId,productId:cut.id,minimum:"1",target:"2"}));
  await assert.rejects(setTarget(db,s,{branchId:dest.id,productId:cut.id,minimum:"2",target:"1"}));
  const receipt=await receiveLot(db,s,receive);
  assert.equal((await receiveLot(db,s,receive)).id,receipt.id);
  await assert.rejects(receiveLot(db,other,{...receive,requestKey:key(),branchId:other.branchId}));
  const batchInput={branchId:s.branchId,sourceLotId:receipt.lotId,requestKey:key(),inputMilli:"10000",outputs:[
   {productId:cut.id,quantityMilli:"8000",disposition:"STOCK",reason:"Cortes"},
   {quantityMilli:"1000",disposition:"GIFT",reason:"Huesos"},
   {quantityMilli:"1000",disposition:"WASTE",reason:"Merma"}]};
  const batch=await transformLot(db,s,batchInput);
  assert.equal((await transformLot(db,s,batchInput)).id,batch.id);
  const lot=batch.outputs[0];
  assert.equal(lot.remainingCostCents,800000n);
  assert.equal(lot.status,"REVIEW");
  await db.lot.update({where:{tenantId_id:{tenantId,id:lot.id}},data:{status:"AVAILABLE"}});
  const shift=await openShift(db,s,{branchId:s.branchId,opening:"100"});
  await assert.rejects(openShift(db,s,{branchId:s.branchId,opening:"0"}));
  await db.promotion.create({data:{tenantId,productId:cut.id,lotId:lot.id,name:"Promo",discountBps:1000,startsOn:new Date(localDay()+"T00:00:00Z"),endsOn:new Date(expiresOn+"T00:00:00Z")}});
  const saleInput={shiftId:shift.id,requestKey:key(),payment:"CASH",tendered:"3000",quotedTotal:"2160",lines:[{lotId:lot.id,quantity:"2"}]};
  const sale=await recordSale(db,s,saleInput);
  assert.equal(sale.costCents,200000n);
  assert.equal(sale.changeCents,84000n);
  assert.equal((await recordSale(db,s,saleInput)).id,sale.id);
  await assert.rejects(recordSale(db,other,{...saleInput,requestKey:key()}));
  await assert.rejects(recordSale(db,s,{...saleInput,requestKey:key(),quotedTotal:"1"}));
  const competing=()=>recordSale(db,s,{...saleInput,requestKey:key(),payment:"TRANSFER",quotedTotal:"4320",lines:[{lotId:lot.id,quantity:"4"}]});
  const attempts=await Promise.allSettled([competing(),competing()]);
  assert.equal(attempts.filter(x=>x.status==="fulfilled").length,1);
  assert.equal((await db.lot.findUniqueOrThrow({where:{tenantId_id:{tenantId,id:lot.id}}})).quantityMilli,2000n);
  const wasteInput={lotId:lot.id,requestKey:key(),reason:"Merma adicional",kind:"WASTE",quantity:"1"};
  const waste=await lotOperation(db,s,wasteInput);
  assert.equal(waste.costCents,100000n);
  assert.equal((await lotOperation(db,s,wasteInput)).id,waste.id);
  const opening=await lotOperation(db,s,{lotId:lot.id,requestKey:key(),reason:"Apertura",kind:"OPEN"});
  assert.equal(opening.kind,"OPEN");
  const opened=await db.lot.findUniqueOrThrow({where:{tenantId_id:{tenantId,id:lot.id}}});
  assert.ok(opened.openedAt);
  assert.ok(opened.expiresOn<=new Date(expiresOn+"T00:00:00Z"));
  const packaged=await db.product.create({data:{tenantId,sku:key(),name:"Pack",unit:"UNIT",sector:"GROCERY",salePriceCents:10000n}});
  const packagedReceipt=await receiveLot(db,s,{...receive,productId:packaged.id,code:key(),requestKey:key(),invoiceRef:"Pack",quantity:"8",cost:"320",expiresOn});
  const bundle=await db.promotion.create({data:{tenantId,productId:packaged.id,name:"3x2",discountBps:0,buyUnits:3,payUnits:2,startsOn:new Date(localDay()+"T00:00:00Z"),endsOn:new Date(expiresOn+"T00:00:00Z")}});
  await db.promotion.create({data:{tenantId,productId:packaged.id,name:"10%",discountBps:1000,startsOn:new Date(localDay()+"T00:00:00Z"),endsOn:new Date(expiresOn+"T00:00:00Z")}});
  const promoSale=await recordSale(db,s,{shiftId:shift.id,requestKey:key(),payment:"TRANSFER",quotedTotal:"300",lines:[{lotId:packagedReceipt.lotId,quantity:"4"}]});
  assert.equal(promoSale.totalCents,30000n);assert.equal(promoSale.costCents,16000n);
  const promoLine=await db.saleLine.findFirstOrThrow({where:{tenantId,saleId:promoSale.id}});
  assert.equal(promoLine.promotionId,bundle.id);assert.equal(promoLine.promotionLabel,"3x2");assert.equal(promoLine.subtotalCents,40000n);
  const packageLot=await db.lot.findUniqueOrThrow({where:{tenantId_id:{tenantId,id:packagedReceipt.lotId}}});
  assert.equal(packageLot.quantityMilli,4000n);
  const mixedInput={shiftId:shift.id,requestKey:key(),payment:"MIXED",quotedTotal:"180",tendered:"100",parts:{cashCents:"80",debitCents:"100"},lines:[{lotId:packagedReceipt.lotId,quantity:"2"}]};
  const mixed=await recordSale(db,s,mixedInput);
  assert.equal(mixed.cashCents,8000n);assert.equal(mixed.debitCents,10000n);assert.equal(mixed.changeCents,2000n);
  assert.equal((await recordSale(db,s,mixedInput)).id,mixed.id);
  await assert.rejects(recordSale(db,s,{...mixedInput,parts:{cashCents:"70",debitCents:"110"}}));
  await cancelSale(db,s,{saleId:mixed.id,requestKey:key(),reason:"Reintegro mixto",disposition:"WASTE",confirm:"yes"});
  const cashInput={shiftId:shift.id,requestKey:key(),kind:"IN",amount:"500",reason:"Aporte"};
  const income=await recordCashMovement(db,s,cashInput);
  assert.equal((await recordCashMovement(db,s,cashInput)).id,income.id);
  await recordCashMovement(db,s,{...cashInput,requestKey:key(),kind:"OUT",amount:"100",reason:"Retiro"});
  await assert.rejects(recordCashMovement(db,s,{...cashInput,requestKey:key(),kind:"OUT",amount:"999999"}));
  const cancel={saleId:sale.id,requestKey:key(),reason:"Error en caja",disposition:"WASTE",confirm:"yes"};
  await assert.rejects(cancelSale(db,other,cancel));
  const cancelled=await cancelSale(db,s,cancel);
  assert.equal((await cancelSale(db,s,cancel)).id,cancelled.id);
  await assert.rejects(cancelSale(db,s,{...cancel,requestKey:key()}));
  const closed=await closeShift(db,s,{shiftId:shift.id,counted:"500"});
  assert.equal(closed.expectedCents,50000n);
  await assert.rejects(recordSale(db,s,{...saleInput,requestKey:key()}));
  const nextShift=await openShift(db,s,{branchId:s.branchId,opening:"500"});
  const refundInput={saleId:promoSale.id,saleLineId:promoLine.id,shiftId:nextShift.id,requestKey:key(),quantity:"1",quoted:"75",parts:{transferCents:"75"},reason:"Devuelto",disposition:"REVIEW",confirm:"yes"};
  await assert.rejects(recordReturn(db,other,refundInput));
  const refund=await recordReturn(db,s,refundInput);
  assert.equal(refund.refundCents,7500n);assert.equal(refund.costCents,4000n);
  assert.equal((await recordReturn(db,s,refundInput)).id,refund.id);
  const quarantine=await db.lot.findUniqueOrThrow({where:{tenantId_id:{tenantId,id:refund.returnedLotId}}});
  assert.equal(quarantine.status,"REVIEW");assert.equal(quarantine.quantityMilli,1000n);
  await assert.rejects(recordReturn(db,s,{...refundInput,requestKey:key(),quantity:"4"}));
  const rest=await recordReturn(db,s,{...refundInput,requestKey:key(),quantity:"3",quoted:"225",parts:{transferCents:"225"},disposition:"WASTE"});
  assert.equal(rest.refundCents+refund.refundCents,promoSale.totalCents);
  assert.equal(rest.costCents+refund.costCents,promoSale.costCents);
  await assert.rejects(recordReturn(db,s,{...refundInput,requestKey:key()}));
  await assert.rejects(cancelSale(db,s,{saleId:promoSale.id,requestKey:key(),reason:"No duplicar",disposition:"WASTE",confirm:"yes"}));
  const cashSale=await recordSale(db,s,{shiftId:nextShift.id,requestKey:key(),payment:"CASH",tendered:"100",quotedTotal:"90",lines:[{lotId:packagedReceipt.lotId,quantity:"1"}]});
  const cashLine=await db.saleLine.findFirstOrThrow({where:{tenantId,saleId:cashSale.id}});
  const closeSecond=await closeShift(db,s,{shiftId:nextShift.id,counted:"590"});assert.equal(closeSecond.expectedCents,59000n);
  const thirdShift=await openShift(db,s,{branchId:s.branchId,opening:"100"});
  await recordReturn(db,s,{...refundInput,saleId:cashSale.id,saleLineId:cashLine.id,shiftId:thirdShift.id,requestKey:key(),quoted:"90",parts:{cashCents:"90"},disposition:"WASTE"});
  const closeThird=await closeShift(db,s,{shiftId:thirdShift.id,counted:"10"});assert.equal(closeThird.expectedCents,1000n);
  assert.equal((await db.cashShift.findUniqueOrThrow({where:{tenantId_id:{tenantId,id:nextShift.id}}})).expectedCents,59000n);
  const member=await db.customer.create({data:{tenantId,code:key(),name:"Socio"}});
  const otherMember=await db.customer.create({data:{tenantId:other.tenantId,code:key(),name:"Otro"}});
  const packB=await db.product.create({data:{tenantId,sku:key(),name:"Pack B",unit:"UNIT",sector:"GROCERY",salePriceCents:15000n}});
  const stockB=await receiveLot(db,s,{...receive,productId:packB.id,code:key(),requestKey:key(),invoiceRef:"Combo B",quantity:"3",cost:"150"});
  await db.combo.create({data:{tenantId,name:"Combo prueba",items:[{productId:packaged.id,units:1},{productId:packB.id,units:1}],priceCents:20000n,startsOn:new Date(localDay()+"T00:00:00Z"),endsOn:new Date(expiresOn+"T00:00:00Z")}});
  await db.tenant.update({where:{id:tenantId},data:{memberDiscountBps:500,pointsEveryCents:10000n}});
  const finalShift=await openShift(db,s,{branchId:s.branchId,opening:"0"});
  const comboInput={shiftId:finalShift.id,requestKey:key(),payment:"TRANSFER",quotedTotal:"200",customerId:member.id,lines:[{lotId:packagedReceipt.lotId,quantity:"1"},{lotId:stockB.lotId,quantity:"1"}]};
  await assert.rejects(recordSale(db,s,{...comboInput,customerId:otherMember.id}));
  const comboSale=await recordSale(db,s,comboInput);assert.equal(comboSale.customerId,member.id);assert.equal(comboSale.pointsRateCents,10000n);
  const comboLines=await db.saleLine.findMany({where:{tenantId,saleId:comboSale.id}});
  assert.equal(comboLines.reduce((a,l)=>a+l.totalCents,0n),20000n);assert.ok(comboLines.every(l=>l.promotionLabel==="Combo prueba"));
  assert.equal((await recordSale(db,s,comboInput)).id,comboSale.id);
  await closeShift(db,s,{shiftId:finalShift.id,counted:"0"});
  await db.tenant.update({where:{id:tenantId},data:{suspended:true}});
  await assert.rejects(openShift(db,s,{branchId:s.branchId,opening:"0"}));
  await db.tenant.update({where:{id:tenantId},data:{suspended:false}});
  const expense=await recordFinance(db,s,{requestKey:key(),date:localDay(),amount:"100",category:"Luz",description:"Test"},"EXPENSE");
  assert.equal(expense.amountCents,10000n);
  const payment=await recordFinance(db,s,{requestKey:key(),date:localDay(),amount:"5000",supplierId:supplier.id,payment:"TRANSFER"},"PAYMENT");
  assert.equal(payment.amountCents,500000n);
  const movements=await db.stockMovement.findMany({where:{tenantId,lotId:lot.id}});
  assert.equal(movements.reduce((a,m)=>a+m.deltaMilli,0n),opened.quantityMilli);
  assert.equal(movements.reduce((a,m)=>a+m.deltaCostCents,0n),opened.remainingCostCents);

  // Regression: expired, blocked, and review lots cannot be sold or transformed; expired license blocks writes.
  const today=localDay();
  const pastLot=await db.lot.create({data:{tenantId,branchId:s.branchId,productId:packaged.id,supplierId:supplier.id,code:key(),quantityMilli:2000n,remainingCostCents:2000n,expiresOn:new Date(today+"T00:00:00Z"),status:"AVAILABLE"}});
  const blockedLot=await db.lot.create({data:{tenantId,branchId:s.branchId,productId:packaged.id,supplierId:supplier.id,code:key(),quantityMilli:2000n,remainingCostCents:2000n,status:"BLOCKED"}});
  const reviewLot=await db.lot.create({data:{tenantId,branchId:s.branchId,productId:packaged.id,supplierId:supplier.id,code:key(),quantityMilli:2000n,remainingCostCents:2000n,status:"REVIEW"}});
  const guardReceipt=await receiveLot(db,s,{...receive,productId:packaged.id,code:key(),requestKey:key(),invoiceRef:"Guard",quantity:"4",cost:"160",expiresOn});
  const guardShift=await openShift(db,s,{branchId:s.branchId,opening:"0"});
  for(const bad of [pastLot,blockedLot,reviewLot]){
   await assert.rejects(recordSale(db,s,{shiftId:guardShift.id,requestKey:key(),payment:"TRANSFER",quotedTotal:"100",lines:[{lotId:bad.id,quantity:"1"}]}),/no apto/i);
  }
  // Regression: expired license blocks sales and inventory operations.
  const yesterday=localDay(new Date(Date.now()-86400000));
  await db.tenant.update({where:{id:tenantId},data:{licenseUntil:new Date(yesterday+"T00:00:00Z")}});
  await assert.rejects(recordSale(db,s,{shiftId:guardShift.id,requestKey:key(),payment:"TRANSFER",quotedTotal:"100",lines:[{lotId:guardReceipt.lotId,quantity:"1"}]}),/Sin permisos/);
  await assert.rejects(receiveLot(db,s,{...receive,code:key(),requestKey:key()}),/Sin permisos/);
  await db.tenant.update({where:{id:tenantId},data:{licenseUntil:null}});
  await closeShift(db,s,{shiftId:guardShift.id,counted:"0"});

  // Regression: loyalty points subtract cancellations and partial returns; cross-tenant writes are rejected.
  const ptsShift=await openShift(db,s,{branchId:s.branchId,opening:"0"});
  const ptsSale=await recordSale(db,s,{shiftId:ptsShift.id,requestKey:key(),payment:"TRANSFER",quotedTotal:"200",customerId:member.id,lines:[{lotId:guardReceipt.lotId,quantity:"3"}]});
  const ptsLine=await db.saleLine.findFirstOrThrow({where:{tenantId,saleId:ptsSale.id}});
  await recordReturn(db,s,{saleId:ptsSale.id,saleLineId:ptsLine.id,shiftId:ptsShift.id,requestKey:key(),quantity:"1",quoted:"66.67",parts:{transferCents:"66.67"},reason:"Parcial puntos",disposition:"REVIEW",confirm:"yes"});
  const cancelledPtsSale=await recordSale(db,s,{shiftId:ptsShift.id,requestKey:key(),payment:"TRANSFER",quotedTotal:"90",customerId:member.id,lines:[{lotId:guardReceipt.lotId,quantity:"1"}]});
  await cancelSale(db,s,{saleId:cancelledPtsSale.id,requestKey:key(),reason:"Anulación puntos",disposition:"WASTE",confirm:"yes"});
  const loyaltyStats=await db.$queryRaw`
   WITH refunds AS (SELECT "saleId",SUM("refundCents") AS amount FROM "SaleReturn" WHERE "tenantId"=${tenantId} GROUP BY "saleId"),
   net AS (SELECT s."customerId",s."totalCents"-COALESCE(r.amount,0) AS amount,s."pointsRateCents" AS rate FROM "Sale" s LEFT JOIN refunds r ON r."saleId"=s.id LEFT JOIN "SaleCancellation" c ON c."tenantId"=s."tenantId" AND c."saleId"=s.id WHERE s."tenantId"=${tenantId} AND s."customerId"=${member.id} AND c.id IS NULL)
   SELECT COALESCE(SUM(amount),0)::bigint net,COALESCE(SUM(FLOOR(amount/NULLIF(rate,0))),0)::bigint points FROM net`;
  assert.equal(loyaltyStats[0].net,33333n);
  assert.equal(loyaltyStats[0].points,3n);
  await assert.rejects(lotOperation(db,other,{lotId:guardReceipt.lotId,requestKey:key(),kind:"WASTE",quantity:"1",reason:"Cross-tenant"}));
  await assert.rejects(transformLot(db,other,{branchId:s.branchId,sourceLotId:lot.id,requestKey:key(),inputMilli:"1000",outputs:[{quantityMilli:"1000",disposition:"WASTE",reason:"Cross"}]}));
  await assert.rejects(recordFinance(db,other,{requestKey:key(),date:today,amount:"10",supplierId:supplier.id,payment:"CASH"},"PAYMENT"));
  await closeShift(db,s,{shiftId:ptsShift.id,counted:"0"});
 }finally{await db.$disconnect();}
});
