import { NextRequest, NextResponse } from "next/server";
import { platformSession } from "../../../../src/server/platform-auth";
import { db } from "../../../../src/server/db";
import { checkSlugAvailability } from "../../../../src/server/slug-availability.mjs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await platformSession();
  if (!session) {
    return NextResponse.json({ available: false, reason: "Sesión administrativa requerida." }, { status: 401 });
  }

  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  const result = await checkSlugAvailability(db, slug);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
