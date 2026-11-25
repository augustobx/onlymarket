"use client";
import {useState,useRef,useMemo,useEffect} from "react";
import {useFormStatus} from "react-dom";
import {saleAction} from "./actions";
import {decimal} from "../../src/domain/parse.mjs";
import {decodeWeight} from "../../src/domain/barcode.mjs";
import {basketQuote} from "../../src/domain/combos.mjs";
import {quotePromotion,paymentBreakdown} from "../../src/domain/sales.mjs";
import {Icon,type IconName} from "../components/icons";

type Promo={id:string;name:string;discountBps:number;minimumMilli:string|null;buyUnits:number|null;payUnits:number|null};
type Option={
 id:string;
 productId:string;
 weightCode:string|null;
 name:string;
 sku:string;
 barcode:string|null;
 code:string;
 unit:string;
 sector?:string;
 quantity:string;
 price:string;
 promotions:Promo[];
 expiry:string|null;
};

const sectorTabs:[string,string,IconName][]=[
 ["","Todos","grid"],
 ["GROCERY","Almacén","shoppingBag"],
 ["BUTCHERY","Carnicería","beef"],
 ["DELI","Fiambrería","cheese"],
 ["PRODUCE","Verdulería","apple"],
 ["OTHER","Otros","box"],
];

const fixed=(n:bigint,scale:number)=>{
 const a=n.toString().padStart(scale+1,"0");
 return a.slice(0,-scale)+"."+a.slice(-scale);
};
const money=(n:bigint)=>"$ "+fixed(n,2).replace(".",",");

function Submit({disabled}:{disabled:boolean}){
 const {pending}=useFormStatus();
 return (
  <button className="v2-charge" disabled={disabled||pending}>
   <Icon name="check" size={18}/>
   <span>{pending?"Registrando venta...":"Confirmar venta"}</span>
  </button>
 );
}

