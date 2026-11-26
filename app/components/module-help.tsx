"use client";
import {useEffect,useRef,useState} from "react";
import {usePathname} from "next/navigation";
import Link from "next/link";
import {Icon} from "./icons";
import {resolveModuleGuide} from "../guides/module-guides";

export function ModuleHelpButton({
 routeOverride,
 dark=false,
}:{
 routeOverride?:string;
 dark?:boolean;
}){
 const pathname=usePathname();
 const guide=resolveModuleGuide(routeOverride??pathname);
 const [open,setOpen]=useState(false);
 const ref=useRef<HTMLDialogElement>(null);

 useEffect(()=>{
  const dialog=ref.current;
  if(!dialog)return;
  if(open&&!dialog.open)dialog.showModal();
  if(!open&&dialog.open)dialog.close();
 },[open]);

 return (
  <>
   <button
    type="button"
    className={`om-help-trigger${dark?" om-help-trigger--dark":""}`}
    onClick={()=>setOpen(true)}
    aria-label={`Ayuda: ${guide.title}`}
    title={`Guía rápida y ciclo de vida · ${guide.title}`}
   >
    <Icon name="help" size={16}/>
   </button>

   <dialog
    ref={ref}
    className="om-help-dialog"
    aria-labelledby="om-help-dialog-title"
    onClose={()=>setOpen(false)}
    onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}
   >
    <div className="om-help-dialog__head">
     <div className="om-help-dialog__heading">
      <span className="om-help-dialog__icon">
       <Icon name={guide.icon} size={18}/>
      </span>
      <div>
       <small>{guide.group} · Guía rápida</small>
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
     <p className="om-help-dialog__summary">{guide.summary}</p>

     <div className="om-help-section">
      <h3>Ciclo de vida</h3>
      <div className="om-help-flow">
       {guide.lifecycle.map((step,idx)=>(
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
        {guide.howTo.map(line=><li key={line}>{line}</li>)}
       </ol>
      </div>

      <div className="om-help-section">
       <h3>Qué esperar</h3>
       <ul className="om-help-list">
        {guide.whatToExpect.map(line=><li key={line}>{line}</li>)}
       </ul>
      </div>
     </div>

     {guide.tip&&(
      <div className="om-help-tip">
       <Icon name="info" size={15}/>
       <span>{guide.tip}</span>
      </div>
     )}
    </div>

    <div className="om-help-dialog__foot">
     <Link href="/ayuda" className="actionlink secondarylink" onClick={()=>setOpen(false)}>
      <Icon name="help" size={14}/>
      <span>Ver todas las guías del sistema</span>
     </Link>
     <button type="button" onClick={()=>setOpen(false)}>Entendido</button>
    </div>
   </dialog>
  </>
 );
}
