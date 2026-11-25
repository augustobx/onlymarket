import Link from "next/link";
import {requireSession} from "../src/server/auth";
import {logoutAction} from "./actions";
import type {ReactNode} from "react";
import {showTransform,profiles} from "../src/domain/settings.mjs";
import {resolveOkMessage} from "../src/domain/notices.mjs";
import {WorkspaceFrame} from "./navigation";
import {PaletteSelector,DarkModeToggle} from "./theme/ThemeControls";

export const sectors={BUTCHERY:"Carnicería",DELI:"Fiambrería",PRODUCE:"Verdulería",GROCERY:"Almacén",OTHER:"Otros"};
export const states:Record<string,string>={AVAILABLE:"Disponible",EXPIRING:"Próximo a vencer",REVIEW:"Revisar calidad",BLOCKED:"Bloqueado",EXHAUSTED:"Agotado"};
const roles={OWNER:"Propietario",MANAGER:"Encargado",INVENTORY:"Inventario",CASHIER:"Cajero"};

export function fixed(n:bigint,scale:number){const sign=n<0n?"-":"";const a=(n<0n?-n:n).toString().padStart(scale+1,"0");return sign+a.slice(0,-scale)+","+a.slice(-scale);}
export function money(n:bigint){return "$ "+fixed(n,2);}
export function amount(n:bigint,unit:string){return unit==="UNIT"&&n%1000n===0n?(n/1000n).toString()+" u.":fixed(n,3)+(unit==="KG"?" kg":" u.");}

export async function Shell({title,children,allowCashier=false}:{title:string;children?:ReactNode;allowCashier?:boolean}){
 const s=await requireSession(),manager=["OWNER","MANAGER"].includes(s.role);
 const groups=[
  {name:"Operación",items:[
   ...(s.role!=="CASHIER"?[{href:"/",label:"Resumen",icon:"home"},{href:"/alertas",label:"Alertas",icon:"bell"}]:[]),
   ...(s.role!=="INVENTORY"?[{href:"/pos",label:"Punto de venta",icon:"cart"}]:[])
  ]},
  ...(s.role!=="CASHIER"?[{name:"Mercadería",items:[
   {href:"/inventario",label:"Inventario y compras",icon:"box"},
   {href:"/stock",label:"Conteos y traslados",icon:"trace"},
   {href:"/reposicion",label:"Reposición",icon:"truck"},
   {href:"/catalogo",label:"Catálogo",icon:"grid"},
   {href:"/proveedores",label:"Proveedores",icon:"truck"},
   ...(showTransform(s.profile)?[{href:"/transformaciones",label:"Desposte y fraccionamiento",icon:"scale"}]:[]),
   {href:"/trazabilidad",label:"Trazabilidad",icon:"trace"}
  ]}]:[]),
  ...(manager?[{name:"Administración comercial",items:[
   {href:"/promociones",label:"Promociones",icon:"tag"},
   {href:"/combos",label:"Combos",icon:"tag"},
   {href:"/clientes",label:"Clientes y fidelización",icon:"grid"},
   {href:"/ventas",label:"Ventas y anulaciones",icon:"receipt"},
   {href:"/finanzas",label:"Finanzas",icon:"wallet"},
   {href:"/informes",label:"Informes",icon:"chart"}
  ]}]:[]),
  ...(s.role==="OWNER"?[{name:"Configuración",items:[
   {href:"/administracion",label:"Administración",icon:"settings"},
   {href:"/configuracion",label:"Perfil del comercio",icon:"settings"}
  ]}]:[])
 ];

 const footer=(
  <>
   <Link href="/cuenta" className="footer-link">Mi cuenta</Link>
   <form action={logoutAction}><button className="secondary">Cerrar sesión</button></form>
   <small>OnlyMarket · v1.0 RC · NanoLabs</small>
  </>
 );

 const header=(
  <header className="topbar">
   <div className="topbar-title">
    <small className="om-breadcrumb">Área de trabajo <span> / </span> {s.tenantName}</small>
    <h1>{title}</h1>
   </div>
   <div className="topbar-actions">
    {s.role!=="INVENTORY"&&<Link href="/pos" className="om-top-pos" aria-label="Abrir punto de venta"><span aria-hidden="true">↗</span> Caja</Link>}
    <PaletteSelector/>
    <DarkModeToggle/>
    <Link href="/cuenta" className="userchip" title="Mi cuenta">
     <span className="avatar">{s.email.slice(0,1).toUpperCase()}</span>
     <div>
      <strong>{roles[s.role]}</strong>
      <small>{s.email}</small>
     </div>
    </Link>
   </div>
  </header>
 );

 return (
  <WorkspaceFrame
   brandHref={s.role==="CASHIER"?"/pos":"/"}
   tenantName={s.tenantName}
   roleMeta={`${roles[s.role]} · ${profiles[s.profile as keyof typeof profiles]} · ${s.plan}`}
   groups={groups}
   footer={footer}
   header={header}
  >
   {s.role==="CASHIER"&&!allowCashier?<p className="notice"><Link href="/pos">Ir al punto de venta</Link></p>:children}
  </WorkspaceFrame>
 );
}

export function Notice({query}:{query:{error?:string;ok?:string}}){
 const okMessage=resolveOkMessage(query.ok);
 return query.error?<p className="error" role="alert">{query.error}</p>:okMessage?<p className="success" role="status">{okMessage}</p>:null;
}

export function Field({label,children}:{label:string;children:ReactNode}){return <label>{label}{children}</label>;}
