import { authenticateReadBearer, MANAGEMENT_HEADERS, managementFailure } from "../../../../../src/server/hub-http";
import { readTenantsSummary } from "../../../../../src/server/hub-management";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    authenticateReadBearer(req);
    const rawOffset = new URL(req.url).searchParams.get("offset") ?? "0";
    if (!/^\d{1,6}$/.test(rawOffset)) {
      return Response.json({ success: false, error: "Invalid offset" }, { status: 400, headers: MANAGEMENT_HEADERS });
    }
    const { tenants, nextOffset } = await readTenantsSummary(Number(rawOffset));
    return Response.json(
      {
        success: true,
        contract: "nanolabs.saas.tenants.v1",
        product: "onlymarket",
        capturedAt: new Date().toISOString(),
        tenants,
        nextOffset,
        capabilities: { tenantsRead: true, tenantWrite: false, moduleWrite: false },
      },
      { headers: MANAGEMENT_HEADERS }
    );
  } catch (error) {
    return managementFailure(error);
  }
}
