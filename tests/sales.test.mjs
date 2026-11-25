import test from "node:test";
import assert from "node:assert/strict";
import {priceLine,bestPromotion,paymentAmounts,quotePromotion,quoteMultiLotPromotions,eligiblePromotions,paymentBreakdown} from "../src/domain/sales.mjs";
test("precio exacto por peso y descuento",()=>{
 assert.deepEqual(priceLine(123456n,125n,2000),{subtotal:15432n,total:12346n});
 assert.throws(()=>priceLine(10n,0n));assert.throws(()=>priceLine(10n,1000n,10000));
});
test("promoción de lote, vencimiento y mejor descuento no acumulable",()=>{
 const p={id:"a",active:true,productId:"p",lotId:null,startsOn:"2026-11-20",endsOn:"2026-11-30",discountBps:1000,expiryWithinDays:null};
 const lot={id:"l",productId:"p",expiresOn:"2026-11-26"};
 const promos=[p,{...p,id:"b",discountBps:3000,lotId:"other"},{...p,id:"c",discountBps:2000,expiryWithinDays:2}];
 assert.equal(bestPromotion(promos,lot,"2026-11-24").id,"c");
 assert.equal(bestPromotion(promos,lot,"2026-11-21").id,"a");
 assert.equal(bestPromotion(promos,{...lot,expiresOn:null},"2026-11-24").id,"a");
 assert.equal(bestPromotion(promos,lot,"2026-12-01"),null);
});
test("efectivo y medios no efectivo",()=>{
 assert.deepEqual(paymentAmounts(500n,"CASH",1000n),{tenderedCents:1000n,changeCents:500n});
 assert.throws(()=>paymentAmounts(500n,"CASH",499n));
 assert.deepEqual(paymentAmounts(500n,"TRANSFER",null),{tenderedCents:null,changeCents:null});
});

test("ofertas por cantidad, NxM, resto de unidades y mejor ahorro",()=>{
 const bundle={id:"b",name:"3x2",discountBps:0,buyUnits:3,payUnits:2};
 const threshold={id:"t",name:"Por cantidad",discountBps:2000,minimumMilli:"3000"};
 const percent={id:"p",name:"10%",discountBps:1000};
 assert.equal(quotePromotion(1000n,2000n,"UNIT",[bundle,threshold,percent]).total,1800n);
 assert.equal(quotePromotion(1000n,3000n,"UNIT",[bundle,threshold,percent]).total,2000n);
 assert.equal(quotePromotion(1000n,4000n,"UNIT",[bundle,threshold,percent]).total,3000n);
 assert.equal(quotePromotion(1000n,7000n,"UNIT",[bundle,threshold,percent]).total,5000n);
 assert.equal(quotePromotion(1000n,3000n,"KG",[bundle,threshold,percent]).total,2400n);
 assert.equal(quotePromotion(1000n,3000n,"UNIT",[bundle,{...percent,discountBps:5000}]).promotionId,"p");
 assert.equal(quotePromotion(1000n,3000n,"UNIT",[{...bundle,payUnits:4}]).total,3000n);
 const scoped={...bundle,active:true,productId:"p",lotId:"a",startsOn:"2026-11-20",endsOn:"2026-11-30",expiryWithinDays:2};
 assert.equal(eligiblePromotions([scoped],{id:"a",productId:"p",expiresOn:"2026-11-26"},"2026-11-24").length,1);
 assert.equal(eligiblePromotions([scoped],{id:"b",productId:"p",expiresOn:"2026-11-26"},"2026-11-24").length,0);
});

test("pagos mixtos separan efectivo, vuelto y electrónicos",()=>{
 assert.deepEqual(paymentBreakdown(1000n,"MIXED",500n,{cashCents:300n,debitCents:700n}),{cashCents:300n,debitCents:700n,creditCents:0n,transferCents:0n,tenderedCents:500n,changeCents:200n});
 assert.throws(()=>paymentBreakdown(1000n,"MIXED",500n,{cashCents:300n,debitCents:600n}));
 assert.throws(()=>paymentBreakdown(1000n,"MIXED",200n,{cashCents:300n,debitCents:700n}));
 assert.throws(()=>paymentBreakdown(1000n,"MIXED",null,{debitCents:1000n}));
 assert.equal(paymentBreakdown(1000n,"MIXED",null,{debitCents:600n,transferCents:400n}).changeCents,null);
 assert.equal(paymentBreakdown(1000n,"TRANSFER",null).transferCents,1000n);
});

test("quoteMultiLotPromotions combines product-wide NxM across multiple lots without combining lot-specific promos",()=>{
 const prodBundle={id:"b",name:"3x2 multi",active:true,productId:"p",lotId:null,expiryWithinDays:null,discountBps:0,buyUnits:3,payUnits:2};
 const q=quoteMultiLotPromotions([
  {productId:"p",unit:"UNIT",unitPrice:1000n,quantity:2000n,promotions:[prodBundle]},
  {productId:"p",unit:"UNIT",unitPrice:1000n,quantity:1000n,promotions:[prodBundle]},
 ]);
 assert.equal(q.reduce((a,r)=>a+r.total,0n),2000n);
 assert.ok(q.every(r=>r.promotionId==="b"));
 const lotBundle={...prodBundle,id:"bl",lotId:"lot1"};
 const ql=quoteMultiLotPromotions([
  {productId:"p",unit:"UNIT",unitPrice:1000n,quantity:2000n,promotions:[lotBundle]},
  {productId:"p",unit:"UNIT",unitPrice:1000n,quantity:1000n,promotions:[]},
 ]);
 assert.equal(ql.reduce((a,r)=>a+r.total,0n),3000n);
});
