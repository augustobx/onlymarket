import {createHash} from "node:crypto";
import {textField} from "../domain/parse.mjs";
import {serial,authorizeSale} from "./sales.mjs";

export async function getCustomerPointsSummary(db,tenantId,customerId=null){
 const rows=await db.$queryRaw`
  WITH refunds AS (
   SELECT "saleId",SUM("refundCents") AS amount
   FROM "SaleReturn"
   WHERE "tenantId"=${tenantId}
   GROUP BY "saleId"
  ),
  net AS (
   SELECT s."customerId",s."totalCents"-COALESCE(r.amount,0) AS amount,s."pointsRateCents" AS rate
   FROM "Sale" s
   LEFT JOIN refunds r ON r."saleId"=s.id
   LEFT JOIN "SaleCancellation" c ON c."tenantId"=s."tenantId" AND c."saleId"=s.id
   WHERE s."tenantId"=${tenantId}
     AND s."customerId" IS NOT NULL
     AND (${customerId}::text IS NULL OR s."customerId"=${customerId})
     AND c.id IS NULL
  ),
  earned_by_customer AS (
   SELECT "customerId" AS id,
          COUNT(*) FILTER(WHERE amount>0)::bigint AS visits,
          COALESCE(SUM(amount),0)::bigint AS net,
          COALESCE(SUM(FLOOR(amount/NULLIF(rate,0))),0)::bigint AS earned
   FROM net
   GROUP BY "customerId"
  ),
  redeemed_by_customer AS (
   SELECT "customerId" AS id,
          COALESCE(SUM("points"),0)::bigint AS redeemed,
          COALESCE(SUM("valueCents"),0)::bigint AS redeemed_value
   FROM "PointRedemption"
   WHERE "tenantId"=${tenantId}
     AND (${customerId}::text IS NULL OR "customerId"=${customerId})
   GROUP BY "customerId"
  )
  SELECT COALESCE(e.id,r.id) AS id,
         COALESCE(e.visits,0)::bigint AS visits,
         COALESCE(e.net,0)::bigint AS net,
         COALESCE(e.earned,0)::bigint AS earned,
         COALESCE(r.redeemed,0)::bigint AS redeemed,
         COALESCE(r.redeemed_value,0)::bigint AS "redeemedValue",
         GREATEST(COALESCE(e.earned,0)-COALESCE(r.redeemed,0),0)::bigint AS available
  FROM earned_by_customer e
  FULL OUTER JOIN redeemed_by_customer r ON r.id=e.id`;
 return rows;
}

export async function redeemPoints(prisma,s,input){
 const customerId=textField(input.customerId,"Socio");
 const requestKey=textField(input.requestKey,"Operación");
 const reason=textField(input.reason,"Motivo",300);
 const rawPoints=String(input.points??"").trim();
 if(!/^\d{1,7}$/.test(rawPoints))throw new Error("Cantidad de puntos inválida");
 const points=BigInt(rawPoints);
 if(points<=0n||points>1000000n)throw new Error("Cantidad de puntos fuera de rango");
 const requestHash=createHash("sha256").update(JSON.stringify([s.actorUserId,customerId,points.toString(),reason])).digest("hex");

 return serial(prisma,async tx=>{
  await authorizeSale(tx,s,["OWNER","MANAGER","CASHIER"]);
  const existing=await tx.pointRedemption.findUnique({where:{tenantId_requestKey:{tenantId:s.tenantId,requestKey}}});
  if(existing){
   if(existing.requestHash!==requestHash)throw new Error("Operación duplicada con otros datos");
   return existing;
  }
  const customer=await tx.customer.findUnique({where:{tenantId_id:{tenantId:s.tenantId,id:customerId}},include:{tenant:{select:{pointValueCents:true}}}});
  if(!customer?.active)throw new Error("Socio inactivo o inexistente");
  const summary=await getCustomerPointsSummary(tx,s.tenantId,customerId);
  const available=summary[0]?.available??0n;
  if(points>available)throw new Error("Puntos insuficientes");
  const valueCents=points*customer.tenant.pointValueCents;
  return tx.pointRedemption.create({
   data:{
    tenantId:s.tenantId,
    customerId,
    actorId:s.actorUserId,
    requestKey,
    requestHash,
    points,
    valueCents,
    reason,
   },
  });
 });
}
