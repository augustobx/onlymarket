import {PrismaClient} from "@prisma/client";
import {hashPassword} from "../src/server/password.mjs";
const db=new PrismaClient();
try{
 const email=process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase(),slug=process.env.BOOTSTRAP_SLUG?.trim().toLowerCase(),name=process.env.BOOTSTRAP_NAME?.trim();
 if(!email||!email.includes("@")||!slug||!/^[a-z0-9-]{2,64}$/.test(slug)||!name)throw new Error("Configurar BOOTSTRAP_EMAIL, BOOTSTRAP_SLUG, BOOTSTRAP_NAME y BOOTSTRAP_PASSWORD");
 const passwordHash=await hashPassword(process.env.BOOTSTRAP_PASSWORD);
 await db.$transaction(async tx=>{
   if(await tx.tenant.findUnique({where:{slug}}))throw new Error("Comercio ya existe; no se sobrescribe");
   if(await tx.user.findUnique({where:{email}}))throw new Error("Usuario ya existe; no se modifican permisos");
   const tenant=await tx.tenant.create({data:{name,slug}});
   const user=await tx.user.create({data:{email,passwordHash}});
   await tx.membership.create({data:{tenantId:tenant.id,userId:user.id,role:"OWNER"}});
   await tx.branch.create({data:{tenantId:tenant.id,name:"Casa central"}});
 });
 console.log("Comercio y propietario creados:",slug);
}finally{await db.$disconnect();}
