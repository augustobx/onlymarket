import Link from "next/link";
import type {ReactNode} from "react";
import {requireSession} from "../src/server/auth";
import {logoutAction} from "./actions";
import {showTransform,profiles} from "../src/domain/settings.mjs";
import {resolveOkMessage} from "../src/domain/notices.mjs";
import {db} from "../src/server/db";
import {classifyLot} from "../src/domain/inventory.mjs";
import {localDay} from "../src/domain/parse.mjs";
import {WorkspaceFrame} from "./navigation";
import {PaletteSelector,DarkModeToggle} from "./theme/ThemeControls";
import {Icon,type IconName} from "./components/icons";
import {ToastTrigger} from "./components/toast";
import {ModuleHelpButton} from "./components/module-help";
import {NotificationsBell,type ExpiryNotification} from "./components/notifications-bell";

export const sectors={BUTCHERY:"Carnicería",DELI:"Fiambrería",PRODUCE:"Verdulería",GROCERY:"Almacén",OTHER:"Otros"};
export const states:Record<string,string>={AVAILABLE:"Disponible",EXPIRING:"Próximo a vencer",REVIEW:"Revisar calidad",BLOCKED:"Bloqueado",EXHAUSTED:"Agotado"};
const roles:Record<string,string>={OWNER:"Propietario",MANAGER:"Encargado",INVENTORY:"Inventario",CASHIER:"Cajero"};

export function fixed(n:bigint,scale:number){
 const sign=n<0n?"-":"";
 const a=(n<0n?-n:n).toString().padStart(scale+1,"0");
 return sign+a.slice(0,-scale)+","+a.slice(-scale);
}
export function money(n:bigint){return "$ "+fixed(n,2);}
export function amount(n:bigint,unit:string){
 return unit==="UNIT"&&n%1000n===0n?(n/1000n).toString()+" u.":fixed(n,3)+(unit==="KG"?" kg":" u.");
}

