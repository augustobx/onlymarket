import { createHmac, timingSafeEqual } from "node:crypto";

export const MANAGEMENT_CONTRACT = "nanolabs.saas.management.v1";
export const MANAGEMENT_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export const ALL_OPERATIONS = [
  "tenant.create",
  "tenant.update",
  "tenant.status",
  "subscription.update",
  "subscription.renew",
  "module.set",
  "admin.update",
  "admin.revoke",
  "plan.create",
  "plan.update",
  "payment.record",
  "payment.status",
] as const;

export type HubOperation = (typeof ALL_OPERATIONS)[number];

export class HubError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function permittedOperations(): HubOperation[] {
  const raw = process.env.HUB_MANAGEMENT_OPERATIONS;
  if (!raw) return [...ALL_OPERATIONS];
  const configured = raw.split(",").map((s) => s.trim());
  return ALL_OPERATIONS.filter((op) => configured.includes(op));
}

export function authenticateReadBearer(req: Request): void {
  if (process.env.HUB_INTEGRATION_ENABLED === "false") {
    throw new HubError(503, "DISABLED", "Integración deshabilitada.");
  }
  const key = process.env.HUB_INTEGRATION_TOKEN || "";
  if (Buffer.byteLength(key) < 32 || (process.env.HUB_MANAGEMENT_TOKEN && equal(key, process.env.HUB_MANAGEMENT_TOKEN))) {
    throw new HubError(401, "UNAUTHORIZED", "Credencial no configurada.");
  }
  const supplied = req.headers.get("authorization") || "";
  if (!equal(supplied, `Bearer ${key}`)) {
    throw new HubError(401, "UNAUTHORIZED", "Credenciales inválidas.");
  }
}

export function authenticateManagementRequest(req: Request, body: string, now = Date.now()): { actor: string; key: string } {
  if (process.env.HUB_MANAGEMENT_ENABLED !== "true") {
    throw new HubError(503, "DISABLED", "Gestión central deshabilitada.");
  }
  const key = process.env.HUB_MANAGEMENT_TOKEN || "";
  if (Buffer.byteLength(key) < 32 || (process.env.HUB_INTEGRATION_TOKEN && equal(key, process.env.HUB_INTEGRATION_TOKEN))) {
    throw new HubError(503, "DISABLED", "Las credenciales de gestión deben ser independientes.");
  }
  const supplied = req.headers.get("authorization") || "";
  const timestamp = req.headers.get("x-nanolabs-timestamp") || "";
  const actor = req.headers.get("x-nanolabs-actor") || "";
  const signature = req.headers.get("x-nanolabs-signature") || "";
  if (
    !equal(supplied, `Bearer ${key}`) ||
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp)) > 300_000 ||
    !/^[a-zA-Z0-9@._:+-]{1,120}$/.test(actor) ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    throw new HubError(401, "UNAUTHORIZED", "Credenciales de gestión inválidas.");
  }
  const url = new URL(req.url);
  const signed = [timestamp, req.method, url.pathname + url.search, actor, body].join("\n");
  const expected = createHmac("sha256", key).update(signed).digest("hex");
  if (!equal(expected, signature)) {
    throw new HubError(401, "SIGNATURE", "Firma inválida o expirada.");
  }
  return { actor, key };
}

export async function readBoundedBody(req: Request): Promise<string> {
  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    throw new HubError(415, "FORMAT", "Se requiere JSON.");
  }
  const reader = req.body?.getReader();
  if (!reader) throw new HubError(400, "BODY", "Cuerpo vacío.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 32768) {
      await reader.cancel();
      throw new HubError(413, "BODY_LIMIT", "La solicitud supera el límite permitido.");
    }
    chunks.push(chunk.value);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
}

export function managementFailure(error: unknown): Response {
  if (error instanceof HubError) {
    return Response.json({ success: false, code: error.code, error: error.message }, { status: error.status, headers: MANAGEMENT_HEADERS });
  }
  if (error instanceof SyntaxError || error instanceof TypeError) {
    return Response.json({ success: false, code: "INVALID_INPUT", error: "Datos inválidos." }, { status: 400, headers: MANAGEMENT_HEADERS });
  }
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "P2002" || code === "23505") {
    return Response.json({ success: false, code: "CONFLICT", error: "Identificador o referencia duplicada." }, { status: 409, headers: MANAGEMENT_HEADERS });
  }
  return Response.json({ success: false, code: "UNAVAILABLE", error: "La operación no pudo completarse." }, { status: 503, headers: MANAGEMENT_HEADERS });
}
