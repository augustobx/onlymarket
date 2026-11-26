"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {matchesSearch} from "../../src/domain/search.mjs";
import {Icon} from "../components/icons";
import {MODULE_GUIDES,type ModuleGuide} from "../guides/module-guides";

const groups:["Todos",...ModuleGuide["group"][]]=[
 "Todos",
 "Operación",
 "Mercadería",
 "Producción y frescos",
 "Comercial",
 "Administración",
 "Cuenta y ayuda",
];

export default function GuidesClient({role}:{role:string}){
 const [query,setQuery]=useState("");
 const [group,setGroup]=useState<(typeof groups)[number]>("Todos");

 const visible=useMemo(()=>{
  return MODULE_GUIDES.filter(g=>{
   if(group!=="Todos"&&g.group!==group)return false;
   if(!query.trim())return true;
   return matchesSearch(query,[
    g.title,
    g.group,
    g.summary,
    ...g.lifecycle,
    ...g.howTo,
    ...g.whatToExpect,
    g.tip??"",
   ]);
  });
 },[query,group]);

 const canOpen=(g:ModuleGuide)=>{
  if(role==="CASHIER")return g.route==="/pos"||g.route==="/cuenta"||g.route==="/ayuda";
  if(role==="INVENTORY"){
   return !["/promociones","/combos","/clientes","/ventas","/finanzas","/informes","/auditoria","/administracion","/configuracion"].includes(g.route);
  }
  if(role==="MANAGER"){
   return !["/administracion","/configuracion"].includes(g.route);
  }
  return true;
 };

 return (
  <div className="om-ayuda-guides">
   <div className="om-ayuda-toolbar">
    <div className="om-ayuda-search">
     <Icon name="search" size={16}/>
     <input
      aria-label="Buscar guía o tema"
      placeholder="Buscá un módulo o duda (ej. lote, FEFO, arqueo, devolución, balanza, CSV)..."
      value={query}
      onChange={e=>setQuery(e.target.value)}
     />
     {query&&(
      <button type="button" className="om-picker-clear" aria-label="Limpiar búsqueda" onClick={()=>setQuery("")}>
       <Icon name="x" size={14}/>
      </button>
     )}
    </div>

    <div className="v2-tabs" role="tablist" aria-label="Filtrar guías por área">
     {groups.map(name=>(
      <button
       key={name}
       type="button"
       role="tab"
       aria-selected={group===name}
       className={group===name?"active":""}
       onClick={()=>setGroup(name)}
      >
       {name}
      </button>
     ))}
    </div>
   </div>

   <div className="om-ayuda-grid">
    {visible.map(g=>(
     <article className="om-ayuda-card" key={g.id}>
      <header className="om-ayuda-card__head">
       <div className="om-ayuda-card__title">
        <span className="om-card__icon">
         <Icon name={g.icon} size={17}/>
        </span>
        <div>
         <small>{g.group}</small>
         <h2>{g.title}</h2>
        </div>
       </div>
       {canOpen(g)&&(
        <Link href={g.route} className="om-link-chip">
         <span>Abrir</span>
         <Icon name="arrowUpRight" size={13}/>
        </Link>
       )}
      </header>

      <p className="om-ayuda-card__summary">{g.summary}</p>

      <div className="om-help-section">
       <h3>Ciclo de vida</h3>
       <div className="om-help-flow om-help-flow--compact">
        {g.lifecycle.map((step,idx)=>(
         <div className="om-help-flow__item" key={step}>
          <span className="om-help-flow__num">{idx+1}</span>
          <span>{step}</span>
         </div>
        ))}
       </div>
      </div>

      <div className="om-help-cols">
       <div className="om-help-section">
        <h3>Cómo se usa</h3>
        <ol className="om-help-list">
         {g.howTo.map(line=><li key={line}>{line}</li>)}
        </ol>
       </div>
       <div className="om-help-section">
        <h3>Qué esperar</h3>
        <ul className="om-help-list">
         {g.whatToExpect.map(line=><li key={line}>{line}</li>)}
        </ul>
       </div>
      </div>

      {g.tip&&(
       <div className="om-help-tip">
        <Icon name="info" size={14}/>
        <span>{g.tip}</span>
       </div>
      )}
     </article>
    ))}
   </div>

   {visible.length===0&&(
    <div className="om-empty">
     <span className="om-empty__icon"><Icon name="search" size={20}/></span>
     <strong>No encontramos guías para &ldquo;{query}&rdquo;</strong>
     <p>Probá con otra palabra clave o seleccioná la pestaña «Todos».</p>
    </div>
   )}
  </div>
 );
}
