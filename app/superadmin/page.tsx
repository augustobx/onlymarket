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

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
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

  const [tenants, count, audits] = await Promise.all([
    db.tenant.findMany({
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
    db.platformAudit.findMany({
      include: { admin: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <main className="platformpage">
      <header className="topbar">
        <div>
          <small>NANOLABS · CONTROL CENTRAL · {platformDomain}</small>
          <h1>OnlyMarket / Comercios</h1>
          <p>{s.email}</p>
        </div>
        <form action={logoutPlatform}>
          <button className="secondary">Cerrar sesión de plataforma</button>
        </form>
      </header>
      <Notice query={q} />
      <section className="metrics">
        <article>
          <small>Comercios registrados</small>
          <strong>{count}</strong>
        </article>
        <article>
          <small>Dominio base tenants</small>
          <strong>*.{baseDomain}</strong>
          <small>Aprovisionamiento vía router NanoApps</small>
        </article>
      </section>
      <section className="panel">
        <h2>Crear comercio</h2>
        <p>
          Se crea una sucursal inicial y un propietario independiente. El comercio accederá directamente desde{" "}
          <code>
            {scheme}://{"{subdominio}"}.{baseDomain}
          </code>
          . Se validan colisiones con otros sistemas de NanoLabs.
        </p>
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
      </section>
      <section className="panel">
        <h2>Comercios registrados</h2>
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
                <th>Licencia</th>
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
                    <td>{t.name}</td>
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
                    <td>
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
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Últimas operaciones de plataforma</h2>
        {audits.map((a) => (
          <p key={a.id}>
            {a.createdAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} · {a.admin.email} · {a.detail}
          </p>
        ))}
        {!audits.length && <p>Sin operaciones registradas.</p>}
      </section>
    </main>
  );
}
