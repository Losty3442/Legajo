import {spawn} from "node:child_process";
import {mkdir,copyFile,writeFile,stat} from "node:fs/promises";
import {join,resolve} from "node:path";
import {Pool} from "pg";
import {settings} from "../server/config";
import {PgStore} from "../server/store";
import {sha256,requireThat} from "../server/security";
import {createBackup} from "../src/application/backup";

const connection=new URL(settings.ownerUrl);
requireThat(connection.pathname==="/legajos_unp"||connection.pathname==="/legajos_unp_test","Solo se respaldan las bases del sistema.");
const destination=resolve(settings.dataDir,"backups",`postgres-${new Date().toISOString().replace(/[:.]/g,"-")}`);
const owner=new Pool({connectionString:settings.ownerUrl,max:1});const client=await owner.connect();
try{
  await mkdir(join(destination,"documents"),{recursive:true});
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const snapshot=(await client.query("SELECT pg_export_snapshot() AS id")).rows[0].id;
  const database=(await client.query("SELECT current_database() AS name")).rows[0].name;
  const pgDump=process.env.PG_DUMP??"C:/Program Files/PostgreSQL/18/bin/pg_dump.exe";
  const env={...process.env,PGHOST:connection.hostname,PGPORT:connection.port||"5432",PGDATABASE:connection.pathname.slice(1),PGUSER:decodeURIComponent(connection.username),PGPASSWORD:decodeURIComponent(connection.password)};
  await new Promise<void>((resolve,reject)=>{const child=spawn(pgDump,["--format=custom","--no-owner","--no-acl","--snapshot",snapshot,"--file",join(destination,"database.dump")],{env,windowsHide:true,stdio:["ignore","ignore","pipe"]});let error="";child.stderr.on("data",chunk=>{error+=chunk;});child.on("error",reject);child.on("close",code=>code===0?resolve():reject(new Error(`Falló pg_dump (${code}): ${error}`)));});
  const store=new PgStore(client,{role:"legajos",teacherId:"",userId:"backup"});const workspace=await store.read();requireThat(workspace,"Primero importa los datos del sistema.");
  const documents=[];const manifest=[];
  for(const row of (await client.query("SELECT * FROM documento ORDER BY id")).rows){
    const doc=await store.document(row.id);requireThat(doc,"Documento no disponible.");documents.push(doc);
    const hash=sha256(new Uint8Array(await doc.blob.arrayBuffer()));requireThat(hash===row.hash_sha256,"El archivo no supera la comprobación de integridad.");
    await copyFile(join(settings.dataDir,"documents",row.clave_almacenamiento),join(destination,"documents",row.clave_almacenamiento));
    manifest.push({id:row.id,key:row.clave_almacenamiento,sha256:hash,size:row.tamano_bytes,version:row.version});
  }
  await writeFile(join(destination,"legajo-backup.zip"),await createBackup(workspace,documents,`PostgreSQL · ${database}`),{mode:0o600});
  await writeFile(join(destination,"manifest.json"),JSON.stringify({format:"legajo-postgres-backup-v1",database,createdAt:new Date().toISOString(),revision:workspace.revision,documents:manifest,dumpBytes:(await stat(join(destination,"database.dump"))).size},null,2),{mode:0o600});
  await client.query("COMMIT");console.log(`Respaldo consistente y documentos verificados: ${destination}`);
}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();await owner.end();}
