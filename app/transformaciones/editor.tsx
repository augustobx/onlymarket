"use client";
import {useState} from "react";
import {useFormStatus} from "react-dom";
import {transformAction,saveTemplate} from "../actions";
import {decimal} from "../../src/domain/parse.mjs";
import {consumeCost,planTransformation} from "../../src/domain/inventory.mjs";
import {SectionCard,InfoCallout} from "../components/retail-ui";
import {Icon} from "../components/icons";
import {SearchPicker,type SearchPickerItem} from "../components/search-picker";

type Product={id:string;name:string;sku?:string;barcode?:string|null;weightCode?:string|null;sector?:string;price?:string};
type Lot={id:string;branchId:string;label:string;title?:string;subtitle?:string;stock?:string;price?:string;quantity:string;cost:string};
type Row={disposition:string;productId:string;reason:string;quantity:string};
type Template={id:string;name:string;lines:{disposition:string;productId:string;reason:string}[]};

const blank=():Row=>({disposition:"STOCK",productId:"",reason:"",quantity:""});
const format=(n:bigint,scale:number)=>{
 const a=(n<0n?-n:n).toString().padStart(scale+1,"0");
 return (n<0n?"-":"")+a.slice(0,-scale)+","+a.slice(-scale);
};

function Submit({valid}:{valid:boolean}){
 const {pending}=useFormStatus();
 return (
  <button disabled={!valid||pending}>
   <Icon name="check" size={16}/>
   <span>{pending?"Registrando…":"Confirmar transformación"}</span>
  </button>
 );
}

