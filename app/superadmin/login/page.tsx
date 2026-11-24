import Link from "next/link";
import {platformEnabled,platformSession} from "../../../src/server/platform-auth";
import {redirect} from "next/navigation";
import {Field} from "../../ui";
import {loginPlatform} from "../actions";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{error?:string}>}){
 if(await platformSession())redirect("/superadmin");
 const q=await searchParams;
 return <main className="login"><section className="panel"><small>NANOLABS · ADMINISTRACIÓN CENTRAL</small><h1>OnlyMarket Platform</h1>{!platformEnabled()?<p>El acceso central no está habilitado.</p>:<form action={loginPlatform} className="fields">{q.error&&<p className="error">Acceso no autorizado o límite de intentos alcanzado.</p>}<Field label="Correo administrativo"><input type="email" name="email" required autoComplete="username"/></Field><Field label="Contraseña administrativa"><input type="password" name="password" required autoComplete="current-password"/></Field><button>Ingresar a plataforma</button></form>}<Link href="/login">Acceso de comercios</Link></section></main>;
}
