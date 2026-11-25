"use client";

import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {Icon} from "./icons";

export type ToastTone="success"|"error"|"info";
interface ToastItem{id:number;tone:ToastTone;title:string;message:string;}

const ToastContext=createContext<{push:(tone:ToastTone,message:string,title?:string)=>void}>({push:()=>{}});
export const useToast=()=>useContext(ToastContext);

export function ToastProvider({children}:{children:ReactNode}){
 const [items,setItems]=useState<ToastItem[]>([]);
 const nextId=useRef(1);

 const dismiss=useCallback((id:number)=>{
  setItems(prev=>prev.filter(t=>t.id!==id));
 },[]);

 const push=useCallback((tone:ToastTone,message:string,title?:string)=>{
  const id=nextId.current++;
  const fallback=tone==="success"?"Operación confirmada":tone==="error"?"No se pudo completar":"Aviso";
  setItems(prev=>[...prev.slice(-3),{id,tone,title:title??fallback,message}]);
  setTimeout(()=>dismiss(id),4800);
 },[dismiss]);

 return (
  <ToastContext.Provider value={{push}}>
   {children}
   <div className="om-toast-stack" aria-live="polite" aria-atomic="false">
    {items.map(t=>(
     <div key={t.id} className={`om-toast om-toast--${t.tone}`}>
      <span className="om-toast__icon">
       <Icon name={t.tone==="success"?"check":t.tone==="error"?"alert":"info"} size={16}/>
      </span>
      <div className="om-toast__body">
       <strong>{t.title}</strong>
       <span>{t.message}</span>
      </div>
      <button type="button" className="om-toast__close" aria-label="Cerrar notificación" onClick={()=>dismiss(t.id)}>
       <Icon name="x" size={14}/>
      </button>
     </div>
    ))}
   </div>
  </ToastContext.Provider>
 );
}

export function ToastTrigger({tone,message}:{tone:ToastTone;message:string}){
 const {push}=useToast();
 const sent=useRef("");
 useEffect(()=>{
  const key=`${tone}:${message}`;
  if(message&&sent.current!==key){
   sent.current=key;
   push(tone,message);
  }
 },[tone,message,push]);
 return null;
}
