import type {ReactNode} from "react";
import Link from "next/link";
import {Icon,type IconName} from "./icons";

export function formatMoney(n:bigint){
 const a=n<0n?-n:n;
 return (n<0n?"− ":"")+"$ "+(a/100n).toLocaleString("es-AR")+","+String(a%100n).padStart(2,"0");
}

export const sectorIcons:Record<string,IconName>={
 BUTCHERY:"beef",
 DELI:"cheese",
 PRODUCE:"apple",
 GROCERY:"shoppingBag",
 OTHER:"box",
};

export function PageHeader({
 kicker,
 title,
 subtitle,
 actions,
}:{
 kicker:string;
 title:string;
 subtitle?:string;
 actions?:ReactNode;
}){
 return (
  <header className="om-pagehead">
   <div className="om-pagehead__title">
    <span className="om-kicker">{kicker}</span>
    <h1>{title}</h1>
    {subtitle&&<p>{subtitle}</p>}
   </div>
   {actions&&<div className="om-pagehead__actions">{actions}</div>}
  </header>
 );
}

export function KpiCard({
 label,
 value,
 hint,
 icon,
 tone="default",
}:{
 label:string;
 value:ReactNode;
 hint:string;
 icon:IconName;
 tone?:"default"|"brand"|"success"|"warning"|"danger";
}){
 return (
  <article className={`om-kpi om-kpi--${tone}`}>
   <div className="om-kpi__top">
    <span className="om-kpi__label">{label}</span>
    <span className="om-kpi__icon">
     <Icon name={icon} size={17}/>
    </span>
   </div>
   <strong className="om-kpi__value">{value}</strong>
   <small className="om-kpi__hint">{hint}</small>
  </article>
 );
}

export function SectionCard({
 title,
 subtitle,
 icon,
 actions,
 children,
 className="",
 padded=false,
}:{
 title:string;
 subtitle?:string;
 icon?:IconName;
 actions?:ReactNode;
 children:ReactNode;
 className?:string;
 padded?:boolean;
}){
 return (
  <section className={`om-card ${className}`.trim()}>
   <header className="om-card__head">
    <div className="om-card__heading">
     {icon&&(
      <span className="om-card__icon">
       <Icon name={icon} size={16}/>
      </span>
     )}
     <div>
      <h2>{title}</h2>
      {subtitle&&<p>{subtitle}</p>}
     </div>
    </div>
    {actions&&<div className="om-card__actions">{actions}</div>}
   </header>
   <div className={padded?"om-card__body om-card__body--pad":"om-card__body"}>{children}</div>
  </section>
 );
}

export function AttentionItem({
 href,
 label,
 hint,
 count,
 icon,
 tone="warn",
}:{
 href:string;
 label:string;
 hint:string;
 count?:number;
 icon:IconName;
 tone?:"warn"|"bad"|"neutral";
}){
 return (
  <Link href={href} className={`om-attention om-attention--${tone}`}>
   <span className="om-attention__icon">
    <Icon name={icon} size={17}/>
   </span>
   <div className="om-attention__copy">
    <strong>{label}</strong>
    <small>{hint}</small>
   </div>
   {count!==undefined&&<b className="om-attention__count">{count}</b>}
   <span className="om-attention__chev" aria-hidden="true">
    <Icon name="chevronRight" size={16}/>
   </span>
  </Link>
 );
}

export function EmptyState({
 icon="box",
 title,
 description,
 action,
}:{
 icon?:IconName;
 title:string;
 description?:string;
 action?:ReactNode;
}){
 return (
  <div className="om-empty">
   <span className="om-empty__icon">
    <Icon name={icon} size={22}/>
   </span>
   <strong>{title}</strong>
   {description&&<p>{description}</p>}
   {action&&<div className="om-empty__action">{action}</div>}
  </div>
 );
}

export function InfoCallout({
 icon="info",
 tone="info",
 children,
}:{
 icon?:IconName;
 tone?:"info"|"warning";
 children:ReactNode;
}){
 return (
  <div className={`om-callout om-callout--${tone}`}>
   <Icon name={icon} size={16}/>
   <div>{children}</div>
  </div>
 );
}
