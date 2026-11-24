import test from "node:test";
import assert from "node:assert/strict";
import {openedExpiry} from "../src/domain/shelf-life.mjs";
const iso=d=>d.toISOString().slice(0,10);
test("apertura acorta pero jamás extiende vencimiento",()=>{
 assert.equal(iso(openedExpiry({today:"2026-11-24",printedExpiry:"2026-12-05",lifeDays:3})),"2026-11-27");
 assert.equal(iso(openedExpiry({today:"2026-11-24",printedExpiry:"2026-11-25",lifeDays:3})),"2026-11-25");
 assert.throws(()=>openedExpiry({today:"2026-11-24",printedExpiry:"2026-11-24",lifeDays:3}));
 assert.throws(()=>openedExpiry({today:"2026-11-24",printedExpiry:null,lifeDays:3}));
 assert.throws(()=>openedExpiry({today:"2026-11-24",printedExpiry:"2026-12-05",lifeDays:null}));
});
