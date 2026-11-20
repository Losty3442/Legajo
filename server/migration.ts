import { randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { Unzip, UnzipInflate } from "fflate";
import { z } from "zod";
import type { PoolClient } from "pg";
import type { Actor, DocumentFile, Workspace } from "../src/domain/models";
import type { BackupManifest } from "../src/application/backup";
import { migrateWorkspace } from "../src/application/migrations";
import { settings } from "./config";
import { PgStore, normalizeWorkspace } from "./store";
import { requireThat, sha256 } from "./security";
import { validateDocument } from "./files";

const record=z.object({id:z.string().min(1).max(200)}).passthrough();
const workspaceShape=z.object({schemaVersion:z.union([z.literal(1),z.literal(2)]),revision:z.number().int().nonnegative(),teachers:z.array(record),merits:z.array(record),requests:z.array(record),evaluations:z.array(record),vacancies:z.array(record),audit:z.array(record),rubric:z.object({version:z.string(),name:z.string(),threshold:z.number(),degrees:z.object({maestria:z.number(),doctorado:z.number()}),experience:z.object({perYear:z.number(),max:z.number()}),research:z.object({unit:z.number(),max:z.number()}),talks:z.object({unit:z.number(),max:z.number()}),attendance:z.object({unit:z.number(),max:z.number()})}).passthrough()}).passthrough();
function unpack(bytes:Uint8Array){
  const output:Record<string,Uint8Array>={};let total=0;let failure:Error|undefined;
  const unzip=new Unzip(file=>{
    if(failure)return;
    if(!/^(workspace\.json|manifest\.json|documents\/[a-zA-Z0-9_-]+\.bin)$/.test(file.name)){failure=new Error("El respaldo contiene una ruta no permitida.");return;}
    if(output[file.name]){failure=new Error("Hay archivos duplicados en el respaldo.");return;}
    let size=0;const chunks:Uint8Array[]=[];
    file.ondata=(error,chunk,final)=>{
      if(error){failure=error;return;}size+=chunk.length;total+=chunk.length;
      const limit=file.name==="workspace.json"?16*1024*1024:10*1024*1024;
      if(size>limit||total>512*1024*1024){failure=new Error("El respaldo supera los límites permitidos.");file.terminate();return;}
      chunks.push(chunk);
      if(final){const result=new Uint8Array(size);let offset=0;for(const part of chunks){result.set(part,offset);offset+=part.length;}output[file.name]=result;}
    };file.start();
  });unzip.register(UnzipInflate);unzip.push(bytes,true);if(failure)throw failure;return output;
}
export function decodeBackup(bytes:Uint8Array){
  let entries:Record<string,Uint8Array>;
  try{entries=unpack(bytes);}catch(error){throw new Error(`Respaldo inválido: ${(error as Error).message}`);}
  requireThat(entries["workspace.json"]&&entries["manifest.json"],"Faltan workspace.json o manifest.json.");
  const manifest=JSON.parse(Buffer.from(entries["manifest.json"]).toString()) as BackupManifest;
  requireThat(manifest.format==="legajo-backup-v1"&&Array.isArray(manifest.documents),"Formato de respaldo desconocido.");
  const original=JSON.parse(Buffer.from(entries["workspace.json"]).toString());
  workspaceShape.parse(original);
  const source=original as Workspace;
  const migrated=migrateWorkspace(source,new Date().toISOString());
  for(const name of ["calls","reviews","experiences","proposals"] as const)requireThat(Array.isArray(migrated[name]),`Falta la colección ${name} en el respaldo.`);
  if(source.schemaVersion===1){for(const r of [migrated.rubric,...(migrated.rubrics??[])]){if(!source.rubric.aprobadaEn||r.version!==source.rubric.version){delete r.aprobadaEn;delete r.aprobadaPor;}}}
  const data=normalizeWorkspace(migrated);
  data.calls??=[];data.reviews??=[];data.experiences??=[];data.proposals??=[];
  const warnings:string[]=[];
  if(!data.rubric.aprobadaEn)warnings.push("La rúbrica heredada no tiene aprobación registrada. Puede aprobarse como simulación desde Rúbricas y requisitos.");
  for(const [name,collection]of Object.entries(data))if(Array.isArray(collection)&&name!=="rubrics"){
    const ids=collection.map(r=>r.id);requireThat(ids.every(id=>typeof id==="string")&&new Set(ids).size===ids.length,`Identificadores inválidos o repetidos en ${name}.`);
  }
  const teachers=new Set(data.teachers.map(t=>t.id)),merits=new Set(data.merits.map(m=>m.id)),calls=new Set(data.calls.map(c=>c.id)),vacancies=new Set(data.vacancies.map(v=>v.id));
  const documents:DocumentFile[]=[];const fileIds=new Set<string>();
  for(const info of manifest.documents){
    requireThat(typeof info.id==="string"&&!fileIds.has(info.id),"Documento repetido o sin identificador.");fileIds.add(info.id);
    const file=entries[info.path];requireThat(file,`Falta el archivo ${info.id}.`);
    requireThat(file.length===info.size&&sha256(file)===info.sha256,`El archivo ${info.id} no coincide con su huella.`);
    validateDocument(file,info.type);documents.push({id:info.id,name:info.name,type:info.type,blob:new Blob([new Uint8Array(file)],{type:info.type})});
  }
  const declaredPaths=new Set(manifest.documents.map(info=>info.path));requireThat(Object.keys(entries).every(path=>!path.startsWith("documents/")||declaredPaths.has(path)),"El ZIP contiene documentos ausentes en su manifiesto.");
  for(const t of data.teachers){requireThat(typeof t.name==="string"&&typeof t.email==="string"&&typeof t.faculty==="string"&&typeof t.department==="string","Ficha docente incompleta.");}
  for(const m of [...data.merits,...data.evaluations.flatMap(e=>e.evidenceSnapshot),...data.reviews.flatMap(r=>[r.before,r.after])])requireThat(teachers.has(m.teacherId)&&fileIds.has(m.fileId),`El mérito ${m.id} tiene un docente o documento inexistente.`);
  for(const r of data.requests){requireThat(teachers.has(r.teacherId)&&calls.has(r.callId)&&vacancies.has(r.vacancyId),`La solicitud ${r.id} tiene referencias inexistentes.`);const call=data.calls.find(c=>c.id===r.callId)!;requireThat(call.vacancyIds.includes(r.vacancyId),`La plaza de la solicitud ${r.id} no pertenece a su convocatoria.`);}
  for(const e of data.experiences)requireThat(teachers.has(e.teacherId)&&data.merits.some(m=>m.id===e.evidenceId&&m.teacherId===e.teacherId),`La experiencia ${e.id} no tiene respaldo propio.`);
  for(const e of data.evaluations){requireThat(data.requests.some(r=>r.id===e.requestId&&r.teacherId===e.teacherId),`La evaluación ${e.id} no corresponde a su solicitud.`);requireThat(e.evidenceSnapshot.every(m=>merits.has(m.id)&&m.teacherId===e.teacherId),`La evaluación ${e.id} contiene evidencia ajena o inexistente.`);}
  for(const r of data.reviews)requireThat(data.merits.some(m=>m.id===r.meritId&&m.teacherId===r.teacherId)&&[r.before,r.after].every(m=>m.id===r.meritId&&m.teacherId===r.teacherId),`La revisión ${r.id} tiene referencias incompatibles.`);
  for(const p of data.proposals)requireThat(data.requests.some(r=>r.id===p.requestId&&r.teacherId===p.teacherId)&&data.evaluations.some(e=>e.id===p.evaluationId&&e.requestId===p.requestId),`La propuesta ${p.id} tiene referencias incompatibles.`);
  const fileOwners=new Map<string,string>();for(const m of [...data.merits,...data.evaluations.flatMap(e=>e.evidenceSnapshot),...data.reviews.flatMap(r=>[r.before,r.after])]){requireThat(!fileOwners.has(m.fileId)||fileOwners.get(m.fileId)===m.teacherId,`El documento ${m.fileId} aparece vinculado a dos docentes.`);fileOwners.set(m.fileId,m.teacherId);}
  const used=new Set([...data.merits,...data.evaluations.flatMap(e=>e.evidenceSnapshot),...data.reviews.flatMap(r=>[r.before,r.after])].map(m=>m.fileId));
  requireThat(documents.every(doc=>used.has(doc.id)),"Hay documentos sin propietario identificable; se conservan en el respaldo, pero requieren revisión antes de importar.");
  const fingerprint=sha256(JSON.stringify(original)+JSON.stringify([...manifest.documents].sort((a,b)=>a.id.localeCompare(b.id)).map(({id,sha256:hash,size})=>({id,hash,size}))));
  const report={huella:fingerprint,origen:manifest.origin,docentes:data.teachers.length,meritos:data.merits.length,solicitudes:data.requests.length,evaluaciones:data.evaluations.length,documentos:documents.length,bytes:manifest.documents.reduce((sum,doc)=>sum+doc.size,0),advertencias:warnings};
  return {data,documents,report,fingerprint,original};
}
export async function verifyImported(store:PgStore,expected:Workspace,documents:DocumentFile[]){
  const actual=await store.read();requireThat(actual,"No se pudo leer la importación.",500,"IMPORT_INTEGRITY");
  for(const name of ["teachers","merits","requests","evaluations","calls","reviews","experiences","vacancies","proposals","audit","rubrics"] as const){
    const rows=actual[name]??[],source=expected[name]??[];
    requireThat(rows.length===source.length&&source.every(r=>isDeepStrictEqual(r,rows.find(a=>a.id===r.id))),`No coincide la colección importada: ${name}.`,500,"IMPORT_INTEGRITY");
  }
  for(const document of documents){const stored=await store.document(document.id);requireThat(stored&&stored.name===document.name&&stored.type===document.type&&sha256(new Uint8Array(await stored.blob.arrayBuffer()))===sha256(new Uint8Array(await document.blob.arrayBuffer())),`No coincide el documento importado: ${document.id}.`,500,"IMPORT_INTEGRITY");}
}
export async function importBackup(client:PoolClient,actor:Actor,bytes:Uint8Array){
  const parsed=decodeBackup(bytes);const store=new PgStore(client,actor);
  await client.query("BEGIN");
  try{
    const state=(await client.query("SELECT * FROM aplicacion_estado WHERE id=1 FOR UPDATE")).rows[0];
    const previous=(await client.query("SELECT informe FROM migracion_lote WHERE huella=$1",[parsed.fingerprint])).rows[0];
    if(previous){await client.query("COMMIT");return {...previous.informe,repetida:true};}
    requireThat(!state.inicializada,"La base ya contiene datos. No se sobrescriben con otra copia.",409,"IMPORT_CONFLICT");
    const dir=join(settings.dataDir,"backups");await mkdir(dir,{recursive:true});
    await writeFile(join(dir,`${parsed.fingerprint}.zip`),bytes,{mode:0o600});
    await store.persist(parsed.data,undefined,parsed.documents,true);
    const counts=(await client.query("SELECT (SELECT count(*) FROM docente)::int AS docentes,(SELECT count(*) FROM merito)::int AS meritos,(SELECT count(*) FROM documento)::int AS documentos,(SELECT count(*) FROM solicitud_promocion)::int AS solicitudes")).rows[0];
    for(const key of ["docentes","meritos","documentos","solicitudes"] as const)requireThat(counts[key]===parsed.report[key],"No coinciden los conteos de la importación.",500,"IMPORT_INTEGRITY");
    await verifyImported(store,parsed.data,parsed.documents);
    await client.query("INSERT INTO migracion_lote(id,huella,usuario_id,informe) VALUES($1,$2,$3,$4)",[randomUUID(),parsed.fingerprint,actor.userId,JSON.stringify({...parsed.report,comprobada:true})]);
    await client.query("COMMIT");return {...parsed.report,comprobada:true,repetida:false};
  }catch(error){await client.query("ROLLBACK");await store.files.rollback();throw error;}
}
export async function importBackupFile(client:PoolClient,actor:Actor,path:string){return importBackup(client,actor,new Uint8Array(await readFile(path)));}
