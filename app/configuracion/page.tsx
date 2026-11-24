import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {profiles} from "../../src/domain/settings.mjs";
import {Shell,Field,Notice,fixed} from "../ui";
import {settingsAction} from "./actions";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{ok?:string;error?:string}>}){
 const s=await requireSession();if(s.role!=="OWNER")return <Shell title="Configuración"><p>Sin permisos</p></Shell>;
 const t=await db.tenant.findUniqueOrThrow({where:{id:s.tenantId}});
 return <Shell title="Perfil del comercio"><Notice query={await searchParams}/><section className="panel"><h2>Configuración operativa</h2><p>El perfil adapta la navegación, sin eliminar datos ni restringir módulos por licencia. Plan actual: {t.plan}. Vencimiento: {t.licenseUntil?.toISOString().slice(0,10)??"Sin fecha asignada"}.</p><form action={settingsAction} className="formgrid"><Field label="Tipo de comercio"><select name="profile" defaultValue={t.profile}>{Object.entries(profiles).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field><Field label="Prefijo EAN de peso (2 dígitos, opcional)"><input name="prefix" defaultValue={t.weightPrefix??""} pattern="2[0-9]" maxLength={2}/></Field><Field label="Pesos de compra neta por punto"><input name="points" defaultValue={fixed(t.pointsEveryCents,2)} required inputMode="decimal"/></Field><button>Guardar configuración</button></form><p>Formato de peso: prefijo de 2 dígitos + PLU de 5 + gramos de 5 + dígito de control EAN-13. Confirmar formato con la balanza antes de activar.</p></section></Shell>;
}
