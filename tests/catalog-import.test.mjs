import test from "node:test";
import assert from "node:assert/strict";
import {catalogHeader,parseCatalogCsv} from "../src/domain/catalog-import.mjs";
import {ean13} from "../src/domain/barcode.mjs";
test("CSV argentino con comillas, decimales y BOM",()=>{
 const row='001;"Queso; cremoso";0001234567890;KG;FIAMBRERIA;1500,25;3;;2';
 const result=parseCatalogCsv("\uFEFF"+catalogHeader+"\r\n"+row+"\r\n");
 assert.equal(result[0].sku,"001");assert.equal(result[0].name,"Queso; cremoso");assert.equal(result[0].salePriceCents,150025n);assert.equal(result[0].openedLifeDays,2);
 assert.throws(()=>parseCatalogCsv(catalogHeader+"\n"+row+"\n"+row));
 assert.throws(()=>parseCatalogCsv(catalogHeader+'\n"unclosed'));
 assert.throws(()=>parseCatalogCsv(catalogHeader+"\n"+row.replace("1500,25","-2")));
});
test("CSV permite SKU vacío y rechaza SKUs duplicados cuando se informan",()=>{
 const rows=[
  catalogHeader,
  ';Yerba mate;;UNIDAD;ALMACEN;2500,00;3;;',
  ';Azúcar;;UNIDAD;ALMACEN;1200,00;3;;',
 ].join("\n");
 const parsed=parseCatalogCsv(rows);
 assert.equal(parsed.length,2);
 assert.equal(parsed[0].sku,"");
 assert.equal(parsed[1].sku,"");
});
test("EAN13 valida dígito de control y estructura",()=>{
 const bits=ean13("4006381333931");assert.equal(bits.length,95);assert.equal(bits.slice(0,3),"101");assert.equal(bits.slice(45,50),"01010");assert.equal(bits.slice(-3),"101");assert.equal(ean13("4006381333932"),null);
});
