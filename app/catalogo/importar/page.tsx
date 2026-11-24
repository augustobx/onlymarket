import Link from "next/link";
import {requireSession} from "../../../src/server/auth";
import {Shell} from "../../ui";
import Editor from "./editor";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{error?:string;count?:string}>}){
 const s=await requireSession();if(!["OWNER","MANAGER"].includes(s.role))return <Shell title="Importar catálogo"><p>Sin permisos.</p></Shell>;
 const q=await searchParams;
 return <Shell title="Importar catálogo"><section className="panel"><Link href="/catalogo">Volver al catálogo</Link><h2>Carga masiva desde Excel / CSV</h2><p>Guardá el archivo como CSV UTF-8. Máximo 1000 productos por operación. Los SKU y códigos de barras deben ser únicos; no se modifica ni el stock ni el historial de productos.</p>{q.error&&<p className="error" role="alert">{q.error}</p>}{q.count&&/^\d+$/.test(q.count)&&<p className="success" role="status">{q.count} productos importados.</p>}<Editor/></section></Shell>;
}
