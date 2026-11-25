import { NextRequest, NextResponse } from "next/server";
import { getPlatformDomain, certificateHostname, resolveHostContext } from "../../../../../src/domain/domains.mjs";
import { db } from "../../../../../src/server/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("domain");
  const domain = certificateHostname(raw);
  if (!domain || request.nextUrl.searchParams.getAll("domain").length !== 1) {
    return new NextResponse(null, { status: 400 });
  }

  // Dominio principal de plataforma OnlyMarket (ej. onlymarket.nanoapps.ar)
  if (domain === getPlatformDomain()) {
    return new NextResponse(null, { status: 204 });
  }

  const ctx = resolveHostContext(domain);
  if (ctx.kind !== "tenant" || !ctx.slug) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const tenant = await db.tenant.findUnique({
      where: { slug: ctx.slug },
      select: { id: true },
    });
    // Devolver 204 incluso si el comercio está suspendido o vencido para que OnlyMarket muestre su bloqueo oficial.
    return new NextResponse(null, { status: tenant ? 204 : 404 });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
