import {Shell,Notice,Field} from "../ui";
import {PageHeader,SectionCard,InfoCallout} from "../components/retail-ui";
import {changePassword} from "./actions";

export const dynamic="force-dynamic";

export default async function Page({searchParams}:{searchParams:Promise<{error?:string}>}){
 return (
  <Shell title="Mi cuenta" allowCashier>
   <Notice query={await searchParams}/>

   <PageHeader
    kicker="Seguridad personal"
    title="Mi cuenta"
    subtitle="Actualizá tu contraseña de acceso al comercio."
   />

   <SectionCard title="Cambiar contraseña" subtitle="Al confirmar se cerrarán todas tus sesiones activas" icon="shield" className="om-settings-panel" padded>
    <InfoCallout icon="info">
     Si un operador olvidó su contraseña, el propietario puede revocar su acceso en Administración o solicitar recuperación a NanoLabs.
    </InfoCallout>
    <form action={changePassword} className="fields" style={{maxWidth:460}}>
     <Field label="Contraseña actual">
      <input name="current" type="password" required autoComplete="current-password"/>
     </Field>
     <Field label="Nueva contraseña">
      <input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/>
     </Field>
     <Field label="Repetir nueva contraseña">
      <input name="confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/>
     </Field>
     <button>Actualizar contraseña</button>
    </form>
   </SectionCard>
  </Shell>
 );
}
