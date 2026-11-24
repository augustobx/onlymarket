export function summarizeFinance({sales,costOfSales,waste,gifts,expenses,purchases,payments}){
 for(const v of [sales,costOfSales,waste,gifts,expenses,purchases,payments])if(typeof v!=="bigint"||v<0n)throw new Error("Importe inválido");
 const gross=sales-costOfSales;
 return {gross,estimatedOperatingProfit:gross-waste-gifts-expenses,purchases,payments};
}
export function periodBounds(from,to){
 const valid=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
 if(!valid(from)||!valid(to)||from>to)throw new Error("Período inválido");
 const start=new Date(from+"T00:00:00-03:00"),end=new Date(to+"T00:00:00-03:00");end.setUTCDate(end.getUTCDate()+1);
 return {start,end,fromDate:new Date(from+"T00:00:00Z"),toDate:new Date(to+"T00:00:00Z")};
}