export default function Cart({
 lots,
 shiftId,
 requestKey,
 customers,
 weightPrefix,
 memberBps,
 combos,
}:{
 lots:Option[];
 shiftId:string;
 requestKey:string;
 customers:{id:string;name:string;code:string}[];
 weightPrefix:string|null;
 memberBps:number;
 combos:{id:string;name:string;items:{productId:string;units:number}[];priceCents:string}[];
}){
 const [search,setSearch]=useState("");
 const [sectorFilter,setSectorFilter]=useState("");
 const [selected,setSelected]=useState("");
 const [qty,setQty]=useState("1");
 const [cart,setCart]=useState<Record<string,string>>({});
 const [payment,setPayment]=useState("CASH");
 const [tendered,setTendered]=useState("");
 const [error,setError]=useState("");
 const scanRef=useRef<HTMLInputElement>(null);
 const quantityRef=useRef<HTMLInputElement>(null);
 const [fast,setFast]=useState(true);
 const [customerId,setCustomerId]=useState("");
 const decoded=decodeWeight(search.trim(),weightPrefix);
 const [split,setSplit]=useState({cashCents:"",debitCents:"",creditCents:"",transferCents:""});

 const byId=useMemo(()=>new Map(lots.map(l=>[l.id,l])),[lots]);
 const exactIndex=useMemo(()=>{
  const index=new Map<string,Option[]>();
  for(const l of lots){
   for(const code of new Set([l.barcode,l.sku,l.code])){
    if(!code)continue;
    const group=index.get(code)??[];
    group.push(l);
    index.set(code,group);
   }
  }
  return index;
 },[lots]);

 const term=search.trim().toLowerCase();
 const matches=useMemo(
  ()=>lots.filter(l=>
   decoded
    ?l.unit==="KG"&&l.weightCode===decoded.plu
    :!term||[l.name,l.sku,l.barcode,l.code].some(v=>v?.toLowerCase().includes(term))
  ),
  [lots,term,decoded?.plu]
 );

 const options=matches.slice(0,100);
 const chosen=byId.get(selected);
 if(chosen&&!options.some(l=>l.id===chosen.id))options.unshift(chosen);

 const choose=()=>{
  if(decoded){
   const candidates=matches;
   if(candidates.length===1){
    setSelected(candidates[0].id);
    setQty(fixed(BigInt(decoded.quantityMilli),3));
    setError("");
   }else{
    setSelected("");
    setQty(fixed(BigInt(decoded.quantityMilli),3));
    setError(candidates.length?"Seleccioná lote físico para este peso":"PLU no encontrado");
   }
   return;
  }
  if(weightPrefix&&search.trim().startsWith(weightPrefix)&&search.trim().length===13){
   setSelected("");
   setQty("");
   setError("Código de peso inválido");
   return;
  }
  const exact=exactIndex.get(search.trim())??[];
  if(exact.length===1){
   if(fast&&exact[0].unit==="UNIT"){
    add(exact[0].id,"1");
    return;
   }
   setSelected(exact[0].id);
   setQty(exact[0].unit==="UNIT"?"1":"");
   setError("");
   quantityRef.current?.focus();
  }else{
   setSelected("");
   setError(
    exact.length>1
     ?"Hay varios lotes con ese código: seleccioná el lote físico de la lista."
     :matches.length===0
      ?"Producto o código no encontrado / sin stock"
      :"Seleccioná un producto y su lote."
   );
  }
 };

 function add(id=selected,quantity=qty){
  try{
   const lot=byId.get(id);
   if(!lot)throw new Error("Seleccioná un lote");
   const n=decimal(quantity,3,"Cantidad");
   if(lot.unit==="UNIT"&&n%1000n)throw new Error("Solo unidades enteras");
   const sum=BigInt(cart[lot.id]??"0")+n;
   if(sum>BigInt(lot.quantity))throw new Error("Stock insuficiente");
   if(!cart[lot.id]&&Object.keys(cart).length>=100)throw new Error("Máximo 100 lotes por venta");
   setCart({...cart,[lot.id]:sum.toString()});
   setSearch("");
   setSelected("");
   setQty("1");
   setError("");
   scanRef.current?.focus();
  }catch(e){
   setError(e instanceof Error?e.message:"Cantidad inválida");
  }
 }

 const rawRows=Object.entries(cart)
  .sort(([a],[b])=>a.localeCompare(b))
  .flatMap(([id,q])=>{
   const lot=byId.get(id);
   if(!lot)return [];
   const n=BigInt(q);
   return [{lot,n,...quotePromotion(BigInt(lot.price),n,lot.unit,lot.promotions)}];
  });

 const quotes=basketQuote(
  rawRows.map(r=>({productId:r.lot.productId,unit:r.lot.unit,unitPrice:BigInt(r.lot.price),quantity:r.n,price:r})),
  combos,
  customerId?memberBps:0
 );

 const rows:{lot:Option;n:bigint;subtotal:bigint;total:bigint;promotionLabel:string|null}[]=rawRows.map((r,i)=>({
  lot:r.lot,
  n:BigInt(r.n),
  subtotal:BigInt(quotes[i].subtotal),
  total:BigInt(quotes[i].total),
  promotionLabel:quotes[i].promotionLabel??null,
 }));

 const total=rows.reduce((a,r)=>a+r.total,0n);
 let cash:bigint|null=null;
 try{cash=decimal(tendered,2,"Efectivo",{allowZero:true});}catch{}

 const methods=[
  ["cashCents","Efectivo asignado"],
  ["debitCents","Débito asignado"],
  ["creditCents","Crédito asignado"],
  ["transferCents","Transferencia asignada"],
 ] as const;

 let cashDue=payment==="CASH"?total:0n;
 let splitTotal=0n;
 let validPayment=false;
 let change:bigint|null=null;

 try{
  const parts=Object.fromEntries(methods.map(([k])=>[k,decimal(split[k]||"0",2,"Importe",{allowZero:true})]));
  splitTotal=Object.values(parts).reduce((a,b)=>a+b,0n);
  if(payment==="MIXED")cashDue=parts.cashCents??0n;
  const paid=paymentBreakdown(total,payment,cash,parts);
  validPayment=true;
  change=paid.changeCents===null?null:BigInt(paid.changeCents);
 }catch{}

 const needsCash=payment==="CASH"||(payment==="MIXED"&&cashDue>0n);

 const quick=useMemo(()=>{
  const map=new Map<string,Option>();
  for(const l of lots){
   if(sectorFilter&&l.sector!==sectorFilter)continue;
   if(!map.has(l.productId))map.set(l.productId,l);
  }
  return [...map.values()].slice(0,12);
 },[lots,sectorFilter]);

 useEffect(()=>{
  scanRef.current?.focus();
  const key=(e:KeyboardEvent)=>{
   if(document.querySelector("dialog[open]"))return;
   if(e.key==="F2"){e.preventDefault();scanRef.current?.focus();}
   else if(e.key==="F4"){e.preventDefault();quantityRef.current?.focus();}
   else if(e.key==="F12"){e.preventDefault();document.querySelector<HTMLButtonElement>(".v2-charge:not(:disabled)")?.focus();}
  };
  window.addEventListener("keydown",key);
  return ()=>window.removeEventListener("keydown",key);
 },[]);

 const selectQuick=(l:Option)=>{
  setSearch(l.name);
  setSelected("");
  const choices=lots.filter(x=>x.productId===l.productId);
  if(choices.length===1&&l.unit==="UNIT"){
   add(l.id,"1");
  }else{
   setSelected(choices.length===1?l.id:"");
   setQty(l.unit==="KG"?"":"1");
   setError(choices.length>1?"Seleccioná el lote físico":"");
   quantityRef.current?.focus();
  }
 };

 const quickCashAmounts=useMemo(()=>{
  const base=[100000n,200000n,500000n,1000000n,2000000n];
  return base.filter(v=>v>=total).slice(0,4);
 },[total]);

 return (
  <section className="v2-posbody">
   <div className="v2-posleft">
    <div className="om-pos-scan-card">
     <div className="v2-posscan">
      <label>
       <span>Buscar / escanear código</span>
       <input
        ref={scanRef}
        value={search}
        onChange={e=>{setSearch(e.target.value);setSelected("");}}
        onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();choose();}}}
        placeholder="Escanear código EAN, PLU o buscar producto por nombre / SKU..."
       />
      </label>
      <button type="button" className="secondary" onClick={choose}>
       <Icon name="search" size={16}/>
       <span>Buscar</span>
      </button>
     </div>

     <div className="om-pos-scan-bar">
      <label className="scanmode">
       <input type="checkbox" checked={fast} onChange={e=>{setFast(e.target.checked);scanRef.current?.focus();}}/>
       <span>Escaneo rápido (agrega una unidad si hay un único lote coincidente)</span>
      </label>
      {weightPrefix&&(
       <span className="status AVAILABLE">
        Balanza prefijo {weightPrefix}
       </span>
      )}
     </div>

     <div className="v2-pos-pick">
      <label>
       Producto y lote
       <select
        value={selected}
        onChange={e=>{
         setSelected(e.target.value);
         setQty(decoded?fixed(BigInt(decoded.quantityMilli),3):byId.get(e.target.value)?.unit==="KG"?"":"1");
        }}
       >
        <option value="">Elegir lote ({options.length})</option>
        {options.map(l=>(
         <option key={l.id} value={l.id}>
          {l.name} · {l.code} · {fixed(BigInt(l.quantity),3)} {l.unit==="KG"?"kg":"u."} · {l.expiry??"sin venc."}{l.promotions.length?" · Oferta":""}
         </option>
        ))}
       </select>
      </label>

      <label>
       Cantidad (kg o unidades)
       <input
        ref={quantityRef}
        value={qty}
        onChange={e=>setQty(e.target.value)}
        inputMode="decimal"
        onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();add();}}}
       />
      </label>

      <button type="button" onClick={()=>add()}>
       <Icon name="plus" size={16}/>
       <span>Agregar</span>
      </button>
     </div>
     {matches.length>100&&<small>Mostrando 100 de {matches.length} lotes. Refiná la búsqueda.</small>}
    </div>

    {error&&(
     <p role="alert" className="error">
      <Icon name="alert" size={16}/>
      <span>{error}</span>
     </p>
    )}

    <section className="om-card">
     <header className="om-card__head">
      <div className="om-card__heading">
       <span className="om-card__icon"><Icon name="shoppingBag" size={16}/></span>
       <div>
        <h2>Nueva venta</h2>
        <p>{rows.length} líneas · lote físico confirmado</p>
       </div>
      </div>
      <span className="status AVAILABLE">Venta directa</span>
     </header>

     {rows.length>0?(
      <div className="tablewrap">
       <table>
        <thead>
         <tr>
          <th>Producto</th>
          <th>Cantidad</th>
          <th>Precio base</th>
          <th>Promo / beneficio</th>
          <th>Subtotal</th>
          <th></th>
         </tr>
        </thead>
        <tbody>
         {rows.map(({lot,n,total:lineTotal,promotionLabel,subtotal})=>(
          <tr key={lot.id}>
           <td>
            <strong>{lot.name}</strong>
            <small className="mono">{lot.code}</small>
           </td>
           <td>
            {lot.unit==="UNIT"?(
             <div className="qtybuttons">
              <button
               type="button"
               className="secondary"
               aria-label={"Restar una unidad de "+lot.name}
               onClick={()=>{
                if(n<=1000n){const next={...cart};delete next[lot.id];setCart(next);}
                else setCart({...cart,[lot.id]:(n-1000n).toString()});
               }}
              >
               −
              </button>
              <strong>{(n/1000n).toString()}</strong>
              <button
               type="button"
               className="secondary"
               aria-label={"Sumar una unidad de "+lot.name}
               disabled={n+1000n>BigInt(lot.quantity)}
               onClick={()=>add(lot.id,"1")}
              >
               +
              </button>
             </div>
            ):(
             <span className="mono">{fixed(n,3)} kg</span>
            )}
           </td>
           <td className="mono">{money(BigInt(lot.price))}</td>
           <td>
            {promotionLabel?(
             <span className="status AVAILABLE">{promotionLabel}</span>
            ):"—"}
            {subtotal>lineTotal&&<small>Ahorro {money(subtotal-lineTotal)}</small>}
           </td>
           <td className="mono"><strong>{money(lineTotal)}</strong></td>
           <td>
            <button
             type="button"
             className="secondary"
             onClick={()=>{const next={...cart};delete next[lot.id];setCart(next);}}
            >
             Quitar
            </button>
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     ):(
      <div className="om-empty">
       <span className="om-empty__icon"><Icon name="barcode" size={22}/></span>
       <strong>La venta está vacía</strong>
       <p>Escaneá un código de barras, leé una etiqueta de balanza o tocá un artículo rápido abajo.</p>
      </div>
     )}

     <div className="v2-cartactions">
      <button type="button" className="secondary" onClick={()=>scanRef.current?.focus()}>
       F2 · Volver al escáner
      </button>
      <button type="button" className="secondary" onClick={()=>quantityRef.current?.focus()}>
       F4 · Cantidad
      </button>
      <button
       type="button"
       className="secondary"
       disabled={!rows.length}
       onClick={()=>{if(window.confirm("¿Vaciar la venta actual?")){setCart({});scanRef.current?.focus();}}}
      >
       Vaciar venta
      </button>
     </div>
    </section>

    <section className="om-card">
     <header className="om-card__head">
      <div className="om-card__heading">
       <span className="om-card__icon"><Icon name="grid" size={16}/></span>
       <div>
        <h2>Accesos rápidos</h2>
        <p>Artículos disponibles en esta sucursal</p>
       </div>
      </div>
     </header>

     <div className="v2-tabs">
      {sectorTabs.map(([k,label])=>(
       <button
        key={k}
        type="button"
        className={sectorFilter===k?"active":""}
        onClick={()=>setSectorFilter(k)}
       >
        {label}
       </button>
      ))}
     </div>

     {quick.length>0?(
      <div className="v2-quicktiles">
       {quick.map(l=>(
        <button className="om-pos-tile" key={l.productId} type="button" onClick={()=>selectQuick(l)}>
         <strong>{l.name}</strong>
         <div className="om-pos-tile__foot">
          <span>{money(BigInt(l.price))}</span>
          <span className="om-pos-tile__unit">{l.unit==="KG"?"kg":"u."}</span>
         </div>
        </button>
       ))}
      </div>
     ):(
      <p className="empty">Sin mercadería apta en este sector.</p>
     )}
    </section>
   </div>

   <section className="om-card v2-posright">
    <form action={saleAction} className="fields">
     <input type="hidden" name="shiftId" value={shiftId}/>
     <label>
      Cliente (opcional)
      <select name="customerId" value={customerId} onChange={e=>setCustomerId(e.target.value)}>
       <option value="">Consumidor final</option>
       {customers.map(c=><option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
      </select>
     </label>

     <input type="hidden" name="requestKey" value={requestKey}/>
     <input type="hidden" name="lines" value={JSON.stringify(rows.map(r=>({lotId:r.lot.id,quantity:fixed(r.n,3)})))}/>
     <input type="hidden" name="quotedTotal" value={fixed(total,2)}/>

     <div>
      <div className="v2-totalline">
       <span>Subtotal</span>
       <strong>{money(rows.reduce((a,r)=>a+r.subtotal,0n))}</strong>
      </div>
      <div className="v2-totalline v2-savings">
       <span>Promociones y beneficios</span>
       <strong>− {money(rows.reduce((a,r)=>a+r.subtotal-r.total,0n))}</strong>
      </div>
     </div>

     <div className="v2-totalbox">
      <small>TOTAL A COBRAR</small>
      <h2 className="total">{money(total)}</h2>
     </div>

     <div>
      <label style={{marginBottom:8}}>Medio de pago</label>
      <input type="hidden" name="payment" value={payment}/>
      <div className="v2-methodgrid" role="group" aria-label="Medio de pago">
       {[
        ["CASH","Efectivo"],
        ["DEBIT","Débito"],
        ["CREDIT","Crédito"],
        ["TRANSFER","Transferencia"],
        ["MIXED","Pago mixto"],
       ].map(([k,v])=>(
        <button
         key={k}
         type="button"
         className={"secondary "+(payment===k?"active":"")}
         aria-pressed={payment===k}
         onClick={()=>setPayment(k)}
        >
         {v}
        </button>
       ))}
      </div>
     </div>

     <div className="om-payment-fields">
      {payment==="MIXED"&&methods.map(([k,label])=>(
       <label key={k}>
        {label}
        <input name={k} value={split[k]} inputMode="decimal" onChange={e=>setSplit(old=>({...old,[k]:e.target.value}))}/>
       </label>
      ))}

      {needsCash&&(
       <>
        <label>
         Efectivo recibido
         <input name="tendered" value={tendered} onChange={e=>setTendered(e.target.value)} inputMode="decimal" required/>
        </label>
        {payment==="CASH"&&total>0n&&(
         <div className="om-cash-pills">
          <button type="button" className="secondary" onClick={()=>setTendered(fixed(total,2))}>
           Exacto
          </button>
          {quickCashAmounts.map(v=>(
           <button key={v.toString()} type="button" className="secondary" onClick={()=>setTendered(fixed(v,2))}>
            {money(v)}
           </button>
          ))}
         </div>
        )}
       </>
      )}
     </div>

     {payment==="MIXED"&&(
      <small>
       Asignado: {money(splitTotal)} · Total: {money(total)}. Seleccioná al menos dos medios y completá el total.
      </small>
     )}

     <div className="v2-change">
      {change!==null&&<>Vuelto a entregar: <strong>{money(change)}</strong></>}
     </div>

     <Submit disabled={!rows.length||!validPayment}/>
     <small>Comprobante interno, no fiscal. Los pagos electrónicos se registran manualmente.</small>
    </form>
   </section>
  </section>
 );
}
