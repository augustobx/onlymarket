import { hashPassword } from "./password.mjs";
import { textField } from "../domain/parse.mjs";
import { serial } from "./sales.mjs";
import { checkSlugAvailability } from "./slug-availability.mjs";

export async function createCommerce(prisma, session, input) {
  const name = textField(input.name, "Comercio", 120);
  const rawSlug = textField(input.slug, "Subdominio", 63).toLowerCase();
  const email = textField(input.email, "Correo", 254).toLowerCase();
  const branchName = textField(input.branchName, "Sucursal", 100);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Correo electrónico inválido");
  }

  const slugCheck = await checkSlugAvailability(prisma, rawSlug);
  if (!slugCheck.available) {
    throw new Error(slugCheck.reason || "Subdominio no disponible");
  }
  const slug = slugCheck.slug;
  const passwordHash = await hashPassword(input.password);

  return serial(prisma, async (tx) => {
    const auth = await tx.platformSession.findUnique({
      where: { tokenHash: session.tokenHash },
      include: { admin: true },
    });
    if (!auth || !auth.admin.active || auth.adminId !== session.id || auth.expiresAt <= new Date()) {
      throw new Error("Sesión administrativa inválida");
    }
    if (await tx.tenant.findUnique({ where: { slug } })) {
      throw new Error("Código de comercio existente");
    }
    if (await tx.user.findUnique({ where: { email } })) {
      throw new Error("Correo ya utilizado; no se modifican usuarios existentes");
    }
    const tenant = await tx.tenant.create({ data: { name, slug } });
    const user = await tx.user.create({ data: { email, passwordHash } });
    await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: "OWNER" } });
    await tx.branch.create({ data: { tenantId: tenant.id, name: branchName } });
    await tx.platformAudit.create({
      data: { adminId: auth.adminId, tenantId: tenant.id, action: "CREATE_TENANT", detail: "Alta de comercio " + slug },
    });
    return tenant;
  });
}
