const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;

export const BASE_RESERVED_SLUGS = [
  // NanoLabs SaaS & platform subdomains sharing wildcard domains
  "onlymarket",
  "onlycars",
  "onlyfood",
  "onlypadel",
  "onlyerp",
  "onlymob",
  "onlygym",
  "onlyturn",
  "onlyshop",
  "hub",
  "nanolabs",
  "nanolabshub",
  "sppadel",
  "sanpedropadel",
  "liga-padel",
  "gastosapp",
  "acevedocontrol",
  "asp",
  "nanotrading",
  "nanocontrol",
  "nanokeys",
  "nanomonitor",
  "keys",
  // Infrastructure & common system labels
  "www",
  "api",
  "app",
  "admin",
  "superadmin",
  "platform",
  "proxy",
  "portainer",
  "status",
  "health",
  "control",
  "monitor",
  "mail",
  "smtp",
  "imap",
  "cdn",
  "static",
  "assets",
  "auth",
  "login",
  "sso",
  "dashboard",
  "portal",
  "localhost",
  "internal",
  "caddy",
];

export function normalizeHostname(rawHost) {
  if (!rawHost || typeof rawHost !== "string") return "";
  if (/[\s,/@\\?#]/.test(rawHost)) return "";
  const port = rawHost.match(/:(\d+)$/);
  if (port && (+port[1] < 1 || +port[1] > 65535)) return "";
  const withoutPort = rawHost.replace(/:\d+$/, "").toLowerCase().replace(/\.$/, "");
  if (!withoutPort || !HOSTNAME_RE.test(withoutPort)) return "";
  return withoutPort;
}

// The existing NPM/router preserves Host. Forwarded headers cannot select a tenant.
export function requestHostname(host, forwardedHost) {
  const hostname = normalizeHostname(host);
  if (!hostname) return "";
  if (forwardedHost != null && normalizeHostname(forwardedHost) !== hostname) return "";
  return hostname;
}

// Certificate authorization accepts a DNS name, never an HTTP authority or list.
export function certificateHostname(raw) {
  if (typeof raw !== "string" || !HOSTNAME_RE.test(raw.toLowerCase())) return "";
  return raw.toLowerCase();
}

export function getPlatformDomain(env = process.env) {
  return certificateHostname(env.PLATFORM_DOMAIN || env.ADMIN_DOMAIN || "onlymarket.nanoapps.ar");
}

export function getTenantBaseDomain(env = process.env) {
  return certificateHostname(env.TENANT_BASE_DOMAIN || "nanoapps.ar");
}

export function getTenantUrlScheme(env = process.env) {
  if (env.TENANT_URL_SCHEME === "http" || env.TENANT_URL_SCHEME === "https") {
    return env.TENANT_URL_SCHEME;
  }
  return getTenantBaseDomain(env) === "localhost" ? "http" : "https";
}

export function getTenantUrlPort(env = process.env) {
  const raw = typeof env.TENANT_URL_PORT === "string" ? env.TENANT_URL_PORT.trim() : "";
  return /^\d{1,5}$/.test(raw) && +raw > 0 && +raw <= 65535 ? `:${raw}` : "";
}

export function buildTenantUrl(slug, env = process.env) {
  return `${getTenantUrlScheme(env)}://${slug}.${getTenantBaseDomain(env)}${getTenantUrlPort(env)}`;
}

export function buildPlatformUrl(env = process.env) {
  return `${getTenantUrlScheme(env)}://${getPlatformDomain(env)}${getTenantUrlPort(env)}`;
}

export function getReservedSlugs(env = process.env) {
  const set = new Set(BASE_RESERVED_SLUGS);
  const extra = typeof env.RESERVED_SLUGS === "string" ? env.RESERVED_SLUGS : "";
  for (const item of extra.split(",")) {
    const clean = item.trim().toLowerCase();
    if (clean) set.add(clean);
  }
  const platformDomain = getPlatformDomain(env);
  const tenantBaseDomain = getTenantBaseDomain(env);
  const suffix = `.${tenantBaseDomain}`;
  if (platformDomain.endsWith(suffix)) {
    const label = platformDomain.slice(0, -suffix.length);
    if (label && !label.includes(".")) {
      set.add(label);
    }
  }
  return set;
}

export function validateSlugFormat(rawSlug, env = process.env) {
  const slug = typeof rawSlug === "string" ? rawSlug.trim().toLowerCase() : "";
  if (!getPlatformDomain(env) || !getTenantBaseDomain(env) || `${slug}.${getTenantBaseDomain(env)}`.length > 253) {
    return { ok: false, slug, reason: "Configuración de dominios inválida." };
  }
  if (!SLUG_RE.test(slug)) {
    return {
      ok: false,
      slug,
      reason: "Usá entre 2 y 63 caracteres en minúscula (letras, números y guiones medios, sin guiones al inicio o fin).",
    };
  }
  if (getReservedSlugs(env).has(slug)) {
    return {
      ok: false,
      slug,
      reason: `El subdominio «${slug}» está reservado para la plataforma o para otro servicio de NanoLabs.`,
    };
  }
  return { ok: true, slug, reason: "" };
}

/** @returns {{kind: 'platform' | 'unknown', hostname: string, slug: null} | {kind: 'tenant', hostname: string, slug: string}} */
export function resolveHostContext(rawHost, env = process.env) {
  const hostname = normalizeHostname(rawHost);
  if (!hostname) {
    return { kind: "unknown", hostname: "", slug: null };
  }

  const platformDomain = getPlatformDomain(env);
  if (!platformDomain || !getTenantBaseDomain(env)) return { kind: "unknown", hostname, slug: null };
  if (hostname === platformDomain) {
    return { kind: "platform", hostname, slug: null };
  }

  const reserved = getReservedSlugs(env);
  const tenantBaseDomain = getTenantBaseDomain(env);
  const suffixes = [`${tenantBaseDomain}`];

  for (const base of suffixes) {
    const suffix = `.${base}`;
    if (hostname.endsWith(suffix)) {
      const prefix = hostname.slice(0, -suffix.length);
      if (prefix && !prefix.includes(".") && SLUG_RE.test(prefix) && !reserved.has(prefix)) {
        return { kind: "tenant", hostname, slug: prefix };
      }
      return { kind: "unknown", hostname, slug: null };
    }
  }

  return { kind: "unknown", hostname, slug: null };
}
