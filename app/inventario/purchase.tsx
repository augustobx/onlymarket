"use client";
import {useState} from "react";
import {useFormStatus} from "react-dom";
import {decimal} from "../../src/domain/parse.mjs";
import {purchaseAction} from "./actions";
import {SectionCard,InfoCallout} from "../components/retail-ui";
import {Icon} from "../components/icons";
import {SearchPicker,type SearchPickerItem} from "../components/search-picker";

type Option={id:string;name:string};
type Product=Option&{sku?:string;barcode?:string|null;weightCode?:string|null;unit:string;sector:string;price?:string};
type Line={productId:string;code:string;quantity:string;cost:string;expiresOn:string};

const sectorLabels:Record<string,string>={BUTCHERY:"Carnicería",DELI:"Fiambrería",PRODUCE:"Verdulería",GROCERY:"Almacén",OTHER:"Otros"};

const blank=():Line=>({productId:"",code:"",quantity:"",cost:"",expiresOn:""});
const fmt=(n:bigint)=>{const a=n.toString().padStart(3,"0");return a.slice(0,-2)+","+a.slice(-2);};

function Submit({valid}:{valid:boolean}){
 const {pending}=useFormStatus();
 return (
  <button disabled={!valid||pending}>
   <Icon name="check" size={16}/>
   <span>{pending?"Registrando compra...":"Registrar compra completa"}</span>
  </button>
 );
}