export async function Shell({
 title,
 children,
 allowCashier=false,
}:{
 title:string;
 children?:ReactNode;
 allowCashier?:boolean;
}){
 const s=await requireSession();
 const manager=["OWNER","MANAGER"].includes(s.role);

 let expiryNotifications:ExpiryNotification[]=[];
 if(s.role!=="CASHIER"){
  const today=localDay();
  const todayMs=Date.parse(today+"T00:00:00Z");
  const alertLots=await db.lot.findMany({
   where:{tenantId:s.tenantId,quantityMilli:{gt:0n},product:{active:true}},
   select:{
    id:true,
    code:true,
    status:true,
    expiresOn:true,
    reviewAt:true,
    quantityMilli:true,
    branch:{select:{name:true}},
    product:{select:{name:true,unit:true,alertDays:true}},
   },
   orderBy:{expiresOn:"asc"},
   take:800,
  });
  expiryNotifications=alertLots
   .flatMap(l=>{
    const expiry=l.expiresOn?.toISOString().slice(0,10)??null;
    const review=l.reviewAt?localDay(l.reviewAt):null;
    const state=classifyLot({
     today,
     expiresOn:expiry,
     reviewOn:review,
     alertDays:l.product.alertDays,
     status:l.status,
     quantityMilli:l.quantityMilli,
    });
    const isExpiredBlock=state==="BLOCKED"&&Boolean(expiry&&expiry<=today);
    if(!isExpiredBlock&&state!=="EXPIRING")return [];
    const daysLeft=expiry?Math.round((Date.parse(expiry+"T00:00:00Z")-todayMs)/86400000):null;
    return [{
     lotId:l.id,
     productName:l.product.name,
     lotCode:l.code,
     branchName:l.branch.name,
     qtyText:amount(l.quantityMilli,l.product.unit),
     expiry:expiry??"",
     state:(isExpiredBlock?"BLOCKED":"EXPIRING") as "BLOCKED"|"EXPIRING",
     daysLeft,
    }];
   })
   .sort((a,b)=>(a.state===b.state?0:a.state==="BLOCKED"?-1:1)||a.expiry.localeCompare(b.expiry))
   .slice(0,18);
 }

 const groups:{name:string;pinned?:boolean;items:{href:string;label:string;icon:IconName}[]}[]=[
  {name:"Operación diaria",pinned:true,items:[
   ...(s.role!=="CASHIER"?[{href:"/",label:"Resumen",icon:"home" as IconName}]:[]),
   ...(s.role!=="INVENTORY"?[{href:"/pos",label:"Terminal de caja",icon:"cart" as IconName}]:[]),
   ...(s.role!=="CASHIER"?[{href:"/alertas",label:"Alertas",icon:"bell" as IconName}]:[]),
  ]},
  ...(s.role!=="CASHIER"?[
   {name:"Stock y producción",items:[
    {href:"/catalogo",label:"Productos e inventario",icon:"box" as IconName},
    {href:"/inventario",label:"Compras y recepción",icon:"truck" as IconName},
    ...(showTransform(s.profile)?[
     {href:"/transformaciones",label:"Desposte y fraccionamiento",icon:"scale" as IconName},
     {href:"/verduleria",label:"Verdulería y frescos",icon:"apple" as IconName},
    ]:[]),
   ]},
   {name:"Control de depósito",items:[
    {href:"/proveedores",label:"Proveedores",icon:"building" as IconName},
    {href:"/stock",label:"Conteos y traslados",icon:"layers" as IconName},
    {href:"/reposicion",label:"Reposición",icon:"packageCheck" as IconName},
    {href:"/trazabilidad",label:"Trazabilidad",icon:"trace" as IconName},
   ]},
  ]:[]),
  ...(manager?[
   {name:"Mostrador y clientes",items:[
    {href:"/ventas",label:"Ventas y anulaciones",icon:"receipt" as IconName},
    {href:"/promociones",label:"Promociones",icon:"tag" as IconName},
    {href:"/combos",label:"Combos",icon:"sparkles" as IconName},
    {href:"/clientes",label:"Clientes y socios",icon:"users" as IconName},
   ]},
   {name:"Plata y administración",items:[
    {href:"/finanzas",label:"Finanzas",icon:"wallet" as IconName},
    {href:"/informes",label:"Informes",icon:"chart" as IconName},
    {href:"/auditoria",label:"Auditoría",icon:"shield" as IconName},
    ...(s.role==="OWNER"?[
     {href:"/administracion",label:"Sucursales y equipo",icon:"building" as IconName},
     {href:"/configuracion",label:"Perfil del comercio",icon:"settings" as IconName},
    ]:[]),
   ]},
  ]:[]),
 ];

 const footer=(
  <>
   <Link href="/ayuda" className="footer-link footer-link--help" title="Centro de ayuda">
    <Icon name="help" size={15}/>
    <span>Centro de ayuda</span>
   </Link>
   <Link href="/cuenta" className="footer-link" title="Mi cuenta">
    <Icon name="user" size={15}/>
    <span>Mi cuenta</span>
   </Link>
   <form action={logoutAction}>
    <button className="secondary">
     <Icon name="logOut" size={15}/>
     <span>Cerrar sesión</span>
    </button>
   </form>
   <small>OnlyMarket · NanoLabs</small>
  </>
 );

 const header=(
  <header className="topbar">
   <div className="topbar-title">
    <div className="v2-crumb">
     <span>Gestión comercial</span>
     <span>/</span>
     <strong>{title}</strong>
    </div>
   </div>
   <div className="topbar-actions">
    {s.role!=="INVENTORY"&&(
     <Link href="/pos" className="om-top-pos" aria-label="Abrir punto de venta">
      <Icon name="cart" size={15}/>
      <span>Ir a caja</span>
      <Icon name="arrowUpRight" size={14}/>
     </Link>
    )}
    {s.role!=="CASHIER"&&<NotificationsBell items={expiryNotifications}/>}
    <ModuleHelpButton/>
    <PaletteSelector/>
    <DarkModeToggle/>
    <Link href="/cuenta" className="userchip" title="Mi cuenta">
     <span className="avatar">{s.email.slice(0,1).toUpperCase()}</span>
     <div>
      <strong>{roles[s.role]??s.role}</strong>
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
   roleMeta={`${roles[s.role]??s.role} · ${profiles[s.profile as keyof typeof profiles]} · ${s.plan}`}
   groups={groups}
   footer={footer}
   header={header}
  >
   {s.role==="CASHIER"&&!allowCashier?(
    <p className="notice">
     <Link href="/pos">Ir al punto de venta</Link>
    </p>
   ):children}
  </WorkspaceFrame>
 );
}

export function Notice({query,action}:{query:{error?:string;ok?:string};action?:ReactNode}){
 const okMessage=resolveOkMessage(query.ok);
 if(query.error){
  return (
   <>
    <ToastTrigger tone="error" message={query.error}/>
    <p className="error" role="alert">
     <Icon name="alert" size={16}/>
     <span>{query.error}</span>
    </p>
   </>
  );
 }
 if(okMessage){
  return (
   <>
    <ToastTrigger tone="success" message={okMessage}/>
    <p className="success" role="status">
     <Icon name="check" size={16}/>
     <span>{okMessage}</span>
     {action&&<span style={{marginLeft:"auto"}}>{action}</span>}
    </p>
   </>
  );
 }
 return null;
}

export function Field({label,children}:{label:string;children:ReactNode}){
 return <label>{label}{children}</label>;
}
