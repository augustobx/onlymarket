"use client";
import {useEffect,useId,useRef,useState,type ReactNode} from "react";

/** Native modal: top layer, keyboard focus trap, Escape and focus restoration. */
export function OperationDialog({title,trigger,description,children,variant="primary",wide=false,drawer=false}:{title:string;trigger:string;description?:string;children:ReactNode;variant?:"primary"|"secondary";wide?:boolean;drawer?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null),button=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false);
 const id=useId();
 useEffect(()=>{
  const d=dialog.current;
  if(open&&d&&!d.open)d.showModal();
 },[open]);
 function close(){dialog.current?.close();}
 return <>
  <button ref={button} type="button" className={variant==="secondary"?"secondary om-operation-trigger":"om-operation-trigger"} onClick={()=>setOpen(true)}>{trigger}</button>
  {open&&<dialog ref={dialog} className={"om-dialog"+(drawer?" v2-drawer":wide?" om-dialog-wide":"")} aria-labelledby={id} onClose={()=>{setOpen(false);button.current?.focus();}}>
   <header className="om-dialog-header"><div><span className="om-kicker">OnlyMarket · Operación</span><h2 id={id}>{title}</h2>{description&&<p>{description}</p>}</div><button type="button" className="secondary om-close" aria-label="Cerrar ventana" onClick={close}>×</button></header>
   <div className="om-dialog-body">{children}</div>
   <footer className="om-dialog-footer"><button type="button" className="secondary" onClick={close}>Cerrar</button></footer>
  </dialog>}
 </>;
}
