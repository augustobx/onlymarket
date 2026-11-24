import test from "node:test";
import assert from "node:assert/strict";
import {summarizeFinance,periodBounds} from "../src/domain/finance.mjs";
test("compras y pagos no se descuentan dos veces de la ganancia",()=>{
 const r=summarizeFinance({sales:10000n,costOfSales:5000n,waste:1000n,gifts:500n,expenses:500n,purchases:20000n,payments:30000n});
 assert.equal(r.gross,5000n);assert.equal(r.estimatedOperatingProfit,3000n);
});
test("límites de día argentino",()=>{
 const r=periodBounds("2026-11-24","2026-11-24");
 assert.equal(r.start.toISOString(),"2026-11-24T03:00:00.000Z");
 assert.equal(r.end.toISOString(),"2026-11-25T03:00:00.000Z");
 assert.throws(()=>periodBounds("2026-02-30","2026-03-01"));
});
