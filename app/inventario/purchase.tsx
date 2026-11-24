"use client";
import {useState} from "react";
import {useFormStatus} from "react-dom";
import {decimal} from "../../src/domain/parse.mjs";
import {purchaseAction} from "./actions";
type Option={id:string;name:string};
type Product=Option&{unit:string;sector:string};
type Line={productId:string;code:string;quantity:string;cost:string;expiresOn:string};
const blank=():Line=>({productId:"",code:"",quantity:"",cost:"",expiresOn:""});
const fmt=(n:bigint)=>{const a=n.toString().padStart(3,"0");return a.slice(0,-2)+","+a.slice(-2);};
function Submit({valid}:{valid:boolean}){const {pending}=useFormStatus();return <button disabled={!valid||pending}>{pending?"Registrando...":"Registrar compra completa"}</button>}
export default function Purchase({products,suppliers,branches,today,requestKey}:{products:Product[];suppliers:Option[];branches:Option[];today:string;requestKey:string}){
 const [lines,setLines]=useState<Line[]>([blank()]),[total,setTotal]=useState("");
 const set=(i:number,k:keyof Line,v:string)=>setLines(old=>old.map((l,j)=>i===j?{...l,[k]:v}:l));
 let sum=0n,valid=false;
 try{sum=lines.reduce((s,l)=>s+decimal(l.cost,2,"Costo",{allowZero:true}),0n);valid=decimal(total,2,"Total",{allowZero:true})===sum;}catch{}
 return <form action={purchaseAction} className="fields"><input type="hidden" name="requestKey" value={requestKey}/><input type="hidden" name="lines" value={JSON.stringify(lines)}/><div className="formgrid"><label>Sucursal<select name="branchId">{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Proveedor<select name="supplierId">{suppliers.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Número de comprobante<input name="invoiceRef" required maxLength={100}/></label><label>Total del comprobante ($)<input name="total" required inputMode="decimal" value={total} onChange={e=>setTotal(e.target.value)}/></label></div>{lines.map((l,i)=>{const p=products.find(p=>p.id===l.productId);return <div key={i} className="outputrow"><label>Producto<select value={l.productId} required onChange={e=>set(i,"productId",e.target.value)}><option value="">Elegir producto</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.unit==="KG"?"kg":"u."})</option>)}</select></label><label>Lote<input value={l.code} required onChange={e=>set(i,"code",e.target.value)}/></label><label>Cantidad ({p?.unit==="KG"?"kg":"u."})<input value={l.quantity} required inputMode="decimal" onChange={e=>set(i,"quantity",e.target.value)}/></label><label>Costo total ($)<input value={l.cost} required inputMode="decimal" onChange={e=>set(i,"cost",e.target.value)}/></label><label>Vencimiento<input type="date" value={l.expiresOn} min={today} required={p?.sector==="DELI"||p?.sector==="BUTCHERY"} onChange={e=>set(i,"expiresOn",e.target.value)}/></label><button type="button" className="secondary" disabled={lines.length===1} onClick={()=>setLines(old=>old.filter((_,j)=>j!==i))}>Quitar</button></div>})}<button type="button" className="secondary" disabled={lines.length>=50} onClick={()=>setLines(old=>[...old,blank()])}>+ Agregar lote</button><p>Suma de los lotes: <strong>$ {fmt(sum)}</strong> · {valid?"Coincide con el comprobante":"Revisar total"}</p><Submit valid={valid}/></form>;
}
