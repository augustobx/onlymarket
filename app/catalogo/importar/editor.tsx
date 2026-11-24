"use client";
import {useState} from "react";
import {useFormStatus} from "react-dom";
import {parseCatalogCsv,catalogHeader} from "../../../src/domain/catalog-import.mjs";
import {importCatalog} from "./actions";
function Submit({disabled}:{disabled:boolean}){const {pending}=useFormStatus();return <button disabled={disabled||pending}>{pending?"Importando…":"Importar productos"}</button>;}
export default function Editor(){
 const [raw,setRaw]=useState(""),[fileError,setFileError]=useState("");
 let items:ReturnType<typeof parseCatalogCsv>=[],error="";
 if(raw)try{items=parseCatalogCsv(raw);}catch(e){error=e instanceof Error?e.message:"CSV inválido";}
 const example=catalogHeader+"\nYERBA-001;Yerba mate;;UNIDAD;ALMACEN;2500,00;3;;\n";
 return <div className="fields"><a className="actionlink secondarylink" download="onlymarket-catalogo.csv" href={"data:text/csv;charset=utf-8,"+encodeURIComponent("\uFEFF"+example)}>Descargar plantilla CSV para Excel</a><label>Archivo CSV<input type="file" accept=".csv,text/csv,text/plain" onChange={async e=>{const f=e.target.files?.[0];setFileError("");setRaw("");if(!f)return;if(f.size>500000){setFileError("Máximo 500 KB");return;}try{setRaw(await f.text());}catch{setFileError("No se pudo leer el archivo");}}}/></label><label>Contenido CSV<textarea rows={7} value={raw} onChange={e=>setRaw(e.target.value)} placeholder={catalogHeader}/></label>{(error||fileError)&&<p className="error">{fileError||error}</p>}{items.length>0&&<><p className="success">{items.length} productos válidos en el archivo. Los duplicados existentes se comprueban al guardar.</p><div className="tablewrap"><table><thead><tr><th>SKU</th><th>Producto</th><th>Unidad</th><th>Sector</th><th>Precio</th></tr></thead><tbody>{items.slice(0,20).map(p=><tr key={p.sku}><td>{p.sku}</td><td>{p.name}</td><td>{p.unit}</td><td>{p.sector}</td><td>{(p.salePriceCents/100n).toString()+","+String(p.salePriceCents%100n).padStart(2,"0")}</td></tr>)}</tbody></table></div><small>Vista previa de hasta 20 productos.</small></>}<form action={importCatalog} className="fields"><input type="hidden" name="csv" value={raw}/><label><span>Confirmo el alta de productos nuevos. No se sobrescriben registros existentes.</span><input type="checkbox" name="confirm" value="yes" required/></label><Submit disabled={!items.length||!!error||!!fileError}/></form></div>;
}
