import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  buildPlatformUrl,
  buildTenantUrl,
  getPlatformDomain,
  getTenantBaseDomain,
  normalizeHostname,
  requestHostname,
  certificateHostname,
  resolveHostContext,
  validateSlugFormat,
} from "../src/domain/domains.mjs";
import { checkSlugAvailability } from "../src/server/slug-availability.mjs";

test("Host is authoritative; forged, missing and ambiguous authorities fail closed", () => {
  const host = "tienda.nanoapps.ar:3000";
  assert.equal(requestHostname(host, null), "tienda.nanoapps.ar");
  assert.equal(requestHostname(host, "tienda.nanoapps.ar"), "tienda.nanoapps.ar");
  for (const forwarded of ["onlymarket.nanoapps.ar", "", "tienda.nanoapps.ar,evil.test", "https://tienda.nanoapps.ar"]) {
    assert.equal(requestHostname(host, forwarded), "");
  }
  assert.equal(requestHostname(null, "onlymarket.nanoapps.ar"), "");
  for (const invalid of ["evil.test/", "user@tienda.nanoapps.ar", "tienda.nanoapps.ar:65536", "tienda.nanoapps.ar:0", " tienda.nanoapps.ar", "tienda.nanoapps.ar\\evil"]) {
    assert.equal(normalizeHostname(invalid), "");
  }
});

test("certificate authorization accepts only a single exact DNS name", () => {
  assert.equal(certificateHostname("TIENDA.nanoapps.ar"), "tienda.nanoapps.ar");
  for (const raw of [null, "", "tienda.nanoapps.ar:443", "tienda.nanoapps.ar,evil.test", "https://tienda.nanoapps.ar", "*.nanoapps.ar", "tienda.nanoapps.ar.", " tienda.nanoapps.ar"]) {
    assert.equal(certificateHostname(raw), "");
  }
});

test("invalid domain configuration and implicit localhost aliases never grant platform access", () => {
  for (const host of ["localhost", "127.0.0.1", "tienda.localhost", "onlymarket.nanoapps.ar.evil.test", "nanoapps.ar"]) {
    assert.equal(resolveHostContext(host, {}).kind, "unknown");
  }
  assert.equal(resolveHostContext("onlymarket.nanoapps.ar", { PLATFORM_DOMAIN: "bad host" }).kind, "unknown");
});

test("shared namespaces deny concurrent allocations even with legacy strict=false or exclusive overrides", async () => {
  const prisma = { tenant: { findUnique: async () => null } };
  for (const base of ["nanoapps.ar", "nanoapps.site", "shared.example.test"]) {
    const attempts = await Promise.all(Array.from({ length: 12 }, () => checkSlugAvailability(prisma, "same-slug", {
      env: { TENANT_BASE_DOMAIN: base, SLUG_CHECK_STRICT: "false", TENANT_NAMESPACE_MODE: base.startsWith("nanoapps") ? "exclusive" : "shared" },
    })));
    assert.ok(attempts.every((r) => !r.available && r.code === "NAMESPACE_UNAVAILABLE"));
  }
});

test("configured sibling failures and redirects never mean availability", async () => {
  const prisma = { tenant: { findUnique: async () => null } };
  const env = { TENANT_BASE_DOMAIN: "localhost" };
  const server = http.createServer((req, res) => {
    res.writeHead(Number(req.url.slice(1)) || 500, { Location: "/204" }); res.end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const status of [200, 302, 500]) {
      const result = await checkSlugAvailability(prisma, "test-slug", { env, externalAskUrls: `${base}/${status}` });
      assert.equal(result.available, false);
      assert.equal(result.code, "ROUTER_UNAVAILABLE");
    }
    assert.equal((await checkSlugAvailability(prisma, "test-slug", { env, externalAskUrls: "http://127.0.0.1:1" })).available, false);
  } finally { await new Promise((r) => server.close(r)); }
});

test("normalizeHostname sanitizes ports, case and trailing dot; rejects ambiguous lists", () => {
  assert.equal(normalizeHostname("MiTienda.NANOAPPS.AR:443"), "mitienda.nanoapps.ar");
  assert.equal(normalizeHostname("tienda.nanoapps.ar., proxy.internal"), "");
  assert.equal(normalizeHostname("bad host!"), "");
  assert.equal(normalizeHostname(""), "");
});

test("domain configuration is configurable via env vars for future standalone domains", () => {
  const defaultEnv = {};
  assert.equal(getPlatformDomain(defaultEnv), "onlymarket.nanoapps.ar");
  assert.equal(getTenantBaseDomain(defaultEnv), "nanoapps.ar");
  assert.equal(buildPlatformUrl(defaultEnv), "https://onlymarket.nanoapps.ar");
  assert.equal(buildTenantUrl("la-esquina", defaultEnv), "https://la-esquina.nanoapps.ar");

  const futureEnv = {
    PLATFORM_DOMAIN: "panel.onlymarket.com.ar",
    TENANT_BASE_DOMAIN: "onlymarket.com.ar",
  };
  assert.equal(getPlatformDomain(futureEnv), "panel.onlymarket.com.ar");
  assert.equal(getTenantBaseDomain(futureEnv), "onlymarket.com.ar");
  assert.equal(buildPlatformUrl(futureEnv), "https://panel.onlymarket.com.ar");
  assert.equal(buildTenantUrl("la-esquina", futureEnv), "https://la-esquina.onlymarket.com.ar");

  assert.equal(resolveHostContext("panel.onlymarket.com.ar", futureEnv).kind, "platform");
  assert.deepEqual(resolveHostContext("la-esquina.onlymarket.com.ar", futureEnv), {
    kind: "tenant",
    hostname: "la-esquina.onlymarket.com.ar",
    slug: "la-esquina",
  });
  assert.equal(resolveHostContext("la-esquina.nanoapps.ar", futureEnv).kind, "unknown");
});

