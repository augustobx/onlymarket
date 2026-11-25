"use client";
import {useState,type ReactNode} from "react";

export default function PrintButton({toolsLeft,children}:{toolsLeft:ReactNode;children:ReactNode}){
 const [paper,setPaper]=useState<"80"|"58">("80");
 return (
  <main className="ticketpage">
   <div className="tickettools">
    {toolsLeft}
    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
     <select aria-label="Ancho de impresora" value={paper} onChange={e=>setPaper(e.target.value==="58"?"58":"80")} style={{minWidth:112}}>
      <option value="80">Térmica 80 mm</option>
      <option value="58">Térmica 58 mm</option>
     </select>
     <button type="button" onClick={()=>window.print()}>Imprimir comprobante</button>
    </div>
   </div>
   <div className={paper==="58"?"ticketwrap-58":"ticketwrap-80"}>{children}</div>
  </main>
 );
}