export default function Purchase({
 products,
 suppliers,
 branches,
 today,
 requestKey,
}:{
 products:Product[];
 suppliers:Option[];
 branches:Option[];
 today:string;
 requestKey:string;
}){
 const [lines,setLines]=useState<Line[]>([blank()]);
 const [total,setTotal]=useState("");
 const set=(i:number,k:keyof Line,v:string)=>setLines(old=>old.map((l,j)=>i===j?{...l,[k]:v}:l));

 let sum=0n;
 let invoice:bigint|null=null;
 const reasons:string[]=[];
 const lineOk=lines.map((l,i)=>{
  const tag=`Renglón ${i+1}`;
  const p=products.find(p=>p.id===l.productId);
  if(!p)reasons.push(`${tag}: elegí un producto.`);
  if(!l.code.trim())reasons.push(`${tag}: ingresá el código de lote.`);
  let qty:bigint|null=null;
  try{qty=decimal(l.quantity,3,"Cantidad");}catch{reasons.push(`${tag}: ingresá una cantidad válida.`);}
  if(p&&qty!==null&&p.unit==="UNIT"&&qty%1000n!==0n)reasons.push(`${tag}: este producto se vende por unidad (sin decimales).`);
  let cost:bigint|null=null;
  try{cost=decimal(l.cost,2,"Costo",{allowZero:true});sum+=cost;}catch{reasons.push(`${tag}: ingresá el costo total del lote ($).`);}
  if(p&&["DELI","BUTCHERY"].includes(p.sector)&&!l.expiresOn)reasons.push(`${tag}: Carnicería y Fiambrería requieren vencimiento.`);
  if(l.expiresOn&&l.expiresOn<=today)reasons.push(`${tag}: el vencimiento debe ser posterior a hoy.`);
  return !!p&&!!l.code.trim()&&qty!==null&&(p.unit!=="UNIT"||qty%1000n===0n)&&cost!==null&&(!["DELI","BUTCHERY"].includes(p.sector)||!!l.expiresOn)&&(!l.expiresOn||l.expiresOn>today);
 });
 try{invoice=decimal(total,2,"Total",{allowZero:true});}catch{reasons.unshift("Ingresá el «Total del comprobante ($)».");}
 const diff=invoice===null?null:invoice-sum;
 if(invoice!==null&&diff!==null&&diff!==0n){
  reasons.unshift(`El Total del comprobante ($ ${fmt(invoice)}) debe coincidir con la suma de los costos de lote ($ ${fmt(sum)}). Diferencia: $ ${fmt(diff<0n?-diff:diff)}.`);
 }
 const valid=invoice!==null&&diff===0n&&lineOk.every(Boolean);

 return (
  <form action={purchaseAction} className="v2-station-form">
   <input type="hidden" name="requestKey" value={requestKey}/>
   <input type="hidden" name="lines" value={JSON.stringify(lines)}/>

   <div className="v2-steps">
    <b>1 · Comprobante</b>
    <span>›</span>
    <b>2 · Mercadería</b>
    <span>›</span>
    <span>3 · Confirmación y balance</span>
   </div>

   <div className="v2-station-grid">
    <div className="v2-stack">
     <SectionCard title="Datos del comprobante" subtitle="Identificación de factura o remito" icon="receipt" padded>
      <div className="v2-fields">
       <label>
        Proveedor
        <select name="supplierId">{suppliers.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
       </label>
       <label>
        Sucursal
        <select name="branchId">{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
       </label>
       <label>
        Número de comprobante
        <input name="invoiceRef" required maxLength={100} placeholder="Ej. FC-A 0001-00012345"/>
       </label>
       <label>
        Total del comprobante ($)
        <input name="total" required inputMode="decimal" value={total} onChange={e=>setTotal(e.target.value)} placeholder="0,00"/>
       </label>
      </div>
     </SectionCard>

     <SectionCard
      title="Detalle de mercadería"
      subtitle="Cada renglón genera un lote físico trazable"
      icon="truck"
      actions={
       <button type="button" className="secondary" disabled={lines.length>=50} onClick={()=>setLines(old=>[...old,blank()])}>
        <Icon name="plus" size={15}/>
        <span>Agregar renglón</span>
       </button>
      }
     >
      <div className="tablewrap">
       <table className="v2-entry-table">
        <thead>
         <tr>
          <th>Producto</th>
          <th>Lote</th>
          <th>Cant.</th>
          <th>Costo lote ($)</th>
          <th>Vencimiento</th>
          <th></th>
         </tr>
        </thead>
        <tbody>
         {lines.map((l,i)=>{
          const p=products.find(p=>p.id===l.productId);
          return (
           <tr key={i}>
            <td>
             <SearchPicker
              ariaLabel={"Producto "+(i+1)}
              required
              placeholder="Buscar producto, SKU o código..."
              items={products.map((pr):SearchPickerItem=>({
               id:pr.id,
               title:pr.name,
               badge:sectorLabels[pr.sector]??pr.sector,
               subtitle:`${pr.sku?"SKU "+pr.sku:""}${pr.barcode?" · EAN "+pr.barcode:""}${pr.weightCode?" · PLU "+pr.weightCode:""}`,
               meta:pr.unit==="KG"?"Por kilogramo":"Por unidad",
               price:pr.price?`${pr.price}/${pr.unit==="KG"?"kg":"u."}`:undefined,
               searchText:`${pr.name} ${pr.sku??""} ${pr.barcode??""} ${pr.weightCode??""} ${sectorLabels[pr.sector]??""}`,
              }))}
              value={l.productId}
              onChange={id=>set(i,"productId",id)}
             />
            </td>
            <td><input aria-label={"Lote "+(i+1)} value={l.code} required onChange={e=>set(i,"code",e.target.value)}/></td>
            <td><input aria-label={"Cantidad "+(i+1)} value={l.quantity} required inputMode="decimal" onChange={e=>set(i,"quantity",e.target.value)}/></td>
            <td>
             <input aria-label={"Costo total "+(i+1)} value={l.cost} required inputMode="decimal" onChange={e=>set(i,"cost",e.target.value)}/>
             {(()=>{
              try{
               const q=decimal(l.quantity,3,"Cantidad");
               const c=decimal(l.cost,2,"Costo",{allowZero:true});
               return q>0n?<small className="mono">Unit: $ {fmt((c*1000n)/q)}/{p?.unit==="KG"?"kg":"u."}</small>:null;
              }catch{return null;}
             })()}
            </td>
            <td>
             <input
              aria-label={"Vencimiento "+(i+1)}
              type="date"
              value={l.expiresOn}
              min={new Date(Date.parse(today+"T00:00:00Z")+86400000).toISOString().slice(0,10)}
              required={p?.sector==="DELI"||p?.sector==="BUTCHERY"}
              onChange={e=>set(i,"expiresOn",e.target.value)}
             />
            </td>
            <td>
             <button
              type="button"
              className="secondary"
              disabled={lines.length===1}
              onClick={()=>setLines(old=>old.filter((_,j)=>j!==i))}
              aria-label={"Quitar lote "+(i+1)}
             >
              <Icon name="trash" size={14}/>
             </button>
            </td>
           </tr>
          );
         })}
        </tbody>
       </table>
      </div>
     </SectionCard>
    </div>

    <aside className="v2-station-aside">
     <SectionCard title="Control de recepción" subtitle="Balance contra comprobante" icon="packageCheck" padded>
      {[
       ["Renglones",lines.length],
       ["Total de lotes","$ "+fmt(sum)],
       ["Comprobante",invoice===null?"—":"$ "+fmt(invoice)],
       ["Diferencia",diff===null?"—":"$ "+(diff<0n?"−":"")+fmt(diff<0n?-diff:diff)],
      ].map(([k,v])=>(
       <div key={String(k)} className="v2-totalline">
        <span>{k}</span>
        <strong>{v}</strong>
       </div>
      ))}

      <div style={{margin:"14px 0"}}>
       <span className={"status "+(valid?"AVAILABLE":"REVIEW")}>
        {valid?"Listo para registrar":"Revisar datos e importes"}
       </span>
      </div>

      <InfoCallout icon="info" tone="warning">
       En cada renglón va el <strong>costo total que pagaste por el lote</strong> (no el costo unitario ni el precio de venta al público). El botón se habilita cuando todos los datos están completos y la suma de los lotes coincide exacto con el <strong>Total del comprobante</strong> ($ 0,00 de diferencia).
      </InfoCallout>

      {!valid&&reasons.length>0&&(
       <div className="om-callout om-callout--warning" role="status" style={{flexDirection:"column",gap:6}}>
        <strong>Por qué no se habilita el botón:</strong>
        <ul style={{margin:0,paddingLeft:18}}>
         {reasons.slice(0,5).map((r,idx)=><li key={idx}>{r}</li>)}
        </ul>
       </div>
      )}

      <Submit valid={valid}/>
      <small style={{display:"block",marginTop:8}}>El servidor valida vencimientos y suma total antes de grabar.</small>
     </SectionCard>
    </aside>
   </div>
  </form>
 );
}
