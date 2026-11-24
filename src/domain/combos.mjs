import {priceLine} from "./sales.mjs";
// One combo type per basket; only full groups of distinct unit products.
// Compare against individual offers and member benefit, never stack on consumed units.
// For clarity, participating lots must be consumed in full by the combo.
export function basketQuote(rows,combos,memberBps=0){
 const base=rows.map(r=>{const p=r.price;const m=memberBps>0?priceLine(r.unitPrice,r.quantity,memberBps):null;return {...p,...(m&&m.total<p.total?{...m,promotionId:null,promotionLabel:"Beneficio socio",discountBps:memberBps}:{})};});
 let best=base,bestTotal=base.reduce((a,p)=>a+p.total,0n);
 for(const c of [...combos].sort((a,b)=>a.id.localeCompare(b.id))){
  if(!Array.isArray(c.items)||c.items.length<2)continue;
  const req=new Map(c.items.map(i=>[i.productId,BigInt(i.units)*1000n]));
  if(req.size!==c.items.length||[...req.values()].some(q=>q<=0n))continue;
  const indexes=rows.map((r,i)=>req.has(r.productId)?i:-1).filter(i=>i>=0);
  const sums=new Map();let valid=true;
  for(const i of indexes){const r=rows[i];if(r.unit!=="UNIT"||r.quantity%1000n){valid=false;break;}sums.set(r.productId,(sums.get(r.productId)??0n)+r.quantity);}
  let groups=null;
  for(const [id,q] of req){const n=sums.get(id)??0n;if(n===0n||n%q){valid=false;break;}const g=n/q;if(groups!==null&&groups!==g){valid=false;break;}groups=g;}
  if(!valid||!groups)continue;
  const target=BigInt(c.priceCents)*groups,subtotal=indexes.reduce((a,i)=>a+base[i].subtotal,0n),normal=indexes.reduce((a,i)=>a+base[i].total,0n);
  if(target<0n||target>=normal||subtotal===0n)continue;
  let cumulative=0n,allocated=0n;
  const candidate=base.map(p=>({...p}));
  for(const i of indexes){cumulative+=base[i].subtotal;const next=target*cumulative/subtotal;candidate[i]={...base[i],total:next-allocated,promotionId:null,promotionLabel:c.name,discountBps:0};allocated=next;}
  const total=candidate.reduce((a,p)=>a+p.total,0n);
  if(total<bestTotal){best=candidate;bestTotal=total;}
 }
 return best;
}
