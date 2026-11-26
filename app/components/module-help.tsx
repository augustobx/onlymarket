"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {usePathname} from "next/navigation";
import Link from "next/link";
import {Icon} from "./icons";
import {resolveModuleGuide} from "../guides/module-guides";
import {
 ASSISTANT_CATEGORIES,
 ASSISTANT_QUESTIONS,
 matchAssistantQuestions,
 type AssistantCategory,
 type AssistantQA,
} from "../guides/assistant-qa";

export function ModuleHelpButton({
 routeOverride,
 dark=false,
}:{
 routeOverride?:string;
 dark?:boolean;
}){
 const pathname=usePathname();
 const activeRoute=routeOverride??pathname;
 const guide=resolveModuleGuide(activeRoute);
 const [open,setOpen]=useState(false);
 const [query,setQuery]=useState("");
 const [category,setCategory]=useState<"Todas"|AssistantCategory>("Todas");
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [showModuleCycle,setShowModuleCycle]=useState(false);
 const ref=useRef<HTMLDialogElement>(null);

 useEffect(()=>{
  const dialog=ref.current;
  if(!dialog)return;
  if(open&&!dialog.open)dialog.showModal();
  if(!open&&dialog.open)dialog.close();
 },[open]);

 const {contextual,all}=useMemo(
  ()=>matchAssistantQuestions(query,activeRoute),
  [query,activeRoute]
 );

 const list=useMemo(
  ()=>all.filter(q=>category==="Todas"||q.category===category),
  [all,category]
 );

 const selected:AssistantQA|null=useMemo(
  ()=>selectedId?(ASSISTANT_QUESTIONS.find(q=>q.id===selectedId)??null):null,
  [selectedId]
 );

 const openModal=()=>{
  setSelectedId(null);
  setQuery("");
  setCategory("Todas");
  setShowModuleCycle(false);
  setOpen(true);
 };

 return (
  <>
   <button
    type="button"
    className={`om-help-trigger${dark?" om-help-trigger--dark":""}`}
    onClick={openModal}
    aria-label={`Ayuda: ${guide.title}`}
    title={`Asistente y guía rápida · ${guide.title}`}
   >
    <Icon name="help" size={16}/>
   </button>

   <dialog
    ref={ref}
    className="om-help-dialog om-assistant-dialog"
    aria-labelledby="om-help-dialog-title"
    onClose={()=>setOpen(false)}
    onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}
   >
    <div className="om-help-dialog__head">
     <div className="om-help-dialog__heading">
      <span className="om-help-dialog__icon">
       <Icon name={selected?selected.icon:guide.icon} size={18}/>
      </span>
      <div>
       <small>Asistente operativo · {guide.group}</small>
       <h2 id="om-help-dialog-title">{guide.title}</h2>
      </div>
     </div>
     <button
      type="button"
      className="secondary om-help-dialog__close"
      aria-label="Cerrar ayuda"
      onClick={()=>setOpen(false)}
     >
      <Icon name="x" size={16}/>
     </button>
    </div>

    <div className="om-help-dialog__body">
     {selected?(
      <div className="om-qa-answer">
       <button
        type="button"
        className="secondary om-qa-back"
        onClick={()=>setSelectedId(null)}
       >
        <Icon name="chevronLeft" size={15}/>
        <span>Volver a consultas</span>
       </button>

       <div className="om-qa-answer__head">
        <span className="om-qa-badge">{selected.category}</span>
        <h3>{selected.question}</h3>
        <p className="om-qa-quick">{selected.quickAnswer}</p>
       </div>

       <div className="om-qa-blocks">
        <div className="om-help-section">
         <h3>Cómo hacerlo paso a paso</h3>
         <ol className="om-help-list">
          {selected.steps.map(s=><li key={s}>{s}</li>)}
         </ol>
        </div>

        <div className="om-qa-effect">
         <strong>Qué pasa después en el sistema</strong>
         <p>{selected.whatHappens}</p>
        </div>
       </div>

       <div className="om-qa-actions">
        {selected.actions.map(act=>(
         <Link
          key={act.href+act.label}
          href={act.href}
          className="actionlink"
          onClick={()=>setOpen(false)}
         >
          <span>{act.label}</span>
          <Icon name="arrowUpRight" size={14}/>
         </Link>
        ))}
       </div>
      </div>
     ):(
      <>
       <div className="om-ayuda-search">
        <Icon name="search" size={16}/>
        <input
         aria-label="¿Qué necesitás hacer?"
         placeholder="Escribí tu duda (ej. carne, cargar lote, no aparece en caja, merma)..."
         value={query}
         onChange={e=>setQuery(e.target.value)}
        />
        {query&&(
         <button type="button" className="om-picker-clear" aria-label="Limpiar duda" onClick={()=>setQuery("")}>
          <Icon name="x" size={14}/>
         </button>
        )}
       </div>

       {!query.trim()&&(
        <div className="om-help-section">
         <h3>Frecuentes en esta pantalla</h3>
         <div className="om-qa-grid">
          {contextual.map(q=>(
           <button
            key={q.id}
            type="button"
            className="om-qa-card om-qa-card--featured"
            onClick={()=>setSelectedId(q.id)}
           >
            <span className="om-qa-card__icon"><Icon name={q.icon} size={16}/></span>
            <div className="om-qa-card__copy">
             <strong>{q.question}</strong>
             <small>{q.quickAnswer}</small>
            </div>
            <Icon name="chevronRight" size={16}/>
           </button>
          ))}
         </div>
        </div>
       )}

       <div className="om-help-section">
        <div className="om-qa-sectionhead">
         <h3>{query.trim()?"Consultas coincidentes":"Todas las consultas rápidas"}</h3>
         <div className="om-qa-pills">
          {(["Todas",...ASSISTANT_CATEGORIES] as const).map(c=>(
           <button
            key={c}
            type="button"
            className={"om-qa-pill"+(category===c?" active":"")}
            onClick={()=>setCategory(c)}
           >
            {c}
           </button>
          ))}
         </div>
        </div>

        {list.length>0?(
         <div className="om-qa-list">
          {list.map(q=>(
           <button
            key={q.id}
            type="button"
            className="om-qa-row"
            onClick={()=>setSelectedId(q.id)}
           >
            <Icon name={q.icon} size={15}/>
            <span>{q.question}</span>
            <small>{q.category}</small>
            <Icon name="chevronRight" size={14}/>
           </button>
          ))}
         </div>
        ):(
         <div className="om-picker-empty">
          No encontramos consultas para &ldquo;{query}&rdquo;. Probá con otra palabra (carne, lote, caja, devolución, stock).
         </div>
        )}
       </div>

       <div className="om-qa-cyclewrap">
        <button
         type="button"
         className="secondary om-qa-cycletoggle"
         onClick={()=>setShowModuleCycle(v=>!v)}
        >
         <Icon name="info" size={14}/>
         <span>{showModuleCycle?`Ocultar ficha de ${guide.title}`:`Ver ciclo de vida de esta pantalla (${guide.title})`}</span>
        </button>

        {showModuleCycle&&(
         <div className="om-qa-cyclepanel">
          <p className="om-help-dialog__summary">{guide.summary}</p>
          <div className="om-help-flow om-help-flow--compact">
           {guide.lifecycle.map((step,idx)=>(
            <div className="om-help-flow__item" key={step}>
             <span className="om-help-flow__num">{idx+1}</span>
             <span>{step}</span>
            </div>
           ))}
          </div>
         </div>
        )}
       </div>
      </>
     )}
    </div>

    <div className="om-help-dialog__foot">
     <Link href="/ayuda" className="actionlink secondarylink" onClick={()=>setOpen(false)}>
      <Icon name="help" size={14}/>
      <span>Abrir Centro de ayuda completo</span>
     </Link>
     <button type="button" onClick={()=>setOpen(false)}>Entendido</button>
    </div>
   </dialog>
  </>
 );
}
