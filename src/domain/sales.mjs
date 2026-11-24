const MAX=9223372036854775807n;
export function checked(value){if(typeof value!=="bigint"||value<0n||value>MAX)throw new Error("Importe fuera de rango");return value;}
const day=s=>Date.parse(s+"T00:00:00Z")/86400000;
export function bestPromotion(promotions,lot,today){
 const candidates=promotions.filter(p=>p.active&&p.productId===lot.productId&&(!p.lotId||p.lotId===lot.id)&&p.startsOn<=today&&today<=p.endsOn&&Number.isInteger(p.discountBps)&&p.discountBps>0&&p.discountBps<10000&&
 (p.expiryWithinDays==null||(lot.expiresOn&&day(lot.expiresOn)>day(today)&&day(lot.expiresOn)-day(today)<=p.expiryWithinDays)));
 return candidates.sort((a,b)=>b.discountBps-a.discountBps||a.id.localeCompare(b.id))[0]??null;
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
