import assert from "node:assert/strict";
import http from "node:http";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { hashPassword, tokenHash } from "../src/server/password.mjs";

function httpGet(pathName, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://localhost:3000${pathName}`,
      { method: "GET", headers },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );
    req.on("error", reject);
    req.end();
  });
}

const slug = process.env.BOOTSTRAP_SLUG || "browser-smoke";
const platformBase = "http://localhost:3000";
const tenantBase = `http://${slug}.localhost:3000`;

const browser = await chromium.launch({ headless: true });
const db = new PrismaClient();
let page;
const failedRequests = [];

try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  page.on("requestfailed", req => {
    const url = new URL(req.url());
    if (url.protocol === "http:" || url.protocol === "https:") {
      failedRequests.push({ host: url.host, path: url.pathname, method: req.method(), error: req.failure()?.errorText });
      if (failedRequests.length > 20) failedRequests.shift();
    }
  });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  async function visual(label) {
    if (!process.env.SMOKE_ARTIFACT_DIR) return;
    await mkdir(process.env.SMOKE_ARTIFACT_DIR, { recursive: true });
    for (const [mode, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
      await page.setViewportSize({ width, height });
      if (await page.locator(".bh2-tarjeta").count()) {
        await page.waitForFunction(() => getComputedStyle(document.querySelector(".bh2-tarjeta")).opacity === "1");
      }
      await page.screenshot({ path: join(process.env.SMOKE_ARTIFACT_DIR, `${label}-${mode}.png`), fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: ${mode} overflow`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  // 1. Platform domain root goes directly to SuperAdmin login
  await page.goto(platformBase + "/");
  await page.waitForURL("**/superadmin/login");
  await page.getByRole("heading", { name: "OnlyMarket Platform" }).waitFor();

  await visual("platform-login");

  // 2. Tenant domain (/login) resolves commerce automatically from hostname without code field
  await page.goto(tenantBase + "/catalogo");
  await page.waitForURL("**/login");
  assert.equal(await page.getByLabel("Código del comercio").count(), 0);
  await page.getByRole("heading", { name: "Browser Smoke" }).waitFor();

  await visual("tenant-login");

  // SuperAdmin routes must be strictly blocked on tenant hostnames
  const tenantSuperadminRes = await httpGet("/superadmin", { host: `${slug}.localhost:3000` });
  assert.equal(tenantSuperadminRes.status, 404);
  const tenantSuperadminLoginRes = await httpGet("/superadmin/login", { host: `${slug}.localhost:3000` });
  assert.equal(tenantSuperadminLoginRes.status, 404);

  // Unknown subdomain shows branded error screen with no login form
  await page.goto("http://inexistente-smoke.localhost:3000/login");
  await page.getByRole("heading", { name: "Comercio no encontrado" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Ingresar", exact: true }).count(), 0);

  // Log in on Tenant 1 subdomain
  await page.goto(tenantBase + "/login");
  await page.getByLabel("Correo electrónico").fill(process.env.BOOTSTRAP_EMAIL);
  await page.getByLabel("Contraseña", { exact: true }).fill(process.env.BOOTSTRAP_PASSWORD);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.getByRole("heading", { name: "Resumen operativo" }).waitFor();
  await visual("dashboard");

  // Verify host-only cookie is NOT shared with another tenant subdomain
  const tenantCookies = await page.context().cookies(tenantBase);
  const sessionCookie = tenantCookies.find((c) => c.name === "onlymarket_session");
  assert.ok(sessionCookie, "Expected host-only onlymarket_session cookie");
  assert.equal(sessionCookie.domain, `${slug}.localhost`);

  await page.goto(tenantBase + "/catalogo");
  await page.getByRole("button", { name: "+ Nuevo producto", exact: true }).click();
  await page.getByRole("dialog", { name: "Nuevo producto" }).waitFor();
  await visual("catalogo-alta");
  const newProduct = page.locator("form").filter({ has: page.getByRole("button", { name: "Crear producto", exact: true }) });
  await newProduct.getByLabel("Nombre", { exact: true }).fill("Yerba smoke");
  await newProduct.getByLabel("SKU", { exact: true }).fill("SMOKE-001");
  await newProduct.getByLabel("Código de barras").fill("4006381333931");
  await newProduct.getByLabel("Sector").selectOption("GROCERY");
  await newProduct.getByLabel("Precio de venta por unidad/kg ($)").fill("2500");
  await newProduct.getByRole("button", { name: "Crear producto" }).click();
  await page.getByRole("status").waitFor();

  await page.goto(tenantBase + "/proveedores");
  await visual("proveedores");
  await page.getByRole("button", { name: "+ Nuevo proveedor", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Proveedor smoke");
  await page.getByRole("button", { name: "Crear proveedor" }).click();
  await page.getByRole("status").waitFor();

  await page.goto(tenantBase + "/inventario");
  await visual("inventario");
  await page.getByRole("button", { name: "Recibir lote", exact: true }).click();
  const receive = page.locator("form").filter({ has: page.getByRole("button", { name: "Registrar recepción", exact: true }) });
  await receive.getByLabel("Código de lote").fill("SMOKE-LOT");
  await receive.getByLabel("Cantidad (kg o unidades)").fill("3");
  await receive.getByLabel("Costo total ($)").fill("4500");
  await receive.getByRole("button", { name: "Registrar recepción" }).click();
  await page.getByRole("status").waitFor();

  await page.goto(tenantBase + "/pos");
  await page.getByLabel("Fondo inicial ($)").fill("1000");
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await page.getByRole("heading", { name: "Nueva venta" }).waitFor();
  await visual("pos");
  await page.getByLabel("Buscar / escanear código").fill("4006381333931");
  await page.getByLabel("Buscar / escanear código").press("Enter");
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await page.getByLabel("Efectivo recibido").fill("3000");
  await page.getByRole("button", { name: "Confirmar venta" }).click();
  await page.getByRole("link", { name: "Ver / imprimir" }).first().waitFor();

  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug } });
  const sale = await db.sale.findFirstOrThrow({ where: { tenantId: tenant.id } });
  assert.equal(sale.totalCents, 250000n);
  assert.equal(sale.costCents, 150000n);
  assert.equal(sale.changeCents, 50000n);
  const lot = await db.lot.findFirstOrThrow({ where: { tenantId: tenant.id, code: "SMOKE-LOT" } });
  assert.equal(lot.quantityMilli, 2000n);

  await page.getByRole("link", { name: "Ver / imprimir" }).first().click();
  await page.getByRole("heading", { name: "Comprobante interno" }).waitFor();
  await page.getByRole("button", { name: "Imprimir comprobante" }).waitFor();

  await page.goto(tenantBase + "/finanzas");
  await visual("finanzas");
  await page.getByRole("heading", { name: "Finanzas y rentabilidad" }).waitFor();
  assert.match(await page.locator(".metrics").innerText(), /1000,00/);

  await page.goto(tenantBase + "/informes");
  await visual("informes");
  await page.getByRole("heading", { name: "Informes de rentabilidad" }).waitFor();
  const productReport = page.getByRole("row").filter({ hasText: "Yerba smoke" });
  assert.match(await productReport.innerText(), /2500,00/);
  assert.match(await productReport.innerText(), /1500,00/);
  assert.match(await productReport.innerText(), /1000,00/);

  await page.goto(tenantBase + "/alertas");
  await visual("alertas");
  await page.getByRole("heading", { name: "Centro de alertas" }).waitFor();
  await page.getByRole("button", { name: "Actualizar avisos" }).waitFor();

  await page.goto(tenantBase + "/etiquetas/" + lot.id);
  await page.getByRole("heading", { name: "Etiqueta de mercadería" }).waitFor();
  await page.getByRole("img", { name: "EAN 4006381333931" }).waitFor();
  await page.getByRole("button", { name: "Imprimir etiquetas" }).waitFor();

  await page.goto(tenantBase + "/catalogo/importar");
  await page.getByLabel("Contenido CSV").fill("sku;nombre;codigo_barras;unidad;sector;precio;aviso_dias;frescura_dias;apertura_dias\nSMOKE-002;Queso smoke;;KG;FIAMBRERIA;5000,00;3;;2");
  await page.getByLabel("Confirmo el alta de productos nuevos. No se sobrescriben registros existentes.").check();
  await page.getByRole("button", { name: "Importar productos", exact: true }).click();
  await page.getByRole("status").waitFor();
  assert.equal(await db.product.count({ where: { tenantId: tenant.id, sku: "SMOKE-002" } }), 1);

  await page.goto(tenantBase + "/administracion");
  await visual("administracion");
  await page.getByRole("button", { name: "+ Nueva sucursal", exact: true }).click();
  const branchForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Agregar sucursal", exact: true }) });
  await branchForm.getByLabel("Nombre").fill("Sucursal smoke");
  await branchForm.getByRole("button", { name: "Agregar sucursal" }).click();
  await page.getByRole("status").waitFor();
  const dest = await db.branch.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Sucursal smoke" } });

  await page.goto(tenantBase + "/stock?lot=" + lot.id);
  await page.getByText("Registrar conteo", { exact: true }).click();
  await page.getByLabel("Cantidad física (u.)").fill("1");
  const countForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Confirmar conteo", exact: true }) });
  await countForm.getByLabel("Motivo / referencia").fill("Faltante de prueba");
  await countForm.getByRole("button", { name: "Confirmar conteo" }).click();
  await page.getByRole("status").waitFor();
  const counted = await db.lot.findUniqueOrThrow({ where: { tenantId_id: { tenantId: tenant.id, id: lot.id } } });
  assert.equal(counted.quantityMilli, 1000n);
  assert.equal(counted.remainingCostCents, 150000n);

  await page.goto(tenantBase + "/reposicion");
  await visual("reposicion");
  await page.getByRole("button", { name: "Configurar objetivo de stock", exact: true }).click();
  const config = page.locator("form").filter({ has: page.getByRole("button", { name: "Guardar objetivo", exact: true }) });
  await config.getByLabel("Sucursal").selectOption(lot.branchId);
  await config.getByLabel("Producto").selectOption(lot.productId);
  await config.getByLabel("Stock mínimo").fill("2");
  await config.getByLabel("Stock objetivo").fill("4");
  await config.getByRole("button", { name: "Guardar objetivo" }).click();
  await page.getByRole("status").waitFor();
  assert.match(await page.getByRole("row").filter({ hasText: "Yerba smoke" }).innerText(), /Reponer/);

  await page.goto(tenantBase + "/stock?lot=" + lot.id);
  await page.getByText("Trasladar stock", { exact: true }).click();
  const transferForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Confirmar traslado", exact: true }) });
  await transferForm.getByLabel("Sucursal destino").selectOption(dest.id);
  await transferForm.getByLabel("Cantidad a trasladar").fill("1");
  await transferForm.getByLabel("Motivo / referencia").fill("Traslado de prueba");
  await transferForm.getByRole("button", { name: "Confirmar traslado" }).click();
  await page.getByRole("status").waitFor();
  const moved = await db.stockControl.findFirstOrThrow({ where: { tenantId: tenant.id, kind: "TRANSFER" }, include: { destination: true } });
  assert.equal(moved.destination.branchId, dest.id);
  assert.equal(moved.destination.status, "REVIEW");
  assert.equal(moved.destination.remainingCostCents, 150000n);

  await page.goto(tenantBase + "/finanzas");
  const shortageCard = page.locator(".metrics article").filter({ hasText: "Faltantes de inventario" });
  assert.match(await shortageCard.innerText(), /1500,00/);

  await page.goto(tenantBase + "/inventario");
  await page.getByRole("button", { name: "Recibir lote", exact: true }).click();
  const newReceipt = page.locator("form").filter({ has: page.getByRole("button", { name: "Registrar recepción", exact: true }) });
  await newReceipt.getByLabel("Sucursal").selectOption(lot.branchId);
  await newReceipt.locator('select[name="productId"]').selectOption(lot.productId);
  await newReceipt.getByLabel("Código de lote").fill("SMOKE-OFFER");
  await newReceipt.getByLabel("Cantidad (kg o unidades)").fill("3");
  await newReceipt.getByLabel("Costo total ($)").fill("4500");
  await newReceipt.getByRole("button", { name: "Registrar recepción" }).click();
  await page.getByRole("status").waitFor();

  await page.goto(tenantBase + "/promociones");
  await visual("promociones");
  await page.getByRole("button", { name: "+ Nueva promoción", exact: true }).click();
  const promoForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Crear promoción", exact: true }) });
  await promoForm.getByLabel("Nombre", { exact: true }).fill("3x2 smoke");
  await promoForm.locator('select[name="productId"]').selectOption(lot.productId);
  await promoForm.getByLabel("Tipo de promoción").selectOption("BUNDLE");
  await promoForm.getByLabel("Unidades que lleva").fill("3");
  await promoForm.getByLabel("Unidades que paga").fill("2");
  await promoForm.getByRole("button", { name: "Crear promoción" }).click();
  await page.getByRole("status").waitFor();

  await page.goto(tenantBase + "/pos");
  await page.getByLabel("Escaneo rápido").check();
  const scanner = page.getByLabel("Buscar / escanear código");
  for (let i = 0; i < 3; i++) {
    await scanner.fill("4006381333931");
    await scanner.press("Enter");
  }
  await page.getByRole("button", { name: "Restar una unidad de Yerba smoke" }).waitFor();
  assert.match(await page.locator(".total").innerText(), /5000,00/);
  await page.getByRole("button", { name: "Restar una unidad de Yerba smoke" }).click();
  assert.match(await page.locator(".total").innerText(), /5000,00/);
  await page.getByRole("button", { name: "Sumar una unidad de Yerba smoke" }).click();
  await page.locator('select[name="payment"]').selectOption("MIXED");
  await page.getByLabel("Efectivo asignado").fill("1000");
  await page.getByLabel("Transferencia asignada").fill("4000");
  await page.getByLabel("Efectivo recibido").fill("1200");
  await page.getByRole("button", { name: "Confirmar venta" }).click();
  await page.getByRole("status").filter({ hasText: "Venta registrada" }).waitFor();
  const offeredSale = await db.sale.findFirstOrThrow({ where: { tenantId: tenant.id, payment: "MIXED" }, include: { lines: true } });
  assert.equal(offeredSale.totalCents, 500000n);
  assert.equal(offeredSale.cashCents, 100000n);
  assert.equal(offeredSale.transferCents, 400000n);
  assert.equal(offeredSale.changeCents, 20000n);
  assert.equal(offeredSale.lines[0].promotionLabel, "3x2 smoke");

  // Platform admin cannot be reached from tenant subdomain
  assert.equal((await httpGet("/superadmin", { host: `${slug}.localhost:3000` })).status, 404);

  await page.goto(tenantBase + "/pos");
  await page.getByRole("button", { name: "Realizar arqueo", exact: true }).click();
  await page.getByLabel("Efectivo contado ($)").fill("4500");
  await page.getByRole("button", { name: "Cerrar caja" }).click();
  await page.getByRole("heading", { name: "Abrir caja" }).waitFor();
  const closedShift = await db.cashShift.findFirstOrThrow({ where: { tenantId: tenant.id, closedAt: { not: null } } });
  assert.equal(closedShift.expectedCents, 450000n);

  await page.locator('select[name="branchId"]').selectOption(lot.branchId);
  await page.getByLabel("Fondo inicial ($)").fill("0");
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await page.getByRole("heading", { name: "Nueva venta" }).waitFor();

  await page.goto(tenantBase + "/ventas/devolucion/" + offeredSale.id);
  await page.getByRole("heading", { name: "Devoluciones", exact: true }).waitFor();
  await page.getByRole("button",{name:"+ Nueva devolución",exact:true}).click();
  await page.getByLabel("Artículo a devolver").selectOption(offeredSale.lines[0].id);
  await page.getByLabel("Cantidad a devolver").fill("1");
  await page.locator('select[name="disposition"]').selectOption("REVIEW");
  await page.getByLabel("Motivo", { exact: true }).fill("Devolución posterior al cierre");
  await page.getByLabel("Confirmo que realicé el reintegro manual indicado y el destino físico de la mercadería.").check();
  await page.getByRole("button", { name: "Registrar devolución", exact: true }).click();
  await page.getByRole("status").waitFor();
  const returned = await db.saleReturn.findFirstOrThrow({ where: { tenantId: tenant.id, saleId: offeredSale.id }, include: { returnedLot: true } });
  assert.equal(returned.refundCents, 166667n);
  assert.equal(returned.transferCents, 166667n);
  assert.equal(returned.cashCents, 0n);
  assert.equal(returned.returnedLot.status, "REVIEW");
  assert.equal(returned.returnedLot.quantityMilli, 1000n);

  await page.goto(tenantBase + "/pos");
  await page.getByRole("button", { name: "Realizar arqueo", exact: true }).click();
  await page.getByLabel("Efectivo contado ($)").fill("0");
  await page.getByRole("button", { name: "Cerrar caja" }).click();
  await page.getByRole("heading", { name: "Abrir caja" }).waitFor();
  assert.equal((await db.cashShift.findUniqueOrThrow({ where: { tenantId_id: { tenantId: tenant.id, id: closedShift.id } } })).expectedCents, 450000n);

  await page.goto(tenantBase + "/configuracion");
  await visual("configuracion");
  await page.getByLabel("Tipo de comercio").selectOption("KIOSK");
  await page.getByLabel("Prefijo EAN de peso (2 dígitos, opcional)").fill("20");
  await page.getByLabel("Pesos de compra neta por punto").fill("100");
  await page.getByLabel("Descuento socios (%)").fill("5");
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await page.getByRole("status").waitFor();
  assert.equal(await page.getByRole("link", { name: "Desposte y fraccionamiento", exact: true }).count(), 0);

  await page.goto(tenantBase + "/clientes");
  await visual("clientes");
  await page.getByRole("button", { name: "+ Nuevo cliente", exact: true }).click();
  await page.getByLabel("Código de socio").fill("SOCIO-1");
  await page.getByLabel("Nombre", { exact: true }).fill("Socio smoke");
  await page.getByRole("button", { name: "Crear cliente" }).click();
  await page.getByRole("status").waitFor();
  const member = await db.customer.findFirstOrThrow({ where: { tenantId: tenant.id, code: "SOCIO-1" } });

  const extra = await db.product.create({ data: { tenantId: tenant.id, sku: "SMOKE-COMBO", name: "Galletas smoke", unit: "UNIT", sector: "GROCERY", salePriceCents: 100000n } });
  const weighed = await db.product.create({ data: { tenantId: tenant.id, sku: "SMOKE-WEIGHT", name: "Tomate smoke", unit: "KG", sector: "PRODUCE", salePriceCents: 200000n, weightCode: "01234", freshnessDays: 3 } });
  const supplier = await db.supplier.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const { receiveLot } = await import("../src/server/receipts.mjs");
  const { randomUUID } = await import("node:crypto");
  const owner = await db.membership.findFirstOrThrow({ where: { tenantId: tenant.id, role: "OWNER" } });
  const scope = { tenantId: tenant.id, actorUserId: owner.userId };
  const seedReceipt = async (productId, code, quantity, cost) =>
    receiveLot(db, scope, { branchId: lot.branchId, supplierId: supplier.id, productId, code, quantity, cost, requestKey: randomUUID(), expiresOn: "", invoiceRef: code });
  await seedReceipt(extra.id, "COMBO-B", "3", "1500");
  await seedReceipt(lot.productId, "COMBO-A", "3", "4500");
  await seedReceipt(weighed.id, "WEIGHT", "2", "1000");

  await page.goto(tenantBase + "/combos");
  await visual("combos");
  await page.getByRole("button", { name: "+ Nuevo combo", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Combo smoke");
  await page.getByLabel("Precio del combo ($)").fill("2500");
  await page.locator('select[name="product0"]').selectOption(lot.productId);
  await page.locator('select[name="product1"]').selectOption(extra.id);
  await page.getByRole("button", { name: "Crear combo" }).click();
  await page.getByRole("status").waitFor();

  await page.goto(tenantBase + "/pos");
  await page.locator('select[name="branchId"]').selectOption(lot.branchId);
  await page.getByLabel("Fondo inicial ($)").fill("0");
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await page.getByRole("heading", { name: "Nueva venta" }).waitFor();
  const comboScan = page.getByLabel("Buscar / escanear código");
  await page.getByLabel("Escaneo rápido").check();
  for (const code of ["COMBO-A", "COMBO-B"]) {
    await comboScan.fill(code);
    await comboScan.press("Enter");
  }
  const digits = "200123400750";
  const check = (10 - ([...digits].reduce((a, d, i) => a + Number(d) * (i % 2 ? 3 : 1), 0) % 10)) % 10;
  await comboScan.fill(digits + check);
  await comboScan.press("Enter");
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await page.getByLabel("Cliente (opcional)").selectOption(member.id);
  assert.match(await page.locator(".total").innerText(), /3925,00/);
  await page.locator('select[name="payment"]').selectOption("TRANSFER");
  await page.getByRole("button", { name: "Confirmar venta" }).click();
  await page.getByRole("status").filter({ hasText: "Venta registrada" }).waitFor();
  const memberSale = await db.sale.findFirstOrThrow({ where: { tenantId: tenant.id, customerId: member.id }, include: { lines: true } });
  assert.equal(memberSale.totalCents, 392500n);
  assert.ok(memberSale.lines.some((l) => l.quantityMilli === 750n));
  assert.ok(memberSale.lines.some((l) => l.promotionLabel === "Combo smoke"));

  await page.goto(tenantBase + "/clientes");
  assert.match(await page.getByRole("row").filter({ hasText: "Socio smoke" }).innerText(), /39/);

  await page.goto(tenantBase + "/pos");
  await page.getByRole("button", { name: "Realizar arqueo", exact: true }).click();
  await page.getByLabel("Efectivo contado ($)").fill("0");
  await page.getByRole("button", { name: "Cerrar caja" }).click();
  await page.getByRole("heading", { name: "Abrir caja" }).waitFor();

  // Keep session active briefly to verify cross-tenant session isolation BEFORE logging out
  const liveCookie = (await page.context().cookies(tenantBase)).find(c => c.name === "onlymarket_session");
  assert.ok(liveCookie);
  const tenantCookieHeader = `onlymarket_session=${liveCookie.value}`;

  // SuperAdmin workflow on platform host
  await page.goto(platformBase + "/superadmin/login");
  await page.getByLabel("Correo administrativo").fill(process.env.BOOTSTRAP_EMAIL);
  await page.getByLabel("Contraseña administrativa").fill(process.env.BOOTSTRAP_PASSWORD);
  await page.getByRole("button", { name: "Ingresar a plataforma" }).click();
  await page.waitForURL("**/superadmin/login?error=1");

  await page.getByLabel("Correo administrativo").fill(process.env.PLATFORM_BOOTSTRAP_EMAIL);
  await page.getByLabel("Contraseña administrativa").fill(process.env.PLATFORM_BOOTSTRAP_PASSWORD);
  await page.getByRole("button", { name: "Ingresar a plataforma" }).click();
  await page.getByRole("heading", { name: "OnlyMarket / Comercios" }).waitFor();

  await visual("superadmin");
  const platformCookie = (await page.context().cookies(platformBase + "/superadmin")).find(c => c.name === "onlymarket_platform");
  assert.ok(platformCookie?.httpOnly && platformCookie?.secure);
  assert.equal(platformCookie.domain, "localhost");
  assert.equal(platformCookie.path, "/superadmin");

  // Verify slug availability check rejects reserved NanoLabs SaaS slugs
  const reservedCheck = await page.request.get(platformBase + "/superadmin/api/slug-check?slug=onlycars");
  assert.equal(reservedCheck.status(), 200);
  assert.equal((await reservedCheck.json()).available, false);

  // Create second commerce via SuperAdmin
  await page.getByRole("button", { name: "+ Nuevo comercio", exact: true }).click();
  await page.getByRole("dialog", { name: "Crear comercio" }).waitFor();
  await visual("superadmin-alta");
  await page.getByLabel("Nombre del comercio").fill("Segundo comercio smoke");
  await page.getByLabel("Subdominio de acceso").fill("platform-smoke");
  await page.getByLabel("Correo del propietario").fill("platform-owner@example.invalid");
  await page.getByLabel("Contraseña inicial").fill("CI-only-owner-test-password");
  await page.getByRole("button", { name: "Crear comercio" }).click();
  await page.getByRole("status").filter({ hasText: "Comercio creado correctamente" }).waitFor();

  const second = await db.tenant.findUniqueOrThrow({ where: { slug: "platform-smoke" } });
  assert.equal(await db.platformAudit.count({ where: { tenantId: second.id, action: "CREATE_TENANT" } }), 1);

  // SuperAdmin displays tenant URL and allows opening it
  const secondRow = page.getByRole("row").filter({ hasText: "Segundo comercio smoke" });
  const tenantLink = secondRow.locator('a[href*="platform-smoke"]');
  assert.equal(await tenantLink.count(), 1);
  assert.equal(await tenantLink.getAttribute("href"), "http://platform-smoke.localhost:3000");

  // Verify Tenant 1 cookie is NEVER accepted on Tenant 2's subdomain (both browser navigation and forged Cookie header)
  await page.goto("http://platform-smoke.localhost:3000/");
  await page.waitForURL("**/login");
  await page.getByRole("heading", { name: "Segundo comercio smoke" }).waitFor();

  const forgedAttempt = await httpGet("/catalogo", {
    host: "platform-smoke.localhost:3000",
    cookie: tenantCookieHeader,
  });
  assert.equal(forgedAttempt.status, 307);
  assert.match(String(forgedAttempt.headers.location || ""), /\/login$/);

  // Authenticate Tenant 2 in the SAME browser context, without reusing Tenant 1's cookie.
  const secondBase = "http://platform-smoke.localhost:3000";
  assert.equal((await page.context().cookies(secondBase)).some(c => c.name === "onlymarket_session"), false, "Tenant 1 cookie leaked to Tenant 2");
  const secondOwner = await db.user.findUniqueOrThrow({ where: { email: "platform-owner@example.invalid" }, select: { id: true, active: true } });
  assert.ok(secondOwner.active);
  assert.equal(await db.membership.count({ where: { tenantId: second.id, userId: secondOwner.id, role: "OWNER" } }), 1);
  await page.getByRole("heading", { name: "Segundo comercio smoke", exact: true }).waitFor();
  await page.getByLabel("Correo electrónico").fill("platform-owner@example.invalid");
  await page.getByLabel("Contraseña", { exact: true }).fill("CI-only-owner-test-password");
  const post = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).origin === secondBase && new URL(r.url()).pathname === "/login");
  const [loginResponse] = await Promise.all([post, page.getByRole("button", { name: "Ingresar", exact: true }).click()]);
  assert.ok(loginResponse.status() >= 200 && loginResponse.status() < 400, `Tenant 2 login HTTP ${loginResponse.status()}`);
  try {
    await page.getByRole("heading", { name: "Resumen operativo" }).waitFor();
  } catch (error) {
    const cookie = (await page.context().cookies(secondBase)).find(c => c.name === "onlymarket_session");
    const sessionCount = await db.session.count({ where: { tenantId: second.id, userId: secondOwner.id } });
    console.error("Tenant 2 login diagnostic:", { url: page.url(), http: loginResponse.status(), cookiePresent: !!cookie, sessionCount, alerts: await page.getByRole("alert").allTextContents() });
    throw error;
  }
  assert.equal(new URL(page.url()).origin, secondBase, "Tenant 2 login redirected to another host");
  const secondCookie = (await page.context().cookies(secondBase)).find(c => c.name === "onlymarket_session");
  assert.ok(secondCookie?.httpOnly && secondCookie.secure);
  assert.equal(secondCookie.domain, "platform-smoke.localhost");
  const secondSession = await db.session.findUniqueOrThrow({ where: { tokenHash: tokenHash(secondCookie.value) }, select: { tenantId: true, userId: true } });
  assert.equal(secondSession.tenantId, second.id);
  assert.equal(secondSession.userId, secondOwner.id);
  await page.goto(secondBase + "/catalogo");
  assert.equal(await page.getByRole("row").filter({ hasText: "Yerba smoke" }).count(), 0);
  const privateTicket = await httpGet("/pos/ticket/" + sale.id, {
    host: "platform-smoke.localhost:3000",
    cookie: "onlymarket_session=" + secondCookie.value,
  });
  assert.equal(privateTicket.status, 404);
  const stolenPlatform = await httpGet("/superadmin", { host: `${slug}.localhost:3000`, cookie: `onlymarket_platform=${platformCookie.value}` });
  assert.equal(stolenPlatform.status, 404);

  // Also test caddy/ask contract
  assert.equal((await fetch(platformBase + "/api/internal/caddy/ask?domain=localhost")).status, 204);
  assert.equal((await fetch(platformBase + `/api/internal/caddy/ask?domain=${slug}.localhost`)).status, 204);
  assert.equal((await fetch(platformBase + "/api/internal/caddy/ask?domain=platform-smoke.localhost")).status, 204);
  assert.equal((await fetch(platformBase + "/api/internal/caddy/ask?domain=onlycars.localhost")).status, 404);
  assert.equal((await fetch(platformBase + "/api/internal/caddy/ask?domain=no-existe-smoke.localhost")).status, 404);
  assert.equal((await fetch(platformBase + "/api/internal/caddy/ask?domain=bad%20domain")).status, 400);

  // Suspend Tenant 2 and verify access is blocked with branded screen (and no login form)
  await page.goto(platformBase + "/superadmin");
  const licenseRow = page.getByRole("row").filter({ hasText: "Segundo comercio smoke" });
  await licenseRow.getByRole("button", { name: "Editar licencia" }).click();
  await licenseRow.getByLabel("Plan", { exact: true }).selectOption("PRO");
  await licenseRow.getByLabel("Suspender acceso").check();
  await licenseRow.getByRole("button", { name: "Guardar licencia" }).click();
  await page.getByRole("status").filter({ hasText: "Licencia actualizada" }).waitFor();
  const licensed = await db.tenant.findUniqueOrThrow({ where: { id: second.id } });
  assert.equal(licensed.plan, "PRO");
  assert.equal(licensed.suspended, true);

  await page.goto("http://platform-smoke.localhost:3000/login");
  await page.getByRole("heading", { name: "Acceso suspendido" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Ingresar", exact: true }).count(), 0);
  // Suspended tenant still returns 204 on caddy/ask so OnlyMarket displays the suspended message
  assert.equal((await fetch(platformBase + "/api/internal/caddy/ask?domain=platform-smoke.localhost")).status, 204);

  // Existing Tenant 2 session loses access while suspended and recovers after reactivation.
  await page.goto("http://platform-smoke.localhost:3000/catalogo");
  await page.waitForURL("**/login");
  await page.goto(platformBase + "/superadmin");
  const reactivateRow = page.getByRole("row").filter({ hasText: "Segundo comercio smoke" });
  await reactivateRow.getByRole("button", { name: "Editar licencia" }).click();
  await reactivateRow.getByLabel("Suspender acceso").uncheck();
  await reactivateRow.getByRole("button", { name: "Guardar licencia" }).click();
  await page.getByRole("status").filter({ hasText: "Licencia actualizada" }).waitFor();
  await page.goto("http://platform-smoke.localhost:3000/");
  await page.getByRole("heading", { name: "Resumen operativo" }).waitFor();

  // Expired tenant blocks access with branded screen (and no login form)
  const expiredOwnerHash = await hashPassword("CI-expired-owner-password");
  const expiredTenant = await db.tenant.create({
    data: { name: "Comercio vencido smoke", slug: "expired-smoke", licenseUntil: new Date("2020-01-01T00:00:00Z") },
  });
  const expiredUser = await db.user.create({ data: { email: "expired-owner@example.invalid", passwordHash: expiredOwnerHash } });
  await db.membership.create({ data: { tenantId: expiredTenant.id, userId: expiredUser.id, role: "OWNER" } });
  await db.branch.create({ data: { tenantId: expiredTenant.id, name: "Central" } });

  await page.goto("http://expired-smoke.localhost:3000/login");
  await page.getByRole("heading", { name: "Licencia vencida" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Ingresar", exact: true }).count(), 0);

  // Hub integration contract remains intact
  const endpoint = platformBase + "/api/integrations/nanolabs/tenants";
  assert.equal((await fetch(endpoint)).status, 401);
  const headers = { Authorization: "Bearer " + process.env.HUB_INTEGRATION_TOKEN };
  assert.equal((await fetch(endpoint + "?offset=-1", { headers })).status, 400);
  const response = await fetch(endpoint, { headers });
  assert.equal(response.status, 200);
  const wire = await response.json();
  assert.equal(wire.contract, "nanolabs.saas.tenants.v1");
  assert.equal(wire.product, "onlymarket");
  assert.deepEqual(wire.capabilities, { tenantsRead: true, tenantWrite: false, moduleWrite: false });
  assert.ok(wire.tenants.some((t) => t.id === second.id));
  assert.ok(wire.tenants.every((t) => !Object.hasOwn(t, "email")));
  assert.equal((await fetch(endpoint, { method: "POST", headers })).status, 405);

  // Verify direct Host requests and reject forged forwarded authorities
  const prodAdminRoot = await httpGet("/", {
    host: "localhost:3000",
    "x-forwarded-proto": "https",
  });
  assert.equal(prodAdminRoot.status, 307);
  assert.equal(prodAdminRoot.headers.location, "http://localhost:3000/superadmin/login");

  const prodTenantSuperadmin = await httpGet("/superadmin", {
    host: `${slug}.localhost`,
    "x-forwarded-proto": "https",
  });
  assert.equal(prodTenantSuperadmin.status, 404);

  const prodTenantLogin = await httpGet("/login", {
    host: `${slug}.localhost`,
    "x-forwarded-proto": "https",
  });
  assert.equal(prodTenantLogin.status, 200);
  assert.match(prodTenantLogin.text, /Browser Smoke/);

  for (const forwarded of ["localhost:3000", `${slug}.localhost:3000,localhost:3000`, "evil.test"]) {
    assert.equal((await httpGet("/superadmin", { host: `${slug}.localhost:3000`, "x-forwarded-host": forwarded })).status, 400);
  }
  assert.equal((await httpGet("/superadmin", { host: "unknown.test" })).status, 404);
  for (const value of ["localhost:3000", "localhost,evil.test", "https://localhost", "*.localhost", "localhost."]) {
    assert.equal((await fetch(platformBase + "/api/internal/caddy/ask?domain=" + encodeURIComponent(value))).status, 400);
  }
  assert.equal((await fetch(platformBase + "/api/internal/caddy/ask?domain=localhost&domain=evil.test")).status, 400);
  assert.equal((await fetch(platformBase + "/api/internal/caddy/ask?domain=evil.test")).status, 404);

  // Log out of Tenant 1 and SuperAdmin cleanly
  await page.goto(tenantBase + "/");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.waitForURL("**/login");

  await page.goto(platformBase + "/superadmin");
  await page.getByRole("button", { name: "Cerrar sesión de plataforma" }).click();
  await page.waitForURL("**/superadmin/login");

  assert.deepEqual(errors, []);
  console.log("Browser smoke: subdomain routing, tenant isolation, superadmin, commercial workflow and Hub contract OK");
} catch (error) {
  if (page && !page.isClosed()) {
    console.error("Browser smoke failed:", { url: page.url(), title: await page.title().catch(() => ""), failedRequests });
    if (process.env.SMOKE_FAILURE_DIR) {
      await mkdir(process.env.SMOKE_FAILURE_DIR, { recursive: true }).catch(() => {});
      await page.screenshot({ path: join(process.env.SMOKE_FAILURE_DIR, "failure.png"), fullPage: true }).catch(() => {});
    }
  }
  throw error;
} finally {
  await browser.close();
  await db.$disconnect();
}
