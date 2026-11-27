"use client";
import {useState,useRef,useMemo,useEffect} from "react";
import {useFormStatus} from "react-dom";
import Link from "next/link";
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
type CatalogHint={
 id:string;
 name:string;
 sku:string;
 barcode:string|null;
 weightCode:string|null;
 unit:string;
 sector:string;
 price:string;
 hasBlockedInBranch:boolean;
 otherBranches:{branchName:string;quantity:string}[];
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

const sectorLabels:Record<string,string>={
 GROCERY:"Almacén",
 BUTCHERY:"Carnicería",
 DELI:"Fiambrería",
 PRODUCE:"Verdulería",
 OTHER:"Otros",
};

const fixed=(n:bigint,scale:number)=>{
 const a=n.toString().padStart(scale+1,"0");
 return a.slice(0,-scale)+"."+a.slice(-scale);
};
const money=(n:bigint)=>"$ "+fixed(n,2).replace(".",",");
const formatHintQty=(quantity:string,unit:string)=>`${fixed(BigInt(quantity),3).replace(/\.000$/,"")} ${unit==="KG"?"kg":"u."}`;
const formatBranchList=(hint:CatalogHint)=>hint.otherBranches.map(b=>`${b.branchName} (${formatHintQty(b.quantity,hint.unit)})`).join(", ");

function Submit({disabled}:{disabled:boolean}){
 const {pending}=useFormStatus();
 return (
  <button className="om-pos-charge" disabled={disabled||pending}>
   <Icon name="check" size={19}/>
   <span>{pending?"Registrando venta...":"Confirmar venta"}</span>
  </button>
 );
}

function TicketQtyEditor({
 lot,
 n,
 onStepMinus,
 onStepPlus,
 onCommitMilli,
 onRemove,
 onError,
}:{
 lot:Option;
 n:bigint;
 onStepMinus:()=>void;
 onStepPlus:()=>void;
 onCommitMilli:(nextMilli:bigint)=>void;
 onRemove:()=>void;
 onError:(msg:string)=>void;
}){
 const maxQty=BigInt(lot.quantity);
 const formatVal=(val:bigint)=>lot.unit==="UNIT"?(val/1000n).toString():fixed(val,3);
 const [draft,setDraft]=useState(()=>formatVal(n));
 useEffect(()=>{setDraft(formatVal(n));},[n,lot.unit]);

 if(lot.unit==="UNIT"){
  return (
   <div className="qtybuttons">
    <button type="button" className="secondary" aria-label={"Restar una unidad de "+lot.name} onClick={onStepMinus}>
     −
    </button>
    <input
     type="text"
     inputMode="numeric"
     className="om-pos-qtyinput"
     aria-label={"Cantidad de "+lot.name}
     value={draft}
     onFocus={e=>e.currentTarget.select()}
     onChange={e=>{
      const v=e.target.value;
      setDraft(v);
      if(!/^\d+$/.test(v))return;
      const parsed=BigInt(v)*1000n;
      if(parsed===0n)return;
      if(parsed>maxQty){onError(`Stock insuficiente en lote ${lot.code} (máx. ${maxQty/1000n} u.)`);return;}
      onError("");
      onCommitMilli(parsed);
     }}
     onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();e.currentTarget.blur();}}}
     onBlur={()=>{
      const t=draft.trim();
      if(t==="0"){onRemove();return;}
      if(!/^\d+$/.test(t)||BigInt(t)*1000n>maxQty){setDraft(formatVal(n));}
     }}
    />
    <button
     type="button"
     className="secondary"
     aria-label={"Sumar una unidad de "+lot.name}
     disabled={n+1000n>maxQty}
     onClick={onStepPlus}
    >
     +
    </button>
   </div>
  );
 }

 return (
  <label className="om-pos-kg-edit">
   <input
    type="text"
    inputMode="decimal"
    className="om-pos-qtyinput om-pos-qtyinput--kg"
    aria-label={"Peso en kg de "+lot.name}
    value={draft}
    onFocus={e=>e.currentTarget.select()}
    onChange={e=>{
     const v=e.target.value;
     setDraft(v);
     try{
      const parsed=decimal(v,3,"Cantidad");
      if(parsed>maxQty){onError(`Stock insuficiente en lote ${lot.code} (máx. ${fixed(maxQty,3)} kg)`);return;}
      onError("");
      onCommitMilli(parsed);
     }catch{}
    }}
    onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();e.currentTarget.blur();}}}
    onBlur={()=>{
     try{
      const parsed=decimal(draft,3,"Cantidad");
      if(parsed<=maxQty){setDraft(formatVal(parsed));return;}
     }catch{}
     setDraft(formatVal(n));
    }}
   />
   <span className="mono om-pos-kg">kg</span>
  </label>
 );
}

