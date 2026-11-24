import test from "node:test";
import assert from "node:assert/strict";
import {returnQuote,refundAllocation} from "../src/domain/returns.mjs";
import {summarizeFinance} from "../src/domain/finance.mjs";
test("devoluciones parciales con redondeo acumulativo exacto",()=>{
 const line={quantityMilli:3000n,totalCents:1000n,costCents:500n};
 const a=returnQuote(line,{quantityMilli:0n},1000n),b=returnQuote(line,{quantityMilli:1000n},1000n),c=returnQuote(line,{quantityMilli:2000n},1000n);
 assert.equal(a.refundCents+b.refundCents+c.refundCents,1000n);
 assert.equal(a.costCents+b.costCents+c.costCents,500n);
 assert.throws(()=>returnQuote(line,{quantityMilli:2000n},2000n));
});
test("reintegro mixto no supera lo cobrado por medio",()=>{
 const sale={cashCents:300n,debitCents:200n,creditCents:0n,transferCents:500n};
 assert.deepEqual(refundAllocation(sale,{},800n),{cashCents:100n,debitCents:200n,creditCents:0n,transferCents:500n});
 assert.throws(()=>refundAllocation(sale,{cashCents:300n},800n));
});
test("resultado del día puede ser negativo por devolución de un día anterior",()=>{
 const r=summarizeFinance({sales:0n,costOfSales:0n,refunds:1000n,returnedCost:600n,waste:600n,gifts:0n,expenses:0n,purchases:0n,payments:0n});
 assert.equal(r.gross,-400n);assert.equal(r.estimatedOperatingProfit,-1000n);
});