test("resolveHostContext enforces platform, tenant subdomain, reserved SaaS and multi-level boundaries", () => {
  const env = { PLATFORM_DOMAIN: "onlymarket.nanoapps.ar", TENANT_BASE_DOMAIN: "nanoapps.ar" };
  assert.equal(resolveHostContext("onlymarket.nanoapps.ar", env).kind, "platform");
  assert.equal(resolveHostContext("localhost:3000", env).kind, "unknown");
  assert.deepEqual(resolveHostContext("carniceria-san-martin.nanoapps.ar", env), {
    kind: "tenant",
    hostname: "carniceria-san-martin.nanoapps.ar",
    slug: "carniceria-san-martin",
  });
  assert.deepEqual(resolveHostContext("mercado.localhost:3000", { PLATFORM_DOMAIN: "localhost", TENANT_BASE_DOMAIN: "localhost" }), {
    kind: "tenant",
    hostname: "mercado.localhost",
    slug: "mercado",
  });

  // Reserved NanoLabs SaaS subdomains must never resolve as OnlyMarket tenants
  for (const reserved of ["onlycars", "onlyfood", "onlypadel", "onlyshop", "onlygym", "hub", "www", "api"]) {
    assert.equal(resolveHostContext(`${reserved}.nanoapps.ar`, env).kind, "unknown");
    assert.equal(validateSlugFormat(reserved, env).ok, false);
  }

  // Multi-level subdomains must be rejected
  assert.equal(resolveHostContext("a.b.nanoapps.ar", env).kind, "unknown");
  assert.equal(resolveHostContext("evil.com", env).kind, "unknown");
});

test("validateSlugFormat enforces DNS label syntax and custom reserved slugs", () => {
  assert.equal(validateSlugFormat("don-pepe").ok, true);
  assert.equal(validateSlugFormat("-invalid").ok, false);
  assert.equal(validateSlugFormat("invalid-").ok, false);
  assert.equal(validateSlugFormat("a").ok, false);
  assert.equal(validateSlugFormat("a".repeat(64)).ok, false);
  assert.equal(validateSlugFormat("mi-reserva", { RESERVED_SLUGS: "mi-reserva,otro" }).ok, false);
});

test("checkSlugAvailability detects DB duplicates, reserved slugs and live nanoapps-router collisions", async () => {
  const existing = new Set(["ya-registrado"]);
  const mockPrisma = {
    tenant: {
      findUnique: async ({ where }) => (existing.has(where.slug) ? { id: "t1" } : null),
    },
  };

  // Start mock nanoapps-router + mock sibling ask server
  const routerServer = http.createServer((req, res) => {
    const host = (req.headers.host || "").split(":")[0].toLowerCase();
    if (host === "usado-en-onlycars.market.test") {
      res.writeHead(302, { Location: "/login" });
      res.end();
      return;
    }
    if (host === "app-html-404.market.test") {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("<html>Not Found in sibling SaaS</html>");
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Tenant not found");
  });

  await new Promise((resolve) => routerServer.listen(0, "127.0.0.1", resolve));
  const { port } = routerServer.address();
  const routerUrl = `http://127.0.0.1:${port}`;

  try {
    const rReserved = await checkSlugAvailability(mockPrisma, "onlyfood", { routerUrl, env: { TENANT_BASE_DOMAIN: "market.test", TENANT_NAMESPACE_MODE: "exclusive" } });
    assert.equal(rReserved.available, false);
    assert.equal(rReserved.code, "INVALID_OR_RESERVED");

    const rDup = await checkSlugAvailability(mockPrisma, "ya-registrado", { routerUrl, env: { TENANT_BASE_DOMAIN: "market.test", TENANT_NAMESPACE_MODE: "exclusive" } });
    assert.equal(rDup.available, false);
    assert.equal(rDup.code, "ALREADY_EXISTS");

    const rCollision = await checkSlugAvailability(mockPrisma, "usado-en-onlycars", { routerUrl, env: { TENANT_BASE_DOMAIN: "market.test", TENANT_NAMESPACE_MODE: "exclusive" } });
    assert.equal(rCollision.available, false);
    assert.equal(rCollision.code, "EXTERNAL_COLLISION");

    const rHtml404 = await checkSlugAvailability(mockPrisma, "app-html-404", { routerUrl, env: { TENANT_BASE_DOMAIN: "market.test", TENANT_NAMESPACE_MODE: "exclusive" } });
    assert.equal(rHtml404.available, false);
    assert.equal(rHtml404.code, "EXTERNAL_COLLISION");

    const rFree = await checkSlugAvailability(mockPrisma, "supermercado-sur", { routerUrl, env: { TENANT_BASE_DOMAIN: "market.test", TENANT_NAMESPACE_MODE: "exclusive" } });
    assert.equal(rFree.available, true);
    assert.equal(rFree.fqdn, "supermercado-sur.market.test");
    assert.equal(rFree.url, "https://supermercado-sur.market.test");

    const rStrictDown = await checkSlugAvailability(mockPrisma, "supermercado-sur", {
      routerUrl: "http://127.0.0.1:1",
      env: { TENANT_BASE_DOMAIN: "market.test", TENANT_NAMESPACE_MODE: "exclusive" },
    });
    assert.equal(rStrictDown.available, false);
    assert.equal(rStrictDown.code, "ROUTER_UNAVAILABLE");
  } finally {
    await new Promise((resolve) => routerServer.close(resolve));
  }
});

