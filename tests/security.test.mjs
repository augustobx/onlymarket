import test from "node:test";
import assert from "node:assert/strict";
import {hashPassword,verifyPassword,newToken,tokenHash} from "../src/server/password.mjs";
import {decimal,dateInput,localDay} from "../src/domain/parse.mjs";
test("password hashing, salt and verification",async()=>{
 const a=await hashPassword("contraseña-segura-123"),b=await hashPassword("contraseña-segura-123");
 assert.notEqual(a,b);assert.equal(await verifyPassword("contraseña-segura-123",a),true);
 assert.equal(await verifyPassword("otra",a),false);assert.equal(await verifyPassword("otra","invalid"),false);
 await assert.rejects(hashPassword("short"));
});
test("session tokens are random and stored as digests",()=>{
 const a=newToken();assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,newToken());assert.notEqual(a,tokenHash(a));assert.equal(tokenHash(a),tokenHash(a));
});
test("exact input and local date",()=>{
 assert.equal(decimal("12,345",3,"peso"),12345n);assert.equal(decimal("123.45",2,"costo"),12345n);
 assert.throws(()=>decimal("1.001",2,"costo"));assert.throws(()=>decimal("-1",3,"peso"));assert.throws(()=>decimal("1e3",3,"peso"));
 assert.throws(()=>dateInput("2026-02-30"));assert.equal(localDay(new Date("2026-11-25T02:00:00Z")),"2026-11-24");
});
