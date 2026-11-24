import {hashPassword} from "./password.mjs";
import {textField} from "../domain/parse.mjs";
import {serial} from "./sales.mjs";
export async function createCommerce(prisma,session,input){
 const name=textField(input.name,"Comercio",120),slug=textField(input.slug,"Código",64).toLowerCase(),email=textField(input.email,"Correo",254).toLowerCase(),branchName=textField(input.branchName,"Sucursal",100);
 if(!/^[a-z0-9][a-z0-9-]{1,63}$/.test(slug)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Código o correo inválido");
 const passwordHash=await hashPassword(input.password);
 return serial(prisma,async tx=>{
  const auth=await tx.platformSession.findUnique({where:{tokenHash:session.tokenHash},include:{admin:true}});
  if(!auth||!auth.admin.active||auth.adminId!==session.id||auth.expiresAt<=new Date())throw new Error("Sesión administrativa inválida");
  if(await tx.tenant.findUnique({where:{slug}}))throw new Error("Código de comercio existente");
  if(await tx.user.findUnique({where:{email}}))throw new Error("Correo ya utilizado; no se modifican usuarios existentes");
  const tenant=await tx.tenant.create({data:{name,slug}});
  const user=await tx.user.create({data:{email,passwordHash}});
  await tx.membership.create({data:{tenantId:tenant.id,userId:user.id,role:"OWNER"}});
  await tx.branch.create({data:{tenantId:tenant.id,name:branchName}});
  await tx.platformAudit.create({data:{adminId:auth.adminId,tenantId:tenant.id,action:"CREATE_TENANT",detail:"Alta de comercio "+slug}});
  return tenant;
 });
}
