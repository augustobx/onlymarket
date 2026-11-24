export const profiles={KIOSK:"Kiosco",MARKET:"Mercado",SUPERMARKET:"Supermercado",BUTCHERY:"Carnicería",DELI:"Fiambrería",PRODUCE:"Verdulería"};
export const plans={PILOT:"Piloto",BASIC:"Básico",PRO:"Profesional",ENTERPRISE:"Empresa"};
export function licenseActive(tenant,today){return !tenant.suspended&&(!tenant.licenseUntil||tenant.licenseUntil.toISOString().slice(0,10)>=today);}
export function showTransform(profile){return ["MARKET","SUPERMARKET","BUTCHERY","DELI"].includes(profile);}
