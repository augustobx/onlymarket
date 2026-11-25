import {classifyLot} from "../domain/inventory.mjs";
type Lot={productId:string;branchId:string;expiresOn:Date|null;reviewAt:Date|null;quantityMilli:bigint;remainingCostCents:bigint;status:string;product:{alertDays:number;active:boolean}};
export function balances(lots:Lot[],today:string,day:(d:Date)=>string){
 const products=new Map<string,{usable:bigint;held:bigint;cost:bigint;heldCost:bigint}>(),branches=new Map<string,bigint>();
 const counts={BLOCKED:0,REVIEW:0,EXPIRING:0};
 for(const l of lots){const b=products.get(l.productId)??{usable:0n,held:0n,cost:0n,heldCost:0n};const state=classifyLot({today,expiresOn:l.expiresOn?.toISOString().slice(0,10)??null,reviewOn:l.reviewAt?day(l.reviewAt):null,alertDays:l.product.alertDays,status:l.status,quantityMilli:l.quantityMilli});
 if(state==="BLOCKED"||state==="REVIEW"||state==="EXPIRING")counts[state]++;
 if(l.product.active&&["AVAILABLE","EXPIRING"].includes(state)){b.usable+=l.quantityMilli;b.cost+=l.remainingCostCents;const key=l.branchId+":"+l.productId;branches.set(key,(branches.get(key)??0n)+l.quantityMilli);}else{b.held+=l.quantityMilli;b.heldCost+=l.remainingCostCents;}products.set(l.productId,b);}
 return {products,branches,counts};
}
