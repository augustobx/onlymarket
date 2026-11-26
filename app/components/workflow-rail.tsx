import Link from "next/link";
import {Icon,type IconName} from "./icons";

export type WorkflowStepId="catalog"|"receive"|"transform"|"review"|"pos";

export function WorkflowRail({
 current,
 showProduction=true,
}:{
 current:WorkflowStepId;
 showProduction?:boolean;
}){
 const steps:{id:WorkflowStepId;label:string;href:string;icon:IconName;hint:string}[]=[
  {id:"catalog",label:"1. Catálogo",href:"/catalogo",icon:"box",hint:"Crear productos"},
  {id:"receive",label:"2. Recepción",href:"/inventario?view=recepcion",icon:"truck",hint:"Entrar lotes y costo"},
  ...(showProduction?[{id:"transform" as const,label:"3. Desposte / frescos",href:"/transformaciones",icon:"scale" as IconName,hint:"Cortar o fraccionar"}]:[]),
  {id:"review",label:showProduction?"4. Control y stock":"3. Control y stock",href:"/inventario",icon:"layers",hint:"Revisar / habilitar"},
  {id:"pos",label:showProduction?"5. Caja POS":"4. Caja POS",href:"/pos",icon:"cart",hint:"Vender por FEFO"},
 ];

 const idx=steps.findIndex(s=>s.id===current);
 const next=idx>=0&&idx<steps.length-1?steps[idx+1]:steps[steps.length-1];

 return (
  <nav className="om-workflow-rail" aria-label="Ciclo de vida de la mercadería">
   <div className="om-workflow-rail__steps">
    {steps.map((s,i)=>{
     const state=s.id===current?"active":i<idx?"done":"upcoming";
     return (
      <Link key={s.id} href={s.href} className={`om-workflow-step om-workflow-step--${state}`}>
       <Icon name={s.icon} size={14}/>
       <div>
        <strong>{s.label}</strong>
        <small>{s.hint}</small>
       </div>
      </Link>
     );
    })}
   </div>
   {next&&next.id!==current&&(
    <Link href={next.href} className="om-workflow-rail__next">
     <span>Siguiente: {next.label.replace(/^\d+\.\s*/,"")}</span>
     <Icon name="chevronRight" size={14}/>
    </Link>
   )}
  </nav>
 );
}
