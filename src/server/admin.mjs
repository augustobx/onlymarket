import {hashPassword} from "./password.mjs";
import {textField} from "../domain/parse.mjs";
import {serial,authorizeSale} from "./sales.mjs";
const roles=["MANAGER","INVENTORY","CASHIER"];
export async function adminOperation(prisma,s,input){
 const kind=input.kind,tenantId=s.tenantId;
 if(kind==="BRANCH"){
  const name=textField(input.name,"Sucursal",100);
  return serial(prisma,async tx=>{
   await authorizeSale(tx,s,["OWNER"]);
   const existing=await tx.branch.findFirst({where:{tenantId,name:{equals:name,mode:"insensitive"}}});
   if(existing)throw new Error("Ya existe esa sucursal");
   return tx.branch.create({data:{tenantId,name}});
  });
 }
 if(kind==="EMPLOYEE"){
  const email=textField(input.email,"Correo",254).toLowerCase(),role=input.role;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!roles.includes(role))throw new Error("Correo o rol inválido");
  const passwordHash=await hashPassword(input.password);
  return serial(prisma,async tx=>{
   await authorizeSale(tx,s,["OWNER"]);
   if(await tx.user.findUnique({where:{email}}))throw new Error("Correo ya registrado; solicitar vinculación a NanoLabs");
   const user=await tx.user.create({data:{email,passwordHash}});
   return tx.membership.create({data:{tenantId,userId:user.id,role}});
  });
 }
 if(kind==="ROLE"||kind==="REVOKE"){
  const userId=textField(input.userId,"Usuario");
  return serial(prisma,async tx=>{
   await authorizeSale(tx,s,["OWNER"]);
   const member=await tx.membership.findUnique({where:{tenantId_userId:{tenantId,userId}}});
   if(!member||member.role==="OWNER"||userId===s.actorUserId)throw new Error("No se puede modificar al propietario");
   if(await tx.cashShift.findFirst({where:{tenantId,actorId:userId,closedAt:null}}))throw new Error("El empleado debe cerrar su caja primero");
   if(kind==="ROLE"){
    if(!roles.includes(input.role))throw new Error("Rol inválido");
    await tx.membership.update({where:{tenantId_userId:{tenantId,userId}},data:{role:input.role}});
   }else await tx.membership.delete({where:{tenantId_userId:{tenantId,userId}}});
   await tx.session.deleteMany({where:{tenantId,userId}});
  });
 }
 throw new Error("Operación inválida");
}
