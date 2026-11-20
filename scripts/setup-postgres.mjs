import { Pool } from "pg";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";

if (existsSync(".env.local")) loadEnvFile(".env.local");
mkdirSync(".local", { recursive: true });
const databaseName = process.env.SETUP_DATABASE ?? "legajos_unp";
if (!/^[a-z][a-z0-9_]+$/.test(databaseName)) throw new Error("Nombre de base inválido.");
const test = databaseName.endsWith("_test");
const ownerName = test ? "legajo_test_owner" : "legajo_owner";
const appName = test ? "legajo_test_app" : "legajo_app";
let ownerUrl = test ? process.env.TEST_DATABASE_OWNER_URL : process.env.DATABASE_OWNER_URL;
let appUrl = test ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
const adminUrl = process.env.DATABASE_ADMIN_URL ?? "postgresql://postgres@localhost:5432/postgres";
const admin = new Pool({ connectionString: adminUrl, max: 1 });
try {
  const credentials = {};
  for (const [name, existing] of [[ownerName, ownerUrl], [appName, appUrl]]) {
    const password = existing ? decodeURIComponent(new URL(existing).password) : randomBytes(24).toString("base64url");
    const found = await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [name]);
    if (!found.rowCount) {
      await admin.query(`CREATE ROLE "${name}" LOGIN PASSWORD '${password.replaceAll("'", "''")}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
    } else if (!existing) throw new Error(`El rol ${name} ya existe y falta su URL guardada; no se cambió su contraseña.`);
    credentials[name] = `postgresql://${name}:${encodeURIComponent(password)}@localhost:5432/${databaseName}`;
  }
  const found = await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [databaseName]);
  if (!found.rowCount) await admin.query(`CREATE DATABASE "${databaseName}" OWNER "${ownerName}" ENCODING 'UTF8'`);
  ownerUrl = credentials[ownerName]; appUrl = credentials[appName];
  const envFile = resolve(".env.local");
  let envText = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
  const vars = test ? {TEST_DATABASE_URL: appUrl, TEST_DATABASE_OWNER_URL: ownerUrl} : {DATABASE_URL: appUrl, DATABASE_OWNER_URL: ownerUrl};
  for (const [key,value] of Object.entries(vars)) {
    const pattern = new RegExp(`^${key}=.*$`, "m");
    envText = pattern.test(envText) ? envText.replace(pattern, `${key}=${value}`) : envText.trimEnd()+`\n${key}=${value}\n`;
  }
  writeFileSync(envFile, envText.trimStart(), { mode: 0o600 });
  const owner = new Pool({ connectionString: ownerUrl, max: 1 });
  const client = await owner.connect();
  try {
    await client.query("CREATE TABLE IF NOT EXISTS migracion_esquema (nombre text PRIMARY KEY, sha256 text NOT NULL, aplicada_en timestamptz NOT NULL DEFAULT now())");
    for(const file of readdirSync("drizzle-pg").filter(name=>/^\d+_.+\.sql$/.test(name)).sort()){
      const name=file.slice(0,-4),sql=readFileSync(resolve("drizzle-pg",file),"utf8");
      const digest=createHash("sha256").update(sql).digest("hex");
      const prior=await client.query("SELECT sha256 FROM migracion_esquema WHERE nombre=$1",[name]);
      if(prior.rowCount&&prior.rows[0].sha256!==digest)throw new Error(`La migración aplicada ${name} cambió; crea otra migración.`);
      if(!prior.rowCount){
        await client.query("BEGIN");
        try{await client.query(sql);await client.query("INSERT INTO migracion_esquema(nombre,sha256) VALUES($1,$2)",[name,digest]);await client.query("COMMIT");}
        catch(error){await client.query("ROLLBACK");throw error;}
      }
    }
    await client.query(`GRANT USAGE ON SCHEMA public TO "${appName}"`);
    await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO "${appName}"`);
    await client.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO "${appName}"`);
    await client.query(`GRANT UPDATE ON SEQUENCE docente_codigo_seq TO "${appName}"`);
    await client.query(`REVOKE ALL ON migracion_esquema FROM "${appName}"`);
    console.log(`Base ${databaseName} preparada; esquema aplicado y usuario de aplicación sin privilegios de administración.`);
  } finally { client.release(); await owner.end(); }
} finally { await admin.end(); }
