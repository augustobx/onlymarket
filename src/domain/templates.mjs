import {textField} from "./parse.mjs";
export function templateLines(lines){
 if(!Array.isArray(lines)||!lines.length||lines.length>100)throw new Error("Se requieren entre 1 y 100 salidas");
 return lines.map(l=>{
  if(!l||!["STOCK","GIFT","WASTE"].includes(l.disposition))throw new Error("Destino inválido");
  return {disposition:l.disposition,productId:l.disposition==="STOCK"?textField(l.productId,"Producto",128):"",reason:textField(l.reason,"Detalle",300)};
 });
}
