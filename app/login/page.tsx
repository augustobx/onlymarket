import {currentSession} from "../../src/server/auth";
import {redirect} from "next/navigation";
import {loginAction} from "../actions";
import {Field} from "../ui";
export const dynamic="force-dynamic";
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){
 if(await currentSession())redirect("/");
 const query=await searchParams;
 return <main className="login"><section className="panel"><span className="brand">Only<span>Market</span></span><h1>Ingresar al comercio</h1><p>Gestión comercial y trazabilidad.</p>{query.error&&<p className="error">No se pudo iniciar sesión. Revisá tus datos o intentá más tarde.</p>}<form action={loginAction} className="fields"><Field label="Código del comercio"><input name="slug" required maxLength={64}/></Field><Field label="Correo electrónico"><input name="email" type="email" autoComplete="username" required maxLength={254}/></Field><Field label="Contraseña"><input name="password" type="password" autoComplete="current-password" required maxLength={128}/></Field><button>Ingresar</button></form></section></main>;
}
