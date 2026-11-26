import {
  authenticateManagementRequest,
  MANAGEMENT_CONTRACT,
  MANAGEMENT_HEADERS,
  managementFailure,
  permittedOperations,
  readBoundedBody,
  HubError,
  type HubOperation,
} from "../../../../../src/server/hub-http";
import { executeManagementCommand, readManagementResource } from "../../../../../src/server/hub-management";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    authenticateManagementRequest(req, "");
    const url = new URL(req.url);
    const resource = url.searchParams.get("resource") || "catalog";
    const data = await readManagementResource(resource, url);
    return Response.json({ success: true, contract: MANAGEMENT_CONTRACT, product: "onlymarket", data }, { headers: MANAGEMENT_HEADERS });
  } catch (error) {
    return managementFailure(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await readBoundedBody(req);
    const auth = authenticateManagementRequest(req, body);
    const parsed = JSON.parse(body) as {
      requestId?: unknown;
      actor?: unknown;
      operation?: unknown;
      input?: unknown;
    };
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.requestId !== "string" ||
      typeof parsed.actor !== "string" ||
      typeof parsed.operation !== "string" ||
      !parsed.input ||
      typeof parsed.input !== "object" ||
      Array.isArray(parsed.input)
    ) {
      throw new HubError(400, "INVALID_INPUT", "Comando mal formado.");
    }
    if (parsed.actor !== auth.actor) {
      throw new HubError(403, "ACTOR", "El actor no coincide con la firma.");
    }
    const op = parsed.operation as HubOperation;
    if (!permittedOperations().includes(op)) {
      throw new HubError(403, "SCOPE", "Operación no habilitada.");
    }
    const data = await executeManagementCommand(
      { requestId: parsed.requestId, actor: parsed.actor, operation: op, input: parsed.input as Record<string, unknown> },
      body,
      auth.key
    );
    return Response.json(
      { success: true, contract: MANAGEMENT_CONTRACT, product: "onlymarket", requestId: parsed.requestId, data },
      { headers: MANAGEMENT_HEADERS }
    );
  } catch (error) {
    return managementFailure(error);
  }
}
