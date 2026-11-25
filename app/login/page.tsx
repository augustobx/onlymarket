import { redirect } from "next/navigation";
import { currentSession } from "../../src/server/auth";
import { resolveTenantForCurrentHost } from "../../src/server/tenant-host";
import { getPlatformDomain, getTenantBaseDomain } from "../../src/domain/domains.mjs";
import { loginAction } from "../actions";
import SpaceLogin from "../intro/SpaceLogin";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; changed?: string }> }) {
  const resolution = await resolveTenantForCurrentHost();

  if (resolution.kind === "platform") {
    redirect("/superadmin/login");
  }

  if (resolution.kind !== "tenant") {
    return (
      <SpaceLogin
        area="OnlyMarket · Acceso de Comercios"
        producto="OnlyMarket"
        bajada="Plataforma comercial multi-tenant de NanoLabs."
        tituloTarjeta="Dominio no reconocido"
        subtituloTarjeta="Ingresá desde el subdominio asignado a tu comercio."
        pieTarjeta={
          <span>
            Panel administrativo en <strong>{getPlatformDomain()}</strong> · Subdominios en <strong>*.{getTenantBaseDomain()}</strong>
          </span>
        }
      >
        <p className="bhi-alerta bhi-alerta--danger" role="alert">
          No se identificó un comercio válido para la dirección «{resolution.hostname || "desconocida"}».
        </p>
      </SpaceLogin>
    );
  }

  if (resolution.status === "NOT_FOUND") {
    return (
      <SpaceLogin
        area={`${resolution.slug} · OnlyMarket`}
        producto="OnlyMarket"
        bajada="Gestión integral para kioscos, mercados, carnicerías, fiambrerías y verdulerías."
        tituloTarjeta="Comercio no encontrado"
        subtituloTarjeta="Este subdominio no corresponde a un comercio activo."
        pieTarjeta={<span>Verificá la URL o contactá al equipo de NanoLabs.</span>}
      >
        <p className="bhi-alerta bhi-alerta--danger" role="alert">
          No existe ningún comercio registrado para el subdominio <strong>{resolution.slug}</strong>.
        </p>
      </SpaceLogin>
    );
  }

  if (resolution.status === "SUSPENDED") {
    return (
      <SpaceLogin
        area={`${resolution.tenant.name} · Gestión Comercial`}
        producto={resolution.tenant.name}
        bajada="OnlyMarket · Plataforma comercial multi-tenant de NanoLabs."
        tituloTarjeta="Acceso suspendido"
        subtituloTarjeta={`El acceso operativo de ${resolution.tenant.name} se encuentra pausado.`}
        pieTarjeta={<span>Para reactivar el servicio, contactá al administrador de NanoLabs.</span>}
      >
        <p className="bhi-alerta bhi-alerta--danger" role="alert">
          Comercio suspendido: las sesiones y operaciones fueron bloqueadas temporalmente.
        </p>
      </SpaceLogin>
    );
  }

  if (resolution.status === "EXPIRED") {
    const expiredDate = resolution.tenant.licenseUntil?.toISOString().slice(0, 10) ?? "";
    return (
      <SpaceLogin
        area={`${resolution.tenant.name} · Gestión Comercial`}
        producto={resolution.tenant.name}
        bajada="OnlyMarket · Plataforma comercial multi-tenant de NanoLabs."
        tituloTarjeta="Licencia vencida"
        subtituloTarjeta={`La suscripción de ${resolution.tenant.name} requiere renovación.`}
        pieTarjeta={<span>Contactá a NanoLabs para extender la vigencia de la licencia.</span>}
      >
        <p className="bhi-alerta bhi-alerta--danger" role="alert">
          La licencia de este comercio venció{expiredDate ? ` el ${expiredDate}` : ""}. El acceso permanece bloqueado hasta su renovación.
        </p>
      </SpaceLogin>
    );
  }

  if (await currentSession()) {
    redirect("/");
  }

  const query = await searchParams;
  const tenant = resolution.tenant;

  return (
    <SpaceLogin
      area={`${tenant.name} · Gestión Comercial`}
      producto={tenant.name}
      bajada="OnlyMarket · Gestión integral para kioscos, mercados, carnicerías, fiambrerías y verdulerías."
      tituloTarjeta={tenant.name}
      subtituloTarjeta="Ingresá con tus credenciales de operador habilitado para este comercio."
    >
      {query.error && (
        <p className="bhi-alerta bhi-alerta--danger" role="alert">
          Credenciales inválidas o usuario sin acceso habilitado en {tenant.name}.
        </p>
      )}
      {query.changed && (
        <p className="bhi-alerta bhi-alerta--info" role="status">
          Contraseña actualizada. Ingresá nuevamente con tu nueva clave.
        </p>
      )}
      <form action={loginAction}>
        <div className="bhi-campo">
          <label className="bhi-etiqueta" htmlFor="login-email">
            Correo electrónico
          </label>
          <div className="bhi-input-contenedor">
            <span className="bhi-input-icono" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </span>
            <input
              id="login-email"
              className="bhi-input"
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              placeholder="operador@comercio.com"
            />
          </div>
        </div>
        <div className="bhi-campo">
          <label className="bhi-etiqueta" htmlFor="login-password">
            Contraseña
          </label>
          <div className="bhi-input-contenedor">
            <span className="bhi-input-icono" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
            <input
              id="login-password"
              className="bhi-input"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              placeholder="••••••••••••"
            />
          </div>
        </div>
        <button className="bhi-boton--primario">Ingresar</button>
      </form>
    </SpaceLogin>
  );
}
