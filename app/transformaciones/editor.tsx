"use client";
import {useState} from "react";
import {useFormStatus} from "react-dom";
import {transformAction,saveTemplate} from "../actions";
import {decimal} from "../../src/domain/parse.mjs";
import {consumeCost,planTransformation} from "../../src/domain/inventory.mjs";
type Product={id:string;name:string};
type Lot={id:string;branchId:string;label:string;quantity:string;cost:string};
type Row={disposition:string;productId:string;reason:string;quantity:string};
type Template={id:string;name:string;lines:{disposition:string;productId:string;reason:string}[]};
const blank=():Row=>({disposition:"STOCK",productId:"",reason:"",quantity:""});
const format=(n:bigint,scale:number)=>{const a=(n<0n?-n:n).toString().padStart(scale+1,"0");return (n<0n?"-":"")+a.slice(0,-scale)+","+a.slice(-scale);};
function Submit({valid}:{valid:boolean}){const {pending}=useFormStatus();return <button disabled={!valid||pending}>{pending?"Registrando…":"Confirmar transformación"}</button>}
export default function Editor({products,lots,templates,requestKey}:{products:Product[];lots:Lot[];templates:Template[];requestKey:string}){
 const [source,setSource]=useState(""),[input,setInput]=useState(""),[rows,setRows]=useState<Row[]>([blank()]),[templateName,setTemplateName]=useState("");
 const lot=lots.find(l=>l.id===source);
 const set=(i:number,key:keyof Row,value:string)=>setRows(old=>old.map((r,j)=>j===i?{...r,[key]:value}:r));
 let entered=0n,output=0n,valid=false,cost:bigint|null=null,planned:{costCents:bigint}[]=[];
 try{
  entered=decimal(input,3,"Entrada");
  const lines=rows.map(r=>({...r,quantityMilli:decimal(r.quantity,3,"Peso")}));
  output=lines.reduce((a,r)=>a+r.quantityMilli,0n);
  if(lot){cost=consumeCost(BigInt(lot.quantity),BigInt(lot.cost),entered);planned=planTransformation(entered,cost,lines);valid=true;}
 }catch{}
 // Preserve a live balance even while individual rows are still being filled.
 output=rows.reduce((a,r)=>{try{return a+decimal(r.quantity,3,"Peso");}catch{return a;}},0n);
 const difference=entered-output;
 const templateData=rows.map(({disposition,productId,reason})=>({disposition,productId,reason}));
 return <div className="fields"><label>Usar plantilla existente<select defaultValue="" onChange={e=>{const t=templates.find(x=>x.id===e.target.value);if(t)setRows(t.lines.map(r=>({...r,quantity:""})));e.target.value="";}}><option value="">Elegir plantilla (opcional)</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><form action={transformAction} className="fields"><input type="hidden" name="requestKey" value={requestKey}/><input type="hidden" name="branchId" value={lot?.branchId??""}/><div className="formgrid"><label>Lote de origen<select name="sourceLotId" required value={source} onChange={e=>{setSource(e.target.value);setInput("");}}><option value="">Elegir lote</option>{lots.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label><label>Peso a transformar (kg)<input name="input" required inputMode="decimal" value={input} onChange={e=>setInput(e.target.value)}/></label></div><div className="metrics"><article><small>Entrada</small><strong>{format(entered,3)} kg</strong></article><article><small>Salidas</small><strong>{format(output,3)} kg</strong></article><article><small>Diferencia</small><strong>{format(difference,3)} kg</strong><span className={"status "+(valid?"AVAILABLE":"REVIEW")}>{valid?"Balance correcto":"Revisar cantidades y datos"}</span></article><article><small>Costo de entrada</small><strong>{cost===null?"—":"$ "+format(cost,2)}</strong></article></div><h3>Cortes, recortes y pérdidas</h3>{rows.map((r,i)=><div className="outputrow" key={i}><label>Destino<select name={"disposition"+i} value={r.disposition} onChange={e=>set(i,"disposition",e.target.value)}><option value="STOCK">Corte / stock</option><option value="GIFT">Regalo</option><option value="WASTE">Merma</option></select></label><label>Producto<select name={"product"+i} value={r.productId} onChange={e=>{set(i,"productId",e.target.value);if(!r.reason)set(i,"reason",products.find(p=>p.id===e.target.value)?.name??"");}} disabled={r.disposition!=="STOCK"} required={r.disposition==="STOCK"}><option value="">Elegir</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Peso kg<input name={"quantity"+i} required inputMode="decimal" value={r.quantity} onChange={e=>set(i,"quantity",e.target.value)}/></label><label>Motivo / detalle<input name={"reason"+i} required maxLength={300} value={r.reason} onChange={e=>set(i,"reason",e.target.value)}/></label><div><small>{planned[i]?"Costo: $ "+format(planned[i].costCents,2):"Costo pendiente"}</small><button type="button" className="secondary" disabled={rows.length===1} onClick={()=>setRows(old=>old.filter((_,j)=>j!==i))}>Quitar</button></div></div>)}<button type="button" className="secondary" disabled={rows.length>=100} onClick={()=>setRows(old=>[...old,blank()])}>+ Agregar salida</button><Submit valid={valid}/></form><form action={saveTemplate} className="formgrid"><input type="hidden" name="templateLines" value={JSON.stringify(templateData)}/><label>Guardar estas salidas como plantilla (sin pesos)<input name="templateName" value={templateName} onChange={e=>setTemplateName(e.target.value)} required maxLength={100}/></label><button>Guardar plantilla</button></form></div>;
}
