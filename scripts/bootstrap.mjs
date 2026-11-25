import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/server/password.mjs";
import { validateSlugFormat } from "../src/domain/domains.mjs";
import { checkSlugAvailability } from "../src/server/slug-availability.mjs";

const db = new PrismaClient();
try {
  const email = process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const slugCheck = validateSlugFormat(process.env.BOOTSTRAP_SLUG ?? "");
  const name = process.env.BOOTSTRAP_NAME?.trim();
  if (!email || !email.includes("@") || !slugCheck.ok || !name) {
    throw new Error(
      slugCheck.reason || "Configurar BOOTSTRAP_EMAIL, BOOTSTRAP_SLUG, BOOTSTRAP_NAME y BOOTSTRAP_PASSWORD"
    );
  }
  const slug = slugCheck.slug;
  const availability = await checkSlugAvailability(db, slug);
  if (!availability.available) throw new Error(availability.reason);
  const passwordHash = await hashPassword(process.env.BOOTSTRAP_PASSWORD);
  await db.$transaction(async (tx) => {
    if (await tx.tenant.findUnique({ where: { slug } })) throw new Error("Comercio ya existe; no se sobrescribe");
    if (await tx.user.findUnique({ where: { email } })) throw new Error("Usuario ya existe; no se modifican permisos");
    const tenant = await tx.tenant.create({ data: { name, slug } });
    const user = await tx.user.create({ data: { email, passwordHash } });
    await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: "OWNER" } });
    await tx.branch.create({ data: { tenantId: tenant.id, name: "Casa central" } });
  });
  console.log("Comercio y propietario creados:", slug);
} finally {
  await db.$disconnect();
}
