import {Shell,Notice,Field} from "../ui";
import {changePassword} from "./actions";
export default async function Page({searchParams}:{searchParams:Promise<{error?:string}>}){
 return <Shell title="Mi cuenta" allowCashier><Notice query={await searchParams}/><section className="panel"><h2>Cambiar contraseña</h2><p>Se cerrarán todas tus sesiones al actualizarla.</p><form action={changePassword} className="fields"><Field label="Contraseña actual"><input name="current" type="password" required autoComplete="current-password"/></Field><Field label="Nueva contraseña"><input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></Field><Field label="Repetir nueva contraseña"><input name="confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></Field><button>Actualizar contraseña</button></form></section></Shell>;
}
