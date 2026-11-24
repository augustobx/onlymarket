import test from "node:test";
import assert from "node:assert/strict";
import {consumeCost,planTransformation,classifyLot,allocateFEFO} from "../src/domain/inventory.mjs";
test("desposte: conserva masa y costo incluidos regalos y desperdicios",()=>{
  const lines=planTransformation(100000n,60000000n,[
    {productId:"asado",quantityMilli:65000n,disposition:"STOCK",reason:"cortes"},
    {productId:"recortes",quantityMilli:8000n,disposition:"STOCK",reason:"picada"},
    {quantityMilli:25000n,disposition:"GIFT",reason:"huesos y grasa"},
    {quantityMilli:2000n,disposition:"WASTE",reason:"descarte"}]);
  assert.equal(lines.reduce((s,l)=>s+l.costCents,0n),60000000n);
  assert.equal(lines[2].costCents,15000000n);
});
test("redondeo conserva cada centavo",()=>{
 const lines=planTransformation(3n,2n,Array.from({length:3},()=>({quantityMilli:1n,disposition:"WASTE",reason:"merma"})));
 assert.deepEqual(lines.map(l=>l.costCents),[1n,1n,0n]);
});
test("rechaza diferencias de masa, negativos y sobreventa",()=>{
 assert.throws(()=>planTransformation(5n,100n,[{quantityMilli:4n,disposition:"WASTE",reason:"merma"}]));
 assert.throws(()=>consumeCost(5n,100n,6n));
 assert.throws(()=>consumeCost(5n,100n,-1n));
});
test("fraccionar y agotar conserva el costo residual",()=>{
 const first=consumeCost(3000n,1001n,1000n);
 assert.equal(first,333n);
 assert.equal(consumeCost(2000n,1001n-first,2000n),668n);
});
const base={today:"2026-11-24",expiresOn:"2026-11-26",reviewOn:null,alertDays:3,status:"AVAILABLE",quantityMilli:1000n};
test("alertas y bloqueos conservadores",()=>{
 assert.equal(classifyLot(base),"EXPIRING");
 assert.equal(classifyLot({...base,expiresOn:"2026-11-24"}),"BLOCKED");
 assert.equal(classifyLot({...base,reviewOn:"2026-11-23"}),"REVIEW");
 assert.equal(classifyLot({...base,status:"BLOCKED"}),"BLOCKED");
 assert.throws(()=>classifyLot({...base,expiresOn:"2026-02-30"}));
});
test("FEFO excluye vencidos y en revisión",()=>{
 const lot=(id,expiresOn,status="AVAILABLE")=>({...base,id,expiresOn,status,receivedAt:"2026-11-20",remainingCostCents:1000n});
 const lots=[lot("later","2026-11-29"),lot("expired","2026-11-23"),lot("first","2026-11-25"),lot("review","2026-11-25","REVIEW")];
 assert.deepEqual(allocateFEFO(lots,1500n,base.today),[{lotId:"first",quantityMilli:1000n,costCents:1000n},{lotId:"later",quantityMilli:500n,costCents:500n}]);
 assert.throws(()=>allocateFEFO(lots,2001n,base.today));
});
