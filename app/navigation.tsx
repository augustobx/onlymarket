"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useState,type ReactNode} from "react";
import {Icon,type IconName} from "./components/icons";

type Group={name:string;pinned?:boolean;items:{href:string;label:string;icon:IconName}[]};

const isItemActive=(pathname:string,href:string)=>
 href==="/"?pathname==="/":pathname===href||pathname.startsWith(href+"/");

export function WorkspaceFrame({
 brandHref,
 tenantName,
 roleMeta,
 groups,
 footer,
 header,
 children,
}:{
 brandHref:string;
 tenantName:string;
 roleMeta:string;
 groups:Group[];
 footer:ReactNode;
 header:ReactNode;
 children:ReactNode;
}){
 const pathname=usePathname();
 const [mobileOpen,setMobileOpen]=useState(false);
 const [collapsed,setCollapsed]=useState(false);
 const [filter,setFilter]=useState("");
 const [openGroups,setOpenGroups]=useState<Record<string,boolean>>({});

 const normalized=filter.trim().toLocaleLowerCase("es-AR");
 const visibleGroups=groups
  .map(g=>({...g,items:g.items.filter(i=>i.label.toLocaleLowerCase("es-AR").includes(normalized))}))
  .filter(g=>g.items.length);

 useEffect(()=>{
  if(localStorage.getItem("nl-sidebar-plegado")==="1")setCollapsed(true);
  try{
   const saved=localStorage.getItem("om-nav-open-groups");
   if(saved){
    const parsed=JSON.parse(saved);
    if(parsed&&typeof parsed==="object")setOpenGroups(parsed);
   }
  }catch{}
 },[]);

 useEffect(()=>{
  const match=groups.find(g=>g.items.some(i=>isItemActive(pathname,i.href)));
  if(match&&!match.pinned){
   setOpenGroups(prev=>prev[match.name]?prev:{...prev,[match.name]:true});
  }
 },[pathname,groups]);

 const toggleCollapse=()=>{
  setCollapsed(prev=>{
   const next=!prev;
   localStorage.setItem("nl-sidebar-plegado",next?"1":"0");
   return next;
  });
 };

 const toggleGroup=(name:string)=>{
  setOpenGroups(prev=>{
   const next={...prev,[name]:!prev[name]};
   try{localStorage.setItem("om-nav-open-groups",JSON.stringify(next));}catch{}
   return next;
  });
 };

 return (
  <div className={`workspace market-v2${collapsed?" workspace--collapsed":""}`}>
   <aside className={collapsed?"collapsed":""}>
    <div className="aside-top">
     <Link className="brand" href={brandHref} title="OnlyMarket · NanoLabs">
      <span className="brandmark" aria-hidden="true">
       <Icon name="store" size={20}/>
      </span>
      <span className="brandtext">
       Only<span>Market</span>
       <small>by NanoLabs</small>
      </span>
     </Link>
     <button
      type="button"
      className="collapse-btn secondary"
      onClick={toggleCollapse}
      aria-label={collapsed?"Expandir menú":"Contraer menú"}
      title={collapsed?"Expandir menú":"Contraer menú"}
     >
      <Icon name={collapsed?"chevronRight":"chevronLeft"} size={16}/>
     </button>
    </div>

    <div className="tenantcard">
     <small>COMERCIO ACTIVO</small>
     <strong>{tenantName}</strong>
     <span>{roleMeta}</span>
    </div>

    <button
     className="navtoggle secondary"
     type="button"
     aria-expanded={mobileOpen}
     onClick={()=>setMobileOpen(v=>!v)}
    >
     <Icon name="menu" size={16}/>
     <span>{mobileOpen?"Ocultar módulos":"Menú de módulos"}</span>
    </button>

    <nav className={mobileOpen?"navopen":""} aria-label="Módulos">
     {!collapsed&&(
      <div className="om-nav-search">
       <Icon name="search" size={15}/>
       <input
        aria-label="Buscar módulo"
        placeholder="Buscar módulo..."
        value={filter}
        onChange={e=>setFilter(e.target.value)}
       />
      </div>
     )}
     {(collapsed?groups:visibleGroups).map(g=>{
      const hasActive=g.items.some(i=>isItemActive(pathname,i.href));
      const isExpanded=collapsed||Boolean(g.pinned)||Boolean(normalized)||Boolean(openGroups[g.name])||hasActive;
      return (
       <section key={g.name}>
        {g.pinned||collapsed?(
         <small>{g.name}</small>
        ):(
         <button
          type="button"
          className={`om-nav-group-btn${hasActive?" has-active":""}`}
          aria-expanded={isExpanded}
          onClick={()=>toggleGroup(g.name)}
         >
          <span>{g.name}</span>
          <Icon name={isExpanded?"chevronDown":"chevronRight"} size={13}/>
         </button>
        )}
        {isExpanded&&g.items.map(i=>{
         const active=isItemActive(pathname,i.href);
         return (
          <Link
           key={i.href}
           href={i.href}
           aria-current={active?"page":undefined}
           className={active?"active":""}
           title={collapsed?i.label:undefined}
           onClick={()=>{setMobileOpen(false);setFilter("");}}
          >
           <Icon name={i.icon} size={17}/>
           <span>{i.label}</span>
          </Link>
         );
        })}
       </section>
      );
     })}
    </nav>

    <div className="sidefooter">{footer}</div>
   </aside>

   <div className="maincolumn">
    {header}
    <main className="content">{children}</main>
   </div>
  </div>
 );
}
