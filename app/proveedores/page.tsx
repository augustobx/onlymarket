import {Operation} from "../operations";
import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {addSupplier} from "../actions";
import {Shell,Field,Notice,money} from "../ui";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{error?:string;ok?:string}>}){
 const s=await requireSession();if(s.role==="CASHIER")return <Shell title="Proveedores"/>;
 const [suppliers,totals]=await Promise.all([db.supplier.findMany({where:{tenantId:s.tenantId},orderBy:{name:"asc"},take:500}),db.receipt.groupBy({by:["supplierId"],where:{tenantId:s.tenantId},_sum:{totalCostCents:true}})]);
 const sums=new Map(totals.map(x=>[x.supplierId,x._sum.totalCostCents??0n]));
 return <Shell title="Proveedores"><Notice query={await searchParams}/><div className="om-page-intro"><div><span className="om-kicker">Compras</span><h2>Directorio de proveedores</h2><p>Contactos y compras acumuladas por proveedor.</p></div><Operation title="Nuevo proveedor" trigger="+ Nuevo proveedor"><form action={addSupplier} className="formgrid"><Field label="Nombre"><input name="name" required maxLength={120}/></Field><Field label="Teléfono"><input name="phone" maxLength={64}/></Field><button>Crear proveedor</button></form></Operation></div><section className="panel"><h2>Compras acumuladas por proveedor</h2><p>No representa deuda ni pagos realizados.</p><div className="tablewrap"><table><thead><tr><th>Proveedor</th><th>Teléfono</th><th>Compras registradas</th></tr></thead><tbody>{suppliers.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.phone??"—"}</td><td>{money(sums.get(p.id)??0n)}</td></tr>)}</tbody></table></div>{!suppliers.length&&<p>Todavía no hay proveedores.</p>}</section></Shell>;
}
