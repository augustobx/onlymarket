import { createHash, createHmac, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { hashPassword } from "./password.mjs";
import { ALL_OPERATIONS, HubError, permittedOperations, type HubOperation } from "./hub-http";
import { licenseActive } from "../domain/settings.mjs";
import { localDay } from "../domain/parse.mjs";

const MODULES = ["inventory", "lotTracking", "transformations", "pos", "promotions", "finance", "reports"] as const;
const LIMITS = ["maxBranches", "maxUsers"] as const;
const STATES = ["ACTIVE", "TRIAL", "PAST_DUE", "SUSPENDED", "CANCELED"] as const;
const PAYMENT_STATES = ["PENDING", "PAID", "OVERDUE", "REFUNDED", "VOID"] as const;
const NATIVE_PLANS = new Set(["PILOT", "BASIC", "PRO", "ENTERPRISE"]);
const RESERVED_SLUGS = new Set([
  "admin", "superadmin", "api", "app", "dashboard", "portal", "status", "health",
  "mail", "cdn", "www", "hub", "proxy", "portainer", "nanoapps", "nanolabs",
  "onlyfood", "onlypadel", "onlycars", "onlyerp", "onlyshop", "onlymarket", "onlymob",
]);

let schemaReady = false;
async function ensureHubSchema() {
  if (schemaReady) return;
  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS "HubPlan" (
      "id" TEXT PRIMARY KEY,
      "code" TEXT UNIQUE NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "priceCents" INTEGER NOT NULL DEFAULT 0,
      "currency" TEXT NOT NULL DEFAULT 'ARS',
      "active" BOOLEAN NOT NULL DEFAULT true,
      "modules" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "limits" JSONB NOT NULL DEFAULT '{"maxBranches":5,"maxUsers":20}'::jsonb,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "HubSubscription" (
      "tenantId" TEXT PRIMARY KEY REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "planId" TEXT NOT NULL REFERENCES "HubPlan"("id"),
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "periodStart" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "periodEnd" TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
      "trialEndsAt" TIMESTAMPTZ,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "HubFeatureOverride" (
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "key" TEXT NOT NULL,
      "enabled" BOOLEAN,
      "limitValue" INTEGER,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY ("tenantId", "key")
    )`,
    `CREATE TABLE IF NOT EXISTS "HubPayment" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "amountCents" INTEGER NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'ARS',
      "status" TEXT NOT NULL DEFAULT 'PAID',
      "method" TEXT NOT NULL DEFAULT 'Transferencia',
      "reference" TEXT NOT NULL UNIQUE,
      "notes" TEXT NOT NULL DEFAULT '',
      "periodStart" TIMESTAMPTZ NOT NULL,
      "periodEnd" TIMESTAMPTZ NOT NULL,
      "dueAt" TIMESTAMPTZ,
      "paidAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "HubAuditLog" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT,
      "actor" TEXT,
      "action" TEXT NOT NULL,
      "entity" TEXT NOT NULL,
      "entityId" TEXT,
      "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  ];
  for (const ddl of ddlStatements) {
    await db.$executeRawUnsafe(ddl);
  }

  const defaultModules = Object.fromEntries(MODULES.map((k) => [k, true]));
  const defaults = [
    ["plan-pilot", "PILOT", "Piloto", "Plan inicial de prueba", 0, 1, 5],
    ["plan-basic", "BASIC", "Básico", "Comercio / Kiosco estándar", 4500000, 1, 10],
    ["plan-pro", "PRO", "Profesional", "Supermercado multi-sucursal", 9000000, 5, 25],
    ["plan-enterprise", "ENTERPRISE", "Empresa", "Cadenas y alto volumen", 15000000, 20, 100],
  ] as const;

  for (const [id, code, name, desc, priceCents, branches, users] of defaults) {
    await db.$executeRaw`
      INSERT INTO "HubPlan" ("id","code","name","description","priceCents","currency","active","modules","limits")
      VALUES (${id}, ${code}, ${name}, ${desc}, ${priceCents}, 'ARS', true, ${JSON.stringify(defaultModules)}::jsonb, ${JSON.stringify({ maxBranches: branches, maxUsers: users })}::jsonb)
      ON CONFLICT ("code") DO NOTHING
    `;
  }

  // Ensure every existing Tenant has a corresponding HubSubscription row
  await db.$executeRawUnsafe(`
    INSERT INTO "HubSubscription" ("tenantId","planId","status","periodStart","periodEnd")
    SELECT t."id",
      COALESCE((SELECT p."id" FROM "HubPlan" p WHERE p."code" = t."plan" LIMIT 1), 'plan-pilot'),
      CASE WHEN t."suspended" THEN 'SUSPENDED' ELSE 'ACTIVE' END,
      t."createdAt",
      COALESCE(t."licenseUntil"::timestamptz + interval '23 hours 59 minutes', now() + interval '30 days')
    FROM "Tenant" t
    ON CONFLICT ("tenantId") DO NOTHING
  `);

  schemaReady = true;
}

const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const text = (v: unknown, min = 1, max = 180) => {
  if (typeof v !== "string") throw new HubError(400, "INVALID_INPUT", "Texto requerido.");
  const s = v.trim();
  if (s.length < min || s.length > max) throw new HubError(400, "INVALID_INPUT", "Longitud de texto inválida.");
  return s;
};
const isoDate = (v: unknown, label: string) => {
  const ts = Date.parse(String(v || ""));
  if (!Number.isFinite(ts)) throw new HubError(422, "INVALID_PERIOD", `Fecha inválida en ${label}.`);
  return new Date(ts);
};
const tenantDomain = (slug: string) => `${slug}.${process.env.TENANT_BASE_DOMAIN || "nanoapps.ar"}`;

function mapPlanRow(p: {
  id: string; code: string; name: string; description: string; priceCents: number;
  currency: string; active: boolean; modules: unknown; limits: unknown; updatedAt: Date;
}) {
  const mods = typeof p.modules === "object" && p.modules ? (p.modules as Record<string, boolean>) : {};
  const lims = typeof p.limits === "object" && p.limits ? (p.limits as Record<string, number>) : {};
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description || "",
    priceCents: Number(p.priceCents || 0),
    currency: p.currency || "ARS",
    active: Boolean(p.active),
    modules: Object.fromEntries(MODULES.map((k) => [k, mods[k] ?? true])),
    limits: Object.fromEntries(LIMITS.map((k) => [k, Number(lims[k] || 10)])),
    version: digest(p),
  };
}

async function syncNativeTenantLicense(
  tx: Prisma.TransactionClient,
  tenantId: string,
  planCode: string,
  status: string,
  periodEnd: Date
) {
  const nativeCode = NATIVE_PLANS.has(planCode.toUpperCase()) ? planCode.toUpperCase() : "PRO";
  const suspended = status === "SUSPENDED" || status === "CANCELED" || status === "PAST_DUE";
  await tx.tenant.update({
    where: { id: tenantId },
    data: {
      plan: nativeCode,
      suspended,
      licenseUntil: periodEnd,
    },
  });
}

async function readTenantDetail(tx: Prisma.TransactionClient, tenantId: string) {
  const tenant = await tx.tenant.findUnique({
    where: { id: tenantId },
    include: {
      members: { include: { user: { select: { id: true, email: true, active: true } } } },
      _count: { select: { products: true, branches: true } },
    },
  });
  if (!tenant) throw new HubError(404, "NOT_FOUND", "Comercio inexistente.");

  const subs = await tx.$queryRaw<Array<{
    tenantId: string; planId: string; status: string; periodStart: Date; periodEnd: Date; trialEndsAt: Date | null; updatedAt: Date;
  }>>`SELECT * FROM "HubSubscription" WHERE "tenantId" = ${tenantId} LIMIT 1`;
  const sub = subs[0] || null;
  const planRows = sub
    ? await tx.$queryRaw<Array<{
        id: string; code: string; name: string; description: string; priceCents: number;
        currency: string; active: boolean; modules: unknown; limits: unknown; updatedAt: Date;
      }>>`SELECT * FROM "HubPlan" WHERE "id" = ${sub.planId} LIMIT 1`
    : [];
  const plan = planRows[0] ? mapPlanRow(planRows[0]) : null;
  const overrides = await tx.$queryRaw<Array<{ key: string; enabled: boolean | null; limitValue: number | null }>>`
    SELECT "key","enabled","limitValue" FROM "HubFeatureOverride" WHERE "tenantId" = ${tenantId}
  `;
  const overrideMap = new Map(overrides.map((o) => [o.key, o]));

  const modules: Record<string, { enabled: boolean | number; override: boolean | number | null }> = {};
  for (const k of MODULES) {
    const ov = overrideMap.get(k);
    const base = plan?.modules[k] ?? true;
    modules[k] = { enabled: ov?.enabled ?? base, override: ov?.enabled ?? null };
  }
  for (const k of LIMITS) {
    const ov = overrideMap.get(k);
    const base = plan?.limits[k] ?? 10;
    modules[k] = { enabled: ov?.limitValue ?? base, override: ov?.limitValue ?? null };
  }

  const payments = await tx.$queryRaw<Array<{
    id: string; amountCents: number; currency: string; status: string; method: string;
    reference: string; notes: string; periodStart: Date; periodEnd: Date;
    dueAt: Date | null; paidAt: Date | null; createdAt: Date;
  }>>`SELECT * FROM "HubPayment" WHERE "tenantId" = ${tenantId} ORDER BY "createdAt" DESC LIMIT 100`;

  const effectiveStatus = (sub?.status || (tenant.suspended ? "SUSPENDED" : "ACTIVE")) as
    "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELED" | "PAST_DUE";
  const operational =
    ["ACTIVE", "TRIAL"].includes(effectiveStatus) &&
    !!sub &&
    new Date(sub.periodEnd) > new Date() &&
    licenseActive(tenant, localDay());

  const version = digest({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    plan: tenant.plan,
    suspended: tenant.suspended,
    licenseUntil: tenant.licenseUntil,
    sub,
    overrides,
    payments,
    admins: tenant.members.map((m) => ({ id: m.user.id, email: m.user.email, active: m.user.active, role: m.role })),
  });

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: effectiveStatus,
    version,
    access: { enabled: operational, reason: operational ? null : "Suscripción suspendida o vencida" },
    domains: [{ hostname: tenantDomain(tenant.slug), primary: true, custom: false, verified: true }],
    plan,
    subscription: sub
      ? {
          id: sub.tenantId,
          planId: sub.planId,
          status: sub.status,
          start: new Date(sub.periodStart).toISOString(),
          end: new Date(sub.periodEnd).toISOString(),
          trialEndsAt: sub.trialEndsAt ? new Date(sub.trialEndsAt).toISOString() : null,
          provider: "HUB",
        }
      : null,
    modules,
    admins: tenant.members.map((m) => ({
      id: m.user.id,
      name: m.user.email.split("@")[0],
      email: m.user.email,
      role: m.role,
      active: m.user.active,
    })),
    usage: { products: tenant._count.products, branches: tenant._count.branches },
    payments: payments.map((p) => ({
      id: p.id,
      amountCents: Number(p.amountCents),
      currency: p.currency,
      method: p.method,
      reference: p.reference,
      status: p.status,
      notes: p.notes,
      dueAt: p.dueAt ? new Date(p.dueAt).toISOString() : null,
      paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : null,
      start: new Date(p.periodStart).toISOString(),
      end: new Date(p.periodEnd).toISOString(),
      createdAt: new Date(p.createdAt).toISOString(),
    })),
  };
}

export async function readTenantsSummary(offsetRaw: number) {
  await ensureHubSchema();
  if (!Number.isInteger(offsetRaw) || offsetRaw < 0 || offsetRaw > 100000) {
    throw new HubError(400, "OFFSET", "Offset inválido.");
  }
  const rows = await db.tenant.findMany({
    skip: offsetRaw,
    take: 101,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true, slug: true, name: true, createdAt: true, plan: true,
      licenseUntil: true, suspended: true, _count: { select: { products: true } },
    },
  });
  const ids = rows.slice(0, 100).map((r) => r.id);
  const subMap = new Map<string, { status: string; periodEnd: Date; planName: string }>();
  if (ids.length > 0) {
    const subs = await db.$queryRaw<Array<{ tenantId: string; status: string; periodEnd: Date; planName: string }>>`
      SELECT s."tenantId", s."status", s."periodEnd", p."name" AS "planName"
      FROM "HubSubscription" s
      JOIN "HubPlan" p ON p."id" = s."planId"
    `;
    for (const s of subs) subMap.set(s.tenantId, s);
  }

  return {
    tenants: rows.slice(0, 100).map((t) => {
      const s = subMap.get(t.id);
      const rawStatus = s?.status || (t.suspended ? "SUSPENDED" : licenseActive(t, localDay()) ? "ACTIVE" : "SUSPENDED");
      const status =
        rawStatus === "TRIAL" ? "TRIAL" : rawStatus === "CANCELED" ? "CANCELED" : rawStatus === "ACTIVE" && !t.suspended ? "ACTIVE" : "SUSPENDED";
      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        domain: tenantDomain(t.slug),
        status,
        rawStatus,
        createdAt: t.createdAt.toISOString(),
        plan: s?.planName || t.plan,
        planExpiresAt: (s?.periodEnd ? new Date(s.periodEnd) : t.licenseUntil)?.toISOString() ?? null,
        modules: Object.fromEntries(MODULES.map((m) => [m, true])),
        metrics: { totalRecords: t._count.products, recordLabel: "productos", available: true },
      };
    }),
    nextOffset: rows.length > 100 ? offsetRaw + 100 : null,
  };
}

