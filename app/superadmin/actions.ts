"use server";
import {platformEnabled,platformLogin,platformLogout,requirePlatform} from "../../src/server/platform-auth";
import {createCommerce} from "../../src/server/platform.mjs";
import {actionError} from "../../src/server/errors.mjs";
import {db} from "../../src/server/db";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
const str=(f:FormData,k:string)=>typeof f.get(k)==="string"?String(f.get(k)):"";
export async function loginPlatform(f:FormData){
 const ok=await platformLogin(str(f,"email"),str(f,"password"));redirect(ok?"/superadmin":"/superadmin/login?error=1");
}
export async function logoutPlatform(){await platformLogout();redirect("/superadmin/login");}
export async function addCommerce(f:FormData){
 const s=await requirePlatform();let error="";
 try{
  if(!platformEnabled())throw new Error("Acceso central deshabilitado");
  await createCommerce(db,s,Object.fromEntries(["name","slug","email","password","branchName"].map(k=>[k,str(f,k)])));
 }
 catch(e){error=actionError(e,"No se pudo crear el comercio","El código o correo ya existe");}
 revalidatePath("/superadmin");redirect("/superadmin"+(error?"?error="+encodeURIComponent(error):"?ok=tenant"));
}
