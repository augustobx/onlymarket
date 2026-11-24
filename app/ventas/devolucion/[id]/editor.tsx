"use client";
import {useState} from "react";
import {useFormStatus} from "react-dom";
import {decimal} from "../../../../src/domain/parse.mjs";
import {returnQuote,refundAllocation} from "../../../../src/domain/returns.mjs";
import {returnAction} from "./actions";
type Parts={cashCents:string;debitCents:string;creditCents:string;transferCents:string};
type Line={id:string;name:string;unit:string;quantityMilli:string;totalCents:string;costCents:string;previous:string};
const fields=[["cashCents","Efectivo"],["debitCents","Débito"],["creditCents","Crédito"],["transferCents","Transferencia"]] as const;
const fmt=(n:bigint,scale=2)=>{const a=n.toString().padStart(scale+1,"0");return a.slice(0,-scale)+","+a.slice(-scale);};
function Submit({valid}:{valid:boolean}){const {pending}=useFormStatus();return <button disabled={!valid||pending}>{pending?"Registrando…":"Registrar devolución"}</button>}
export default function Editor({saleId,shiftId,requestKey,lines,sale,prior}:{saleId:string;shiftId:string;requestKey:string;lines:Line[];sale:Parts;prior:Parts}){
 const [lineId,setLineId]=useState(""),[quantity,setQuantity]=useState("");
 const line=lines.find(l=>l.id===lineId);let refund:bigint|null=null,parts:Record<string,bigint>={},valid=false;
 try{if(line){const q=decimal(quantity,3,"Cantidad");if(line.unit==="UNIT"&&q%1000n)throw new Error("Unidades enteras");const quote=returnQuote(line,{quantityMilli:line.previous},q);refund=BigInt(quote.refundCents);parts=Object.fromEntries(Object.entries(refundAllocation(sale,prior,refund)).map(([k,v])=>[k,BigInt(v as bigint)]));valid=true;}}catch{}
 return <form action={returnAction} className="fields"><input type="hidden" name="saleId" value={saleId}/><input type="hidden" name="shiftId" value={shiftId}/><input type="hidden" name="requestKey" value={requestKey}/><input type="hidden" name="quoted" value={refund===null?"":fmt(refund)}/>{fields.map(([key])=><input key={key} type="hidden" name={key} value={fmt(parts[key]??0n)}/>)}<div className="formgrid"><label>Artículo a devolver<select name="saleLineId" required value={lineId} onChange={e=>{setLineId(e.target.value);setQuantity("");}}><option value="">Elegir artículo</option>{lines.map(l=><option key={l.id} value={l.id}>{l.name} · pendiente {fmt(BigInt(l.quantityMilli)-BigInt(l.previous),3)} {l.unit==="KG"?"kg":"u."}</option>)}</select></label><label>Cantidad a devolver<input name="quantity" required inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><label>Destino<select name="disposition"><option value="WASTE">Descarte / pérdida</option><option value="REVIEW">Lote separado en revisión</option></select></label><label>Motivo<input name="reason" required maxLength={300}/></label></div><h2>Reintegro: {refund===null?"—":"$ "+fmt(refund)}</h2>{valid&&fields.filter(([k])=>(parts[k]??0n)>0n).map(([k,label])=><p key={k}>{label}: $ {fmt(parts[k])}</p>)}<p>Se devuelve el importe proporcional al precio efectivamente pagado, incluyendo promociones. En pagos mixtos se reintegran primero débito, crédito y transferencia, y finalmente efectivo, sin exceder lo cobrado por cada medio.</p><label><span>Confirmo que realicé el reintegro manual indicado y el destino físico de la mercadería.</span><input name="confirm" type="checkbox" value="yes" required/></label><Submit valid={valid}/></form>;
}