export async function readManagementResource(resource: string, url: URL) {
  await ensureHubSchema();
  const offset = Number(url.searchParams.get("offset") || "0");
  if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new HubError(400, "OFFSET", "Offset inválido.");

  if (resource === "catalog") {
    return {
      operations: permittedOperations(),
      modules: [...MODULES],
      limits: [...LIMITS],
      optionalLimits: [...LIMITS],
      currency: "ARS",
      destructiveDelete: false,
      immutableSlug: true,
      statuses: [...STATES],
      trialDates: true,
      paymentLifecycle: true,
    };
  }
  if (resource === "plans") {
    const rows = await db.$queryRaw<Array<{
      id: string; code: string; name: string; description: string; priceCents: number;
      currency: string; active: boolean; modules: unknown; limits: unknown; updatedAt: Date;
    }>>`SELECT * FROM "HubPlan" ORDER BY "priceCents" ASC, "id" ASC LIMIT 101 OFFSET ${offset}`;
    return { items: rows.slice(0, 100).map(mapPlanRow), nextOffset: rows.length > 100 ? offset + 100 : null };
  }
  const tenantId = url.searchParams.get("tenantId") || null;
  if (resource === "audit") {
    const rows = tenantId
      ? await db.$queryRaw<Array<{ id: string; tenantId: string | null; actor: string | null; action: string; entity: string; entityId: string | null; createdAt: Date }>>`
          SELECT "id","tenantId","actor","action","entity","entityId","createdAt" FROM "HubAuditLog"
          WHERE "tenantId" = ${tenantId} ORDER BY "createdAt" DESC LIMIT 101 OFFSET ${offset}
        `
      : await db.$queryRaw<Array<{ id: string; tenantId: string | null; actor: string | null; action: string; entity: string; entityId: string | null; createdAt: Date }>>`
          SELECT "id","tenantId","actor","action","entity","entityId","createdAt" FROM "HubAuditLog"
          ORDER BY "createdAt" DESC LIMIT 101 OFFSET ${offset}
        `;
    return {
      items: rows.slice(0, 100).map((r) => ({ ...r, result: "success", createdAt: new Date(r.createdAt).toISOString() })),
      nextOffset: rows.length > 100 ? offset + 100 : null,
    };
  }
  if (resource === "tenant" && tenantId) {
    return db.$transaction((tx) => readTenantDetail(tx, tenantId));
  }
  throw new HubError(400, "RESOURCE", "Recurso inválido.");
}

