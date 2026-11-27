import {decimal,textField} from "./parse.mjs";
const header=["sku","nombre","codigo_barras","unidad","sector","precio","aviso_dias","frescura_dias","apertura_dias"];
export const catalogHeader=header.join(";");
function splitCsv(text){
 if(typeof text!=="string"||text.length>500000)throw new Error("CSV demasiado grande (máximo 500 KB)");
 text=text.replace(/^\uFEFF/,"");
 const delim=text.split(/\r?\n/,1)[0].includes(";")?";":",";
 let rows=[],row=[],field="",quoted=false,closed=false;
 const push=()=>{row.push(field);field="";closed=false;};
 const end=()=>{push();if(row.some(x=>x.trim()))rows.push(row);row=[];if(rows.length>1001)throw new Error("Máximo 1000 productos");};
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=ch;continue;}
  if(ch===delim){push();continue;}
  if(ch==="\r"||ch==="\n"){if(ch==="\r"&&text[i+1]==="\n")i++;end();continue;}
  if(closed)throw new Error("Formato CSV inválido después de comillas");
  if(ch==='"'){if(field)throw new Error("Comillas CSV inválidas");quoted=true;continue;}
  field+=ch;
 }
 if(quoted)throw new Error("Comillas CSV sin cerrar");
 if(field||row.length||closed)end();
 return rows;
}
function days(value,optional){if(optional&&!value.trim())return null;const s=value.trim();if(!/^\d{1,3}$/.test(s)||Number(s)>365||(optional&&Number(s)<1))throw new Error("Días inválidos");return Number(s);}
const sectors={CARNICERIA:"BUTCHERY",CARNICERÍA:"BUTCHERY",FIAMBRERIA:"DELI",FIAMBRERÍA:"DELI",VERDULERIA:"PRODUCE",VERDULERÍA:"PRODUCE",ALMACEN:"GROCERY",ALMACÉN:"GROCERY",OTROS:"OTHER",BUTCHERY:"BUTCHERY",DELI:"DELI",PRODUCE:"PRODUCE",GROCERY:"GROCERY",OTHER:"OTHER"};
export function parseCatalogCsv(text){
 const rows=splitCsv(text);
 if(rows.length<2||rows[0].map(x=>x.trim().toLowerCase()).join(";")!==catalogHeader)throw new Error("Cabecera inválida. Usá la plantilla de OnlyMarket.");
 const skus=new Set(),codes=new Set();
 return rows.slice(1).map((r,i)=>{
  try{
   if(r.length!==header.length)throw new Error("Cantidad de columnas inválida");
   const [sku,name,barcode,unit,sector,price,alert,fresh,opened]=r;
   const id=textField(sku,"SKU",64,true),code=textField(barcode,"Código de barras",64,true)||null;
   if((id&&skus.has(id))||(code&&codes.has(code)))throw new Error("SKU o código de barras duplicado en archivo");
   if(id)skus.add(id);if(code)codes.add(code);
   const u=unit.trim().toUpperCase(),s=sectors[sector.trim().toUpperCase()];
   if(!["KG","UNIT","UNIDAD"].includes(u)||!s)throw new Error("Unidad o sector inválido");
   return {sku:id,name:textField(name,"Nombre"),barcode:code,unit:u==="KG"?"KG":"UNIT",sector:s,salePriceCents:decimal(price,2,"Precio",{allowZero:true}),alertDays:days(alert,false),freshnessDays:days(fresh,true),openedLifeDays:days(opened,true)};
  }catch(e){throw new Error("Registro "+(i+2)+": "+e.message);}
 });
}