export default function Cart({
 lots,
 catalogHints=[],
 branchName="",
 shiftId,
 requestKey,
 customers,
 weightPrefix,
 memberBps,
 pointValueCents="0",
 combos,
}:{
 lots:Option[];
 catalogHints?:CatalogHint[];
 branchName?:string;
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
 const [suggestIndex,setSuggestIndex]=useState(0);
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

 const barcodeIndex=useMemo(()=>{
  const index=new Map<string,Option[]>();
  for(const l of lots){
   if(!l.barcode)continue;
   const group=index.get(l.barcode)??[];
   group.push(l);
   index.set(l.barcode,group);
  }
  return index;
 },[lots]);

 const matches=useMemo(
  ()=>lots.filter(l=>
   decoded
    ?l.unit==="KG"&&l.weightCode===decoded.plu
    :matchesSearch(search,[l.name,l.sku,l.barcode??"",l.weightCode??"",l.code,sectorLabels[l.sector??""]??""])
  ),
  [lots,search,decoded?.plu]
 );

 const catalogMatches=useMemo(()=>{
  if(!search.trim()||decoded)return [];
  return catalogHints.filter(p=>
   matchesSearch(search,[p.name,p.sku,p.barcode??"",p.weightCode??"",sectorLabels[p.sector]??p.sector])
  ).slice(0,8);
 },[catalogHints,search,decoded]);

 const branchStockSummary=useMemo(()=>{
  const branchesWithStock=new Set<string>();
  let productsElsewhere=0;
  for(const p of catalogHints){
   if(p.otherBranches.length>0){
    productsElsewhere++;
    for(const ob of p.otherBranches)branchesWithStock.add(ob.branchName);
   }
  }
  return {productsElsewhere,branches:[...branchesWithStock]};
 },[catalogHints]);

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

 const explainMissingHint=(hint:CatalogHint)=>{
  setScanOpen(false);
  if(hint.otherBranches.length>0){
   const where=formatBranchList(hint);
   setError(
    hint.hasBlockedInBranch
     ?`"${hint.name}" tiene lotes vencidos o en revisión en ${branchName||"esta sucursal"}. Disponible en: ${where}.`
     :`"${hint.name}" no tiene stock en ${branchName||"esta sucursal"}. Disponible en: ${where}.`
   );
  }else if(hint.hasBlockedInBranch){
   setError(`"${hint.name}" tiene lotes en ${branchName||"esta sucursal"}, pero están vencidos o en revisión.`);
  }else{
   setError(`"${hint.name}" existe en el catálogo, pero no tiene stock cargado en ninguna sucursal.`);
  }
 };

 const pickLotOrFast=(lot:Option,pref?:string)=>{
  if(fast){
   add(lot.id,pref??(decoded?fixed(BigInt(decoded.quantityMilli),3):"1"));
   return;
  }
  setSelected(lot.id);
  setSearch("");
  setScanOpen(false);
  setQty(pref??(decoded?fixed(BigInt(decoded.quantityMilli),3):lot.unit==="KG"?"":"1"));
  setError("");
  setInfo(`Seleccionado: ${lot.name} · Lote ${lot.code}`);
  quantityRef.current?.focus();
 };

 const tryAutoScan=(raw:string)=>{
  const trimmed=raw.trim();
  if(!fast||!trimmed)return false;
  const w=decodeWeight(trimmed,weightPrefix);
  if(w){
   const candidates=lots.filter(l=>l.unit==="KG"&&l.weightCode===w.plu);
   const reqWeight=BigInt(w.quantityMilli);
   const fefoLot=candidates.find(l=>BigInt(l.quantity)-BigInt(cart[l.id]??"0")>=reqWeight)??candidates[0];
   if(fefoLot){
    setScanOpen(false);
    addProductFEFO(fefoLot.productId,fixed(reqWeight,3));
    return true;
   }
   return false;
  }
  if(trimmed.length>=6){
   const bMatches=barcodeIndex.get(trimmed)??[];
   const bPids=new Set(bMatches.map(l=>l.productId));
   if(bMatches.length>=1&&bPids.size===1){
    const hasPrefixExtension=lots.some(l=>l.barcode&&l.barcode!==trimmed&&l.barcode.startsWith(trimmed));
    if(!hasPrefixExtension){
     setScanOpen(false);
     addProductFEFO(bMatches[0].productId,"1");
     return true;
    }
   }
  }
  return false;
 };

 const choose=(fromKeyboard=false)=>{
  setInfo("");
  const trimmed=search.trim();
  if(!trimmed){
   setError("");
   scanRef.current?.focus();
   return;
  }
  if(decoded){
   const candidates=matches;
   const reqWeight=BigInt(decoded.quantityMilli);
   const fefoLot=candidates.find(l=>BigInt(l.quantity)-BigInt(cart[l.id]??"0")>=reqWeight)??candidates[0];
   if(fefoLot){
    if(fast){
     setScanOpen(false);
     addProductFEFO(fefoLot.productId,fixed(reqWeight,3));
     return;
    }
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
  if(weightPrefix&&trimmed.startsWith(weightPrefix)&&trimmed.length===13){
   setSelected("");
   setQty("");
   setError("Código de peso inválido");
   return;
  }
  const exact=exactIndex.get(trimmed)??[];
  const productIds=new Set(exact.map(l=>l.productId));
  if(exact.length>=1&&productIds.size===1){
   const firstAvailable=exact.find(l=>BigInt(l.quantity)-BigInt(cart[l.id]??"0")>0n)??exact[0];
   const isExactLotCode=exact.length===1&&exact[0].code===trimmed;
   setScanOpen(false);
   if(fast){
    if(isExactLotCode)add(firstAvailable.id,"1");
    else addProductFEFO(firstAvailable.productId,"1");
    return;
   }
   setSelected(firstAvailable.id);
   setQty(firstAvailable.unit==="UNIT"?"1":"");
   setError("");
   if(exact.length>1)setInfo(`Lote sugerido por FEFO (${firstAvailable.code}). Podés cambiarlo en la lista.`);
   quantityRef.current?.focus();
   return;
  }

  const matchedProductIds=new Set(matches.map(l=>l.productId));
  if(exact.length===0&&trimmed&&matchedProductIds.size===1){
   const onlyLot=matches.find(l=>BigInt(l.quantity)-BigInt(cart[l.id]??"0")>0n)??matches[0];
   if(onlyLot){
    setScanOpen(false);
    if(fast){
     addProductFEFO(onlyLot.productId,"1");
     return;
    }
    setSelected(onlyLot.id);
    setSearch("");
    setQty(onlyLot.unit==="UNIT"?"1":"");
    setError("");
    if(matches.length>1)setInfo(`Lote sugerido por FEFO (${onlyLot.code}).`);
    else setInfo(`Seleccionado: ${onlyLot.name} · Lote ${onlyLot.code}`);
    quantityRef.current?.focus();
    return;
   }
  }

  if(fromKeyboard&&scanOpen&&trimmed&&matches.length>0){
   const activeLot=matches[Math.min(suggestIndex,Math.min(11,matches.length-1))];
   if(activeLot){
    pickLotOrFast(activeLot);
    return;
   }
  }

  if(matches.length>0&&trimmed){
   setError("");
   setScanOpen(true);
   setSuggestIndex(0);
   setInfo(`Encontramos ${matchedProductIds.size} productos coincidentes. Usá ↑ ↓ + Enter o hacé clic.`);
   scanRef.current?.focus();
   return;
  }

  if(matches.length===0&&catalogMatches.length===1){
   explainMissingHint(catalogMatches[0]);
   return;
  }
  if(matches.length===0&&catalogMatches.length>1){
   setScanOpen(true);
   setError("");
   setInfo(`Encontramos ${catalogMatches.length} artículos del catálogo sin stock disponible en ${branchName||"esta sucursal"}.`);
   return;
  }

  setSelected("");
  setError(
   exact.length>1
    ?"Hay varios productos con ese código: seleccioná el lote físico de la lista."
    :matches.length===0
     ?"Producto o código no encontrado / sin stock"
     :"Escribí un nombre, SKU, código o seleccioná un lote."
  );
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

 const subtotalSum=rows.reduce((a,r)=>a+r.subtotal,0n);
 const total=rows.reduce((a,r)=>a+r.total,0n);
 const totalSavings=subtotalSum-total;

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
   .slice(0,36);
 },[lots,sectorFilter]);

 useEffect(()=>{
  scanRef.current?.focus();
  const key=(e:KeyboardEvent)=>{
   if(document.querySelector("dialog[open]"))return;
   if(e.key==="F2"){e.preventDefault();scanRef.current?.focus();}
   else if(e.key==="F4"){e.preventDefault();quantityRef.current?.focus();}
   else if(e.key==="F12"){e.preventDefault();document.querySelector<HTMLButtonElement>(".om-pos-charge:not(:disabled)")?.focus();}
  };
  window.addEventListener("keydown",key);
  return ()=>window.removeEventListener("keydown",key);
 },[]);

 const selectQuick=(l:Option)=>{
  const choices=lots.filter(x=>x.productId===l.productId);
  if(fast){
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
  const base=[100000n,200000n,500000n,1000000n,2000000n,5000000n];
  return base.filter(v=>v>=total).slice(0,4);
 },[total]);

 return (
  <section className="om-pos-deck">
   <div className="om-pos-catalog">
    <div className="om-pos-searchbar">
     <div className="om-pos-searchbar__top">
      <div className="v2-pos-search-anchor">
       <label className="om-pos-searchfield">
        <span className="om-sr-label">Buscar / escanear código</span>
        <div className="om-pos-searchbox">
         <Icon name="search" size={18}/>
         <input
          ref={scanRef}
          value={search}
          onFocus={()=>{if(search.trim())setScanOpen(true);}}
          onBlur={()=>setTimeout(()=>setScanOpen(false),150)}
          onChange={e=>{
           const val=e.target.value;
           if(tryAutoScan(val))return;
           setSearch(val);
           setSelected("");
           setInfo("");
           setError("");
           setSuggestIndex(0);
           setScanOpen(Boolean(val.trim()));
          }}
          onKeyDown={e=>{
           const count=Math.min(12,matches.length);
           if(e.key==="ArrowDown"&&count>0){
            e.preventDefault();
            if(!scanOpen)setScanOpen(true);
            else setSuggestIndex(i=>Math.min(count-1,i+1));
           }else if(e.key==="ArrowUp"&&scanOpen){
            e.preventDefault();
            setSuggestIndex(i=>Math.max(0,i-1));
           }else if(e.key==="Escape"&&scanOpen){
            e.preventDefault();
            setScanOpen(false);
           }else if(e.key==="Enter"){
            e.preventDefault();
            choose(true);
           }
          }}
          placeholder="Buscar producto por nombre, SKU, PLU o escanear código..."
         />
         {search&&(
          <button
           type="button"
           className="om-picker-clear"
           aria-label="Limpiar búsqueda"
           onMouseDown={e=>{e.preventDefault();setSearch("");setScanOpen(false);scanRef.current?.focus();}}
          >
           <Icon name="x" size={15}/>
          </button>
         )}
        </div>
       </label>

       {scanOpen&&search.trim()&&(
        <div className="v2-pos-suggest" role="listbox" aria-label="Coincidencias rápidas en POS">
         {lotPickerItems.slice(0,12).map((item,idx)=>{
          const lot=matches[idx];
          const isActive=idx===suggestIndex;
          return (
           <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={selected===item.id||isActive}
            className={"om-picker-opt"+(isActive?" active":"")+(selected===item.id?" selected":"")}
            onMouseEnter={()=>setSuggestIndex(idx)}
            onMouseDown={e=>{
             e.preventDefault();
             pickLotOrFast(lot);
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

         {catalogMatches.map(hint=>{
          const where=hint.otherBranches.length>0?formatBranchList(hint):"";
          const branchInfo=hint.otherBranches.length>0
           ?(hint.hasBlockedInBranch
            ?`En ${branchName||"esta sucursal"} hay lotes vencidos o en revisión · Disponible en: ${where}`
            :`Disponible en: ${where}`)
           :hint.hasBlockedInBranch
            ?`En ${branchName||"esta sucursal"} solo hay lotes vencidos o en revisión`
            :"Sin stock ingresado en ninguna sucursal";
          return (
           <button
            key={"hint-"+hint.id}
            type="button"
            role="option"
            aria-selected={false}
            className="om-picker-opt om-picker-opt--muted"
            onMouseDown={e=>{
             e.preventDefault();
             explainMissingHint(hint);
            }}
           >
            <div className="om-picker-opt__main">
             <div className="om-picker-opt__head">
              <strong>{hint.name}</strong>
              <span className="om-picker-badge om-picker-badge--warn">
               {hint.otherBranches.length>0?"En otra sucursal":`Sin stock en ${branchName||"sucursal"}`}
              </span>
             </div>
             <small className="mono">SKU {hint.sku}{hint.barcode?" · EAN "+hint.barcode:""}</small>
             <small>{branchInfo}</small>
            </div>
            <div className="om-picker-opt__right mono">
             <strong>{money(BigInt(hint.price))}/{hint.unit==="KG"?"kg":"u."}</strong>
             <small>0 disp.</small>
            </div>
           </button>
          );
         })}

         {lotPickerItems.length===0&&catalogMatches.length===0&&(
          <div className="om-picker-empty">Sin coincidencias en catálogo para &ldquo;{search}&rdquo;</div>
         )}
        </div>
       )}
      </div>

      <button type="button" className="secondary om-pos-searchbtn" onMouseDown={e=>e.preventDefault()} onClick={()=>choose(false)}>
       Buscar
      </button>
     </div>

     <div className="om-pos-searchbar__meta">
      <label className="om-pos-fasttoggle">
       <input type="checkbox" checked={fast} onChange={e=>{setFast(e.target.checked);scanRef.current?.focus();}}/>
       <span>Escaneo rápido</span>
       <small>Agrega directo al ticket (editable en la lista)</small>
      </label>
      {weightPrefix&&(
       <span className="status AVAILABLE">Balanza {weightPrefix}</span>
      )}
     </div>
    </div>

    {error&&(
     <p role="alert" className="error om-pos-alert">
      <Icon name="alert" size={16}/>
      <span>{error}</span>
     </p>
    )}
    {info&&!error&&(
     <p role="status" className="notice om-pos-alert">
      <Icon name="info" size={16}/>
      <span>{info}</span>
     </p>
    )}

    <div className="om-pos-manual">
     <div className="om-pos-manual__picker">
      <SearchPicker
       ariaLabel="Producto y lote"
       placeholder={lots.length?`Buscar lote manual (${lots.length} lotes en ${branchName||"sucursal"})...`:"Sin lotes disponibles en esta sucursal"}
       items={lotPickerItems}
       value={selected}
       onChange={id=>{
        if(!id){setSelected("");return;}
        if(fast){
         add(id,decoded?fixed(BigInt(decoded.quantityMilli),3):"1");
         return;
        }
        setSelected(id);
        setQty(decoded?fixed(BigInt(decoded.quantityMilli),3):byId.get(id)?.unit==="KG"?"":"1");
       }}
      />
     </div>
     <label className="om-pos-manual__qty">
      <span className="om-sr-label">Cantidad (kg o unidades)</span>
      <input
       ref={quantityRef}
       aria-label="Cantidad (kg o unidades)"
       value={qty}
       onChange={e=>setQty(e.target.value)}
       inputMode="decimal"
       placeholder="Cant."
       onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();add();}}}
      />
     </label>
     <button type="button" onClick={()=>add()}>
      <Icon name="plus" size={16}/>
      <span>Agregar</span>
     </button>
    </div>

    <div className="om-pos-categories" role="tablist" aria-label="Sectores de productos">
     {sectorTabs.map(([k,label,ic])=>(
      <button
       key={k}
       type="button"
       role="tab"
       aria-selected={sectorFilter===k}
       className={"om-pos-cat"+(sectorFilter===k?" active":"")}
       onClick={()=>setSectorFilter(k)}
      >
       <Icon name={ic} size={14}/>
       <span>{label}</span>
      </button>
     ))}
    </div>

    {lots.length===0?(
     <div className="om-pos-empty-branch">
      <Icon name="store" size={26}/>
      <div>
       <strong>{branchName||"Esta sucursal"} no tiene lotes con stock disponible</strong>
       {branchStockSummary.productsElsewhere>0?(
        <p>
         Hay <strong>{branchStockSummary.productsElsewhere} productos</strong> con stock en{" "}
         <strong>{branchStockSummary.branches.join(" y ")}</strong>. Tocá{" "}
         <strong>Realizar arqueo</strong> arriba para cerrar este turno y abrir caja en esa sucursal, o{" "}
         <Link href="/inventario?view=recepcion">recibí mercadería acá</Link>.
        </p>
       ):(
        <p>Cargá stock desde <Link href="/inventario?view=recepcion">Compras y recepción</Link> para empezar a vender.</p>
       )}
      </div>
     </div>
    ):quick.length>0?(
     <div className="om-pos-tile-grid">
      {quick.map(l=>(
       <button
        className="om-pos-tile"
        data-sector={l.sector??"OTHER"}
        key={l.productId}
        type="button"
        onClick={()=>selectQuick(l)}
       >
        <div className="om-pos-tile__top">
         <span className="om-pos-tile__sector">{sectorLabels[l.sector??""]??"General"}</span>
         {l.quickAccess&&<span className="om-pos-tile__pin">★</span>}
        </div>
        <strong>{l.name}</strong>
        <div className="om-pos-tile__foot">
         <span>{money(BigInt(l.price))}</span>
         <span className="om-pos-tile__unit">{l.unit==="KG"?"kg":"u."}</span>
        </div>
       </button>
      ))}
     </div>
    ):(
     <div className="om-empty">
      <span className="om-empty__icon"><Icon name="box" size={20}/></span>
      <strong>Sin artículos en este sector</strong>
      <p>Elegí otro sector arriba o buscá por nombre / código.</p>
     </div>
    )}
   </div>

   <aside className="om-pos-terminal">
    <div className="om-pos-terminal__head">
     <div className="om-pos-terminal__title">
      <span className="om-card__icon"><Icon name="receipt" size={16}/></span>
      <div>
       <h2>Nueva venta</h2>
       <small>{rows.length} {rows.length===1?"ítem":"ítems"} · FEFO automático</small>
      </div>
     </div>
     <div className="om-pos-terminal__tools">
      <button type="button" className="secondary" disabled={!rows.length} onClick={parkCurrentSale}>
       <Icon name="clock" size={14}/>
       <span>Pausar venta</span>
      </button>
      <button
       type="button"
       className="secondary"
       disabled={!rows.length}
       aria-label="Vaciar venta"
       onClick={()=>{if(window.confirm("¿Vaciar la venta actual?")){setCart({});scanRef.current?.focus();}}}
      >
       <Icon name="trash" size={14}/>
      </button>
     </div>
    </div>

    {parked.length>0&&(
     <div className="om-pos-parked">
      <div className="om-pos-parked__head">
       <Icon name="clock" size={14}/>
       <strong>{parked.length} {parked.length===1?"venta en pausa":"ventas en pausa"}</strong>
      </div>
      {parked.map(entry=>{
       const count=Object.keys(entry.cart).length;
       const est=Object.entries(entry.cart).reduce((sum,[id,q])=>{
        const l=byId.get(id);
        return l?sum+(BigInt(l.price)*BigInt(q)+500n)/1000n:sum;
       },0n);
       const cust=customers.find(c=>c.id===entry.customerId);
       return (
        <div className="om-pos-parked__row" key={entry.id}>
         <div>
          <strong>{cust?cust.name:"Consumidor final"} ({count})</strong>
          <small className="mono">{entry.savedAt} · {money(est)}</small>
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
           <Icon name="x" size={13}/>
          </button>
         </div>
        </div>
       );
      })}
     </div>
    )}

    <form action={saleAction} className="om-pos-form">
     <input type="hidden" name="shiftId" value={shiftId}/>
     <input type="hidden" name="requestKey" value={requestKey}/>
     <input type="hidden" name="lines" value={JSON.stringify(rows.map(r=>({lotId:r.lot.id,quantity:fixed(r.n,3)})))}/>
     <input type="hidden" name="quotedTotal" value={fixed(total,2)}/>

     <div className="om-pos-customer">
      <label>
       <span>Cliente (opcional)</span>
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
        <small className="mono om-pos-pts">
         Puntos: <strong>{String(pts)}</strong>{val>0n?` (${money(pts*val)})`:""}
        </small>
       ):null;
      })()}
     </div>

     <div className="om-pos-ticket">
      {rows.length>0?(
       <div className="om-pos-lines">
        {rows.map(({lot,n,total:lineTotal,promotionLabel,subtotal})=>(
         <div className="om-pos-line" key={lot.id}>
          <div className="om-pos-line__info">
           <strong>{lot.name}</strong>
           <small className="mono">
            {money(BigInt(lot.price))}/{lot.unit==="KG"?"kg":"u."} · Lote {lot.code}
            {lot.expiry?` · Vto ${lot.expiry}`:""}
           </small>
           {promotionLabel&&(
            <span className="om-pos-promo">
             {promotionLabel}
             {subtotal>lineTotal?` (−${money(subtotal-lineTotal)})`:""}
            </span>
           )}
          </div>
          <div className="om-pos-line__qty">
           <TicketQtyEditor
            lot={lot}
            n={n}
            onStepMinus={()=>{
             if(n<=1000n){const next={...cart};delete next[lot.id];setCart(next);}
             else setCart({...cart,[lot.id]:(n-1000n).toString()});
            }}
            onStepPlus={()=>add(lot.id,"1")}
            onCommitMilli={nextMilli=>setCart({...cart,[lot.id]:nextMilli.toString()})}
            onRemove={()=>{const next={...cart};delete next[lot.id];setCart(next);}}
            onError={setError}
           />
          </div>
          <div className="om-pos-line__price">
           <strong className="mono">{money(lineTotal)}</strong>
           <button
            type="button"
            className="om-pos-rm"
            aria-label={"Quitar "+lot.name}
            onClick={()=>{const next={...cart};delete next[lot.id];setCart(next);}}
           >
            <Icon name="x" size={13}/>
           </button>
          </div>
         </div>
        ))}
       </div>
      ):(
       <div className="om-pos-ticket-empty">
        <Icon name="barcode" size={24}/>
        <strong>Ticket vacío</strong>
        <p>Escaneá un código o tocá un artículo a la izquierda para empezar.</p>
       </div>
      )}
     </div>

     <div className="om-pos-display">
      <div className="om-pos-display__rows">
       <div>
        <span>Subtotal</span>
        <strong className="mono">{money(subtotalSum)}</strong>
       </div>
       {totalSavings>0n&&(
        <div className="om-pos-display__save">
         <span>Descuentos / promos</span>
         <strong className="mono">− {money(totalSavings)}</strong>
        </div>
       )}
      </div>
      <div className="om-pos-display__total">
       <span>TOTAL A COBRAR</span>
       <h2 className="total">{money(total)}</h2>
      </div>
     </div>

     <div className="om-pos-pay">
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

      {payment==="MIXED"&&(
       <div className="om-pos-mixed">
        {methods.map(([k,label])=>(
         <label key={k}>
          <span>{label}</span>
          <input name={k} value={split[k]} inputMode="decimal" onChange={e=>setSplit(old=>({...old,[k]:e.target.value}))}/>
         </label>
        ))}
        <small className="mono">Asignado: {money(splitTotal)} / {money(total)}</small>
       </div>
      )}

      {needsCash&&(
       <div className="om-pos-cashbox">
        <label>
         <span>Efectivo recibido</span>
         <input name="tendered" value={tendered} onChange={e=>setTendered(e.target.value)} inputMode="decimal" required placeholder="0,00"/>
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
       </div>
      )}

      {change!==null&&(
       <div className="om-pos-change">
        <span>Vuelto a entregar</span>
        <strong className="mono">{money(change)}</strong>
       </div>
      )}

      <Submit disabled={!rows.length||!validPayment}/>
     </div>
    </form>
   </aside>
  </section>
 );
}
