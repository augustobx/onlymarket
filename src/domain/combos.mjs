import {priceLine,quotePromotion} from "./sales.mjs";

// One combo type per basket; full groups of distinct unit products are charged at combo price,
// while any remaining extra units keep their best individual promotion or member discount.
export function basketQuote(rows,combos,memberBps=0){
 const base=rows.map(r=>{
  const p=r.price;
  const m=memberBps>0?priceLine(r.unitPrice,r.quantity,memberBps):null;
  return {...p,...(m&&m.total<p.total?{...m,promotionId:null,promotionLabel:"Beneficio socio",discountBps:memberBps}:{})};
 });
 let best=base,bestTotal=base.reduce((a,p)=>a+p.total,0n);

 for(const c of [...combos].sort((a,b)=>a.id.localeCompare(b.id))){
  if(!Array.isArray(c.items)||c.items.length<2)continue;
  const req=new Map(c.items.map(i=>[i.productId,BigInt(i.units)*1000n]));
  if(req.size!==c.items.length||[...req.values()].some(q=>q<=0n))continue;

  const indexes=rows.map((r,i)=>req.has(r.productId)?i:-1).filter(i=>i>=0);
  const sums=new Map();
  let valid=true;
  for(const i of indexes){
   const r=rows[i];
   if(r.unit!=="UNIT"||r.quantity%1000n){valid=false;break;}
   sums.set(r.productId,(sums.get(r.productId)??0n)+r.quantity);
  }
  if(!valid)continue;

  let groups=null;
  for(const [id,q] of req){
   const n=sums.get(id)??0n;
   const g=n/q;
   if(g<1n){groups=0n;break;}
   if(groups===null||g<groups)groups=g;
  }
  if(!groups||groups<1n)continue;

  const target=BigInt(c.priceCents)*groups;
  if(target<0n)continue;

  // Allocate combo-consumed units deterministically per productId.
  const remainingNeed=new Map([...req.entries()].map(([id,q])=>[id,q*groups]));
  const split=new Map();
  let comboSubtotal=0n;
  for(const i of indexes){
   const r=rows[i];
   const need=remainingNeed.get(r.productId)??0n;
   const usedQty=need>0n?(r.quantity<need?r.quantity:need):0n;
   remainingNeed.set(r.productId,need-usedQty);
   const extraQty=r.quantity-usedQty;
   const usedSub=usedQty>0n?priceLine(r.unitPrice,usedQty).subtotal:0n;
   comboSubtotal+=usedSub;
   let extraTotal=0n;
   if(extraQty>0n){
    const ep=quotePromotion(r.unitPrice,extraQty,r.unit,r.promotions??[]);
    const em=memberBps>0?priceLine(r.unitPrice,extraQty,memberBps):null;
    extraTotal=em&&em.total<ep.total?em.total:ep.total;
   }
   split.set(i,{usedQty,usedSub,extraTotal});
  }
  if(comboSubtotal===0n)continue;

  let cumulative=0n,allocated=0n;
  const candidate=base.map(p=>({...p}));
  for(const i of indexes){
   const s=split.get(i);
   if(s.usedQty===0n)continue;
   cumulative+=s.usedSub;
   const next=target*cumulative/comboSubtotal;
   const comboPart=next-allocated;
   allocated=next;
   candidate[i]={
    ...base[i],
    total:comboPart+s.extraTotal,
    promotionId:null,
    promotionLabel:c.name,
    discountBps:0,
   };
  }
  const total=candidate.reduce((a,p)=>a+p.total,0n);
  if(total<bestTotal){best=candidate;bestTotal=total;}
 }
 return best;
}
