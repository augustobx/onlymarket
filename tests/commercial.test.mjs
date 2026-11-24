import test from "node:test";
import assert from "node:assert/strict";
import {basketQuote} from "../src/domain/combos.mjs";
import {quotePromotion} from "../src/domain/sales.mjs";
import {decodeWeight} from "../src/domain/barcode.mjs";
import {licenseActive,showTransform} from "../src/domain/settings.mjs";
test("combos compare savings, preserve exact cents and avoid stacking",()=>{
 const row=(productId,unitPrice,quantity)=>({productId,unitPrice,quantity,unit:"UNIT",price:quotePromotion(unitPrice,quantity,"UNIT",[])});
 const rows=[row("a",1000n,2000n),row("b",1500n,2000n)];
 const combo={id:"c",name:"Combo",priceCents:1800n,items:[{productId:"a",units:1},{productId:"b",units:1}]};
 assert.equal(basketQuote(rows,[combo]).reduce((a,p)=>a+p.total,0n),3600n);
 assert.equal(basketQuote(rows,[combo],4000).reduce((a,p)=>a+p.total,0n),3000n);
 assert.equal(basketQuote([rows[0]],[combo])[0].total,2000n);
});
test("weighted EAN checksum and grams",()=>{
 const base="200123400750";const sum=[...base].reduce((a,d,i)=>a+Number(d)*(i%2?3:1),0),code=base+(10-sum%10)%10;
 assert.deepEqual(decodeWeight(code,"20"),{plu:"01234",quantityMilli:750});
 assert.equal(decodeWeight(code,"21"),null);assert.equal(decodeWeight(code.slice(0,-1)+(Number(code.at(-1))+1)%10,"20"),null);
});
test("license date inclusive, suspension and profile",()=>{
 const t={suspended:false,licenseUntil:new Date("2026-11-24T00:00:00Z")};
 assert.equal(licenseActive(t,"2026-11-24"),true);assert.equal(licenseActive(t,"2026-11-25"),false);assert.equal(licenseActive({...t,suspended:true},"2026-11-24"),false);
 assert.equal(showTransform("KIOSK"),false);assert.equal(showTransform("BUTCHERY"),true);
});
