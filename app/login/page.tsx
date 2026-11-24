import {currentSession} from "../../src/server/auth";
import {redirect} from "next/navigation";
import {loginAction} from "../actions";
import SpaceLogin from "../intro/SpaceLogin";
export const dynamic="force-dynamic";
export default async function Login({searchParams}:{searchParams:Promise<{error?:string;changed?:string}>}){
 if(await currentSession())redirect("/");
 const query=await searchParams;
 return (
  <SpaceLogin
   area="OnlyMarket · Gestión Comercial"
   producto="OnlyMarket"
   bajada="Gestión integral para kioscos, mercados, carnicerías, fiambrerías y verdulerías."
   tituloTarjeta="Ingresar al comercio"
   subtituloTarjeta="Accedé con el código asignado a tu negocio y tus credenciales de operador."
  >
   {query.error&&<p className="bhi-alerta bhi-alerta--danger" role="alert">No se pudo iniciar sesión. Revisá el código del comercio, correo, contraseña o estado de la licencia.</p>}
   {query.changed&&<p className="bhi-alerta bhi-alerta--info" role="status">Contraseña actualizada. Ingresá nuevamente con tu nueva clave.</p>}
   <form action={loginAction}>
    <div className="bhi-campo">
     <label className="bhi-etiqueta" htmlFor="login-slug">Código del comercio</label>
     <div className="bhi-input-contenedor">
      <span className="bhi-input-icono" aria-hidden="true">
       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6"/></svg>
      </span>
      <input id="login-slug" className="bhi-input" name="slug" required maxLength={64} placeholder="ej. mercado-central"/>
     </div>
    </div>
    <div className="bhi-campo">
     <label className="bhi-etiqueta" htmlFor="login-email">Correo electrónico</label>
     <div className="bhi-input-contenedor">
      <span className="bhi-input-icono" aria-hidden="true">
       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
      </span>
      <input id="login-email" className="bhi-input" name="email" type="email" autoComplete="username" required maxLength={254} placeholder="operador@comercio.com"/>
     </div>
    </div>
    <div className="bhi-campo">
     <label className="bhi-etiqueta" htmlFor="login-password">Contraseña</label>
     <div className="bhi-input-contenedor">
      <span className="bhi-input-icono" aria-hidden="true">
       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
      </span>
      <input id="login-password" className="bhi-input" name="password" type="password" autoComplete="current-password" required maxLength={128} placeholder="••••••••••••"/>
     </div>
    </div>
    <button className="bhi-boton--primario">Ingresar</button>
   </form>
  </SpaceLogin>
 );
}
