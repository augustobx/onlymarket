import { notFound, redirect } from "next/navigation";
import { platformEnabled, platformSession } from "../../../src/server/platform-auth";
import { getHostContext } from "../../../src/server/tenant-host";
import { getPlatformDomain, getTenantBaseDomain } from "../../../src/domain/domains.mjs";
import { loginPlatform } from "../actions";
import SpaceLogin from "../../intro/SpaceLogin";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await getHostContext();
  if (ctx.kind !== "platform") {
    notFound();
  }

  if (await platformSession()) redirect("/superadmin");
  const q = await searchParams;
  const platformDomain = getPlatformDomain();
  const baseDomain = getTenantBaseDomain();

  return (
    <SpaceLogin
      area={`NanoLabs · ${platformDomain}`}
      producto="OnlyMarket"
      bajada="Consola central de provisión, subdominios y licenciamiento multi-tenant."
      tituloTarjeta="OnlyMarket Platform"
      subtituloTarjeta="Acceso exclusivo para operadores centrales de NanoLabs."
      pieTarjeta={
        <span>
          Cada comercio accede desde su subdominio propio en <strong>*.{baseDomain}</strong>.
        </span>
      }
    >
      {!platformEnabled() ? (
        <p className="bhi-alerta bhi-alerta--info">El acceso central no está habilitado en este entorno.</p>
      ) : (
        <form action={loginPlatform}>
          {q.error && (
            <p className="bhi-alerta bhi-alerta--danger" role="alert">
              Acceso no autorizado o límite de intentos alcanzado.
            </p>
          )}
          <div className="bhi-campo">
            <label className="bhi-etiqueta" htmlFor="plat-email">
              Correo administrativo
            </label>
            <div className="bhi-input-contenedor">
              <span className="bhi-input-icono" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
              </span>
              <input id="plat-email" className="bhi-input" type="email" name="email" required autoComplete="username" />
            </div>
          </div>
          <div className="bhi-campo">
            <label className="bhi-etiqueta" htmlFor="plat-pass">
              Contraseña administrativa
            </label>
            <div className="bhi-input-contenedor">
              <span className="bhi-input-icono" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="4" y="11" width="16" height="9" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </span>
              <input
                id="plat-pass"
                className="bhi-input"
                type="password"
                name="password"
                required
                autoComplete="current-password"
              />
            </div>
          </div>
          <button className="bhi-boton--primario">Ingresar a plataforma</button>
        </form>
      )}
    </SpaceLogin>
  );
}
