import http from "node:http";
import https from "node:https";
import { buildTenantUrl, getTenantBaseDomain, validateSlugFormat } from "../domain/domains.mjs";

function probeNanoAppsRouter(routerUrl, fqdn) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(routerUrl);
    } catch (error) {
      resolve({
        checked: false,
        claimed: false,
        error: error instanceof Error ? error.message : "Invalid router URL",
      });
      return;
    }

    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      resolve({ checked: false, claimed: false, error: "Invalid router URL" });
      return;
    }
    const transport = parsed.protocol === "https:" ? https : http;
    // Use node:http directly because Fetch API silently drops the forbidden `Host` header.
    const req = transport.request(
      parsed,
      {
        method: "GET",
        headers: { host: fqdn },
        timeout: 2500,
      },
      (res) => {
        if (res.statusCode !== 404) {
          resolve({ checked: res.statusCode < 500, claimed: res.statusCode < 500, error: null });
          res.destroy();
          return;
        }
        const chunks = [];
        let size = 0;
        res.on("data", (c) => {
          size += c.length;
          if (size > 65536) req.destroy(new Error("Router response too large"));
          else chunks.push(c);
        });
        res.on("error", () => resolve({ checked: false, claimed: false, error: "Router response interrupted" }));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8").trim();
          const unclaimed = res.statusCode === 404 && text === "Tenant not found";
          resolve({ checked: res.statusCode < 500, claimed: res.statusCode < 500 && !unclaimed, error: null });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("Router timeout"));
    });
    req.on("error", (error) => {
      resolve({
        checked: false,
        claimed: false,
        error: error instanceof Error ? error.message : "Router unreachable",
      });
    });
    req.end();
  });
}

async function probeExternalAskEndpoints(askUrls, fqdn) {
  for (const base of askUrls) {
    try {
      const url = new URL(base);
      url.searchParams.set("domain", fqdn);
      const response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(2000),
      });
      await response.body?.cancel();
      if (response.status === 204) {
        return { checked: true, claimed: true, source: url.hostname };
      }
      if (response.status !== 404) return { checked: false, claimed: false, source: null };
    } catch {
      return { checked: false, claimed: false, source: null };
    }
  }
  return { checked: askUrls.length > 0, claimed: false, source: null };
}

export async function checkSlugAvailability(prisma, rawSlug, options = {}) {
  const env = options.env || process.env;
  const validation = validateSlugFormat(rawSlug, env);
  const tenantBaseDomain = getTenantBaseDomain(env);

  if (!validation.ok) {
    return {
      available: false,
      slug: validation.slug,
      fqdn: validation.slug ? `${validation.slug}.${tenantBaseDomain}` : "",
      url: "",
      code: "INVALID_OR_RESERVED",
      reason: validation.reason,
    };
  }

  const slug = validation.slug;
  const fqdn = `${slug}.${tenantBaseDomain}`;
  const url = buildTenantUrl(slug, env);

  const existing = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    return {
      available: false,
      slug,
      fqdn,
      url,
      code: "ALREADY_EXISTS",
      reason: `El código «${slug}» ya está registrado en OnlyMarket.`,
    };
  }

  // Manual SuperAdmin provisioning follows the existing NanoLabs router.
  // Local database uniqueness is atomic; cross-SaaS checks are best effort,
  // not a reservation. Never bypass a missing or unreachable shared router.
  const sharedBase = ["nanoapps.ar", "nanoapps.site"].includes(tenantBaseDomain)
    || (tenantBaseDomain !== "localhost" && env.TENANT_NAMESPACE_MODE !== "exclusive");
  const routerUrl = (typeof options.routerUrl === "string"
    ? options.routerUrl
    : (env.NANOAPPS_ROUTER_URL || "")).trim();
  if (sharedBase && !routerUrl) {
    return {
      available: false, slug, fqdn, url, code: "ROUTER_UNAVAILABLE",
      reason: "No está configurada la verificación de subdominios de NanoLabs.",
    };
  }
  if (routerUrl) {
    const probe = await probeNanoAppsRouter(routerUrl, fqdn);
    if (probe.claimed) {
      return {
        available: false,
        slug,
        fqdn,
        url,
        code: "EXTERNAL_COLLISION",
        reason: `El subdominio ${fqdn} ya está en uso por otro SaaS de NanoLabs.`,
      };
    }
    if (!probe.checked) {
        return {
          available: false,
          slug,
          fqdn,
          url,
          code: "ROUTER_UNAVAILABLE",
          reason: "No se pudo verificar disponibilidad frente a otros SaaS de NanoLabs.",
        };
    }
  }

  const extraAskRaw = typeof options.externalAskUrls === "string"
    ? options.externalAskUrls
    : (env.EXTERNAL_SAAS_ASK_URLS || "");
  const askUrls = extraAskRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (askUrls.length > 0) {
    const askProbe = await probeExternalAskEndpoints(askUrls, fqdn);
    if (!askProbe.checked) {
      return { available: false, slug, fqdn, url, code: "ROUTER_UNAVAILABLE", reason: "No se pudo verificar disponibilidad frente a otros SaaS de NanoLabs." };
    }
    if (askProbe.claimed) {
      return {
        available: false,
        slug,
        fqdn,
        url,
        code: "EXTERNAL_COLLISION",
        reason: `El subdominio ${fqdn} ya está asignado en otro servicio de NanoLabs.`,
      };
    }
  }

  return {
    available: true,
    slug,
    fqdn,
    url,
    code: "AVAILABLE",
    reason: "",
    ...(sharedBase ? { warning: "verificado, sin reserva global" } : {}),
  };
}
