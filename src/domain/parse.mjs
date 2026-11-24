export function decimal(value, scale, name, {allowZero=false}={}) {
  if(typeof value!=="string"||!Number.isInteger(scale)||scale<0||scale>6)throw new Error(name+": valor inválido");
  const raw=value.trim().replace(",",".");
  if(!/^\d{1,14}(\.\d+)?$/.test(raw))throw new Error(name+": formato inválido");
  const [whole,fraction=""]=raw.split(".");
  if(fraction.length>scale)throw new Error(name+": demasiados decimales");
  const n=BigInt(whole)*10n**BigInt(scale)+BigInt(fraction.padEnd(scale,"0")||"0");
  if(n>9223372036854775807n||(!allowZero&&!n))throw new Error(name+": fuera de rango");
  return n;
}
export function dateInput(value) {
  if(!value)return null;
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error("Fecha inválida");
  const d=new Date(value+"T00:00:00Z");
  if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==value)throw new Error("Fecha inválida");
  return d;
}
export function localDay(date=new Date()) {
  const parts=new Intl.DateTimeFormat("en",{timeZone:"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return p.year+"-"+p.month+"-"+p.day;
}
export function textField(value,name,max=120,optional=false){
  if(typeof value!=="string")throw new Error(name+": inválido");
  const s=value.trim();
  if((!optional&&!s)||s.length>max)throw new Error(name+": inválido");
  return s;
}
