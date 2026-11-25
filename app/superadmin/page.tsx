import { notFound } from "next/navigation";
import { requirePlatform } from "../../src/server/platform-auth";
import { getHostContext } from "../../src/server/tenant-host";
import { db } from "../../src/server/db";
import { Field, Notice } from "../ui";
import { licenseActive, plans } from "../../src/domain/settings.mjs";
import { localDay } from "../../src/domain/parse.mjs";
import { buildTenantUrl, getPlatformDomain, getTenantBaseDomain, getTenantUrlScheme } from "../../src/domain/domains.mjs";
import { licenseAction } from "./license";
import { addCommerce, logoutPlatform } from "./actions";
import { SlugField } from "./SlugField";
import { Operation } from "../operations";
import { PageHead, Metric } from "../v2";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; q?: string }> }) {
  const ctx = await getHostContext();
  if (ctx.kind !== "platform") {
    notFound();
  }

  const s = await requirePlatform();
  const q = await searchParams;
  const today = localDay();
  const baseDomain = getTenantBaseDomain();
  const scheme = getTenantUrlScheme();
  const platformDomain = getPlatformDomain();

  const term=(q.q??"").trim().slice(0,120);
  const [tenants, count, activeCount, suspendedCount, audits] = await Promise.all([
    db.tenant.findMany({
      where:term?{OR:[{name:{contains:term,mode:"insensitive"}},{slug:{contains:term,mode:"insensitive"}}]}:{},
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        plan: true,
        licenseUntil: true,
        suspended: true,
        _count: { select: { branches: true, members: true, products: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.tenant.count(),
    db.tenant.count({where:{suspended:false,OR:[{licenseUntil:null},{licenseUntil:{gte:new Date(today+"T00:00:00Z")}}]}}),
    db.tenant.count({where:{suspended:true}}),
    db.platformAudit.findMany({
      include: { admin: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <main className="platformpage om-platform">
      <header className="topbar">
        <div>
          <small className="om-kicker">NanoLabs / Administración de plataforma</small>
          <h1>OnlyMarket / Comercios</h1>
          <p>{s.email} · {platformDomain}</p>
        </div>
        <form action={logoutPlatform}>
          <button className="secondary">Cerrar sesión de plataforma</button>
        </form>
      </header>
      <Notice query={q} />
      <PageHead kicker="Cartera SaaS" title="Gestión de comercios" subtitle="Altas, acceso y licencias desde una sola consola." actions={
      <Operation title="Crear comercio" trigger="+ Nuevo comercio" wide description={`El comercio accederá por ${scheme}://{slug}.${baseDomain}. Se crea su propietario y sucursal inicial.`}>
        <form action={addCommerce} className="formgrid">
          <Field label="Nombre del comercio">
            <input name="name" required maxLength={120} />
          </Field>
          <SlugField baseDomain={baseDomain} scheme={scheme} />
          <Field label="Correo del propietario">
            <input name="email" type="email" required />
          </Field>
          <Field label="Contraseña inicial">
            <input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" />
          </Field>
          <Field label="Sucursal inicial">
            <input name="branchName" defaultValue="Casa central" required />
          </Field>
          <button>Crear comercio</button>
        </form>
      </Operation>}/>
      <div className="v2-grid4"><Metric label="Comercios registrados" value={count} hint="Total de la plataforma" icon="box"/><Metric label="Activos" value={activeCount} hint="Acceso habilitado" icon="chart"/><Metric label="Suspendidos" value={suspendedCount} hint="Acceso bloqueado" icon="warn"/><Metric label="Vencidos" value={count-activeCount-suspendedCount} hint="Licencia fuera de vigencia" icon="clock"/></div>
      <section className="panel">
        <div className="sectionhead"><div><h2>Comercios registrados</h2><p>Dominio base: *.{baseDomain}</p></div><form method="get" className="om-searchbar"><input name="q" aria-label="Buscar comercio" placeholder="Nombre o subdominio" defaultValue={term}/><button className="secondary">Buscar</button></form></div>
        <p>Hasta 500 registros. No se accede a ventas, costos o datos personales desde este panel.</p>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Comercio</th>
                <th>Acceso / Subdominio</th>
                <th>Estado</th>
                <th>Alta</th>
                <th>Sucursales</th>
                <th>Accesos</th>
                <th>Productos</th>
                <th>Plan / Vencimiento</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const tenantUrl = buildTenantUrl(t.slug);
                const active = licenseActive(t, today);
                const statusLabel = t.suspended ? "Suspendido" : active ? "Activo" : "Vencido";
                const statusClass = t.suspended || !active ? "BLOCKED" : "AVAILABLE";
                return (
                  <tr key={t.id}>
                    <td><div className="om-entity"><span className="om-entity-icon" aria-hidden="true">{t.name.slice(0,2).toUpperCase()}</span><div><strong>{t.name}</strong><small>{t.slug}</small></div></div></td>
                    <td>
                      <code>{t.slug}</code>
                      <small>
                        <a href={tenantUrl} target="_blank" rel="noopener noreferrer">
                          {tenantUrl} ↗
                        </a>
                      </small>
                    </td>
                    <td>
                      <span className={`status ${statusClass}`}>{statusLabel}</span>
                    </td>
                    <td>{t.createdAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</td>
                    <td>{t._count.branches}</td>
                    <td>{t._count.members}</td>
                    <td>{t._count.products}</td>
                    <td><strong>{plans[t.plan as keyof typeof plans]??t.plan}</strong><small>{t.licenseUntil?.toISOString().slice(0,10).split("-").reverse().join("/")??"Sin vencimiento"}</small></td>
                    <td><Operation title={"Licencia · "+t.name} trigger="Editar licencia" variant="secondary" description="Los cambios de acceso tienen efecto en las sesiones del comercio.">
                      <form action={licenseAction} className="fields">
                        <input type="hidden" name="tenantId" value={t.id} />
                        <select name="plan" defaultValue={t.plan} aria-label="Plan">
                          {Object.entries(plans).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                        <input
                          name="until"
                          type="date"
                          aria-label="Vencimiento de licencia"
                          defaultValue={t.licenseUntil?.toISOString().slice(0, 10) ?? ""}
                        />
                        <label>
                          <input type="checkbox" name="suspended" value="yes" defaultChecked={t.suspended} /> Suspender acceso
                        </label>
                        <button>Guardar licencia</button>
                      </form></Operation>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>{!tenants.length&&<p className="empty">No hay comercios que coincidan con la búsqueda.</p>}
      </section>
      <section className="panel">
        <h2>Últimas operaciones de plataforma</h2>
        {audits.map((a) => (
          <div className="om-audit-row" key={a.id}><div><strong>{a.detail}</strong><small>{a.admin.email}</small></div><time>{a.createdAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</time></div>
        ))}
        {!audits.length && <p>Sin operaciones registradas.</p>}
      </section>
    </main>
  );
}
