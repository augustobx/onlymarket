import Link from "next/link";
import {notFound} from "next/navigation";
import {db} from "../../../src/server/db";
import {requireSession} from "../../../src/server/auth";
import {classifyLot} from "../../../src/domain/inventory.mjs";
import {localDay} from "../../../src/domain/parse.mjs";
import {states} from "../../ui";
import Label from "./label";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{id:string}>}){
 const s=await requireSession(),{id}=await params;
 if(!["OWNER","MANAGER","INVENTORY"].includes(s.role))notFound();
 const l=await db.lot.findUnique({where:{tenantId_id:{tenantId:s.tenantId,id}},include:{product:true,branch:true}});if(!l||l.quantityMilli<=0n)notFound();
 const expiry=l.expiresOn?.toISOString().slice(0,10)??null,state=classifyLot({today:localDay(),expiresOn:expiry,reviewOn:l.reviewAt?localDay(l.reviewAt):null,alertDays:l.product.alertDays,status:l.status,quantityMilli:l.quantityMilli});
 return <><div className="labeltools labelback"><Link href={"/inventario?lot="+l.id}>Volver al lote</Link></div><Label data={{name:l.product.name,tenant:s.tenantName,branch:l.branch.name,code:l.code,sku:l.product.sku,barcode:l.product.barcode,unit:l.product.unit,balance:l.quantityMilli.toString(),price:l.product.salePriceCents.toString(),received:localDay(l.receivedAt),expiry,opened:l.openedAt?localDay(l.openedAt):null,state:states[state],allowed:l.product.active&&["AVAILABLE","EXPIRING"].includes(state)}}/></>;
}
