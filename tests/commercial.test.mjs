import test from "node:test";
import assert from "node:assert/strict";
import {basketQuote} from "../src/domain/combos.mjs";
import {quotePromotion} from "../src/domain/sales.mjs";
import {decodeWeight,encodeWeightEan13} from "../src/domain/barcode.mjs";
import {licenseActive,showTransform} from "../src/domain/settings.mjs";
import {resolveOkMessage} from "../src/domain/notices.mjs";
import {buildCsv,csvCell,formatCentsCsv,formatMilliCsv} from "../src/domain/csv.mjs";
import {normalizeSearch,matchesSearch} from "../src/domain/search.mjs";
test("combos compare savings, preserve exact cents and avoid stacking",()=>{
 const row=(productId,unitPrice,quantity)=>({productId,unitPrice,quantity,unit:"UNIT",price:quotePromotion(unitPrice,quantity,"UNIT",[])});
 const rows=[row("a",1000n,2000n),row("b",1500n,2000n)];
 const combo={id:"c",name:"Combo",priceCents:1800n,items:[{productId:"a",units:1},{productId:"b",units:1}]};
 assert.equal(basketQuote(rows,[combo]).reduce((a,p)=>a+p.total,0n),3600n);
 assert.equal(basketQuote(rows,[combo],4000).reduce((a,p)=>a+p.total,0n),3000n);
 assert.equal(basketQuote([rows[0]],[combo])[0].total,2000n);
});
test("combos do not stack on member discount and preserve non-combo line savings",()=>{
 const row=(productId,unitPrice,quantity)=>({productId,unitPrice,quantity,unit:"UNIT",price:quotePromotion(unitPrice,quantity,"UNIT",[])});
 const rows=[row("a",250000n,1000n),row("b",100000n,1000n),{productId:"c",unitPrice:200000n,quantity:750n,unit:"KG",price:quotePromotion(200000n,750n,"KG",[])}];
 const combo={id:"c1",name:"Combo smoke",priceCents:250000n,items:[{productId:"a",units:1},{productId:"b",units:1}]};
 const q=basketQuote(rows,[combo],500);
 assert.equal(q.reduce((a,p)=>a+p.total,0n),392500n);
 assert.equal(q[0].promotionLabel,"Combo smoke");
 assert.equal(q[1].promotionLabel,"Combo smoke");
 assert.equal(q[2].promotionLabel,"Beneficio socio");
});
test("notice allowlist rejects arbitrary text injection",()=>{
 assert.equal(resolveOkMessage("sale"),"Venta registrada correctamente.");
 assert.equal(resolveOkMessage("<script>alert(1)</script>"),"Operación registrada correctamente.");
 assert.equal(resolveOkMessage(undefined),null);
});
test("weighted EAN checksum and grams",()=>{
 const base="200123400750";const sum=[...base].reduce((a,d,i)=>a+Number(d)*(i%2?3:1),0),code=base+(10-sum%10)%10;
 assert.equal(encodeWeightEan13("20","01234",750n),code);
 assert.deepEqual(decodeWeight(code,"20"),{plu:"01234",quantityMilli:750});
 assert.equal(decodeWeight(code,"21"),null);assert.equal(decodeWeight(code.slice(0,-1)+(Number(code.at(-1))+1)%10,"20"),null);
 assert.equal(encodeWeightEan13("2","01234",750n),null);
 assert.equal(encodeWeightEan13("20","01234",0n),null);
});
test("partial combos price matched groups as combo and excess units with non-combo pricing",()=>{
 const row=(productId,unitPrice,quantity)=>({productId,unitPrice,quantity,unit:"UNIT",price:quotePromotion(unitPrice,quantity,"UNIT",[])});
 const rows=[row("a",1000n,2000n),row("b",1500n,1000n)];
 const combo={id:"c",name:"Combo parcial",priceCents:1800n,items:[{productId:"a",units:1},{productId:"b",units:1}]};
 const normal=basketQuote(rows,[combo]);
 assert.equal(normal.reduce((a,p)=>a+p.total,0n),2800n);
 assert.match(normal[0].promotionLabel??"",/Combo parcial/);
 const withMember=basketQuote(rows,[combo],1000);
 assert.equal(withMember.reduce((a,p)=>a+p.total,0n),2700n);
});
test("license date inclusive, suspension and profile",()=>{
 const t={suspended:false,licenseUntil:new Date("2026-11-24T00:00:00Z")};
 assert.equal(licenseActive(t,"2026-11-24"),true);assert.equal(licenseActive(t,"2026-11-25"),false);assert.equal(licenseActive({...t,suspended:true},"2026-11-24"),false);
 assert.equal(showTransform("KIOSK"),false);assert.equal(showTransform("BUTCHERY"),true);
});
test("CSV export neutralizes spreadsheet formulas and formats Argentine decimals",()=>{
 assert.equal(csvCell("=CMD()"),`"'=CMD()"`);
 assert.equal(csvCell("+123"),`"'+123"`);
 assert.equal(csvCell('-A"B'),`"' -A""B"`.replace("' ","'"));
 assert.equal(csvCell("@SUM"),`"'@SUM"`);
 assert.equal(formatCentsCsv(12345n),"123,45");
 assert.equal(formatCentsCsv(-500n),"-5,00");
 assert.equal(formatMilliCsv(2000n,"UNIT"),"2");
 assert.equal(formatMilliCsv(750n,"KG"),"0,750");
 const csv=buildCsv(["Producto","Total"],["Yerba;=1+1".split(";")]);
 assert.ok(csv.startsWith("\uFEFF"));
 assert.match(csv,/"Yerba";"'=1\+1"/);
});
test("multi-token accent-insensitive search matches across name, SKU, barcode and sector",()=>{
 assert.equal(normalizeSearch("Jamón Crudo · Fiambrería"),"jamon crudo · fiambreria");
 assert.equal(matchesSearch("jamon fia",["Jamón Crudo","DEL-001","Fiambrería"]),true);
 assert.equal(matchesSearch("yer 3393",["Yerba smoke","SMOKE-001","4006381333931"]),true);
 assert.equal(matchesSearch("yerba carniceria",["Yerba smoke","Almacén"]),false);
});
