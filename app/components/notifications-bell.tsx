"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {Icon} from "./icons";

export type ExpiryNotification={
 lotId:string;
 productName:string;
 lotCode:string;
 branchName:string;
 qtyText:string;
 expiry:string;
 state:"BLOCKED"|"EXPIRING";
 daysLeft:number|null;
};

export function NotificationsBell({items}:{items:ExpiryNotification[]}){
 const [open,setOpen]=useState(false);
 const wrapRef=useRef<HTMLDivElement>(null);

 useEffect(()=>{
  if(!open)return;
  const onPointer=(e:MouseEvent)=>{
   if(wrapRef.current&&!wrapRef.current.contains(e.target as Node))setOpen(false);
  };
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==="Escape")setOpen(false);
  };
  document.addEventListener("mousedown",onPointer);
  window.addEventListener("keydown",onKey);
  return ()=>{
   document.removeEventListener("mousedown",onPointer);
   window.removeEventListener("keydown",onKey);
  };
 },[open]);

 const expiredCount=items.filter(i=>i.state==="BLOCKED").length;
 const expiringCount=items.filter(i=>i.state==="EXPIRING").length;

 const formatBadge=(n:number)=>(n>99?"99+":String(n));

 const labelDays=(item:ExpiryNotification)=>{
  if(item.state==="BLOCKED")return item.expiry?`Vencido (${item.expiry.split("-").reverse().join("/")})`:"Bloqueado por vencimiento";
  if(item.daysLeft===0)return "Vence hoy";
  if(item.daysLeft===1)return "Vence mañana";
  return item.daysLeft!==null?`Vence en ${item.daysLeft} días (${item.expiry.split("-").reverse().join("/")})`:`Vence ${item.expiry}`;
 };

 return (
  <div className="om-notif-wrap" ref={wrapRef}>
   <button
    type="button"
    className={`om-notif-trigger${expiredCount>0?" is-danger":expiringCount>0?" is-warn":""}`}
    aria-label={items.length?`Notificaciones de vencimientos (${items.length})`:"Notificaciones de vencimientos"}
    aria-expanded={open}
    title="Alertas de lotes vencidos y próximos a vencer"
    onClick={()=>setOpen(v=>!v)}
   >
    <Icon name="bell" size={16}/>
    {items.length>0&&(
     <span className={`om-notif-badge${expiredCount>0?" is-danger":""}`}>
      {formatBadge(items.length)}
     </span>
    )}
   </button>

   {open&&(
    <div className="om-notif-menu" role="dialog" aria-label="Alertas de vencimientos">
     <div className="om-notif-menu__head">
      <div>
       <strong>Vencimientos y frescura</strong>
       <small>
        {items.length===0
         ?"Todo al día en tus sucursales"
         :`${expiredCount} vencidos · ${expiringCount} por vencer`}
       </small>
      </div>
      <Link href="/alertas" className="om-link-chip" onClick={()=>setOpen(false)}>
       <span>Centro de alertas</span>
       <Icon name="arrowUpRight" size={12}/>
      </Link>
     </div>

     <div className="om-notif-menu__list">
      {items.length>0?(
       items.map(item=>(
        <Link
         key={item.lotId}
         href={`/inventario?lot=${item.lotId}`}
         className="om-notif-item"
         onClick={()=>setOpen(false)}
        >
         <span className={`om-notif-dot${item.state==="BLOCKED"?" is-danger":""}`} aria-hidden="true"/>
         <div className="om-notif-item__main">
          <strong>{item.productName}</strong>
          <small className="mono">{item.branchName} · Lote {item.lotCode} · {item.qtyText}</small>
          <span className={`om-notif-time${item.state==="BLOCKED"?" is-danger":""}`}>
           {labelDays(item)}
          </span>
         </div>
         <span className={`status ${item.state}`}>
          {item.state==="BLOCKED"?"Vencido":"Por vencer"}
         </span>
        </Link>
       ))
      ):(
       <div className="om-notif-empty">
        <Icon name="check" size={20}/>
        <strong>Sin alertas de vencimiento</strong>
        <small>No tenés lotes vencidos ni dentro del período de aviso.</small>
       </div>
      )}
     </div>

     <div className="om-notif-menu__foot">
      <Link href="/promociones" onClick={()=>setOpen(false)}>Crear promo de liquidación</Link>
      <Link href="/alertas" onClick={()=>setOpen(false)}>Ver todas las alertas →</Link>
     </div>
    </div>
   )}
  </div>
 );
}
