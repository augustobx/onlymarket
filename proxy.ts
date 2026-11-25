import { NextResponse, type NextRequest } from "next/server";
import { buildPlatformUrl, requestHostname, resolveHostContext } from "./src/domain/domains.mjs";

const PUBLIC_EXACT = new Set([
  "/api/health",
  "/api/internal/caddy/ask",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/sw.js",
  "/market-icon.svg",
]);

function externalRedirect(targetPath: string) {
  return NextResponse.redirect(new URL(targetPath, buildPlatformUrl()));
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (
    PUBLIC_EXACT.has(path) ||
    path.startsWith("/_next/") ||
    path.startsWith("/nanolabs/") ||
    path.startsWith("/api/integrations/")
  ) {
    return NextResponse.next();
  }

  const hostname = requestHostname(request.headers.get("host"), request.headers.get("x-forwarded-host"));
  if (!hostname) return new NextResponse("Invalid Host", { status: 400 });
  const ctx = resolveHostContext(hostname);
  if (ctx.kind === "unknown") return new NextResponse("Not Found", { status: 404 });

  // 1. Dominio administrativo / plataforma: exclusivo SuperAdmin
  if (ctx.kind === "platform") {
    if (path === "/superadmin" || path.startsWith("/superadmin/")) {
      return NextResponse.next();
    }
    const hasPlatformCookie = Boolean(request.cookies.get("onlymarket_platform")?.value);
    return externalRedirect(hasPlatformCookie ? "/superadmin" : "/superadmin/login");
  }

  // 2. Dominios de comercios o desconocidos: bloquear completamente el acceso al SuperAdmin
  if (path === "/superadmin" || path.startsWith("/superadmin/")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
