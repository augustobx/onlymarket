"use server";
import {db} from "../../src/server/db";
import {requireSession,logout} from "../../src/server/auth";
import {hashPassword,verifyPassword} from "../../src/server/password.mjs";
import {redirect} from "next/navigation";
export async function changePassword(f:FormData){
 const s=await requireSession();let error="";
 try{
 const old=String(f.get("current")??""),next=String(f.get("password")??""),confirm=String(f.get("confirm")??"");
 if(next!==confirm)throw new Error("Las contraseñas no coinciden");
 const user=await db.user.findUniqueOrThrow({where:{id:s.actorUserId}});
 if(!user.active||!await verifyPassword(old,user.passwordHash))throw new Error("Contraseña actual incorrecta");
 const passwordHash=await hashPassword(next);
 await db.$transaction(async tx=>{
  const result=await tx.user.updateMany({where:{id:user.id,passwordHash:user.passwordHash,active:true},data:{passwordHash}});
  if(result.count!==1)throw new Error("La contraseña cambió; ingresá nuevamente");
  await tx.session.deleteMany({where:{userId:user.id}});
 });
 }catch(e){error=e instanceof Error&&!('code' in e)&&e.message.length<180&&!e.message.includes("\n")?e.message:"No se pudo cambiar la contraseña";}
 if(error)redirect("/cuenta?error="+encodeURIComponent(error));
 await logout();redirect("/login");
}
