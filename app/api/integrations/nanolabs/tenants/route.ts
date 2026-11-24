import {timingSafeEqual} from "node:crypto";
import {db} from "../../../../../src/server/db";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
export async function GET(req:Request){
 const expected=Buffer.from(process.env.HUB_INTEGRATION_TOKEN??""),header=req.headers.get("authorization")??"",supplied=Buffer.from(header.startsWith("Bearer ")?header.slice(7):"");
 if(expected.length<32||supplied.length!==expected.length||!timingSafeEqual(expected,supplied))return Response.json({success:false,error:"Unauthorized"},{status:401,headers});
 const value=new URL(req.url).searchParams.get("offset")??"0",offset=Number(value);
 if(!/^\d+$/.test(value)||!Number.isSafeInteger(offset)||offset>100000)return Response.json({success:false,error:"Invalid offset"},{status:400,headers});
 try{
 const rows=await db.tenant.findMany({skip:offset,take:101,orderBy:[{createdAt:"desc"},{id:"asc"}],select:{id:true,slug:true,name:true,createdAt:true,_count:{select:{products:true}}}});
 return Response.json({success:true,contract:"nanolabs.saas.tenants.v1",product:"onlymarket",capturedAt:new Date().toISOString(),tenants:rows.slice(0,100).map(t=>({id:t.id,slug:t.slug,name:t.name,status:"ACTIVE",rawStatus:"ACTIVE",createdAt:t.createdAt.toISOString(),plan:null,planExpiresAt:null,modules:{inventory:true,lotTracking:true,transformations:true,pos:true,promotions:true,finance:true,reports:true},metrics:{totalRecords:t._count.products,recordLabel:"productos",available:true}})),nextOffset:rows.length>100?offset+100:null,capabilities:{tenantsRead:true,tenantWrite:false,moduleWrite:false}},{headers});
 }catch{return Response.json({success:false,error:"Tenant read unavailable"},{status:503,headers});}
}
