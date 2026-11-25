import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createCommerce } from "../src/server/platform.mjs";

test("PostgreSQL: concurrent tenant provisioning is atomic; shared namespaces write nothing", { skip: process.env.RUN_DB_TESTS !== "1" }, async () => {
  const db = new PrismaClient();
  const saved = { ...process.env };
  try {
    const admin = await db.platformAdmin.create({ data: { email: `${randomUUID()}@example.invalid`, passwordHash: "not-a-login" } });
    const session = { id: admin.id, tokenHash: randomUUID() };
    await db.platformSession.create({ data: { adminId: admin.id, tokenHash: session.tokenHash, expiresAt: new Date(Date.now() + 60000) } });
    const slug = randomUUID();
    const input = { name: "Concurrent commerce", slug, email: `${randomUUID()}@example.invalid`, password: "Local-test-only-password", branchName: "Central" };
    process.env.PLATFORM_DOMAIN = "localhost";
    process.env.TENANT_BASE_DOMAIN = "localhost";
    delete process.env.NANOAPPS_ROUTER_URL;
    delete process.env.EXTERNAL_SAAS_ASK_URLS;
    const outcomes = await Promise.allSettled([createCommerce(db, session, input), createCommerce(db, session, { ...input, email: `${randomUUID()}@example.invalid` })]);
    assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(await db.tenant.count({ where: { slug } }), 1);
    const tenant = await db.tenant.findUniqueOrThrow({ where: { slug } });
    assert.equal(await db.membership.count({ where: { tenantId: tenant.id } }), 1);
    assert.equal(await db.branch.count({ where: { tenantId: tenant.id } }), 1);
    assert.equal(await db.platformAudit.count({ where: { tenantId: tenant.id } }), 1);

    process.env.PLATFORM_DOMAIN = "onlymarket.nanoapps.ar";
    process.env.TENANT_BASE_DOMAIN = "nanoapps.ar";
    process.env.TENANT_NAMESPACE_MODE = "exclusive";
    process.env.SLUG_CHECK_STRICT = "false";
    const blocked = { ...input, slug: randomUUID(), email: `${randomUUID()}@example.invalid` };
    await assert.rejects(createCommerce(db, session, blocked), /Altas temporalmente bloqueadas/);
    assert.equal(await db.tenant.count({ where: { slug: blocked.slug } }), 0);
    assert.equal(await db.user.count({ where: { email: blocked.email } }), 0);
  } finally {
    for (const key of ["PLATFORM_DOMAIN", "TENANT_BASE_DOMAIN", "TENANT_NAMESPACE_MODE", "SLUG_CHECK_STRICT", "NANOAPPS_ROUTER_URL", "EXTERNAL_SAAS_ASK_URLS"]) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
    await db.$disconnect();
  }
});
