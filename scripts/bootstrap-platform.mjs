import {PrismaClient} from "@prisma/client";
import {hashPassword} from "../src/server/password.mjs";
const db=new PrismaClient();
try{
 const email=process.env.PLATFORM_BOOTSTRAP_EMAIL?.trim().toLowerCase();
 if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Configurar PLATFORM_BOOTSTRAP_EMAIL y PLATFORM_BOOTSTRAP_PASSWORD");
 const passwordHash=await hashPassword(process.env.PLATFORM_BOOTSTRAP_PASSWORD);
 await db.platformAdmin.create({data:{email,passwordHash}});
 console.log("Administrador de plataforma creado; activar PLATFORM_ADMIN_ENABLED explícitamente.");
}finally{await db.$disconnect();}