export default function Editor({
 products,
 lots,
 templates,
 requestKey,
}:{
 products:Product[];
 lots:Lot[];
 templates:Template[];
 requestKey:string;
}){
 const [source,setSource]=useState("");
 const [input,setInput]=useState("");
 const [rows,setRows]=useState<Row[]>([blank()]);
 const [templateName,setTemplateName]=useState("");

 const lot=lots.find(l=>l.id===source);
 const set=(i:number,key:keyof Row,value:string)=>setRows(old=>old.map((r,j)=>j===i?{...r,[key]:value}:r));

 let entered=0n;
 let output=0n;
 let valid=false;
 let cost:bigint|null=null;
 let planned:{costCents:bigint}[]=[];

 try{
  entered=decimal(input,3,"Entrada");
  const lines=rows.map(r=>({...r,quantityMilli:decimal(r.quantity,3,"Peso")}));
  output=lines.reduce((a,r)=>a+r.quantityMilli,0n);
  if(lot){
   cost=consumeCost(BigInt(lot.quantity),BigInt(lot.cost),entered);
   planned=planTransformation(entered,cost,lines);
   valid=true;
  }
 }catch{}

 output=rows.reduce((a,r)=>{try{return a+decimal(r.quantity,3,"Peso");}catch{return a;}},0n);
 const difference=entered-output;
 const templateData=rows.map(({disposition,productId,reason})=>({disposition,productId,reason}));
 const weights=rows.map(r=>{try{return decimal(r.quantity,3,"Peso");}catch{return 0n;}});
 const stock=rows.reduce((a,r,i)=>a+(r.disposition==="STOCK"?weights[i]:0n),0n);
 const waste=rows.reduce((a,r,i)=>a+(r.disposition==="WASTE"?weights[i]:0n),0n);
 const gift=output-stock-waste;
 const lossCost=planned.length===rows.length?rows.reduce((a,r,i)=>a+(r.disposition==="STOCK"?0n:planned[i].costCents),0n):null;
 const pct=(v:bigint)=>entered>0n?Number(v*10000n/entered)/100:0;

 return (
  <div className="v2-stack">
   <form action={transformAction} className="v2-station-form">
    <input type="hidden" name="requestKey" value={requestKey}/>
    <input type="hidden" name="branchId" value={lot?.branchId??""}/>

    <div className="v2-steps">
     <b>1 · Lote de origen</b>
     <span>›</span>
     <b>2 · Distribución de cortes</b>
     <span>›</span>
     <span>3 · Balance y confirmación</span>
    </div>

    <div className="v2-station-grid v2-production-grid">
     <div className="v2-stack">
      <SectionCard title="Lote de origen" subtitle="Seleccioná la pieza o media res a procesar" icon="box" padded>
       <div className="v2-fields">
        <label>
         Lote de origen
         <SearchPicker
          name="sourceLotId"
          ariaLabel="Lote de origen"
          required
          placeholder="Buscar lote por producto, código o sucursal..."
          items={lots.map((l):SearchPickerItem=>({
           id:l.id,
           title:l.title??l.label,
           subtitle:l.subtitle,
           stock:l.stock,
           price:l.price,
           searchText:l.label,
          }))}
          value={source}
          onChange={id=>{setSource(id);setInput("");}}
         />
        </label>
        <label>
         Peso a transformar (kg)
         <input name="input" required inputMode="decimal" value={input} onChange={e=>setInput(e.target.value)} placeholder="0,000"/>
        </label>
       </div>
      </SectionCard>

      <SectionCard
       title="Distribución de cortes"
       subtitle="Pesos reales asignados por destino"
       icon="scale"
       actions={
        <button type="button" className="secondary" disabled={rows.length>=100} onClick={()=>setRows(old=>[...old,blank()])}>
         <Icon name="plus" size={15}/>
         <span>Agregar salida</span>
        </button>
       }
      >
       <div className="tablewrap">
        <table className="v2-entry-table">
         <thead>
          <tr>
           <th>Salida / corte</th>
           <th>Destino</th>
           <th>Peso kg</th>
           <th>Costo asignado</th>
           <th></th>
          </tr>
         </thead>
         <tbody>
          {rows.map((r,i)=>(
           <tr key={i}>
            <td>
             <div className="v2-output-product">
              <SearchPicker
               name={"product"+i}
               ariaLabel={"Producto "+(i+1)}
               required={r.disposition==="STOCK"}
               disabled={r.disposition!=="STOCK"}
               placeholder="Buscar corte/producto por nombre o SKU..."
               items={products.map((p):SearchPickerItem=>({
                id:p.id,
                title:p.name,
                badge:p.sector,
                subtitle:`${p.sku?"SKU "+p.sku:""}${p.barcode?" · EAN "+p.barcode:""}${p.weightCode?" · PLU "+p.weightCode:""}`,
                price:p.price?`${p.price}/kg`:undefined,
                searchText:`${p.name} ${p.sku??""} ${p.barcode??""} ${p.weightCode??""} ${p.sector??""}`,
               }))}
               value={r.productId}
               onChange={id=>{
                set(i,"productId",id);
                if(!r.reason)set(i,"reason",products.find(p=>p.id===id)?.name??"");
               }}
              />
              <input
               aria-label={"Motivo / detalle "+(i+1)}
               name={"reason"+i}
               required
               maxLength={300}
               placeholder="Motivo / detalle"
               value={r.reason}
               onChange={e=>set(i,"reason",e.target.value)}
              />
             </div>
            </td>
            <td>
             <select aria-label={"Destino "+(i+1)} name={"disposition"+i} value={r.disposition} onChange={e=>set(i,"disposition",e.target.value)}>
              <option value="STOCK">Corte / stock</option>
              <option value="GIFT">Regalo</option>
              <option value="WASTE">Merma</option>
             </select>
            </td>
            <td>
             <input aria-label={"Peso kg "+(i+1)} name={"quantity"+i} required inputMode="decimal" value={r.quantity} onChange={e=>set(i,"quantity",e.target.value)}/>
            </td>
            <td className="mono">{planned[i]?"$ "+format(planned[i].costCents,2):"—"}</td>
            <td>
             <button
              type="button"
              className="secondary"
              disabled={rows.length===1}
              onClick={()=>setRows(old=>old.filter((_,j)=>j!==i))}
              aria-label={"Quitar salida "+(i+1)}
             >
              <Icon name="trash" size={14}/>
             </button>
            </td>
           </tr>
          ))}
         </tbody>
        </table>
       </div>

       <div className="om-card__body--pad">
        <label style={{maxWidth:360}}>
         Cargar plantilla existente
         <select
          defaultValue=""
          onChange={e=>{
           const t=templates.find(x=>x.id===e.target.value);
           if(t)setRows(t.lines.map(r=>({...r,quantity:""})));
           e.target.value="";
          }}
         >
          <option value="">Elegir plantilla (opcional)</option>
          {templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
         </select>
        </label>
       </div>
      </SectionCard>
     </div>

     <aside className="v2-station-aside">
      <SectionCard title="Balance en vivo" subtitle="Control físico y económico" icon="chart" padded>
       <span className="om-kicker">Rendimiento comercial</span>
       <strong className="v2-yield">{pct(stock).toLocaleString("es-AR")}%</strong>
       <div className="v2-yield-track">
        {[stock,waste,gift].map((v,i)=>(
         <span key={i} style={{width:(output>0n?Number(v*10000n/(entered>output?entered:output))/100:0)+"%"}}/>
        ))}
       </div>
       <small style={{display:"block",marginBottom:12}}>Verde: Stock · Rojo: Merma · Ámbar: Regalo</small>

       {[
        ["Entrada",format(entered,3)+" kg"],
        ["Salida comercial",format(stock,3)+" kg"],
        ["Merma / regalo",format(waste+gift,3)+" kg"],
        ["Diferencia pendiente",format(difference,3)+" kg"],
        ["Costo de entrada",cost===null?"—":"$ "+format(cost,2)],
        ["Costo de pérdidas",lossCost===null?"—":"$ "+format(lossCost,2)],
       ].map(([k,v])=>(
        <div className="v2-totalline" key={String(k)}>
         <span>{k}</span>
         <strong>{v}</strong>
        </div>
       ))}

       <div style={{marginTop:14}}>
        <span className={"status "+(valid?"AVAILABLE":"REVIEW")}>
         {valid?"Balance correcto":"Revisar cantidades y datos"}
        </span>
       </div>
      </SectionCard>

      <InfoCallout icon="info" tone="warning">
       Las salidas comerciales quedan retenidas para revisión antes de venderse en POS.
      </InfoCallout>

      <Submit valid={valid}/>
     </aside>
    </div>
   </form>

   <SectionCard title="Guardar plantilla de salidas" subtitle="Guardá esta estructura de cortes (sin pesos) para futuros despostes" icon="layers" padded>
    <form action={saveTemplate} className="formgrid">
     <input type="hidden" name="templateLines" value={JSON.stringify(templateData)}/>
     <label>
      Nombre de la plantilla
      <input name="templateName" value={templateName} onChange={e=>setTemplateName(e.target.value)} required maxLength={100} placeholder="Ej. Media res estándar"/>
     </label>
     <button className="secondary">Guardar plantilla</button>
    </form>
   </SectionCard>
  </div>
 );
}
