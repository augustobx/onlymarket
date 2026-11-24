import test from "node:test";
import assert from "node:assert/strict";
import {templateLines} from "../src/domain/templates.mjs";
test("plantilla conserva destinos y no guarda pesos históricos",()=>{
 const lines=templateLines([{disposition:"STOCK",productId:"cut",reason:"Asado",quantity:"10"},{disposition:"GIFT",productId:"ignored",reason:"Huesos"}]);
 assert.deepEqual(lines,[{disposition:"STOCK",productId:"cut",reason:"Asado"},{disposition:"GIFT",productId:"",reason:"Huesos"}]);
 assert.throws(()=>templateLines([{disposition:"STOCK",reason:"Corte",productId:""}]));
 assert.throws(()=>templateLines([]));
});
