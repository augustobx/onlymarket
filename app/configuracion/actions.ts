"use server";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {actionError} from "../../src/server/errors.mjs";
import {authorizeSale,serial} from "../../src/server/sales.mjs";
import {profiles} from "../../src/domain/settings.mjs";
import {decimal} from "../../src/domain/parse.mjs";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
export async function settingsAction(f:FormData){
 const s=await requireSession();let error="";
 try{const profile=String(f.get("profile")),weightPrefix=String(f.get("prefix")??"")||null,pointsEveryCents=decimal(String(f.get("points")),2,"Importe por punto");
 const pointValueCents=f.has("pointValue")?decimal(String(f.get("pointValue")??"0"),2,"Valor por punto",{allowZero:true}):0n;
 const memberDiscountBps=Number(decimal(String(f.get("memberDiscount")??"0"),2,"Descuento socios",{allowZero:true}));if(memberDiscountBps>=10000)throw new Error("Descuento menor al 100%");
 if(!Object.hasOwn(profiles,profile)||weightPrefix&&!/^2\d$/.test(weightPrefix))throw new Error("Configuración inválida");
 await serial(db,async (tx:import("@prisma/client").Prisma.TransactionClient)=>{await authorizeSale(tx,s,["OWNER"]);await tx.tenant.update({where:{id:s.tenantId},data:{profile,weightPrefix,pointsEveryCents,pointValueCents,memberDiscountBps}});});
 }catch(e){error=actionError(e,"No se pudo guardar");}
 revalidatePath("/configuracion");revalidatePath("/pos");revalidatePath("/");
 redirect("/configuracion?"+(error?"error="+encodeURIComponent(error):"ok=settings"));
}
