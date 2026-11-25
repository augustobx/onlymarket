import { headers } from "next/headers";
import { licenseActive } from "../domain/settings.mjs";
import { localDay } from "../domain/parse.mjs";
import { requestHostname, resolveHostContext } from "../domain/domains.mjs";
import { db } from "./db";

export async function getRequestHostname(): Promise<string> {
  const h = await headers();
  return requestHostname(h.get("host"), h.get("x-forwarded-host"));
}

export async function getHostContext() {
  const hostname = await getRequestHostname();
  return resolveHostContext(hostname);
}

export type HostTenantResolution =
  | { kind: "platform" | "unknown"; hostname: string; slug: null; tenant: null; status: "NOT_TENANT_HOST" }
  | { kind: "tenant"; hostname: string; slug: string; tenant: null; status: "NOT_FOUND" }
  | {
      kind: "tenant";
      hostname: string;
      slug: string;
      tenant: {
        id: string;
        name: string;
        slug: string;
        plan: string;
        profile: string;
        licenseUntil: Date | null;
        suspended: boolean;
      };
      status: "SUSPENDED" | "EXPIRED" | "ACTIVE";
    };

export async function resolveTenantForCurrentHost(): Promise<HostTenantResolution> {
  const ctx = await getHostContext();
  if (ctx.kind !== "tenant") {
    return { kind: ctx.kind, hostname: ctx.hostname, slug: null, tenant: null, status: "NOT_TENANT_HOST" };
  }
  if (!ctx.slug) {
    return { kind: "unknown", hostname: ctx.hostname, slug: null, tenant: null, status: "NOT_TENANT_HOST" };
  }

  const tenant = await db.tenant.findUnique({
    where: { slug: ctx.slug },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      profile: true,
      licenseUntil: true,
      suspended: true,
    },
  });

  if (!tenant) {
    return { kind: "tenant", hostname: ctx.hostname, slug: ctx.slug, tenant: null, status: "NOT_FOUND" };
  }
  if (tenant.suspended) {
    return { kind: "tenant", hostname: ctx.hostname, slug: ctx.slug, tenant, status: "SUSPENDED" };
  }
  if (!licenseActive(tenant, localDay())) {
    return { kind: "tenant", hostname: ctx.hostname, slug: ctx.slug, tenant, status: "EXPIRED" };
  }
  return { kind: "tenant", hostname: ctx.hostname, slug: ctx.slug, tenant, status: "ACTIVE" };
}
