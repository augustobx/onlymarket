"use server";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {authorizeSale,serial} from "../../src/server/sales.mjs";
import {profiles} from "../../src/domain/settings.mjs";
import {decimal} from "../../src/domain/parse.mjs";
import {redirect} from "next/navigation";
export async function settingsAction(f:FormData){
 const s=await requireSession();let error="";
 try{const profile=String(f.get("profile")),weightPrefix=String(f.get("prefix")??"")||null,pointsEveryCents=decimal(String(f.get("points")),2,"Importe por punto");
 const memberDiscountBps=Number(decimal(String(f.get("memberDiscount")??"0"),2,"Descuento socios",{allowZero:true}));if(memberDiscountBps>=10000)throw new Error("Descuento menor al 100%");
 if(!Object.hasOwn(profiles,profile)||weightPrefix&&!/^2\d$/.test(weightPrefix))throw new Error("Configuración inválida");
 await serial(db,async (tx:import("@prisma/client").Prisma.TransactionClient)=>{await authorizeSale(tx,s,["OWNER"]);await tx.tenant.update({where:{id:s.tenantId},data:{profile,weightPrefix,pointsEveryCents,memberDiscountBps}});});
 }catch(e){error=e instanceof Error&&!('code' in e)?e.message:"No se pudo guardar";}
 redirect("/configuracion?"+(error?"error="+encodeURIComponent(error):"ok=1"));
}
