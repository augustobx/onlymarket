import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { tokenHash, newToken, verifyPassword } from "./password.mjs";
import { getHostContext } from "./tenant-host";

const COOKIE = "onlymarket_platform";
const DUMMY = "scrypt1:" + "0".repeat(32) + ":" + "0".repeat(128);

export const platformEnabled = () => process.env.PLATFORM_ADMIN_ENABLED === "true";

export async function platformSession() {
  if (!platformEnabled()) return null;
  const ctx = await getHostContext();
  if (ctx.kind !== "platform") return null;

  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;

  const session = await db.platformSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { admin: true },
  });
  if (!session || !session.admin.active || session.expiresAt <= new Date()) return null;

  return { id: session.adminId, email: session.admin.email, tokenHash: session.tokenHash };
}

export async function requirePlatform() {
  const s = await platformSession();
  if (!s) redirect("/superadmin/login");
  return s;
}

async function attempt(key: string, limit: number) {
  const rows = await db.$queryRaw<{ attempts: number }[]>`
  INSERT INTO "LoginLimit" ("key","attempts","windowStart") VALUES (${key},1,now())
  ON CONFLICT ("key") DO UPDATE SET
  "attempts"=CASE WHEN "LoginLimit"."windowStart"<now()-interval '15 minutes' THEN 1 ELSE LEAST("LoginLimit"."attempts"+1,${limit + 1}) END,
  "windowStart"=CASE WHEN "LoginLimit"."windowStart"<now()-interval '15 minutes' THEN now() ELSE "LoginLimit"."windowStart" END
  RETURNING "attempts"`;
  return (rows[0]?.attempts ?? limit + 1) <= limit;
}

export async function platformLogin(email: string, password: string) {
  if (!platformEnabled()) return false;
  const ctx = await getHostContext();
  if (ctx.kind !== "platform") return false;

  email = email.trim().toLowerCase();
  if (!email || email.length > 254 || password.length > 128) return false;
  if (!(await attempt(tokenHash("platform:global"), 30)) || !(await attempt(tokenHash("platform:email:" + email), 8))) {
    return false;
  }

  const admin = await db.platformAdmin.findUnique({ where: { email } });
  const valid = await verifyPassword(password, admin?.passwordHash ?? DUMMY);
  if (!valid || !admin?.active) return false;

  const jar = await cookies();
  const old = jar.get(COOKIE)?.value;
  const token = newToken();
  const expiresAt = new Date(Date.now() + 4 * 3600000);

  await db.$transaction(async (tx) => {
    if (old && /^[a-f0-9]{64}$/.test(old)) {
      await tx.platformSession.deleteMany({ where: { tokenHash: tokenHash(old), adminId: admin.id } });
    }
    await tx.platformSession.create({ data: { tokenHash: tokenHash(token), adminId: admin.id, expiresAt } });
  });

  // Host-only cookie scoped strictly to /superadmin on the platform domain.
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/superadmin",
    expires: expiresAt,
  });
  return true;
}

export async function platformLogout() {
  const ctx = await getHostContext();
  if (ctx.kind !== "platform") return;
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await db.platformSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
  }
  jar.set(COOKIE, "", {
    path: "/superadmin",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
  });
}
