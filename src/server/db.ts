import {PrismaClient} from "@prisma/client";
const globalDb=globalThis as unknown as {onlyMarketDb?:PrismaClient};
export const db=globalDb.onlyMarketDb??new PrismaClient();
if(process.env.NODE_ENV!=="production")globalDb.onlyMarketDb=db;
