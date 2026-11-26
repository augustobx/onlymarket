import {requireSession} from "../../src/server/auth";
import {Shell} from "../ui";
import {PageHeader,SectionCard} from "../components/retail-ui";
import {Icon} from "../components/icons";
import {SYSTEM_OVERVIEW} from "../guides/module-guides";
import GuidesClient from "./guides-client";

export const dynamic="force-dynamic";

export default async function Page(){
 const s=await requireSession();
 return (
  <Shell title="Centro de ayuda" allowCashier>
   <PageHeader
    kicker="DOCUMENTACIÓN INTERACTIVA"
    title="Centro de ayuda y guías del sistema"
    subtitle="Explicación clara del funcionamiento de OnlyMarket, su ciclo operativo completo y la guía rápida de cada módulo."
    actions={
     <a href="/manual-usuario.html" target="_blank" rel="noopener noreferrer" className="actionlink">
      <Icon name="info" size={15}/>
      <span>Manual de usuario completo (HTML)</span>
      <Icon name="arrowUpRight" size={14}/>
     </a>
    }
   />

   <SectionCard
    title={SYSTEM_OVERVIEW.title}
    subtitle={SYSTEM_OVERVIEW.subtitle}
    icon="help"
    padded
    className="om-ayuda-hero"
   >
    <div className="om-ayuda-flowband">
     {SYSTEM_OVERVIEW.flow.map((step,idx)=>(
      <div className="om-ayuda-flowstep" key={step}>
       <span>{step}</span>
       {idx<SYSTEM_OVERVIEW.flow.length-1&&<Icon name="chevronRight" size={15}/>}
      </div>
     ))}
    </div>

    <div className="om-ayuda-pillars">
     {SYSTEM_OVERVIEW.pillars.map(p=>(
      <div className="om-ayuda-pillar" key={p.title}>
       <strong>{p.title}</strong>
       <p>{p.description}</p>
      </div>
     ))}
    </div>
   </SectionCard>

   <GuidesClient role={s.role}/>
  </Shell>
 );
}
