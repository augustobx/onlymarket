import Link from "next/link";
import {requireSession} from "../src/server/auth";
import {logoutAction} from "./actions";
import type {ReactNode} from "react";
export const sectors={BUTCHERY:"Carnicería",DELI:"Fiambrería",PRODUCE:"Verdulería",GROCERY:"Almacén",OTHER:"Otros"};
export const states:Record<string,string>={AVAILABLE:"Disponible",EXPIRING:"Próximo a vencer",REVIEW:"Revisar calidad",BLOCKED:"Bloqueado",EXHAUSTED:"Agotado"};
export function fixed(n:bigint,scale:number){const sign=n<0n?"-":"";const a=(n<0n?-n:n).toString().padStart(scale+1,"0");return sign+a.slice(0,-scale)+","+a.slice(-scale);}
export function money(n:bigint){return "$ "+fixed(n,2);}
export function amount(n:bigint,unit:string){return unit==="UNIT"&&n%1000n===0n?(n/1000n).toString()+" u.":fixed(n,3)+(unit==="KG"?" kg":" u.");}
export async function Shell({title,children,allowCashier=false}:{title:string;children?:ReactNode;allowCashier?:boolean}){
 const s=await requireSession();
 return <div className="workspace"><aside><Link className="brand" href="/">Only<span>Market</span></Link><p className="tenant">{s.tenantName}</p><nav><Link href="/pos">Punto de venta</Link>{s.role!=="CASHIER"&&<><Link href="/">Resumen</Link><Link href="/catalogo">Catálogo</Link><Link href="/proveedores">Proveedores</Link><Link href="/inventario">Inventario y lotes</Link><Link href="/transformaciones">Desposte y fraccionamiento</Link><Link href="/promociones">Promociones</Link>{["OWNER","MANAGER"].includes(s.role)&&<Link href="/finanzas">Finanzas</Link>}</>}{s.role==="OWNER"&&<Link href="/administracion">Administración</Link>}</nav><Link href="/cuenta">Mi cuenta</Link><form action={logoutAction}><button className="secondary">Cerrar sesión</button></form><small>NanoLabs · v0.1 · Desarrollo</small></aside><main className="content"><header><h1>{title}</h1><small>{s.email} · {s.role}</small></header>{s.role==="CASHIER"&&!allowCashier?<p className="notice"><Link href="/pos">Ir al punto de venta</Link></p>:children}</main></div>;
}
export function Notice({query}:{query:{error?:string;ok?:string}}){return query.error?<p className="error" role="alert">{query.error}</p>:query.ok?<p className="success" role="status">Operación registrada correctamente.</p>:null;}
export function Field({label,children}:{label:string;children:ReactNode}){return <label>{label}{children}</label>;}
