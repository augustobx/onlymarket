import test from "node:test";
import assert from "node:assert/strict";
import {priceLine,bestPromotion,paymentAmounts} from "../src/domain/sales.mjs";
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
