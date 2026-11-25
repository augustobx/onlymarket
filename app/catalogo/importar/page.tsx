import Link from "next/link";
import {requireSession} from "../../../src/server/auth";
import {Shell} from "../../ui";
import {PageHeader,SectionCard,InfoCallout} from "../../components/retail-ui";
import {Icon} from "../../components/icons";
import Editor from "./editor";

export const dynamic="force-dynamic";

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;count?:string}>}){
 const s=await requireSession();
 if(!["OWNER","MANAGER"].includes(s.role))return <Shell title="Importar catálogo"><p className="error">Sin permisos.</p></Shell>;

 const q=await searchParams;

 return (
  <Shell title="Importar catálogo">
   <PageHeader
    kicker="Mercadería"
    title="Importar catálogo CSV"
    subtitle="Carga masiva de hasta 1.000 productos desde Excel / CSV UTF-8."
    actions={
     <Link className="actionlink secondarylink" href="/catalogo">
      <Icon name="chevronLeft" size={15}/>
      <span>Volver al catálogo</span>
     </Link>
    }
   />

   <SectionCard title="Carga masiva de productos" icon="layers" className="om-settings-panel" padded>
    <InfoCallout icon="info">
     Los SKU y códigos de barras deben ser únicos. Esta operación solo da de alta productos nuevos y no modifica stock ni historial existente.
    </InfoCallout>
    {q.error&&<p className="error" role="alert">{q.error}</p>}
    {q.count&&/^\d+$/.test(q.count)&&<p className="success" role="status">{q.count} productos importados.</p>}
    <Editor/>
   </SectionCard>
  </Shell>
 );
}
