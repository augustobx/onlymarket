const MAX=9223372036854775807n;
export function checked(value){if(typeof value!=="bigint"||value<0n||value>MAX)throw new Error("Importe fuera de rango");return value;}
const day=s=>Date.parse(s+"T00:00:00Z")/86400000;
export function eligiblePromotions(promotions,lot,today){
 return promotions.filter(p=>p.active&&p.productId===lot.productId&&(!p.lotId||p.lotId===lot.id)&&p.startsOn<=today&&today<=p.endsOn&&
 (p.expiryWithinDays==null||(lot.expiresOn&&day(lot.expiresOn)>day(today)&&day(lot.expiresOn)-day(today)<=p.expiryWithinDays)));
}
export function bestPromotion(promotions,lot,today){
 return eligiblePromotions(promotions,lot,today).filter(p=>p.minimumMilli==null&&p.buyUnits==null&&Number.isInteger(p.discountBps)&&p.discountBps>0&&p.discountBps<10000).sort((a,b)=>b.discountBps-a.discountBps||a.id.localeCompare(b.id))[0]??null;
}
// Per physical lot, one non-stacking promotion. Compare actual cents, not advertised percentage.
export function quotePromotion(price,quantity,unit,promotions){
 const base=priceLine(price,quantity),subtotal=base.subtotal;
 let result={...base,promotionId:null,promotionLabel:null,discountBps:0};
 for(const p of promotions){
  let total=subtotal,discountBps=0;
  if(p.buyUnits!=null||p.payUnits!=null){
   if(unit!=="UNIT"||quantity%1000n!==0n||!Number.isInteger(p.buyUnits)||!Number.isInteger(p.payUnits)||p.buyUnits<2||p.buyUnits>100||p.payUnits<1||p.payUnits>=p.buyUnits)continue;
   const free=(quantity/1000n/BigInt(p.buyUnits))*BigInt(p.buyUnits-p.payUnits);
   total=checked(subtotal-free*price);
  }else{
   if(p.minimumMilli!=null&&quantity<BigInt(p.minimumMilli))continue;
   if(!Number.isInteger(p.discountBps)||p.discountBps<=0||p.discountBps>=10000)continue;
   total=priceLine(price,quantity,p.discountBps).total;discountBps=p.discountBps;
  }
  if(total<result.total||(total===result.total&&total<subtotal&&p.id.localeCompare(result.promotionId??"")<0)){
   result={subtotal,total,promotionId:p.id,promotionLabel:p.name??"Promoción",discountBps};
  }
 }
 return result;
}
export function priceLine(price,quantity,discountBps=0){
 checked(price);checked(quantity);
 if(!quantity||!Number.isInteger(discountBps)||discountBps<0||discountBps>=10000)throw new Error("Cantidad o descuento inválido");
 const subtotal=checked((price*quantity+500n)/1000n);
 const total=checked((subtotal*BigInt(10000-discountBps)+5000n)/10000n);
 return {subtotal,total};
}
export function paymentAmounts(total,method,tendered){
 checked(total);
 if(!["CASH","DEBIT","CREDIT","TRANSFER"].includes(method))throw new Error("Medio de pago inválido");
 if(method!=="CASH")return {tenderedCents:null,changeCents:null};
 checked(tendered);
 if(tendered<total)throw new Error("Efectivo recibido insuficiente");
 return {tenderedCents:tendered,changeCents:tendered-total};
}

export function paymentBreakdown(total,method,tendered,parts={}){
 checked(total);
 const values={cashCents:0n,debitCents:0n,creditCents:0n,transferCents:0n};
 const fields={CASH:"cashCents",DEBIT:"debitCents",CREDIT:"creditCents",TRANSFER:"transferCents"};
 if(method==="MIXED"){
  for(const field of Object.values(fields))values[field]=checked(parts[field]??0n);
  if(Object.values(values).filter(v=>v>0n).length<2)throw new Error("Elegí al menos dos medios de pago");
  if(Object.values(values).reduce((a,b)=>a+b,0n)!==total)throw new Error("Los medios de pago deben sumar el total");
 }else{
  if(!Object.hasOwn(fields,method))throw new Error("Medio de pago inválido");
  values[fields[method]]=total;
 }
 const cash=method==="CASH"||values.cashCents>0n;
 return {...values,...paymentAmounts(values.cashCents,cash?"CASH":"DEBIT",tendered)};
}
