export const refundFields=["cashCents","debitCents","creditCents","transferCents"];
// Cumulative rounded allocation ensures the last return reconciles every cent.
export function returnQuote(line,previous,quantity){
 const q=BigInt(line.quantityMilli),done=BigInt(previous.quantityMilli??0),next=done+quantity;
 if(quantity<=0n||q<=0n||done<0n||next>q)throw new Error("Cantidad supera el saldo devolvible");
 const share=(value,n)=>(BigInt(value)*n+q/2n)/q;
 return {refundCents:share(line.totalCents,next)-share(line.totalCents,done),costCents:share(line.costCents,next)-share(line.costCents,done)};
}
export function refundAllocation(sale,prior,refund){
 if(refund<0n)throw new Error("Reintegro inválido");
 let remaining=refund;
 const parts={};
 // Electronic methods first, cash last; never exceed the original payment.
 for(const k of ["debitCents","creditCents","transferCents","cashCents"]){
  const available=BigInt(sale[k])-BigInt(prior[k]??0);
  if(available<0n)throw new Error("Saldo de reintegro inválido");
  parts[k]=remaining<available?remaining:available;remaining-=parts[k];
 }
 if(remaining!==0n)throw new Error("Reintegro supera el pago original");
 return parts;
}
