import test from "node:test";
import http from "node:http";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createCommerce } from "../src/server/platform.mjs";

test("PostgreSQL: concurrent local provisioning is atomic; manual shared provisioning requires router validation", { skip: process.env.RUN_DB_TESTS !== "1" }, async () => {
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
    await assert.rejects(createCommerce(db, session, blocked), /No está configurada/);
    assert.equal(await db.tenant.count({ where: { slug: blocked.slug } }), 0);
    assert.equal(await db.user.count({ where: { email: blocked.email } }), 0);
    const router = http.createServer((req, res) => {
      res.writeHead(404); res.end("Tenant not found");
    });
    await new Promise(r => router.listen(0, "127.0.0.1", r));
    try {
      process.env.NANOAPPS_ROUTER_URL = `http://127.0.0.1:${router.address().port}`;
      const shared = await createCommerce(db, session, blocked);
      assert.equal(shared.slug, blocked.slug);
      assert.equal(await db.membership.count({ where: { tenantId: shared.id } }), 1);
      await assert.rejects(createCommerce(db, session, { ...blocked, email: `${randomUUID()}@example.invalid` }), /registrado/);
    } finally { await new Promise(r => router.close(r)); }
  } finally {
    for (const key of ["PLATFORM_DOMAIN", "TENANT_BASE_DOMAIN", "TENANT_NAMESPACE_MODE", "SLUG_CHECK_STRICT", "NANOAPPS_ROUTER_URL", "EXTERNAL_SAAS_ASK_URLS"]) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
    await db.$disconnect();
  }
});
