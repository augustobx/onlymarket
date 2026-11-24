"use client";
import {useState,useRef} from "react";
import {useFormStatus} from "react-dom";
import {saleAction} from "./actions";
import {decimal} from "../../src/domain/parse.mjs";
import {priceLine} from "../../src/domain/sales.mjs";

type Option={id:string;name:string;sku:string;barcode:string|null;code:string;unit:string;quantity:string;price:string;discount:number;expiry:string|null};
const fixed=(n:bigint,scale:number)=>{const a=n.toString().padStart(scale+1,"0");return a.slice(0,-scale)+"."+a.slice(-scale);};
const money=(n:bigint)=>"$ "+fixed(n,2).replace(".",",");
function Submit({disabled}:{disabled:boolean}){const {pending}=useFormStatus();return <button disabled={disabled||pending}>{pending?"Registrando...":"Confirmar venta"}</button>;}
export default function Cart({lots,shiftId,requestKey}:{lots:Option[];shiftId:string;requestKey:string}){
 const [search,setSearch]=useState(""),[selected,setSelected]=useState(""),[qty,setQty]=useState("1"),[cart,setCart]=useState<Record<string,string>>({}),[payment,setPayment]=useState("CASH"),[tendered,setTendered]=useState(""),[error,setError]=useState("");
 const scanRef=useRef<HTMLInputElement>(null);
 const options=lots.filter(l=>!search||[l.name,l.sku,l.barcode,l.code].some(v=>v?.toLowerCase().includes(search.toLowerCase().trim())));
 const choose=()=>{const exact=lots.filter(l=>l.barcode===search.trim()||l.sku===search.trim()||l.code===search.trim());if(exact.length===1){setSelected(exact[0].id);setQty(exact[0].unit==="UNIT"?"1":"");setError("");}else{setSelected("");setError(exact.length>1?"Seleccioná el lote físico de la lista.":"Seleccioná un producto y su lote.");}};
 function add(){
  try{const lot=lots.find(x=>x.id===selected);if(!lot)throw new Error("Seleccioná un lote");
   const n=decimal(qty,3,"Cantidad");if(lot.unit==="UNIT"&&n%1000n)throw new Error("Solo unidades enteras");
   const sum=BigInt(cart[lot.id]??"0")+n;if(sum>BigInt(lot.quantity))throw new Error("Stock insuficiente");
   if(!cart[lot.id]&&Object.keys(cart).length>=100)throw new Error("Máximo 100 lotes por venta");
   setCart({...cart,[lot.id]:sum.toString()});setSearch("");setSelected("");setQty("1");setError("");scanRef.current?.focus();
  }catch(e){setError(e instanceof Error?e.message:"Cantidad inválida");}
 }
 const rows=Object.entries(cart).flatMap(([id,q])=>{const lot=lots.find(l=>l.id===id);if(!lot)return [];const n=BigInt(q);return [{lot,n,...priceLine(BigInt(lot.price),n,lot.discount)}];});
 const total=rows.reduce((a,r)=>a+r.total,0n);
 let cash:bigint|null=null;try{cash=decimal(tendered,2,"Efectivo",{allowZero:true});}catch{}
 return <section className="panel"><h2>Nueva venta</h2><p>Confirmá el lote físico que entregás. Los lotes se ordenan por vencimiento; no se descuentan automáticamente de otro lote.</p><div className="formgrid"><label>Buscar / escanear código<input ref={scanRef} value={search} onChange={e=>{setSearch(e.target.value);setSelected("");}} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();choose();}}} placeholder="Nombre, SKU, código de barras"/></label><label>Producto y lote<select value={selected} onChange={e=>{setSelected(e.target.value);setQty(lots.find(x=>x.id===e.target.value)?.unit==="KG"?"":"1");}}><option value="">Elegir lote</option>{options.map(l=><option key={l.id} value={l.id}>{l.name} · {l.code} · {fixed(BigInt(l.quantity),3)} {l.unit==="KG"?"kg":"u."} · {l.expiry??"sin venc."}{l.discount?" · -"+l.discount/100+"%":""}</option>)}</select></label><label>Cantidad (kg o unidades)<input value={qty} onChange={e=>setQty(e.target.value)} inputMode="decimal"/></label><button type="button" onClick={add}>Agregar</button></div>{error&&<p role="alert" className="error">{error}</p>}<div className="tablewrap"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio base</th><th>Promo</th><th>Subtotal</th><th></th></tr></thead><tbody>{rows.map(({lot,n,total})=><tr key={lot.id}><td>{lot.name}<small>{lot.code}</small></td><td>{fixed(n,3)} {lot.unit==="KG"?"kg":"u."}</td><td>{money(BigInt(lot.price))}</td><td>{lot.discount/100}%</td><td>{money(total)}</td><td><button type="button" className="secondary" onClick={()=>{const next={...cart};delete next[lot.id];setCart(next);}}>Quitar</button></td></tr>)}</tbody></table></div>{!rows.length&&<p>Agregá artículos para comenzar.</p>}<form action={saleAction} className="fields"><input type="hidden" name="shiftId" value={shiftId}/><input type="hidden" name="requestKey" value={requestKey}/><input type="hidden" name="lines" value={JSON.stringify(rows.map(r=>({lotId:r.lot.id,quantity:fixed(r.n,3)})))}/><input type="hidden" name="quotedTotal" value={fixed(total,2)}/><h2 className="total">Total: {money(total)}</h2><div className="formgrid"><label>Medio de pago<select name="payment" value={payment} onChange={e=>setPayment(e.target.value)}><option value="CASH">Efectivo</option><option value="DEBIT">Débito</option><option value="CREDIT">Crédito</option><option value="TRANSFER">Transferencia</option></select></label>{payment==="CASH"&&<label>Efectivo recibido<input name="tendered" value={tendered} onChange={e=>setTendered(e.target.value)} inputMode="decimal" required/></label>}</div>{payment==="CASH"&&cash!==null&&cash>=total&&<p>Vuelto: {money(cash-total)}</p>}<Submit disabled={!rows.length||(payment==="CASH"&&(cash===null||cash<total))}/><small>Comprobante interno, no fiscal. Los pagos electrónicos se registran manualmente.</small></form></section>;
}
