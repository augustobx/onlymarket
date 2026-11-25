import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {Operation} from "../operations";
import {Shell,Notice,Field} from "../ui";
import {PageHeader,KpiCard,SectionCard} from "../components/retail-ui";
import {adminAction} from "./actions";

export const dynamic="force-dynamic";

const roles:Record<string,string>={MANAGER:"Encargado",INVENTORY:"Inventario",CASHIER:"Cajero"};

export default async function Page({searchParams}:{searchParams:Promise<{error?:string;ok?:string}>}){
 const s=await requireSession();
 if(s.role!=="OWNER")return <Shell title="Administración"><p className="error">Sin permisos.</p></Shell>;

 const [branches,members]=await Promise.all([
  db.branch.findMany({where:{tenantId:s.tenantId},orderBy:{name:"asc"}}),
  db.membership.findMany({where:{tenantId:s.tenantId},include:{user:{select:{email:true,active:true}}}}),
 ]);

 return (
  <Shell title="Administración del comercio">
   <Notice query={await searchParams}/>

   <PageHeader
    kicker="Administración"
    title="Sucursales y equipo"
    subtitle="Gestión de locales operativos, roles del personal y revocación de accesos."
    actions={
     <>
      <Operation title="Nueva sucursal" trigger="+ Nueva sucursal">
       <form action={adminAction} className="fields">
        <input type="hidden" name="kind" value="BRANCH"/>
        <Field label="Nombre"><input name="name" required maxLength={100}/></Field>
        <button>Agregar sucursal</button>
       </form>
      </Operation>
      <Operation
       title="Alta de empleado"
       trigger="+ Nuevo empleado"
       description="El empleado ingresa desde el dominio de este comercio con sus propias credenciales."
      >
       <form action={adminAction} className="fields">
        <input type="hidden" name="kind" value="EMPLOYEE"/>
        <Field label="Correo"><input name="email" type="email" required/></Field>
        <Field label="Contraseña inicial">
         <input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required/>
        </Field>
        <Field label="Rol">
         <select name="role">
          {Object.entries(roles).map(([k,v])=><option key={k} value={k}>{v}</option>)}
         </select>
        </Field>
        <button>Crear empleado</button>
       </form>
      </Operation>
     </>
    }
   />

   <div className="om-kpi-grid">
    <KpiCard label="Sucursales" value={branches.length} hint="Locales registrados" icon="building" tone="brand"/>
    <KpiCard label="Accesos" value={members.length} hint="Usuarios del comercio" icon="users"/>
    <KpiCard label="Cajeros" value={members.filter(m=>m.role==="CASHIER").length} hint="Operadores de caja" icon="cart"/>
    <KpiCard label="Usuarios activos" value={members.filter(m=>m.user.active).length} hint="Cuentas habilitadas" icon="shield" tone="success"/>
   </div>

   <SectionCard title="Sucursales" subtitle="Puntos físicos donde opera el comercio" icon="building" padded>
    <div className="om-card-grid">
     {branches.map(b=>(
      <article className="om-list-card" key={b.id}>
       <span className="om-kicker">Sucursal</span>
       <strong style={{fontSize:16}}>{b.name}</strong>
      </article>
     ))}
    </div>
   </SectionCard>

   <SectionCard title="Equipo de trabajo" subtitle="Permisos y estado de cuentas del comercio" icon="users">
    <div className="tablewrap">
     <table>
      <thead>
       <tr>
        <th>Usuario</th>
        <th>Rol</th>
        <th>Estado</th>
        <th>Acciones</th>
       </tr>
      </thead>
      <tbody>
       {members.map(m=>(
        <tr key={m.userId}>
         <td><strong>{m.user.email}</strong></td>
         <td>{m.role==="OWNER"?"Propietario":roles[m.role]}</td>
         <td>
          <span className={"status "+(m.user.active?"AVAILABLE":"EXHAUSTED")}>
           {m.user.active?"Activo":"Inactivo"}
          </span>
         </td>
         <td>
          {m.role!=="OWNER"&&(
           <Operation title={"Acceso · "+m.user.email} trigger="Administrar acceso" variant="secondary">
            <form action={adminAction} className="fields">
             <input type="hidden" name="userId" value={m.userId}/>
             <select name="role" defaultValue={m.role} aria-label="Nuevo rol">
              {Object.entries(roles).map(([k,v])=><option key={k} value={k}>{v}</option>)}
             </select>
             <button name="kind" value="ROLE">Cambiar rol y cerrar sesiones</button>
             <button name="kind" value="REVOKE" className="secondary">Revocar acceso a este comercio</button>
            </form>
           </Operation>
          )}
         </td>
        </tr>
       ))}
      </tbody>
     </table>
    </div>
   </SectionCard>
  </Shell>
 );
}
