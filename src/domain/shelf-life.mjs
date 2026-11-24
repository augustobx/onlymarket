import {dateInput,localDay} from "./parse.mjs";
export function openedExpiry({today,printedExpiry,lifeDays}){
 const opened=dateInput(today),printed=dateInput(printedExpiry);
 if(!opened||!printed||!Number.isInteger(lifeDays)||lifeDays<1||lifeDays>365)throw new Error("Se requiere vencimiento y vida útil tras apertura configurada");
 if(printed<=opened)throw new Error("Lote vencido");
 const candidate=new Date(+opened+lifeDays*86400000);
 return candidate<printed?candidate:printed;
}
