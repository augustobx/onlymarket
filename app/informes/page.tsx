import {db} from "../../src/server/db";
import {requireSession} from "../../src/server/auth";
import {localDay} from "../../src/domain/parse.mjs";
import {periodBounds} from "../../src/domain/finance.mjs";
import {Shell,Field,money,amount,sectors} from "../ui";
import {PageHeader,SectionCard,EmptyState,InfoCallout,sectorIcons} from "../components/retail-ui";
import {Icon} from "../components/icons";
import type {Sector} from "@prisma/client";

export const dynamic="force-dynamic";

type Row={id:string;name:string;sector:Sector;unit:string;sales:bigint;cost:bigint;waste:bigint;gifts:bigint;quantity:bigint};
type SupplierRow={id:string;name:string;purchases:bigint;sales:bigint;cost:bigint;waste:bigint;gifts:bigint};
type YieldRow={id:string;name:string;input:bigint;commercial:bigint;gift:bigint;waste:bigint;cost:bigint;count:bigint};

const margin=(sales:bigint,cost:bigint)=>sales<=0n?"—":Number((sales-cost)*10000n/sales)/100+"%";

export default async function Page({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}){
 const s=await requireSession();
 if(!["OWNER","MANAGER"].includes(s.role))return <Shell title="Informes"><p className="error">Sin permisos.</p></Shell>;

 const query=await searchParams;
 const today=localDay();
 let from=query.from??today.slice(0,7)+"-01";
 let to=query.to??today;
 let invalid=false;
 let range;
 try{range=periodBounds(from,to);}
 catch{from=today.slice(0,7)+"-01";to=today;range=periodBounds(from,to);invalid=true;}

 const tenant=s.tenantId;
 const {start,end}=range;

 const [rows,suppliers,yields]=await db.$transaction(
  async tx=>Promise.all([
   tx.$queryRaw<Row[]>`
    WITH activity AS (
     SELECT sl."productId",sl."totalCents" sales,sl."costCents" cost,sl."quantityMilli" quantity
     FROM "SaleLine" sl JOIN "Sale" sa ON sa."tenantId"=sl."tenantId" AND sa.id=sl."saleId"
     LEFT JOIN "SaleCancellation" c ON c."tenantId"=sa."tenantId" AND c."saleId"=sa.id
     WHERE sl."tenantId"=${tenant} AND sa."createdAt">=${start} AND sa."createdAt"<${end} AND c.id IS NULL
     UNION ALL
     SELECT sl."productId",-r."refundCents",-r."costCents",-r."quantityMilli"
     FROM "SaleReturn" r JOIN "SaleLine" sl ON sl."tenantId"=r."tenantId" AND sl.id=r."saleLineId"
     WHERE r."tenantId"=${tenant} AND r."createdAt">=${start} AND r."createdAt"<${end}
    ),
    sold AS (SELECT "productId",SUM(sales)::bigint sales,SUM(cost)::bigint cost,SUM(quantity)::bigint quantity FROM activity GROUP BY "productId"),
    losses AS (
     SELECT l."productId",(-SUM(m."deltaCostCents") FILTER(WHERE m.kind='WASTE'))::bigint waste,(-SUM(m."deltaCostCents") FILTER(WHERE m.kind='GIFT'))::bigint gifts
     FROM "StockMovement" m JOIN "Lot" l ON l."tenantId"=m."tenantId" AND l.id=m."lotId"
     WHERE m."tenantId"=${tenant} AND m."createdAt">=${start} AND m."createdAt"<${end} AND m.kind IN ('WASTE','GIFT') GROUP BY l."productId"
    )
    SELECT p.id,p.name,p.sector,p.unit,COALESCE(a.sales,0)::bigint sales,COALESCE(a.cost,0)::bigint cost,COALESCE(a.quantity,0)::bigint quantity,
           COALESCE(b.waste,0)::bigint waste,COALESCE(b.gifts,0)::bigint gifts
    FROM "Product" p LEFT JOIN sold a ON a."productId"=p.id LEFT JOIN losses b ON b."productId"=p.id
    WHERE p."tenantId"=${tenant} AND (a."productId" IS NOT NULL OR b."productId" IS NOT NULL) ORDER BY sales DESC,p.name`,
   tx.$queryRaw<SupplierRow[]>`
    WITH bought AS (SELECT "supplierId",SUM("totalCostCents")::bigint purchases FROM "Receipt" WHERE "tenantId"=${tenant} AND "createdAt">=${start} AND "createdAt"<${end} GROUP BY "supplierId"),
    activity AS (
     SELECT l."supplierId",sl."totalCents" sales,sl."costCents" cost FROM "SaleLine" sl
     JOIN "Sale" sa ON sa."tenantId"=sl."tenantId" AND sa.id=sl."saleId"
     JOIN "Lot" l ON l."tenantId"=sl."tenantId" AND l.id=sl."lotId"
     LEFT JOIN "SaleCancellation" c ON c."tenantId"=sa."tenantId" AND c."saleId"=sa.id
     WHERE sl."tenantId"=${tenant} AND sa."createdAt">=${start} AND sa."createdAt"<${end} AND c.id IS NULL
     UNION ALL
     SELECT l."supplierId",-r."refundCents",-r."costCents" FROM "SaleReturn" r JOIN "SaleLine" sl ON sl."tenantId"=r."tenantId" AND sl.id=r."saleLineId" JOIN "Lot" l ON l."tenantId"=sl."tenantId" AND l.id=sl."lotId" WHERE r."tenantId"=${tenant} AND r."createdAt">=${start} AND r."createdAt"<${end}
    ),
    sold AS (SELECT "supplierId",SUM(sales)::bigint sales,SUM(cost)::bigint cost FROM activity GROUP BY "supplierId"),
    losses AS (
     SELECT l."supplierId",(-SUM(m."deltaCostCents") FILTER(WHERE m.kind='WASTE'))::bigint waste,(-SUM(m."deltaCostCents") FILTER(WHERE m.kind='GIFT'))::bigint gifts
     FROM "StockMovement" m JOIN "Lot" l ON l."tenantId"=m."tenantId" AND l.id=m."lotId"
     WHERE m."tenantId"=${tenant} AND m."createdAt">=${start} AND m."createdAt"<${end} AND m.kind IN ('WASTE','GIFT') GROUP BY l."supplierId"
    )
    SELECT p.id,p.name,COALESCE(b.purchases,0)::bigint purchases,COALESCE(a.sales,0)::bigint sales,COALESCE(a.cost,0)::bigint cost,COALESCE(l.waste,0)::bigint waste,COALESCE(l.gifts,0)::bigint gifts
    FROM "Supplier" p LEFT JOIN bought b ON b."supplierId"=p.id LEFT JOIN sold a ON a."supplierId"=p.id LEFT JOIN losses l ON l."supplierId"=p.id
    WHERE p."tenantId"=${tenant} ORDER BY p.name`,
   tx.$queryRaw<YieldRow[]>`
    WITH output AS (
     SELECT "transformationId",SUM("deltaMilli") FILTER(WHERE kind='TRANSFORM_IN') commercial,(-SUM("deltaMilli") FILTER(WHERE kind='GIFT')) gift,(-SUM("deltaMilli") FILTER(WHERE kind='WASTE')) waste
     FROM "StockMovement" WHERE "tenantId"=${tenant} AND "transformationId" IS NOT NULL GROUP BY "transformationId"
    )
    SELECT COALESCE(sp.id,'unknown') id,COALESCE(sp.name,'Sin proveedor') name,SUM(t."inputMilli")::bigint input,SUM(COALESCE(o.commercial,0))::bigint commercial,SUM(COALESCE(o.gift,0))::bigint gift,SUM(COALESCE(o.waste,0))::bigint waste,SUM(t."inputCostCents")::bigint cost,COUNT(*)::bigint count
    FROM "Transformation" t JOIN "Lot" l ON l."tenantId"=t."tenantId" AND l.id=t."sourceLotId" JOIN "Product" p ON p."tenantId"=l."tenantId" AND p.id=l."productId" LEFT JOIN "Supplier" sp ON sp."tenantId"=l."tenantId" AND sp.id=l."supplierId" LEFT JOIN output o ON o."transformationId"=t.id
    WHERE t."tenantId"=${tenant} AND t."createdAt">=${start} AND t."createdAt"<${end} AND p.sector='BUTCHERY' GROUP BY sp.id,sp.name ORDER BY name`,
  ] as const),
  {isolationLevel:"RepeatableRead"}
 );

 const groups=Object.entries(sectors).map(([key,name])=>{
  const items=rows.filter(r=>r.sector===key);
  const sum=(k:"sales"|"cost"|"waste"|"gifts")=>items.reduce((a,r)=>a+r[k],0n);
  return {key,name,sales:sum("sales"),cost:sum("cost"),waste:sum("waste"),gifts:sum("gifts")};
 });
 const maxSales=groups.reduce((max,g)=>{const abs=g.sales<0n?-g.sales:g.sales;return abs>max?abs:max;},0n);

 return (
  <Shell title="Informes de rentabilidad">
   <PageHeader
    kicker="Análisis del comercio"
    title="Informes de rentabilidad"
    subtitle="Rendimiento por área, ventas netas, costos, pérdidas, proveedores y carnicería."
   />

   <SectionCard title="Período de análisis" icon="sliders" padded>
    <form method="get" className="formgrid">
     <Field label="Desde"><input name="from" type="date" defaultValue={from}/></Field>
     <Field label="Hasta"><input name="to" type="date" defaultValue={to}/></Field>
     <button className="secondary">
      <Icon name="filter" size={15}/>
      <span>Consultar período</span>
     </button>
    </form>
    {invalid&&<p className="error" style={{marginTop:12}}>Período inválido; se muestra el mes actual.</p>}
    <InfoCallout icon="info">
     Contribución = ventas netas menos costo vendido neto, mermas (incluye faltantes de conteo) y regalos. No incluye gastos generales ni impuestos.
    </InfoCallout>
   </SectionCard>

   <div className="om-dashgrid">
    <SectionCard title="Ventas netas por sector" subtitle="Proporcional al valor absoluto del período" icon="chart">
     <div className="om-bars">
      {groups.map(g=>(
       <div className="om-bars__row" key={g.key}>
        <div className="om-bars__meta">
         <strong><Icon name={sectorIcons[g.key]??"box"} size={15}/> {g.name}</strong>
         <span>{money(g.sales)}</span>
        </div>
        <div className="om-bars__track">
         <span className={g.sales<0n?"negative":""} style={{width:(maxSales?Number((g.sales<0n?-g.sales:g.sales)*10000n/maxSales)/100:0)+"%"}}/>
        </div>
       </div>
      ))}
     </div>
    </SectionCard>

    <SectionCard title="Resultado por sector" subtitle="Margen bruto y contribución neta" icon="wallet">
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Sector</th>
         <th>Ventas netas</th>
         <th>Costo vendido</th>
         <th>Mermas</th>
         <th>Regalos</th>
         <th>Contribución</th>
         <th>Margen</th>
        </tr>
       </thead>
       <tbody>
        {groups.map(r=>(
         <tr key={r.key}>
          <td><strong>{r.name}</strong></td>
          <td className="mono">{money(r.sales)}</td>
          <td className="mono">{money(r.cost)}</td>
          <td className="mono">{money(r.waste)}</td>
          <td className="mono">{money(r.gifts)}</td>
          <td className="mono"><strong>{money(r.sales-r.cost-r.waste-r.gifts)}</strong></td>
          <td className="mono">{margin(r.sales,r.cost)}</td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    </SectionCard>
   </div>

   <SectionCard title="Detalle por producto" subtitle="Productos con ventas o pérdidas en el período" icon="box">
    {rows.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Producto</th>
         <th>Sector</th>
         <th>Cantidad neta</th>
         <th>Ventas netas</th>
         <th>Costo vendido</th>
         <th>Mermas</th>
         <th>Regalos</th>
         <th>Contribución</th>
        </tr>
       </thead>
       <tbody>
        {rows.map(r=>(
         <tr key={r.id}>
          <td><strong>{r.name}</strong></td>
          <td>{sectors[r.sector]}</td>
          <td className="mono">{amount(r.quantity,r.unit)}</td>
          <td className="mono">{money(r.sales)}</td>
          <td className="mono">{money(r.cost)}</td>
          <td className="mono">{money(r.waste)}</td>
          <td className="mono">{money(r.gifts)}</td>
          <td className="mono"><strong>{money(r.sales-r.cost-r.waste-r.gifts)}</strong></td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="box" title="Sin movimientos para el período" description="No hubo ventas ni pérdidas registradas en el rango elegido."/>
    )}
   </SectionCard>

   <SectionCard title="Compras y contribución por proveedor" subtitle="Ventas y pérdidas atribuidas al proveedor de origen del lote" icon="building">
    {suppliers.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Proveedor</th>
         <th>Compras</th>
         <th>Ventas netas</th>
         <th>Costo vendido</th>
         <th>Mermas</th>
         <th>Regalos</th>
         <th>Contribución</th>
        </tr>
       </thead>
       <tbody>
        {suppliers.map(r=>(
         <tr key={r.id}>
          <td><strong>{r.name}</strong></td>
          <td className="mono">{money(r.purchases)}</td>
          <td className="mono">{money(r.sales)}</td>
          <td className="mono">{money(r.cost)}</td>
          <td className="mono">{money(r.waste)}</td>
          <td className="mono">{money(r.gifts)}</td>
          <td className="mono"><strong>{money(r.sales-r.cost-r.waste-r.gifts)}</strong></td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="building" title="Sin proveedores" description="Todavía no hay proveedores registrados."/>
    )}
   </SectionCard>

   <SectionCard title="Rendimiento de carnicería por proveedor" subtitle="Pesos originales de entrada y salida de cada desposte" icon="beef">
    {yields.length>0?(
     <div className="tablewrap">
      <table>
       <thead>
        <tr>
         <th>Proveedor</th>
         <th>Operaciones</th>
         <th>Entrada</th>
         <th>Salidas a stock</th>
         <th>Regalos</th>
         <th>Merma</th>
         <th>Rendimiento</th>
         <th>Costo entrada</th>
        </tr>
       </thead>
       <tbody>
        {yields.map(r=>(
         <tr key={r.id}>
          <td><strong>{r.name}</strong></td>
          <td className="mono">{r.count.toString()}</td>
          <td className="mono">{amount(r.input,"KG")}</td>
          <td className="mono">{amount(r.commercial,"KG")}</td>
          <td className="mono">{amount(r.gift,"KG")}</td>
          <td className="mono">{amount(r.waste,"KG")}</td>
          <td className="mono"><strong>{r.input?Number(r.commercial*10000n/r.input)/100+"%":"—"}</strong></td>
          <td className="mono">{money(r.cost)}</td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    ):(
     <EmptyState icon="beef" title="Sin despostes en el período" description="Las transformaciones de carnicería aparecerán aquí con su rendimiento porcentual."/>
    )}
   </SectionCard>
  </Shell>
 );
}
