"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {matchesSearch} from "../../src/domain/search.mjs";
import {Icon} from "../components/icons";
import {MODULE_GUIDES,type ModuleGuide} from "../guides/module-guides";
import {
 ASSISTANT_CATEGORIES,
 ASSISTANT_QUESTIONS,
 matchAssistantQuestions,
 type AssistantCategory,
 type AssistantQA,
} from "../guides/assistant-qa";

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
 const [qaQuery,setQaQuery]=useState("");
 const [qaCat,setQaCat]=useState<"Todas"|AssistantCategory>("Todas");
 const [selectedQA,setSelectedQA]=useState<AssistantQA>(ASSISTANT_QUESTIONS[0]);

 const [query,setQuery]=useState("");
 const [group,setGroup]=useState<(typeof groups)[number]>("Todos");

 const qaFiltered=useMemo(()=>{
  const {all}=matchAssistantQuestions(qaQuery,"/ayuda");
  return all.filter(q=>qaCat==="Todas"||q.category===qaCat);
 },[qaQuery,qaCat]);

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

 const canOpenRoute=(href:string)=>{
  const path=href.split("?")[0];
  if(role==="CASHIER")return path==="/pos"||path==="/cuenta"||path==="/ayuda";
  if(role==="INVENTORY"){
   return !["/promociones","/combos","/clientes","/ventas","/finanzas","/informes","/auditoria","/administracion","/configuracion"].includes(path);
  }
  if(role==="MANAGER"){
   return !["/administracion","/configuracion"].includes(path);
  }
  return true;
 };

 return (
  <div className="om-ayuda-guides">
   <section className="om-card om-ayuda-assistant">
    <header className="om-card__head">
     <div className="om-card__heading">
      <span className="om-card__icon"><Icon name="help" size={16}/></span>
      <div>
       <h2>Asistente por tareas: tocá lo que querés hacer</h2>
       <p>Preguntas concretas de operación diaria con pasos directos y accesos al módulo correcto.</p>
      </div>
     </div>
    </header>

    <div className="om-card__body--pad om-ayuda-qa-layout">
     <div className="om-ayuda-qa-left">
      <div className="om-ayuda-search">
       <Icon name="search" size={16}/>
       <input
        aria-label="Buscá qué querés hacer"
        placeholder="Ej: ingreso de carne, lote, no aparece en caja, devolución..."
        value={qaQuery}
        onChange={e=>setQaQuery(e.target.value)}
       />
      </div>

      <div className="om-qa-pills">
       {(["Todas",...ASSISTANT_CATEGORIES] as const).map(c=>(
        <button
         key={c}
         type="button"
         className={"om-qa-pill"+(qaCat===c?" active":"")}
         onClick={()=>setQaCat(c)}
        >
         {c}
        </button>
       ))}
      </div>

      <div className="om-qa-list">
       {qaFiltered.map(q=>(
        <button
         key={q.id}
         type="button"
         className={"om-qa-row"+(selectedQA.id===q.id?" active":"")}
         onClick={()=>setSelectedQA(q)}
        >
         <Icon name={q.icon} size={15}/>
         <span>{q.question}</span>
         <Icon name="chevronRight" size={14}/>
        </button>
       ))}
       {qaFiltered.length===0&&(
        <div className="om-picker-empty">Sin consultas coincidentes para &ldquo;{qaQuery}&rdquo;.</div>
       )}
      </div>
     </div>

     <div className="om-ayuda-qa-right">
      <div className="om-qa-answer">
       <div className="om-qa-answer__head">
        <span className="om-qa-badge">{selectedQA.category}</span>
        <h3>{selectedQA.question}</h3>
        <p className="om-qa-quick">{selectedQA.quickAnswer}</p>
       </div>

       <div className="om-help-section">
        <h3>Paso a paso</h3>
        <ol className="om-help-list">
         {selectedQA.steps.map(s=><li key={s}>{s}</li>)}
        </ol>
       </div>

       <div className="om-qa-effect">
        <strong>Qué pasa en el sistema</strong>
        <p>{selectedQA.whatHappens}</p>
       </div>

       <div className="om-qa-actions">
        {selectedQA.actions.filter(a=>canOpenRoute(a.href)).map(act=>(
         <Link key={act.href+act.label} href={act.href} className="actionlink">
          <span>{act.label}</span>
          <Icon name="arrowUpRight" size={14}/>
         </Link>
        ))}
       </div>
      </div>
     </div>
    </div>
   </section>

   <div className="om-ayuda-toolbar">
    <div className="om-ayuda-search">
     <Icon name="search" size={16}/>
     <input
      aria-label="Buscar guía o tema"
      placeholder="Buscá un módulo o referencia (ej. lote, FEFO, arqueo, devolución, balanza, CSV)..."
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
       {canOpenRoute(g.route)&&(
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
