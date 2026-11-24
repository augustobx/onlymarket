"use client";
import {useState} from "react";
export default function RuleFields(){
 const [kind,setKind]=useState("PERCENT");
 return <><label>Tipo de promoción<select name="kind" value={kind} onChange={e=>setKind(e.target.value)}><option value="PERCENT">Descuento porcentual</option><option value="QUANTITY">Descuento por cantidad mínima</option><option value="BUNDLE">Llevá N, pagá M (por unidad)</option></select></label>{kind!=="BUNDLE"&&<label>Descuento %<input name="discount" inputMode="decimal" required/></label>}{kind==="QUANTITY"&&<label>Cantidad mínima (kg o u.)<input name="minimum" inputMode="decimal" required/></label>}{kind==="BUNDLE"&&<><label>Unidades que lleva<input name="buyUnits" type="number" min="2" max="100" defaultValue="2" required/></label><label>Unidades que paga<input name="payUnits" type="number" min="1" max="99" defaultValue="1" required/></label></>}</>;
}
