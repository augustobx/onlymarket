/**
 * Escapes and neutralizes CSV cells against spreadsheet formula injection.
 */
export function csvCell(value){
 const raw=value===null||value===undefined?"":String(value);
 const safe=/^[=+\-@\t\r]/.test(raw)?"'"+raw:raw;
 return `"${safe.replace(/"/g,'""')}"`;
}

/**
 * Builds a UTF-8 BOM CSV payload formatted with semicolon separators for Excel es-AR.
 */
export function buildCsv(headers,rows,delimiter=";"){
 const lines=[headers.map(csvCell).join(delimiter)];
 for(const row of rows){
  lines.push(row.map(csvCell).join(delimiter));
 }
 return "\uFEFF"+lines.join("\r\n")+"\r\n";
}

export function formatCentsCsv(cents){
 const n=typeof cents==="bigint"?cents:BigInt(cents??0);
 const sign=n<0n?"-":"";
 const abs=(n<0n?-n:n).toString().padStart(3,"0");
 return sign+abs.slice(0,-2)+","+abs.slice(-2);
}

export function formatMilliCsv(milli,unit="UNIT"){
 const n=typeof milli==="bigint"?milli:BigInt(milli??0);
 if(unit==="UNIT"&&n%1000n===0n)return (n/1000n).toString();
 const sign=n<0n?"-":"";
 const abs=(n<0n?-n:n).toString().padStart(4,"0");
 return sign+abs.slice(0,-3)+","+abs.slice(-3);
}
