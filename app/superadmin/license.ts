"use server";
import {db} from "../../src/server/db";
import {platformEnabled,requirePlatform} from "../../src/server/platform-auth";
import {actionError} from "../../src/server/errors.mjs";
import {plans} from "../../src/domain/settings.mjs";
import {dateInput,localDay} from "../../src/domain/parse.mjs";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
export async function licenseAction(f:FormData){
 const s=await requirePlatform();let error="";
 try{
  if(!platformEnabled())throw new Error("Acceso central deshabilitado");
  const id=String(f.get("tenantId")??""),plan=String(f.get("plan")??""),licenseUntil=dateInput(String(f.get("until")??"")),suspended=f.get("suspended")==="yes";
  if(!Object.hasOwn(plans,plan))throw new Error("Plan inválido");
  await db.$transaction(async tx=>{
   const auth=await tx.platformSession.findUnique({where:{tokenHash:s.tokenHash},include:{admin:true}});
   if(!auth?.admin.active||auth.expiresAt<=new Date())throw new Error("Sesión inválida");
   if((suspended||licenseUntil&&licenseUntil.toISOString().slice(0,10)<localDay())&&await tx.cashShift.count({where:{tenantId:id,closedAt:null}}))throw new Error("Cerrar las cajas antes de suspender");
   await tx.tenant.update({where:{id},data:{plan,licenseUntil,suspended}});
   await tx.platformAudit.create({data:{adminId:s.id,tenantId:id,action:"LICENSE",detail:JSON.stringify({plan,licenseUntil,suspended})}});
  },{isolationLevel:"Serializable"});
 }catch(e){error=actionError(e,"No se pudo guardar la licencia");}
 revalidatePath("/superadmin");
 redirect("/superadmin?"+(error?"error="+encodeURIComponent(error):"ok=license"));
}
