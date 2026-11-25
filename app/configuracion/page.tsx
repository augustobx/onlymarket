import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {profiles} from "../../src/domain/settings.mjs";
import {Shell,Field,Notice,fixed} from "../ui";
import {PageHeader,KpiCard,SectionCard,InfoCallout} from "../components/retail-ui";
import {settingsAction} from "./actions";

export const dynamic="force-dynamic";

export default async function Page({searchParams}:{searchParams:Promise<{ok?:string;error?:string}>}){
 const s=await requireSession();
 if(s.role!=="OWNER")return <Shell title="Configuración"><p className="error">Sin permisos</p></Shell>;

 const t=await db.tenant.findUniqueOrThrow({where:{id:s.tenantId}});

 return (
  <Shell title="Perfil del comercio">
   <Notice query={await searchParams}/>

   <PageHeader
    kicker="Administración"
    title="Perfil del comercio"
    subtitle="Identidad operativa, lectura de balanzas EAN-13 y reglas de fidelización."
   />

   <div className="om-kpi-grid om-kpi-grid--3">
    <KpiCard label="Perfil actual" value={profiles[t.profile as keyof typeof profiles]??t.profile} hint="Adaptación de navegación" icon="store" tone="brand"/>
    <KpiCard label="Plan" value={t.plan} hint="Licencia del comercio" icon="receipt"/>
    <KpiCard label="Vencimiento" value={t.licenseUntil?.toISOString().slice(0,10)??"Sin fecha"} hint="Asignado por plataforma" icon="clock"/>
   </div>

   <form action={settingsAction} className="v2-stack">
    <SectionCard title="Identidad del comercio" subtitle="El perfil adapta la navegación sin eliminar datos" icon="store" padded>
     <div className="v2-fields">
      <Field label="Tipo de comercio">
       <select name="profile" defaultValue={t.profile}>
        {Object.entries(profiles).map(([k,v])=><option key={k} value={k}>{v}</option>)}
       </select>
      </Field>
     </div>
    </SectionCard>

    <SectionCard title="Productos pesables" subtitle="Configuración del formato de código de barras de la balanza" icon="barcode" padded>
     <div className="v2-fields">
      <Field label="Prefijo EAN de peso (2 dígitos, opcional)">
       <input name="prefix" defaultValue={t.weightPrefix??""} pattern="2[0-9]" maxLength={2}/>
      </Field>
     </div>
     <InfoCallout icon="info">
      Formato EAN-13 de peso: prefijo de 2 dígitos + PLU de 5 + gramos de 5 + dígito verificador. Confirmá el formato con la balanza antes de activar.
     </InfoCallout>
    </SectionCard>

    <SectionCard title="Fidelización" subtitle="Reglas de descuento y puntos de seguimiento" icon="users" padded>
     <div className="v2-fields">
      <Field label="Pesos de compra neta por punto">
       <input name="points" defaultValue={fixed(t.pointsEveryCents,2)} required inputMode="decimal"/>
      </Field>
      <Field label="Descuento socios (%)">
       <input name="memberDiscount" defaultValue={fixed(BigInt(t.memberDiscountBps),2)} required inputMode="decimal"/>
      </Field>
     </div>
    </SectionCard>

    <div>
     <button>Guardar configuración</button>
    </div>
   </form>
  </Shell>
 );
}
