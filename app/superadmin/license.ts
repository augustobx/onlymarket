"use server";
import {db} from "../../src/server/db";
import {requirePlatform} from "../../src/server/platform-auth";
import {plans} from "../../src/domain/settings.mjs";
import {dateInput} from "../../src/domain/parse.mjs";
import {redirect} from "next/navigation";
export async function licenseAction(f:FormData){
 const s=await requirePlatform();let error="";
 try{
 const id=String(f.get("tenantId")??""),plan=String(f.get("plan")??""),licenseUntil=dateInput(String(f.get("until")??"")),suspended=f.get("suspended")==="yes";
 if(!Object.hasOwn(plans,plan))throw new Error("Plan inválido");
 await db.$transaction(async tx=>{
 const auth=await tx.platformSession.findUnique({where:{tokenHash:s.tokenHash},include:{admin:true}});
 if(!auth?.admin.active||auth.expiresAt<=new Date())throw new Error("Sesión inválida");
 if((suspended||licenseUntil&&licenseUntil.toISOString().slice(0,10)<new Date().toLocaleDateString("en-CA",{timeZone:"America/Argentina/Buenos_Aires"}))&&await tx.cashShift.count({where:{tenantId:id,closedAt:null}}))throw new Error("Cerrar las cajas antes de suspender");
 await tx.tenant.update({where:{id},data:{plan,licenseUntil,suspended}});
 await tx.platformAudit.create({data:{adminId:s.id,tenantId:id,action:"LICENSE",detail:JSON.stringify({plan,licenseUntil,suspended})}});
 },{isolationLevel:"Serializable"});
 }catch(e){error=e instanceof Error&&!('code' in e)?e.message:"No se pudo guardar la licencia";}
 redirect("/superadmin?"+(error?"error="+encodeURIComponent(error):"ok=1"));
}
