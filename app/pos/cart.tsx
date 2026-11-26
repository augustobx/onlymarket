"use client";
import {useState,useRef,useMemo,useEffect} from "react";
import {useFormStatus} from "react-dom";
import {saleAction} from "./actions";
import {decimal} from "../../src/domain/parse.mjs";
import {decodeWeight} from "../../src/domain/barcode.mjs";
import {basketQuote} from "../../src/domain/combos.mjs";
import {quoteMultiLotPromotions,paymentBreakdown} from "../../src/domain/sales.mjs";
import {matchesSearch} from "../../src/domain/search.mjs";
import {Icon,type IconName} from "../components/icons";
import {SearchPicker,type SearchPickerItem} from "../components/search-picker";

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
 quickAccess?:boolean;
 quantity:string;
 price:string;
 promotions:Promo[];
 expiry:string|null;
};
type ParkedSale={
 id:string;
 savedAt:string;
 customerId:string;
 cart:Record<string,string>;
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
 pointValueCents="0",
 combos,
}:{
 lots:Option[];
 shiftId:string;
 requestKey:string;
 customers:{id:string;name:string;code:string;availablePoints?:string}[];
 weightPrefix:string|null;
 memberBps:number;
 pointValueCents?:string;
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
 const [info,setInfo]=useState("");
 const scanRef=useRef<HTMLInputElement>(null);
 const quantityRef=useRef<HTMLInputElement>(null);
 const [fast,setFast]=useState(true);
 const [scanOpen,setScanOpen]=useState(false);
 const [customerId,setCustomerId]=useState("");
 const [parked,setParked]=useState<ParkedSale[]>([]);
 const decoded=decodeWeight(search.trim(),weightPrefix);
 const [split,setSplit]=useState({cashCents:"",debitCents:"",creditCents:"",transferCents:""});

 const parkedKey=`om_pos_parked_${shiftId}`;

 useEffect(()=>{
  try{
   const raw=localStorage.getItem(parkedKey);
   if(raw){
    const parsed=JSON.parse(raw);
    if(Array.isArray(parsed))setParked(parsed.slice(0,10));
   }
  }catch{}
 },[parkedKey]);

 const persistParked=(next:ParkedSale[])=>{
  setParked(next);
  try{
   if(next.length)localStorage.setItem(parkedKey,JSON.stringify(next));
   else localStorage.removeItem(parkedKey);
  }catch{}
 };

 const byId=useMemo(()=>new Map(lots.map(l=>[l.id,l])),[lots]);
 const byProduct=useMemo(()=>{
  const map=new Map<string,Option[]>();
  for(const l of lots){
   const list=map.get(l.productId)??[];
   list.push(l);
   map.set(l.productId,list);
  }
  return map;
 },[lots]);

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

 const sectorLabels:Record<string,string>={GROCERY:"Almacén",BUTCHERY:"Carnicería",DELI:"Fiambrería",PRODUCE:"Verdulería",OTHER:"Otros"};
 const matches=useMemo(
  ()=>lots.filter(l=>
   decoded
    ?l.unit==="KG"&&l.weightCode===decoded.plu
    :matchesSearch(search,[l.name,l.sku,l.barcode??"",l.weightCode??"",l.code,sectorLabels[l.sector??""]??""])
  ),
  [lots,search,decoded?.plu]
 );

 const lotPickerItems=useMemo<SearchPickerItem[]>(
  ()=>matches.map(l=>({
   id:l.id,
   title:l.name,
   badge:l.promotions.length?"Oferta":l.quickAccess?"★ POS":(sectorLabels[l.sector??""]??undefined),
   subtitle:`SKU ${l.sku}${l.barcode?" · EAN "+l.barcode:""}${l.weightCode?" · PLU "+l.weightCode:""} · Lote ${l.code}`,
   meta:`${sectorLabels[l.sector??""]??"Producto"} · ${l.expiry?"Vence "+l.expiry:"Sin vencimiento"}`,
   price:`${money(BigInt(l.price))}/${l.unit==="KG"?"kg":"u."}`,
   stock:`Disp: ${fixed(BigInt(l.quantity),3).replace(".",",")} ${l.unit==="KG"?"kg":"u."}`,
   searchText:[l.name,l.sku,l.barcode??"",l.weightCode??"",l.code,sectorLabels[l.sector??""]??""].join(" "),
  })),
  [matches]
 );

 const options=matches.slice(0,100);
 const chosen=byId.get(selected);
 if(chosen&&!options.some(l=>l.id===chosen.id))options.unshift(chosen);

 function addProductFEFO(productId:string,quantityStr:string){
  try{
   const productLots=byProduct.get(productId)??[];
   if(!productLots.length)throw new Error("Producto sin stock disponible");
   const unit=productLots[0].unit;
   const requested=decimal(quantityStr,3,"Cantidad");
   if(unit==="UNIT"&&requested%1000n)throw new Error("Solo unidades enteras");

   const nextCart={...cart};
   let remaining=requested;
   let distinctLots=Object.keys(nextCart).length;
   for(const lot of productLots){
    if(remaining<=0n)break;
    const used=BigInt(nextCart[lot.id]??"0");
    const avail=BigInt(lot.quantity)-used;
    if(avail<=0n)continue;
    const take=avail<remaining?avail:remaining;
    if(!nextCart[lot.id]){
     distinctLots++;
     if(distinctLots>100)throw new Error("Máximo 100 lotes por venta");
    }
    nextCart[lot.id]=(used+take).toString();
    remaining-=take;
   }
   if(remaining>0n)throw new Error("Stock insuficiente");
   setCart(nextCart);
   setSearch("");
   setSelected("");
   setQty("1");
   setError("");
   setInfo("");
   scanRef.current?.focus();
  }catch(e){
   setError(e instanceof Error?e.message:"Cantidad inválida");
  }
 }

 const choose=()=>{
  setInfo("");
  if(decoded){
   const candidates=matches;
   const reqWeight=BigInt(decoded.quantityMilli);
   const fefoLot=candidates.find(l=>BigInt(l.quantity)-BigInt(cart[l.id]??"0")>=reqWeight)??candidates[0];
   if(fefoLot){
    setSelected(fefoLot.id);
    setQty(fixed(reqWeight,3));
    setError("");
    if(candidates.length>1)setInfo(`Lote sugerido por FEFO (${fefoLot.code}).`);
   }else{
    setSelected("");
    setQty(fixed(reqWeight,3));
    setError("PLU no encontrado");
   }
   return;
  }
  if(weightPrefix&&search.trim().startsWith(weightPrefix)&&search.trim().length===13){
   setSelected("");
   setQty("");
   setError("Código de peso inválido");
   return;
  }
  const trimmed=search.trim();
  const exact=exactIndex.get(trimmed)??[];
  const productIds=new Set(exact.map(l=>l.productId));
  if(exact.length>=1&&productIds.size===1){
   const firstAvailable=exact.find(l=>BigInt(l.quantity)-BigInt(cart[l.id]??"0")>0n)??exact[0];
   const isExactLotCode=exact.length===1&&exact[0].code===trimmed;
   if(fast&&firstAvailable.unit==="UNIT"){
    if(isExactLotCode)add(firstAvailable.id,"1");
    else addProductFEFO(firstAvailable.productId,"1");
    return;
   }
   setSelected(firstAvailable.id);
   setQty(firstAvailable.unit==="UNIT"?"1":"");
   setError("");
   if(exact.length>1)setInfo(`Lote sugerido por FEFO (${firstAvailable.code}). Podés cambiarlo en la lista.`);
   quantityRef.current?.focus();
  }else{
   setSelected("");
   setError(
    exact.length>1
     ?"Hay varios productos con ese código: seleccioná el lote físico de la lista."
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
   setInfo("");
   scanRef.current?.focus();
  }catch(e){
   setError(e instanceof Error?e.message:"Cantidad inválida");
  }
 }

 const cartItems=Object.entries(cart)
  .sort(([a],[b])=>a.localeCompare(b))
  .flatMap(([id,q])=>{
   const lot=byId.get(id);
   if(!lot)return [];
   return [{lot,n:BigInt(q)}];
  });

 const lotQuotes=quoteMultiLotPromotions(
  cartItems.map(r=>({
   productId:r.lot.productId,
   unit:r.lot.unit,
   unitPrice:BigInt(r.lot.price),
   quantity:r.n,
   promotions:r.lot.promotions,
  }))
 );

 const quotes=basketQuote(
  cartItems.map((r,i)=>({
   productId:r.lot.productId,
   unit:r.lot.unit,
   unitPrice:BigInt(r.lot.price),
   quantity:r.n,
   promotions:r.lot.promotions,
   price:lotQuotes[i],
  })),
  combos,
  customerId?memberBps:0
 );

 const rows:{lot:Option;n:bigint;subtotal:bigint;total:bigint;promotionLabel:string|null}[]=cartItems.map((r,i)=>({
  lot:r.lot,
  n:r.n,
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
  return [...map.values()]
   .sort((a,b)=>Number(Boolean(b.quickAccess))-Number(Boolean(a.quickAccess)))
   .slice(0,16);
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
  const choices=lots.filter(x=>x.productId===l.productId);
  if(fast&&l.unit==="UNIT"){
   addProductFEFO(l.productId,"1");
   return;
  }
  const firstAvailable=choices.find(x=>BigInt(x.quantity)-BigInt(cart[x.id]??"0")>0n)??choices[0];
  setSearch(l.name);
  setSelected(firstAvailable?.id??"");
  setQty(l.unit==="KG"?"":"1");
  setError("");
  setInfo(choices.length>1&&firstAvailable?`Lote sugerido por FEFO (${firstAvailable.code}).`:"");
  quantityRef.current?.focus();
 };

 const parkCurrentSale=()=>{
  if(!rows.length)return;
  const entry:ParkedSale={
   id:String(Date.now()),
   savedAt:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}),
   customerId,
   cart,
  };
  persistParked([entry,...parked].slice(0,10));
  setCart({});
  setCustomerId("");
  setTendered("");
  setError("");
  setInfo("Venta guardada en pausa.");
  scanRef.current?.focus();
 };

 const resumeParkedSale=(entry:ParkedSale)=>{
  const rest=parked.filter(p=>p.id!==entry.id);
  const nextParked=rows.length
   ?[{id:String(Date.now()),savedAt:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}),customerId,cart},...rest].slice(0,10)
   :rest;
  // Keep only lots still present and clamp to available quantity
  const validCart:Record<string,string>={};
  for(const [lotId,qtyStr] of Object.entries(entry.cart)){
   const lot=byId.get(lotId);
   if(!lot)continue;
   const q=BigInt(qtyStr),max=BigInt(lot.quantity);
   if(q>0n&&max>0n)validCart[lotId]=(q>max?max:q).toString();
  }
  persistParked(nextParked);
  setCart(validCart);
  setCustomerId(customers.some(c=>c.id===entry.customerId)?entry.customerId:"");
  setError("");
  setInfo("Venta retomada desde pausa.");
  scanRef.current?.focus();
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
      <div className="v2-pos-search-anchor">
       <label>
        <span>Buscar / escanear código</span>
        <input
         ref={scanRef}
         value={search}
         onFocus={()=>{if(search.trim())setScanOpen(true);}}
         onBlur={()=>setTimeout(()=>setScanOpen(false),150)}
         onChange={e=>{
          const val=e.target.value;
          setSearch(val);
          setSelected("");
          setInfo("");
          setScanOpen(Boolean(val.trim()));
         }}
         onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();setScanOpen(false);choose();}}}
         placeholder="Escanear código EAN, PLU o buscar por nombre, SKU, lote o sector..."
        />
       </label>
       {scanOpen&&search.trim()&&matches.length>0&&(
        <div className="v2-pos-suggest" role="listbox" aria-label="Coincidencias rápidas en POS">
         {lotPickerItems.slice(0,12).map((item,idx)=>{
          const lot=matches[idx];
          return (
           <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={selected===item.id}
            className={"om-picker-opt"+(selected===item.id?" selected":"")}
            onMouseDown={e=>{
             e.preventDefault();
             setScanOpen(false);
             if(fast&&lot.unit==="UNIT"){
              add(lot.id,"1");
             }else{
              setSelected(lot.id);
              setSearch("");
              setQty(decoded?fixed(BigInt(decoded.quantityMilli),3):lot.unit==="KG"?"":"1");
              setInfo(`Seleccionado: ${lot.name} · Lote ${lot.code}`);
              quantityRef.current?.focus();
             }
            }}
           >
            <div className="om-picker-opt__main">
             <div className="om-picker-opt__head">
              <strong>{item.title}</strong>
              {item.badge&&<span className="om-picker-badge">{item.badge}</span>}
             </div>
             {item.subtitle&&<small className="mono">{item.subtitle}</small>}
             {item.meta&&<small>{item.meta}</small>}
            </div>
            <div className="om-picker-opt__right mono">
             {item.price&&<strong>{item.price}</strong>}
             {item.stock&&<small>{item.stock}</small>}
            </div>
           </button>
          );
         })}
        </div>
       )}
      </div>
      <button type="button" className="secondary" onClick={()=>{setScanOpen(false);choose();}}>
       <Icon name="search" size={16}/>
       <span>Buscar</span>
      </button>
     </div>

     <div className="om-pos-scan-bar">
      <label className="scanmode">
       <input type="checkbox" checked={fast} onChange={e=>{setFast(e.target.checked);scanRef.current?.focus();}}/>
       <span>Escaneo rápido (asigna lote por FEFO automáticamente)</span>
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
       <SearchPicker
        ariaLabel="Producto y lote"
        placeholder={`Buscar entre ${matches.length} lotes por nombre, SKU, EAN o lote...`}
        items={lotPickerItems}
        value={selected}
        onChange={id=>{
         setSelected(id);
         setQty(decoded?fixed(BigInt(decoded.quantityMilli),3):byId.get(id)?.unit==="KG"?"":"1");
        }}
       />
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
    {info&&!error&&(
     <p role="status" className="notice">
      <Icon name="info" size={16}/>
      <span>{info}</span>
     </p>
    )}

    <section className="om-card">
     <header className="om-card__head">
      <div className="om-card__heading">
       <span className="om-card__icon"><Icon name="shoppingBag" size={16}/></span>
       <div>
        <h2>Nueva venta</h2>
        <p>{rows.length} líneas · asignación FEFO / lote confirmado</p>
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
            <small className="mono">{lot.code}{lot.expiry?` · Vence ${lot.expiry}`:""}</small>
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
      <button type="button" className="secondary" disabled={!rows.length} onClick={parkCurrentSale}>
       <Icon name="clock" size={14}/>
       <span>Pausar venta</span>
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

    {parked.length>0&&(
     <section className="om-card">
      <header className="om-card__head">
       <div className="om-card__heading">
        <span className="om-card__icon"><Icon name="clock" size={16}/></span>
        <div>
         <h2>Ventas en pausa ({parked.length})</h2>
         <p>Tickets retenidos temporalmente en esta caja</p>
        </div>
       </div>
      </header>
      <div className="om-card__body--pad">
       {parked.map(entry=>{
        const count=Object.keys(entry.cart).length;
        const est=Object.entries(entry.cart).reduce((sum,[id,q])=>{
         const l=byId.get(id);
         return l?sum+(BigInt(l.price)*BigInt(q)+500n)/1000n:sum;
        },0n);
        const cust=customers.find(c=>c.id===entry.customerId);
        return (
         <div className="om-record-row" key={entry.id}>
          <div>
           <strong>{cust?cust.name:"Consumidor final"} · {count} líneas</strong>
           <small className="mono">Pausada {entry.savedAt} · Est. {money(est)}</small>
          </div>
          <div className="om-row-actions">
           <button type="button" className="secondary" onClick={()=>resumeParkedSale(entry)}>
            Retomar
           </button>
           <button
            type="button"
            className="secondary"
            aria-label="Descartar venta en pausa"
            onClick={()=>persistParked(parked.filter(p=>p.id!==entry.id))}
           >
            <Icon name="trash" size={14}/>
           </button>
          </div>
         </div>
        );
       })}
      </div>
     </section>
    )}

    <section className="om-card">
     <header className="om-card__head">
      <div className="om-card__heading">
       <span className="om-card__icon"><Icon name="grid" size={16}/></span>
       <div>
        <h2>Accesos rápidos</h2>
        <p>Productos fijados y artículos disponibles en esta sucursal</p>
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
         <strong>{l.quickAccess?"★ ":""}{l.name}</strong>
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
     {customerId&&(()=>{
      const selectedCust=customers.find(c=>c.id===customerId);
      const pts=BigInt(selectedCust?.availablePoints??"0");
      const val=BigInt(pointValueCents||"0");
      return selectedCust?(
       <small className="mono" style={{display:"block",marginTop:-4}}>
        Puntos disponibles: <strong>{String(pts)}</strong>{val>0n?` (${money(pts*val)})`:""}
       </small>
      ):null;
     })()}

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
