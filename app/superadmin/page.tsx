import { notFound } from "next/navigation";
import { requirePlatform } from "../../src/server/platform-auth";
import { getHostContext } from "../../src/server/tenant-host";
import { db } from "../../src/server/db";
import { Field, Notice } from "../ui";
import { licenseActive, plans } from "../../src/domain/settings.mjs";
import { localDay } from "../../src/domain/parse.mjs";
import { buildTenantUrl, getPlatformDomain, getTenantBaseDomain, getTenantUrlScheme } from "../../src/domain/domains.mjs";
import { PaletteSelector, DarkModeToggle } from "../theme/ThemeControls";
import { licenseAction } from "./license";
import { addCommerce, logoutPlatform } from "./actions";
import { SlugField } from "./SlugField";
import { Operation } from "../operations";
import { PageHeader, KpiCard, SectionCard, EmptyState } from "../components/retail-ui";
import { Icon } from "../components/icons";

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

  const term = (q.q ?? "").trim().slice(0, 120);
  const [tenants, count, activeCount, suspendedCount, audits] = await Promise.all([
    db.tenant.findMany({
      where: term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { slug: { contains: term, mode: "insensitive" } }] } : {},
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
    db.tenant.count({ where: { suspended: false, OR: [{ licenseUntil: null }, { licenseUntil: { gte: new Date(today + "T00:00:00Z") } }] } }),
    db.tenant.count({ where: { suspended: true } }),
    db.platformAudit.findMany({
      include: { admin: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <main className="platformpage om-platform">
      <header className="topbar">
        <div className="brand">
          <span className="brandmark" aria-hidden="true">
            <Icon name="store" size={20} />
          </span>
          <div>
            <small className="om-kicker" style={{ marginBottom: 0 }}>NanoLabs · Administración de plataforma</small>
            <h1 style={{ fontSize: 20 }}>OnlyMarket / Comercios</h1>
            <small>{s.email} · {platformDomain}</small>
          </div>
        </div>
        <div className="topbar-actions">
          <PaletteSelector />
          <DarkModeToggle />
          <form action={logoutPlatform}>
            <button className="secondary">Cerrar sesión de plataforma</button>
          </form>
        </div>
      </header>

      <Notice query={q} />

      <PageHeader
        kicker="Cartera SaaS"
        title="Gestión de comercios"
        subtitle="Altas, subdominios, planes y licencias desde una sola consola."
        actions={
          <Operation
            title="Crear comercio"
            trigger="+ Nuevo comercio"
            wide
            description={`El comercio accederá por ${scheme}://{slug}.${baseDomain}. Se crea su propietario y sucursal inicial.`}
          >
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
          </Operation>
        }
      />

      <div className="om-kpi-grid">
        <KpiCard label="Comercios registrados" value={count} hint="Total de la plataforma" icon="store" tone="brand" />
        <KpiCard label="Activos" value={activeCount} hint="Acceso habilitado" icon="check" tone="success" />
        <KpiCard label="Suspendidos" value={suspendedCount} hint="Acceso bloqueado" icon="alert" tone="danger" />
        <KpiCard label="Vencidos" value={count - activeCount - suspendedCount} hint="Licencia fuera de vigencia" icon="clock" tone="warning" />
      </div>

      <SectionCard
        title="Comercios registrados"
        subtitle={`Dominio base: *.${baseDomain} · Hasta 500 registros (sin acceso a ventas ni datos personales)`}
        icon="building"
      >
        <form method="get" className="v2-toolbar">
          <label className="v2-search">
            <Icon name="search" size={16} />
            <input name="q" aria-label="Buscar comercio" placeholder="Buscar por nombre o subdominio..." defaultValue={term} />
          </label>
          <button className="secondary">
            <Icon name="search" size={15} />
            <span>Buscar</span>
          </button>
        </form>

        {tenants.length > 0 ? (
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
                  <th>Plan / Vencimiento</th>
                  <th>Acciones</th>
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
                      <td>
                        <div className="om-entity">
                          <span className="om-entity-icon" aria-hidden="true">{t.name.slice(0, 2).toUpperCase()}</span>
                          <div>
                            <strong>{t.name}</strong>
                            <small className="mono">{t.slug}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <code>{t.slug}</code>
                        <small>
                          <a href={tenantUrl} target="_blank" rel="noopener noreferrer">
                            {tenantUrl} ↗
                          </a>
                        </small>
                      </td>
                      <td><span className={`status ${statusClass}`}>{statusLabel}</span></td>
                      <td className="mono">{t.createdAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</td>
                      <td className="mono">{t._count.branches}</td>
                      <td className="mono">{t._count.members}</td>
                      <td className="mono">{t._count.products}</td>
                      <td>
                        <strong>{plans[t.plan as keyof typeof plans] ?? t.plan}</strong>
                        <small className="mono">{t.licenseUntil?.toISOString().slice(0, 10).split("-").reverse().join("/") ?? "Sin vencimiento"}</small>
                      </td>
                      <td>
                        <Operation
                          title={"Licencia · " + t.name}
                          trigger="Editar licencia"
                          variant="secondary"
                          description="Los cambios de acceso tienen efecto en las sesiones del comercio."
                        >
                          <form action={licenseAction} className="fields">
                            <input type="hidden" name="tenantId" value={t.id} />
                            <Field label="Plan">
                              <select name="plan" defaultValue={t.plan} aria-label="Plan">
                                {Object.entries(plans).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Vencimiento de licencia">
                              <input
                                name="until"
                                type="date"
                                aria-label="Vencimiento de licencia"
                                defaultValue={t.licenseUntil?.toISOString().slice(0, 10) ?? ""}
                              />
                            </Field>
                            <label>
                              <input type="checkbox" name="suspended" value="yes" defaultChecked={t.suspended} />
                              <span>Suspender acceso</span>
                            </label>
                            <button>Guardar licencia</button>
                          </form>
                        </Operation>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="store" title="Sin comercios coincidentes" description="No hay comercios que coincidan con la búsqueda." />
        )}
      </SectionCard>

      <SectionCard title="Últimas operaciones de plataforma" subtitle="Registro de auditoría de SuperAdmin" icon="shield" padded>
        {audits.length > 0 ? (
          <div>
            {audits.map((a) => (
              <div className="om-audit-row" key={a.id}>
                <div>
                  <strong>{a.detail}</strong>
                  <small>{a.admin.email}</small>
                </div>
                <time className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                  {a.createdAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="shield" title="Sin operaciones registradas" description="Las altas y cambios de licencia quedarán auditados aquí." />
        )}
      </SectionCard>
    </main>
  );
}
