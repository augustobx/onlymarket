import {randomBytes,scrypt as scryptCb,timingSafeEqual,createHash} from "node:crypto";
import {promisify} from "node:util";
const scrypt=promisify(scryptCb);
const params={N:32768,r:8,p:1,maxmem:64*1024*1024};
export async function hashPassword(password){
  if(typeof password!=="string"||password.length<12||password.length>128)throw new Error("Contraseña: 12 a 128 caracteres");
  const salt=randomBytes(16).toString("hex");
  const hash=await scrypt(password,salt,64,params);
  return "scrypt1:"+salt+":"+hash.toString("hex");
}
export async function verifyPassword(password,encoded){
  if(typeof password!=="string"||password.length>128||typeof encoded!=="string")return false;
  const match=/^scrypt1:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(encoded);
  if(!match)return false;
  const actual=await scrypt(password,match[1],64,params);
  return timingSafeEqual(actual,Buffer.from(match[2],"hex"));
}
export const tokenHash=value=>createHash("sha256").update(value).digest("hex");
export const newToken=()=>randomBytes(32).toString("hex");
