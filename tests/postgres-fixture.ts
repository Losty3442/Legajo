import {readdir,readFile} from "node:fs/promises";
import {Pool} from "pg";
import {bootstrapAccounts} from "../server/accounts";
import {importBackup} from "../server/migration";
import {pool} from "../server/db";
import {seed} from "../src/infrastructure/seed";
import {createBackup} from "../src/application/backup";
import type {APIRequestContext} from "@playwright/test";
import type {Role} from "../src/domain/models";
import {test as base} from "@playwright/test";
export const test=base.extend<{}, {databaseLifecycle:void}>({databaseLifecycle:[async({},use)=>{await use();await pool.end();},{scope:"worker",auto:true}]});

export const testOrigin="http://localhost:5183";
export async function resetTestDatabase(importData=true){
  const owner=new Pool({connectionString:process.env.TEST_DATABASE_OWNER_URL,max:1});
  try{const check=await owner.query("SELECT current_database() AS name");if(check.rows[0].name!=="legajos_unp_test")throw new Error("Las pruebas destructivas solo admiten legajos_unp_test.");
    await owner.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    const migrations=(await readdir("drizzle-pg")).filter(name=>/^\d+_.+\.sql$/.test(name)).sort();
    for (const migration of migrations) await owner.query(await readFile("drizzle-pg/"+migration,"utf8"));
    await owner.query("GRANT USAGE ON SCHEMA public TO legajo_test_app; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO legajo_test_app; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO legajo_test_app; GRANT UPDATE ON SEQUENCE docente_codigo_seq TO legajo_test_app");
  }finally{await owner.end();}
  const client=await pool.connect();
  try{await bootstrapAccounts(client,".local/test-accounts");if(importData){const s=seed();const bytes=await createBackup(s.data,s.documents,"fixture de pruebas");await importBackup(client,{role:"legajos",teacherId:"t1",userId:"legajos-ana"},bytes);}}
  finally{client.release();}
}
export async function credential(role:Role,teacherId?:string){const all=JSON.parse(await readFile(".local/test-accounts/credenciales-cuentas.json","utf8"));if(teacherId){const row=(await pool.query("SELECT email FROM usuario WHERE datos->>'teacherId'=$1 AND activo",[teacherId])).rows[0];return all.find((a:{email:string})=>a.email===row.email);}return all.find((a:{rol:Role})=>a.rol===role);}
export async function login(request:APIRequestContext,role:Role,teacherId?:string){const c=await credential(role,teacherId);const response=await request.post("/api/v1/auth/login",{headers:{Origin:testOrigin},data:{email:c.email,password:c.password}});if(!response.ok())throw new Error(await response.text());return c;}
export async function revision(request:APIRequestContext){const response=await request.get("/api/v1/workspace");if(!response.ok())throw new Error(await response.text());return (await response.json()).revision as number;}
export async function mutation(request:APIRequestContext,path:string,data:unknown={},method="post",key?:string){const headers:Record<string,string>={Origin:testOrigin,"If-Match":String(await revision(request))};if(key)headers["Idempotency-Key"]=key;return request.fetch("/api/v1"+path,{method,headers,data});}
