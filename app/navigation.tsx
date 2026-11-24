"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useState,type ReactNode} from "react";

const paths:Record<string,string>={
 home:"M3 10 12 3l9 7v10H3z M9 20v-7h6v7",
 bell:"M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9 M10 21h4",
 cart:"M2 3h3l3 12h11l3-9H6 M9 20h.01 M19 20h.01",
 box:"M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10",
 grid:"M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
 truck:"M2 5h13v12H2z M15 9h4l3 4v4h-7 M5 20h2 M18 20h2",
 scale:"M12 3v18 M4 5h16 M4 5 1 13h6z M20 5l-3 8h6z M7 21h10",
 trace:"M5 4v16 M5 12h9l5-6 M5 16h9l5 4",
 tag:"M3 3h9l9 9-9 9-9-9z M7 7h.01",
 receipt:"M5 3h14v18l-3-2-4 2-4-2-3 2z M8 8h8 M8 12h8",
 wallet:"M3 6h18v14H3z M3 6l14-3v3 M17 12h4v4h-4z",
 chart:"M3 3v18h18 M7 17v-5 M12 17V7 M17 17v-8",
 settings:"M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
};

type Group={name:string;items:{href:string;label:string;icon:string}[]};

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

 useEffect(()=>{
  if(localStorage.getItem("nl-sidebar-plegado")==="1")setCollapsed(true);
 },[]);

 const toggleCollapse=()=>{
  setCollapsed(prev=>{
   const next=!prev;
   localStorage.setItem("nl-sidebar-plegado",next?"1":"0");
   return next;
  });
 };

 return (
  <div className={`workspace${collapsed?" workspace--collapsed":""}`}>
   <aside className={collapsed?"collapsed":""}>
    <div className="aside-top">
     <Link className="brand" href={brandHref} title="OnlyMarket · NanoLabs">
      <span className="brandmark" aria-hidden="true">
       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l1-5h16l1 5"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>
       </svg>
      </span>
      <span className="brandtext">Only<span>Market</span><small>by NanoLabs</small></span>
     </Link>
     <button type="button" className="collapse-btn secondary" onClick={toggleCollapse} aria-label={collapsed?"Expandir menú":"Contraer menú"} title={collapsed?"Expandir menú":"Contraer menú"}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
       {collapsed?<path d="M9 18l6-6-6-6"/>:<path d="M15 18l-6-6 6-6"/>}
      </svg>
     </button>
    </div>
    <div className="tenantcard">
     <small>COMERCIO ACTIVO</small>
     <strong>{tenantName}</strong>
     <span>{roleMeta}</span>
    </div>
    <button className="navtoggle secondary" type="button" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(v=>!v)}>
     Menú de módulos {mobileOpen?"−":"+"}
    </button>
    <nav className={mobileOpen?"navopen":""} aria-label="Módulos">
     {groups.map(g=>(
      <section key={g.name}>
       <small>{g.name}</small>
       {g.items.map(i=>{
        const active=i.href==="/"?pathname==="/":pathname===i.href||pathname.startsWith(i.href+"/");
        return (
         <Link
          key={i.href}
          href={i.href}
          aria-current={active?"page":undefined}
          className={active?"active":""}
          title={collapsed?i.label:undefined}
          onClick={()=>setMobileOpen(false)}
         >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
           <path d={paths[i.icon]??paths.grid}/>
          </svg>
          <span>{i.label}</span>
         </Link>
        );
       })}
      </section>
     ))}
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
