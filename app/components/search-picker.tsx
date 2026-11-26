"use client";
import {useState,useRef,useEffect,useMemo,useId} from "react";
import {createPortal} from "react-dom";
import {matchesSearch} from "../../src/domain/search.mjs";
import {Icon} from "./icons";

export type SearchPickerItem={
 id:string;
 title:string;
 subtitle?:string;
 meta?:string;
 price?:string;
 stock?:string;
 badge?:string;
 searchText:string;
};

type Props={
 name?:string;
 ariaLabel:string;
 placeholder?:string;
 items:SearchPickerItem[];
 value?:string;
 defaultValue?:string;
 onChange?:(id:string)=>void;
 required?:boolean;
 disabled?:boolean;
 allowEmpty?:boolean;
 emptyLabel?:string;
 maxResults?:number;
};

export function SearchPicker({
 name,
 ariaLabel,
 placeholder="Escribí nombre, SKU, código o sector...",
 items,
 value,
 defaultValue="",
 onChange,
 required=false,
 disabled=false,
 allowEmpty=false,
 emptyLabel="Todos / sin especificar",
 maxResults=35,
}:Props){
 const controlled=value!==undefined;
 const [internal,setInternal]=useState(defaultValue);
 const selectedId=controlled?value:internal;
 const selectedItem=useMemo(()=>items.find(i=>i.id===selectedId)??null,[items,selectedId]);

 const [query,setQuery]=useState("");
 const [open,setOpen]=useState(false);
 const [activeIndex,setActiveIndex]=useState(0);
 const [coords,setCoords]=useState<{top:number;left:number;width:number;maxHeight:number}|null>(null);

 const wrapRef=useRef<HTMLDivElement>(null);
 const inputRef=useRef<HTMLInputElement>(null);
 const listRef=useRef<HTMLDivElement>(null);
 const listboxId=useId();

 const filtered=useMemo(()=>{
  const list=query.trim()
   ?items.filter(item=>matchesSearch(query,[item.title,item.subtitle??"",item.meta??"",item.badge??"",item.searchText]))
   :items;
  return list.slice(0,maxResults);
 },[items,query,maxResults]);

 const totalMatched=useMemo(()=>{
  if(!query.trim())return items.length;
  return items.filter(item=>matchesSearch(query,[item.title,item.subtitle??"",item.meta??"",item.badge??"",item.searchText])).length;
 },[items,query]);

 useEffect(()=>{
  setActiveIndex(0);
 },[query,open]);

 const updateCoords=()=>{
  const el=wrapRef.current;
  if(!el)return;
  const rect=el.getBoundingClientRect();
  const spaceBelow=window.innerHeight-rect.bottom-12;
  const spaceAbove=rect.top-12;
  const openAbove=spaceBelow<220&&spaceAbove>spaceBelow;
  const maxHeight=Math.max(160,Math.min(340,openAbove?spaceAbove:spaceBelow));
  const width=Math.max(rect.width,340);
  const left=Math.max(8,Math.min(rect.left,window.innerWidth-width-8));
  const top=openAbove?Math.max(8,rect.top-maxHeight-6):rect.bottom+6;
  setCoords({top,left,width,maxHeight});
 };

 useEffect(()=>{
  if(!open)return;
  updateCoords();
  const onScrollOrResize=()=>updateCoords();
  const onPointerDown=(e:MouseEvent)=>{
   const target=e.target as Node;
   if(wrapRef.current?.contains(target)||listRef.current?.contains(target))return;
   setOpen(false);
   setQuery("");
  };
  window.addEventListener("scroll",onScrollOrResize,true);
  window.addEventListener("resize",onScrollOrResize);
  document.addEventListener("mousedown",onPointerDown);
  return ()=>{
   window.removeEventListener("scroll",onScrollOrResize,true);
   window.removeEventListener("resize",onScrollOrResize);
   document.removeEventListener("mousedown",onPointerDown);
  };
 },[open]);

 const commit=(id:string)=>{
  if(!controlled)setInternal(id);
  onChange?.(id);
  setQuery("");
  setOpen(false);
 };

 const displayValue=open?query:selectedItem?selectedItem.title:"";

 const onKeyDown=(e:React.KeyboardEvent<HTMLInputElement>)=>{
  if(disabled)return;
  if(!open&&(e.key==="ArrowDown"||e.key==="ArrowUp")){
   e.preventDefault();
   setOpen(true);
   return;
  }
  if(!open)return;
  if(e.key==="ArrowDown"){
   e.preventDefault();
   setActiveIndex(i=>Math.min(filtered.length-1,i+1));
  }else if(e.key==="ArrowUp"){
   e.preventDefault();
   setActiveIndex(i=>Math.max(0,i-1));
  }else if(e.key==="Enter"){
   if(filtered[activeIndex]){
    e.preventDefault();
    commit(filtered[activeIndex].id);
   }
  }else if(e.key==="Escape"){
   e.preventDefault();
   e.stopPropagation();
   setOpen(false);
   setQuery("");
  }
 };

 const portalTarget=typeof document!=="undefined"?(wrapRef.current?.closest("dialog")??document.body):null;
 const dropdown=open&&coords&&portalTarget?createPortal(
  <div
   ref={listRef}
   id={listboxId}
   role="listbox"
   aria-label={ariaLabel}
   className="om-picker-menu"
   style={{
    position:"fixed",
    top:coords.top,
    left:coords.left,
    width:coords.width,
    maxHeight:coords.maxHeight,
   }}
  >
   {allowEmpty&&(
    <button
     type="button"
     role="option"
     aria-selected={selectedId===""}
     className={"om-picker-opt"+(selectedId===""?" selected":"")}
     onMouseDown={e=>{e.preventDefault();commit("");}}
    >
     <div className="om-picker-opt__main">
      <strong>{emptyLabel}</strong>
     </div>
    </button>
   )}
   {filtered.length>0?(
    filtered.map((item,idx)=>(
     <button
      key={item.id}
      type="button"
      role="option"
      aria-selected={item.id===selectedId}
      className={"om-picker-opt"+(idx===activeIndex?" active":"")+(item.id===selectedId?" selected":"")}
      onMouseEnter={()=>setActiveIndex(idx)}
      onMouseDown={e=>{e.preventDefault();commit(item.id);}}
     >
      <div className="om-picker-opt__main">
       <div className="om-picker-opt__head">
        <strong>{item.title}</strong>
        {item.badge&&<span className="om-picker-badge">{item.badge}</span>}
       </div>
       {item.subtitle&&<small className="mono">{item.subtitle}</small>}
       {item.meta&&<small>{item.meta}</small>}
      </div>
      {(item.price||item.stock)&&(
       <div className="om-picker-opt__right mono">
        {item.price&&<strong>{item.price}</strong>}
        {item.stock&&<small>{item.stock}</small>}
       </div>
      )}
     </button>
    ))
   ):(
    <div className="om-picker-empty">Sin coincidencias para &ldquo;{query}&rdquo;</div>
   )}
   {totalMatched>filtered.length&&(
    <div className="om-picker-foot">Mostrando {filtered.length} de {totalMatched} coincidencias · seguí escribiendo para filtrar</div>
   )}
  </div>,
  portalTarget
 ):null;

 return (
  <div className="om-picker" ref={wrapRef}>
   {name&&<input type="hidden" name={name} value={selectedId}/>}
   <div className={"om-picker-input"+(disabled?" is-disabled":"")}>
    <Icon name="search" size={15}/>
    <input
     ref={inputRef}
     type="text"
     role="combobox"
     aria-label={ariaLabel}
     aria-expanded={open}
     aria-controls={listboxId}
     aria-autocomplete="list"
     autoComplete="off"
     disabled={disabled}
     required={required&&!selectedId}
     placeholder={selectedItem?selectedItem.title:placeholder}
     value={displayValue}
     onFocus={()=>{if(!disabled)setOpen(true);}}
     onClick={()=>{if(!disabled)setOpen(true);}}
     onChange={e=>{
      setQuery(e.target.value);
      if(!open)setOpen(true);
     }}
     onKeyDown={onKeyDown}
    />
    {selectedItem&&!disabled&&(
     <button
      type="button"
      className="om-picker-clear"
      aria-label={`Limpiar ${ariaLabel}`}
      onMouseDown={e=>{
       e.preventDefault();
       commit("");
       inputRef.current?.focus();
       setOpen(true);
      }}
     >
      <Icon name="x" size={14}/>
     </button>
    )}
   </div>
   {selectedItem&&(
    <small className="om-picker-chosen mono">
     {[selectedItem.subtitle,selectedItem.price,selectedItem.stock].filter(Boolean).join(" · ")}
    </small>
   )}
   {dropdown}
  </div>
 );
}