export async function executeManagementCommand(
  cmd: { requestId: string; actor: string; operation: HubOperation; input: Record<string, unknown> },
  body: string,
  key: string
) {
  await ensureHubSchema();
  if (!/^[a-f0-9-]{36}$/i.test(cmd.requestId) || !ALL_OPERATIONS.includes(cmd.operation)) {
    throw new HubError(400, "COMMAND", "Comando inválido.");
  }
  const fp = createHmac("sha256", key).update(body).digest("hex");
  const prior = await db.$queryRaw<Array<{ details: unknown }>>`
    SELECT "details" FROM "HubAuditLog" WHERE "id" = ${cmd.requestId} LIMIT 1
  `;
  if (prior[0]) {
    const d = prior[0].details as { fingerprint?: string; result?: unknown } | null;
    if (d?.fingerprint !== fp) throw new HubError(409, "IDEMPOTENCY_CONFLICT", "Solicitud duplicada con otros parámetros.");
    return d.result;
  }

  return db.$transaction(async (tx) => {
    const i = cmd.input;
    const op = cmd.operation;
    let tenantId: string | null = typeof i.tenantId === "string" ? i.tenantId : null;
    let entityId: string | null = tenantId;
    let result: Record<string, unknown> = {};

    const before = tenantId ? await readTenantDetail(tx, tenantId) : null;
    if (before && typeof i.version === "string" && i.version !== before.version) {
      throw new HubError(409, "STALE_VERSION", "Los datos cambiaron. Actualizá la ficha antes de guardar.");
    }

    switch (op) {
      case "plan.create":
      case "plan.update": {
        const isUpdate = op === "plan.update";
        const planId = isUpdate ? text(i.planId) : `plan-${randomUUID().slice(0, 8)}`;
        const code = isUpdate ? "" : text(i.code, 2, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
        const name = text(i.name, 2, 100);
        const description = typeof i.description === "string" ? i.description.trim().slice(0, 400) : "";
        const priceCents = Number(i.priceCents ?? 0);
        const currency = String(i.currency || "ARS").trim().toUpperCase();
        const active = Boolean(i.active);
        const mods = (typeof i.modules === "object" && i.modules ? i.modules : {}) as Record<string, boolean>;
        const lims = (typeof i.limits === "object" && i.limits ? i.limits : {}) as Record<string, number>;
        if (!Number.isInteger(priceCents) || priceCents < 0 || !/^[A-Z]{3}$/.test(currency)) {
          throw new HubError(400, "INVALID_INPUT", "Precio o moneda inválidos.");
        }
        if (isUpdate) {
          const existing = await tx.$queryRaw<Array<{
            id: string; code: string; name: string; description: string; priceCents: number;
            currency: string; active: boolean; modules: unknown; limits: unknown; updatedAt: Date;
          }>>`SELECT * FROM "HubPlan" WHERE "id" = ${planId} LIMIT 1`;
          if (!existing[0]) throw new HubError(404, "NOT_FOUND", "Plan inexistente.");
          if (i.version !== mapPlanRow(existing[0]).version) {
            throw new HubError(409, "STALE_VERSION", "El plan cambió. Actualizá los datos.");
          }
          await tx.$executeRaw`
            UPDATE "HubPlan"
            SET "name"=${name},"description"=${description},"priceCents"=${priceCents},"currency"=${currency},
                "active"=${active},"modules"=${JSON.stringify(mods)}::jsonb,"limits"=${JSON.stringify(lims)}::jsonb,"updatedAt"=now()
            WHERE "id"=${planId}
          `;
        } else {
          await tx.$executeRaw`
            INSERT INTO "HubPlan" ("id","code","name","description","priceCents","currency","active","modules","limits")
            VALUES (${planId},${code},${name},${description},${priceCents},${currency},${active},${JSON.stringify(mods)}::jsonb,${JSON.stringify(lims)}::jsonb)
          `;
        }
        entityId = planId;
        result = { planId };
        break;
      }

      case "tenant.create": {
        const name = text(i.name, 2, 120);
        const slug = text(i.slug, 2, 63).toLowerCase();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || RESERVED_SLUGS.has(slug)) {
          throw new HubError(422, "RESERVED_SLUG", "Identificador inválido o reservado.");
        }
        const planId = text(i.planId);
        const email = text(i.ownerEmail, 5, 190).toLowerCase();
        const password = text(i.password, 12, 128);
        const status = i.status === "TRIAL" ? "TRIAL" : "ACTIVE";
        const start = isoDate(i.start, "inicio");
        const end = isoDate(i.end, "vencimiento");
        if (end <= start || end <= new Date()) throw new HubError(422, "INVALID_PERIOD", "Período inválido.");

        const planRows = await tx.$queryRaw<Array<{ id: string; code: string; active: boolean }>>`
          SELECT "id","code","active" FROM "HubPlan" WHERE "id"=${planId} LIMIT 1
        `;
        const plan = planRows[0];
        if (!plan || !plan.active) throw new HubError(422, "PLAN", "Plan inexistente o inactivo.");
        if (await tx.tenant.findUnique({ where: { slug } })) throw new HubError(409, "CONFLICT", "El subdominio ya existe.");
        if (await tx.user.findUnique({ where: { email } })) throw new HubError(409, "CONFLICT", "El correo ya existe.");

        const nativeCode = NATIVE_PLANS.has(plan.code.toUpperCase()) ? plan.code.toUpperCase() : "BASIC";
        const created = await tx.tenant.create({
          data: { name, slug, plan: nativeCode, licenseUntil: end, suspended: false },
        });
        const passwordHash = await hashPassword(password);
        const user = await tx.user.create({ data: { email, passwordHash, active: true } });
        await tx.membership.create({ data: { tenantId: created.id, userId: user.id, role: "OWNER" } });
        await tx.branch.create({ data: { tenantId: created.id, name: "Casa Central" } });
        await tx.$executeRaw`
          INSERT INTO "HubSubscription" ("tenantId","planId","status","periodStart","periodEnd","trialEndsAt")
          VALUES (${created.id},${plan.id},${status},${start},${end},${status === "TRIAL" ? end : null})
        `;
        tenantId = created.id;
        entityId = created.id;
        result = { tenantId: created.id };
        break;
      }

      case "tenant.update": {
        const name = text(i.name, 2, 120);
        await tx.tenant.update({ where: { id: tenantId! }, data: { name } });
        result = { tenantId, version: (await readTenantDetail(tx, tenantId!)).version };
        break;
      }

      case "tenant.status": {
        const status = text(i.status) as (typeof STATES)[number];
        if (!STATES.includes(status)) throw new HubError(400, "INVALID_INPUT", "Estado inválido.");
        const sub = before!.subscription;
        if (!sub) throw new HubError(422, "SUBSCRIPTION", "Suscripción requerida.");
        const end = new Date(sub.end);
        if (["ACTIVE", "TRIAL"].includes(status) && end <= new Date()) {
          throw new HubError(422, "INVALID_PERIOD", "Renová la fecha de vencimiento antes de activar.");
        }
        await tx.$executeRaw`UPDATE "HubSubscription" SET "status"=${status},"updatedAt"=now() WHERE "tenantId"=${tenantId!}`;
        await syncNativeTenantLicense(tx, tenantId!, before!.plan?.code || "PILOT", status, end);
        result = { tenantId, status, version: (await readTenantDetail(tx, tenantId!)).version };
        break;
      }

      case "subscription.update": {
        const planId = text(i.planId);
        const status = text(i.status) as (typeof STATES)[number];
        if (!STATES.includes(status)) throw new HubError(400, "INVALID_INPUT", "Estado inválido.");
        const start = isoDate(i.start, "inicio");
        const end = isoDate(i.end, "vencimiento");
        if (end <= start) throw new HubError(422, "INVALID_PERIOD", "El vencimiento debe ser posterior al inicio.");
        const trialEndsAt = i.trialEndsAt ? isoDate(i.trialEndsAt, "fin de prueba") : null;
        const planRows = await tx.$queryRaw<Array<{ id: string; code: string }>>`SELECT "id","code" FROM "HubPlan" WHERE "id"=${planId} LIMIT 1`;
        if (!planRows[0]) throw new HubError(422, "PLAN", "Plan inexistente.");

        await tx.$executeRaw`
          INSERT INTO "HubSubscription" ("tenantId","planId","status","periodStart","periodEnd","trialEndsAt","updatedAt")
          VALUES (${tenantId!},${planId},${status},${start},${end},${trialEndsAt},now())
          ON CONFLICT ("tenantId") DO UPDATE SET
            "planId"=EXCLUDED."planId","status"=EXCLUDED."status","periodStart"=EXCLUDED."periodStart",
            "periodEnd"=EXCLUDED."periodEnd","trialEndsAt"=EXCLUDED."trialEndsAt","updatedAt"=now()
        `;
        await syncNativeTenantLicense(tx, tenantId!, planRows[0].code, status, end);
        result = { tenantId, version: (await readTenantDetail(tx, tenantId!)).version };
        break;
      }

      case "subscription.renew": {
        const days = Number(i.days);
        if (!Number.isInteger(days) || days < 1 || days > 3650) throw new HubError(400, "INVALID_INPUT", "Días inválidos.");
        const sub = before!.subscription;
        if (!sub) throw new HubError(422, "SUBSCRIPTION", "Suscripción inexistente.");
        const now = Date.now();
        const nextEnd = new Date(Math.max(now, Date.parse(sub.end)) + days * 86400000);
        const nextStart = Date.parse(sub.start) > now ? new Date(now) : new Date(sub.start);
        await tx.$executeRaw`
          UPDATE "HubSubscription"
          SET "status"='ACTIVE',"periodStart"=${nextStart},"periodEnd"=${nextEnd},"trialEndsAt"=NULL,"updatedAt"=now()
          WHERE "tenantId"=${tenantId!}
        `;
        await syncNativeTenantLicense(tx, tenantId!, before!.plan?.code || "BASIC", "ACTIVE", nextEnd);
        result = { tenantId, end: nextEnd.toISOString(), version: (await readTenantDetail(tx, tenantId!)).version };
        break;
      }

      case "module.set": {
        const keyName = text(i.key);
        const isBool = (MODULES as readonly string[]).includes(keyName);
        const isLimit = (LIMITS as readonly string[]).includes(keyName);
        if (!isBool && !isLimit) throw new HubError(422, "MODULE", "Módulo desconocido.");
        if (isBool) {
          if (i.enabled === null) {
            await tx.$executeRaw`DELETE FROM "HubFeatureOverride" WHERE "tenantId"=${tenantId!} AND "key"=${keyName}`;
          } else {
            await tx.$executeRaw`
              INSERT INTO "HubFeatureOverride" ("tenantId","key","enabled","updatedAt")
              VALUES (${tenantId!},${keyName},${Boolean(i.enabled)},now())
              ON CONFLICT ("tenantId","key") DO UPDATE SET "enabled"=EXCLUDED."enabled","updatedAt"=now()
            `;
          }
        } else {
          const lim = i.limit === null || i.limit === undefined ? null : Number(i.limit);
          if (lim === null) {
            await tx.$executeRaw`DELETE FROM "HubFeatureOverride" WHERE "tenantId"=${tenantId!} AND "key"=${keyName}`;
          } else if (!Number.isInteger(lim) || lim < 1) {
            throw new HubError(422, "LIMIT", "Límite inválido.");
          } else {
            await tx.$executeRaw`
              INSERT INTO "HubFeatureOverride" ("tenantId","key","limitValue","updatedAt")
              VALUES (${tenantId!},${keyName},${lim},now())
              ON CONFLICT ("tenantId","key") DO UPDATE SET "limitValue"=EXCLUDED."limitValue","updatedAt"=now()
            `;
          }
        }
        result = { tenantId, version: (await readTenantDetail(tx, tenantId!)).version };
        break;
      }

      case "admin.update": {
        const userId = text(i.userId);
        const email = text(i.email, 5, 190).toLowerCase();
        const mem = await tx.membership.findUnique({ where: { tenantId_userId: { tenantId: tenantId!, userId } } });
        if (!mem) throw new HubError(404, "NOT_FOUND", "Administrador inexistente.");
        const updateData: { email: string; passwordHash?: string } = { email };
        if (typeof i.password === "string" && i.password.length > 0) {
          if (i.password.length < 12) throw new HubError(400, "INVALID_INPUT", "Contraseña mínima de 12 caracteres.");
          updateData.passwordHash = await hashPassword(i.password);
        }
        await tx.user.update({ where: { id: userId }, data: updateData });
        await tx.session.deleteMany({ where: { tenantId: tenantId!, userId } });
        result = { tenantId, userId, version: (await readTenantDetail(tx, tenantId!)).version };
        break;
      }

      case "admin.revoke": {
        const userId = text(i.userId);
        await tx.session.deleteMany({ where: { tenantId: tenantId!, userId } });
        result = { tenantId, userId };
        break;
      }

      case "payment.record": {
        const amountCents = Number(i.amountCents);
        const currency = String(i.currency || "ARS").trim().toUpperCase();
        const status = text(i.status) as (typeof PAYMENT_STATES)[number];
        const method = text(i.method, 2, 60);
        const reference = text(i.reference, 2, 120);
        const notes = typeof i.notes === "string" ? i.notes.trim().slice(0, 1000) : "";
        const start = isoDate(i.start, "inicio");
        const end = isoDate(i.end, "fin");
        const dueAt = i.dueAt ? isoDate(i.dueAt, "vencimiento") : null;
        const paidAt = i.paidAt ? isoDate(i.paidAt, "cobro") : status === "PAID" ? new Date() : null;
        if (!Number.isInteger(amountCents) || amountCents <= 0 || !/^[A-Z]{3}$/.test(currency) || !PAYMENT_STATES.includes(status) || end <= start) {
          throw new HubError(400, "INVALID_INPUT", "Datos de pago inválidos.");
        }
        const paymentId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO "HubPayment" ("id","tenantId","amountCents","currency","status","method","reference","notes","periodStart","periodEnd","dueAt","paidAt")
          VALUES (${paymentId},${tenantId!},${amountCents},${currency},${status},${method},${reference},${notes},${start},${end},${dueAt},${paidAt})
        `;
        const planId = typeof i.planId === "string" && i.planId ? i.planId : before!.subscription?.planId;
        if (status === "PAID" && end > new Date() && planId) {
          const pRows = await tx.$queryRaw<Array<{ code: string }>>`SELECT "code" FROM "HubPlan" WHERE "id"=${planId} LIMIT 1`;
          await tx.$executeRaw`
            INSERT INTO "HubSubscription" ("tenantId","planId","status","periodStart","periodEnd","trialEndsAt","updatedAt")
            VALUES (${tenantId!},${planId},'ACTIVE',${start},${end},NULL,now())
            ON CONFLICT ("tenantId") DO UPDATE SET
              "planId"=EXCLUDED."planId","status"='ACTIVE',"periodStart"=EXCLUDED."periodStart","periodEnd"=EXCLUDED."periodEnd","trialEndsAt"=NULL,"updatedAt"=now()
          `;
          await syncNativeTenantLicense(tx, tenantId!, pRows[0]?.code || "BASIC", "ACTIVE", end);
        } else if (status === "OVERDUE") {
          await tx.$executeRaw`UPDATE "HubSubscription" SET "status"='PAST_DUE',"updatedAt"=now() WHERE "tenantId"=${tenantId!}`;
          await syncNativeTenantLicense(tx, tenantId!, before!.plan?.code || "BASIC", "PAST_DUE", end);
        }
        entityId = paymentId;
        result = { tenantId, paymentId, version: (await readTenantDetail(tx, tenantId!)).version };
        break;
      }

      case "payment.status": {
        const paymentId = text(i.paymentId);
        const status = text(i.status) as (typeof PAYMENT_STATES)[number];
        if (!PAYMENT_STATES.includes(status)) throw new HubError(400, "INVALID_INPUT", "Estado inválido.");
        const pRows = await tx.$queryRaw<Array<{ id: string; periodStart: Date; periodEnd: Date; paidAt: Date | null }>>`
          SELECT "id","periodStart","periodEnd","paidAt" FROM "HubPayment" WHERE "id"=${paymentId} AND "tenantId"=${tenantId!} LIMIT 1
        `;
        const pay = pRows[0];
        if (!pay) throw new HubError(404, "NOT_FOUND", "Pago inexistente.");
        const paidAt = status === "PAID" ? (i.paidAt ? isoDate(i.paidAt, "cobro") : pay.paidAt || new Date()) : null;
        await tx.$executeRaw`UPDATE "HubPayment" SET "status"=${status},"paidAt"=${paidAt} WHERE "id"=${paymentId}`;
        const pEnd = new Date(pay.periodEnd);
        if (status === "PAID" && pEnd > new Date()) {
          await tx.$executeRaw`
            UPDATE "HubSubscription" SET "status"='ACTIVE',"periodStart"=${new Date(pay.periodStart)},"periodEnd"=${pEnd},"trialEndsAt"=NULL,"updatedAt"=now()
            WHERE "tenantId"=${tenantId!}
          `;
          await syncNativeTenantLicense(tx, tenantId!, before!.plan?.code || "BASIC", "ACTIVE", pEnd);
        } else if (status === "OVERDUE") {
          await tx.$executeRaw`UPDATE "HubSubscription" SET "status"='PAST_DUE',"updatedAt"=now() WHERE "tenantId"=${tenantId!}`;
          await syncNativeTenantLicense(tx, tenantId!, before!.plan?.code || "BASIC", "PAST_DUE", pEnd);
        }
        entityId = paymentId;
        result = { tenantId, paymentId, status, version: (await readTenantDetail(tx, tenantId!)).version };
        break;
      }
    }

    await tx.$executeRaw`
      INSERT INTO "HubAuditLog" ("id","tenantId","actor","action","entity","entityId","details")
      VALUES (${cmd.requestId},${tenantId},${cmd.actor},${op},${op.split(".")[0]},${entityId},${JSON.stringify({ fingerprint: fp, result })}::jsonb)
    `;
    return result;
  });
}
