import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {licenseActive} from "../domain/settings.mjs";
import {localDay} from "../domain/parse.mjs";
import {db} from "./db";
import {newToken,tokenHash,verifyPassword} from "./password.mjs";
const COOKIE="onlymarket_session";
const DUMMY="scrypt1:"+"0".repeat(32)+":"+"0".repeat(128);
export async function currentSession(){
  const token=(await cookies()).get(COOKIE)?.value;
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const session=await db.session.findUnique({where:{tokenHash:tokenHash(token)},include:{user:true,tenant:true}});
  if(!session||session.expiresAt<=new Date()||!session.user.active||!licenseActive(session.tenant,localDay()))return null;
  const member=await db.membership.findUnique({where:{tenantId_userId:{tenantId:session.tenantId,userId:session.userId}}});
  if(!member)return null;
  return {tenantId:session.tenantId,actorUserId:session.userId,role:member.role,tenantName:session.tenant.name,email:session.user.email,profile:session.tenant.profile,plan:session.tenant.plan};
}
export async function requireSession(){const s=await currentSession();if(!s)redirect("/login");return s;}
async function allowAttempt(key:string,limit:number){
  // Atomic PostgreSQL upsert: maximum 8 attempts per 15-minute identity window.
  const rows=await db.$queryRaw<{attempts:number}[]>`
    INSERT INTO "LoginLimit" ("key","attempts","windowStart") VALUES (${key},1,now())
    ON CONFLICT ("key") DO UPDATE SET
      "attempts"=CASE WHEN "LoginLimit"."windowStart"<now()-interval '15 minutes' THEN 1 ELSE LEAST("LoginLimit"."attempts"+1,${limit+1}) END,
      "windowStart"=CASE WHEN "LoginLimit"."windowStart"<now()-interval '15 minutes' THEN now() ELSE "LoginLimit"."windowStart" END
    RETURNING "attempts"`;
  return (rows[0]?.attempts??limit+1)<=limit;
}
export async function login(email:string,password:string,slug:string){
  email=email.trim().toLowerCase();slug=slug.trim().toLowerCase();
  if(email.length>254||slug.length>64||password.length>128||!email||!slug)return false;
  if(!await allowAttempt(tokenHash("commerce:global"),300)||!await allowAttempt(tokenHash("commerce:email:"+email),15)||!await allowAttempt(tokenHash(email+"\n"+slug),8))return false;
  const user=await db.user.findUnique({where:{email}});
  const valid=await verifyPassword(password,user?.passwordHash??DUMMY);
  if(!valid||!user?.active)return false;
  const tenant=await db.tenant.findUnique({where:{slug}});
  if(!tenant||!licenseActive(tenant,localDay())||!await db.membership.findUnique({where:{tenantId_userId:{tenantId:tenant.id,userId:user.id}}}))return false;
  const token=newToken(), jar=await cookies(), old=jar.get(COOKIE)?.value;
  const expiresAt=new Date(Date.now()+12*3600000);
  await db.$transaction(async tx=>{
    if(old&&/^[a-f0-9]{64}$/.test(old))await tx.session.deleteMany({where:{tokenHash:tokenHash(old)}});
    await tx.session.create({data:{tokenHash:tokenHash(token),tenantId:tenant.id,userId:user.id,expiresAt}});
  });
  jar.set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",expires:expiresAt});
  return true;
}
export async function logout(){
  const jar=await cookies(), token=jar.get(COOKIE)?.value;
  if(token&&/^[a-f0-9]{64}$/.test(token))await db.session.deleteMany({where:{tokenHash:tokenHash(token)}});
  jar.delete(COOKIE);
}
