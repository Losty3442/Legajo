import type { PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { approvedDemoRubric, vacancyCode, type Actor, type AuthUser, type DocumentFile, type Rubric, type Workspace } from "../src/domain/models";
import { unpCriteria } from "../src/domain/unp-rubric";
import type { Repositories } from "../src/application/ports";
import { LegajoService } from "../src/application/service";
import { FileStorage } from "./files";
import { insertAccount, roleIds, technicalIdentity } from "./accounts";
import { ApiError, newPassword, requireThat, sha256 } from "./security";

type Row=Record<string,unknown>;
const cats:Record<string,number>={Auxiliar:1,Asociado:2,Principal:3,B:4};
const dedications={"Tiempo completo":1,"Dedicación exclusiva":2,"Tiempo parcial":3,B1:4,B2:5};
const kinds:Record<string,number>={experiencia:1,titulo:2,maestria:3,doctorado:4,investigacion:5,ponencia:6,participacion:7,ratificacion:8,bachiller:9,capacitacion:10,diplomado:11,material_ensenanza:12,idioma:13,organizacion_evento:14,proyeccion_social:15};
const tables={teachers:"docente",merits:"merito",reviews:"revision_merito",experiences:"experiencia_laboral",rubrics:"rubrica",vacancies:"plaza",calls:"convocatoria",requests:"solicitud_promocion",evaluations:"evaluacion",proposals:"propuesta",audit:"auditoria_evento"} as const;
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const uid=(prefix:string,value:string)=>`${prefix}-${sha256(value).slice(0,24)}`;
export function normalizeWorkspace(input:Workspace):Workspace {
  const d=structuredClone(input); const rubrics=new Map<string,Rubric>();const versions=new Map<string,Rubric>();
  const rules=(r:Rubric)=>({name:r.name,profile:r.profile,threshold:r.threshold,degrees:r.degrees,experience:r.experience,research:r.research,talks:r.talks,attendance:r.attendance,requirements:r.requirements});
  for(const r of [...(d.rubrics??[]),d.rubric,...d.calls.map(c=>c.rubric),...d.evaluations.map(e=>e.rubric)]){
    const version=versions.get(r.version);
    if(!r.id)r.id=version?.id??uid("rub",r.version);
    r.estadoFuente??="simulacion";
    r.requirements??=structuredClone(approvedDemoRubric("2000-01-01T00:00:00.000Z").requirements);
    requireThat(!version||(version.id===r.id&&isDeepStrictEqual(rules(version),rules(r))),`La versión de rúbrica ${r.version} tiene copias incompatibles.`);
    versions.set(r.version,r);
    const prior=rubrics.get(r.id);if(!prior || (!prior.aprobadaEn&&r.aprobadaEn))rubrics.set(r.id,r);
  }
  d.rubrics=[...rubrics.values()];return d;
}
export class PgStore {
  files=new FileStorage();newCredentials:{email:string;password:string}[]=[];
  constructor(public client:PoolClient,public actor:Actor){ }
  async save(table:string,row:Row,keys=["id"],immutable=false){
    const entries=Object.entries(row).filter(([,v])=>v!==undefined);
    const names=entries.map(([k])=>`"${k}"`).join(",");
    const values=entries.map(([,v])=>v!==null&&typeof v==="object"?JSON.stringify(v):v);
    const updates=entries.filter(([k])=>!keys.includes(k));
    const action=immutable||!updates.length?"NOTHING":`UPDATE SET ${updates.map(([k])=>`"${k}"=EXCLUDED."${k}"`).join(",")} WHERE ${updates.map(([k])=>`"${table}"."${k}" IS DISTINCT FROM EXCLUDED."${k}"`).join(" OR ")}`;
    await this.client.query(`INSERT INTO "${table}" (${names}) VALUES (${entries.map((_,i)=>`$${i+1}`).join(",")}) ON CONFLICT (${keys.map(k=>`"${k}"`).join(",")}) DO ${action}`,values);
  }
  async read():Promise<Workspace|undefined>{
    const state=(await this.client.query("SELECT * FROM aplicacion_estado WHERE id=1")).rows[0];
    if(!state.inicializada)return undefined;
    const result:Record<string,unknown>={schemaVersion:2,revision:state.revision};
    const db=drizzle(this.client);
    for(const [collection,table]of Object.entries(tables)){
      const records=await db.execute(sql.raw(`SELECT datos FROM "${table}" ORDER BY ${table==="auditoria_evento"?"id DESC":"id"}`));
      result[collection]=records.rows.map(r=>r.datos);
    }
    const organizations = await this.client.query<{ faculty: string; department: string }>(`
      SELECT f.nombre AS faculty, d.nombre AS department
      FROM facultad f
      JOIN departamento_academico d ON d.facultad_id=f.id
      WHERE f.activo AND d.activo
      ORDER BY f.nombre, d.nombre
    `);
    if (organizations.rows.some(row => !row.faculty.endsWith(" · Demo"))) {
      const byFaculty = new Map<string, string[]>();
      for (const row of organizations.rows) {
        const departments = byFaculty.get(row.faculty) ?? [];
        departments.push(row.department);
        byFaculty.set(row.faculty, departments);
      }
      result.organizations = Object.fromEntries(byFaculty);
    }
    const rubrics=result.rubrics as Rubric[];
    result.rubric=rubrics.find(r=>r.id===state.rubrica_vigente_id);
    requireThat(result.rubric,"No se encuentra la rúbrica vigente.",500,"DATA_INTEGRITY");
    return result as unknown as Workspace;
  }
  async document(id:string):Promise<DocumentFile|undefined>{
    const row=(await this.client.query("SELECT * FROM documento WHERE id=$1",[id])).rows[0];if(!row)return;
    const bytes=await this.files.read(row.clave_almacenamiento,row.hash_sha256);
    return {id,name:row.nombre_original,type:row.tipo_mime,blob:new Blob([new Uint8Array(bytes)],{type:row.tipo_mime})};
  }
  async organization(faculty:string,department:string){
    const facultyRow = (await this.client.query<{ id: string }>("SELECT id FROM facultad WHERE nombre=$1", [faculty])).rows[0];
    const facultyId = facultyRow?.id ?? uid("fac", faculty);
    if (!facultyRow) await this.save("facultad",{id:facultyId,codigo:facultyId,nombre:faculty,activo:true},["id"],true);
    const departmentRow = (await this.client.query<{ id: string }>("SELECT id FROM departamento_academico WHERE facultad_id=$1 AND nombre=$2", [facultyId, department])).rows[0];
    if (departmentRow) return departmentRow.id;
    const departmentId=uid("dep",faculty+"/"+department);
    await this.save("departamento_academico",{id:departmentId,facultad_id:facultyId,nombre:department,activo:true},["id"],true);
    return departmentId;
  }
  async persist(input:Workspace,before:Workspace|undefined,files:DocumentFile[],importing=false){
    const d=normalizeWorkspace(input);Object.assign(input,d);
    const beforeIds=<T extends {id?:string}>(values:T[]|undefined)=>new Map((values??[]).map(x=>[x.id,x]));
    const changed=<T extends {id?:string}>(values:T[],old:T[]|undefined)=>{const map=beforeIds(old);return values.filter(x=>!equal(x,map.get(x.id)));};
    const at=new Date().toISOString();const actorId=this.actor.userId!;
    const oldTeachers=beforeIds(before?.teachers);
    const existingDossiers = await this.client.query<{ docente_id: string; id: string }>("SELECT docente_id, id FROM legajo");
    const dossierIds = new Map(existingDossiers.rows.map(row => [row.docente_id, row.id]));
    for(const t of changed(d.teachers,before?.teachers)){
      const department=await this.organization(t.faculty,t.department);
      let user=(await this.client.query("SELECT id FROM usuario WHERE datos->>'teacherId'=$1 AND activo=true LIMIT 1",[t.id])).rows[0]?.id;
      if(!user){
        const id=`docente-${t.id}`,password=newPassword();
        const account:AuthUser={id,userId:id,teacherId:t.id,name:t.name,email:t.email,role:"docente",category:t.category,avatarInitials:t.name.split(" ").slice(0,2).map(x=>x[0]).join("")};
        await insertAccount(this.client,account,password);this.newCredentials.push({email:t.email,password});user=id;
      }
      if(!oldTeachers.has(t.id)&&!importing)t.code="DOC-"+String((await this.client.query("SELECT nextval('docente_codigo_seq') AS n")).rows[0].n).padStart(3,"0");
      const nameFields=oldTeachers.get(t.id)?.name===t.name ? {} : {nombres:null,apellidos:null};
      await this.save("docente",{id:t.id,usuario_id:user,codigo:t.code,nombre_completo:t.name,...nameFields,email:t.email,departamento_id:department,categoria_id:t.category===null?null:cats[t.category],dedicacion_id:t.dedication===null?null:dedications[t.dedication],fecha_categoria:t.since,especialidad:t.specialty,activo:true,version:d.revision+1,creado_en:t.createdAt,actualizado_en:t.updatedAt,datos:t});
      if (oldTeachers.get(t.id)?.category!==t.category) {
        await this.client.query("UPDATE usuario SET datos=datos || jsonb_build_object('category',$2::text) WHERE id=$1 AND datos->>'role'='docente'",[user,t.category]);
      }
      if (!dossierIds.has(t.id)) {
        const dossierId = `legajo-${t.id}`;
        await this.save("legajo",{id:dossierId,docente_id:t.id,fecha_apertura:t.createdAt.slice(0,10),creado_en:t.createdAt},["id"],true);
        dossierIds.set(t.id,dossierId);
      }
    }
    const evidenceOwners=new Map<string,string>();const replacements=new Map<string,string>();
    const allMerits=[...d.merits,...d.evaluations.flatMap(e=>e.evidenceSnapshot),...d.reviews.flatMap(r=>[r.before,r.after])];
    for(const m of allMerits)evidenceOwners.set(m.fileId,m.teacherId);
    for(const r of d.reviews)if(r.before.fileId!==r.after.fileId)replacements.set(r.after.fileId,r.before.fileId);
    const pending=new Map(files.map(f=>[f.id,f]));
    for(let pass=0;pending.size;pass++){
      requireThat(pass<=files.length,"Hay un ciclo en las versiones documentales.");let count=0;
      for(const [id,file]of pending){
        const owner=evidenceOwners.get(id);requireThat(owner,`El archivo ${id} no tiene un legajo identificable.`);
        const prior=replacements.get(id);if(prior&&pending.has(prior))continue;
        const stored=await this.files.put(file);
        const version=prior?(await this.client.query("SELECT version FROM documento WHERE id=$1",[prior])).rows[0]?.version+1:1;
        const uploader=importing?await technicalIdentity(this.client,undefined):actorId;
        await this.save("documento",{id,legajo_id:dossierIds.get(owner),subido_por:uploader,nombre_original:file.name,tipo_mime:file.type,tamano_bytes:stored.size,hash_sha256:stored.hash,clave_almacenamiento:stored.key,version,reemplaza_a:prior??null,subido_en:at},["id"],true);
        pending.delete(id);count++;
      }requireThat(count>0,"No se pudo reconstruir la cadena de documentos.");
    }
    for(const m of changed(d.merits,before?.merits)){
      const last=d.reviews.find(r=>r.meritId===m.id&&r.after.status===m.status);
      const reviewer=m.status==="pendiente"?null:await technicalIdentity(this.client,last?.reviewer.id,m.reviewedBy??"legajos");
      await this.save("merito",{id:m.id,legajo_id:dossierIds.get(m.teacherId),tipo_merito_id:kinds[m.kind],titulo:m.title,institucion:m.institution,fecha_merito:m.date,documento_id:m.fileId,estado_revision:m.status,observacion:m.observation||null,revisado_por:reviewer,revisado_en:reviewer?m.updatedAt:null,version:d.revision+1,creado_en:m.createdAt,actualizado_en:m.updatedAt,datos:m});
    }
    for(const r of changed(d.reviews,before?.reviews)){
      const reviewer=await technicalIdentity(this.client,r.reviewer.id,r.reviewer.role);
      await this.save("revision_merito",{id:r.id,merito_id:r.meritId,revisor_id:reviewer,rol_id:roleIds[r.reviewer.role],accion:r.action,estado_anterior:r.before.status,estado_posterior:r.after.status,documento_anterior_id:r.before.fileId,documento_posterior_id:r.after.fileId,nota:r.note,copia_antes:r.before,copia_despues:r.after,ocurrido_en:r.at,datos:r},["id"],true);
    }
    for(const e of changed(d.experiences,before?.experiences)){
      const merit=d.merits.find(m=>m.id===e.evidenceId);requireThat(merit,"La experiencia no tiene mérito de respaldo.");
      await this.save("experiencia_laboral",{id:e.id,legajo_id:dossierIds.get(e.teacherId),institucion:e.institution,cargo:e.position,fecha_inicio:e.startsOn,fecha_fin:e.endsOn??null,documento_id:merit.fileId,actualizado_en:e.updatedAt,datos:e});
    }
    for(const r of changed(d.rubrics??[],before?.rubrics)){
      const existing=(await this.client.query("SELECT aprobada_en FROM rubrica WHERE id=$1",[r.id])).rows[0];
      if(existing?.aprobada_en)throw new ApiError(409,"RUBRIC_IMMUTABLE","La rúbrica aprobada no se puede modificar.");
      const by=importing?await technicalIdentity(this.client,r.aprobadaPor):actorId;
      await this.save("rubrica",{id:r.id,version:r.version,nombre:r.name,umbral:r.threshold,puntaje_maximo:100,estado_fuente:r.estadoFuente??"simulacion",fuente_normativa:r.fuenteNormativa??null,aprobada_en:null,creada_por:by,creada_en:r.createdAt??at,datos:r});
      const specs=r.profile === "unp-concurso-plazas-v1"
        ? unpCriteria.map(criterion => [criterion.code,criterion.label,null,0,criterion.cap] as const)
        : [['grado_maestria','Grado académico',3,r.degrees.maestria,r.degrees.maestria],['grado_doctorado','Grado académico',4,r.degrees.doctorado,r.degrees.doctorado],['antiguedad','Tiempo en categoría',null,r.experience.perYear,r.experience.max],['investigacion','Investigaciones',5,r.research.unit,r.research.max],['ponencia','Ponencias',6,r.talks.unit,r.talks.max],['participacion','Participaciones',7,r.attendance.unit,r.attendance.max]];
      for(const [code,name,kind,points,cap]of specs)await this.save("rubrica_criterio",{id:`${r.id}-${code}`,rubrica_id:r.id,codigo:code,nombre:name,tipo_merito_id:kind,puntos_por_unidad:points,tope:cap,fuente_referencia:r.fuenteNormativa||"Supuesto didáctico de simulación.",estado_fuente:r.estadoFuente??"simulacion"});
      for(const [category,rule]of Object.entries(r.requirements??{}))await this.save("rubrica_requisito",{id:`${r.id}-${category}`,rubrica_id:r.id,categoria_destino_id:cats[category],grado_minimo_id:kinds[rule.degree],anios_minimos:rule.years,investigaciones_minimas:rule.research,exige_ratificacion:rule.ratification,fuente_referencia:r.fuenteNormativa||"Supuesto didáctico de simulación."});
      if(r.aprobadaEn)await this.client.query("UPDATE rubrica SET aprobada_en=$2 WHERE id=$1",[r.id,r.aprobadaEn]);
    }
    for(const v of changed(d.vacancies,before?.vacancies))await this.save("plaza",{id:v.id,codigo:vacancyCode(v),etiqueta:v.label,departamento_id:await this.organization(v.faculty,v.department),categoria_id:cats[v.category],dedicacion_id:dedications[v.dedication],habilitada:v.available,datos:v});
    for(const c of changed(d.calls,before?.calls)){
      const existing=(await this.client.query("SELECT codigo FROM convocatoria WHERE id=$1",[c.id])).rows[0];
      const code=existing?.codigo??`CON-${String((await this.client.query("SELECT nextval('convocatoria_codigo_seq') AS n")).rows[0].n).padStart(6,"0")}`;
      await this.save("convocatoria",{id:c.id,codigo:code,nombre:c.name,fecha_inicio:c.startsOn,fecha_fin:c.endsOn,estado:c.status,rubrica_id:c.rubric.id,creada_por:actorId,version:d.revision+1,creada_en:c.createdAt,datos:c});
      for(const vacancy of c.vacancyIds)await this.save("convocatoria_plaza",{convocatoria_id:c.id,plaza_id:vacancy},["convocatoria_id","plaza_id"],true);
      await this.save("comision_evaluadora",{id:`comision-${c.id}`,convocatoria_id:c.id,nombre:"Comisión de demostración local",resolucion_designacion:"Simulación académica; sin designación institucional."},["id"],true);
      const members=(await this.client.query("SELECT u.id FROM usuario u JOIN asignacion_rol a ON a.usuario_id=u.id WHERE a.rol_id=3 AND u.activo")).rows;
      for(const member of members)await this.save("miembro_comision",{comision_id:`comision-${c.id}`,usuario_id:member.id,cargo:"miembro"},["comision_id","usuario_id"],true);
    }
    const changedRequests=changed(d.requests,before?.requests);
    for(const r of changedRequests){
      const exists=(await this.client.query("SELECT codigo FROM solicitud_promocion WHERE id=$1",[r.id])).rows[0];
      const evaluated=d.evaluations.some(e=>e.requestId===r.id);
      if(!exists){
        const n=(await this.client.query("SELECT nextval('solicitud_codigo_seq') AS n")).rows[0].n;
        const sourceCategory=d.evaluations.find(e=>e.requestId===r.id)?.teacherSnapshot.category??d.teachers.find(t=>t.id===r.teacherId)?.category??"";
        await this.save("solicitud_promocion",{id:r.id,codigo:`SOL-${String(n).padStart(6,"0")}`,docente_id:r.teacherId,convocatoria_id:r.callId,plaza_id:r.vacancyId,categoria_origen_id:cats[sourceCategory],categoria_destino_id:cats[r.target],estado:evaluated?"presentada":r.status,nota:r.note,presentada_en:r.submittedAt??null,version:d.revision+1,creada_en:r.createdAt,actualizada_en:r.updatedAt,datos:r},["id"],true);
      }
      const evidences=d.evaluations.find(e=>e.requestId===r.id)?.evidenceSnapshot??d.merits.filter(m=>m.teacherId===r.teacherId);
      for(const m of evidences)await this.save("expediente_item",{solicitud_id:r.id,merito_id:m.id,documento_id:m.fileId,incorporado_en:r.submittedAt??r.createdAt},["solicitud_id","merito_id"],true);
    }
    for(const e of changed(d.evaluations,before?.evaluations)){
      const evaluator=importing?await technicalIdentity(this.client,undefined,"comision"):actorId;
      const request=d.requests.find(r=>r.id===e.requestId)!;
      await this.save("evaluacion",{id:e.id,solicitud_id:e.requestId,rubrica_id:e.rubric.id,comision_id:`comision-${request.callId}`,evaluador_id:evaluator,puntaje_total:e.score,umbral_aplicado:e.rubric.threshold,plaza_disponible:e.vacancyMet,resultado:e.outcome,fundamento:e.note,clave_idempotencia:e.id,instantanea_docente:e.teacherSnapshot,instantanea_plaza:e.vacancySnapshot??null,instantanea_convocatoria:e.callSnapshot??d.calls.find(c=>c.id===request.callId),cerrada_en:e.createdAt,datos:e},["id"],true);
      const codes=[e.evidenceSnapshot.some(m=>m.kind==='doctorado')?'grado_doctorado':'grado_maestria','antiguedad','investigacion','ponencia','participacion'];
      for(const [i,line]of e.breakdown.entries())await this.save("evaluacion_criterio",{id:`${e.id}-criterio-${i}`,evaluacion_id:e.id,rubrica_criterio_id:`${e.rubric.id}-${line.code??codes[i]}`,etiqueta:line.label,puntaje:line.score,tope:line.cap,detalle:line.detail},["id"],true);
      for(const [i,line]of e.requirements.entries())await this.save("evaluacion_requisito",{id:`${e.id}-requisito-${i}`,evaluacion_id:e.id,etiqueta:line.label,cumple:line.met,detalle:line.detail},["id"],true);
      for(const m of e.evidenceSnapshot){const doc=(await this.client.query("SELECT hash_sha256 FROM documento WHERE id=$1",[m.fileId])).rows[0];requireThat(doc,"Falta un archivo de una evaluación.");await this.save("evaluacion_evidencia",{evaluacion_id:e.id,merito_id:m.id,documento_id:m.fileId,hash_sha256:doc.hash_sha256,estado_revision:m.status},["evaluacion_id","merito_id"],true);}
    }
    const previousProposals=beforeIds(before?.proposals);
    for(const p of changed(d.proposals,before?.proposals)){
      const by=importing?await technicalIdentity(this.client,p.events[0]?.actor.id,"decanato"):actorId;
      await this.save("propuesta",{id:p.id,solicitud_id:p.requestId,evaluacion_id:p.evaluationId,convocatoria_id:p.callId,plaza_id:p.vacancyId,estado:p.status,informe:p.report,creada_por:by,version:d.revision+1,creada_en:p.createdAt,actualizada_en:p.updatedAt,datos:p});
      if(!previousProposals.has(p.id))for(const row of p.rankingSnapshot)await this.save("propuesta_orden_merito",{propuesta_id:p.id,solicitud_id:row.requestId,evaluacion_id:row.evaluationId,docente_id:row.teacherId,nombre_docente:row.name,puntaje:row.score,resultado:row.outcome,puesto:row.position,empate:row.tied},["propuesta_id","solicitud_id"],true);
      const oldLength=previousProposals.get(p.id)?.events.length??0;
      for(const [i,event]of p.events.entries())if(i>=oldLength)await this.save("propuesta_evento",{id:`${p.id}-evento-${i}`,propuesta_id:p.id,etapa:event.stage,usuario_id:await technicalIdentity(this.client,event.actor.id,event.actor.role),rol_id:roleIds[event.actor.role],referencia:event.reference||"Creación de propuesta",nota:event.note,ocurrido_en:event.at},["id"],true);
    }
    for(const r of changedRequests){
      await this.client.query("UPDATE solicitud_promocion SET convocatoria_id=$2,plaza_id=$3,estado=$4,nota=$5,presentada_en=$6,version=$7,actualizada_en=$8,datos=$9 WHERE id=$1",[r.id,r.callId,r.vacancyId,r.status,r.note,r.submittedAt??null,d.revision+1,r.updatedAt,JSON.stringify(r)]);
      const prior=before?.requests.find(x=>x.id===r.id);
      if(!prior||prior.status!==r.status)await this.client.query("INSERT INTO solicitud_historial_estado(solicitud_id,estado_anterior,estado_nuevo,usuario_id,motivo,cambiado_en) VALUES($1,$2,$3,$4,$5,$6)",[r.id,prior?.status??null,r.status,actorId,importing?"Estado importado; no reconstruye transiciones históricas.":r.note||"Cambio registrado por el sistema.",r.updatedAt]);
      if(r.status==="observada"&&prior?.status!=="observada")await this.save("observacion_solicitud",{id:uid("obs",r.id+r.updatedAt),solicitud_id:r.id,autor_id:actorId,texto:r.note,creada_en:r.updatedAt},["id"],true);
      if(prior?.status==="observada"&&r.status==="presentada")await this.client.query("UPDATE observacion_solicitud SET subsanada_en=$2 WHERE solicitud_id=$1 AND subsanada_en IS NULL",[r.id,r.updatedAt]);
    }
    for(const a of changed(d.audit,before?.audit).reverse()){
      const who=await technicalIdentity(this.client,a.actorId,a.actor);
      const result=await this.client.query("INSERT INTO auditoria_evento(origen_id,ocurrido_en,usuario_id,rol_id,docente_id,accion,entidad,mensaje,datos) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",[a.id,a.at,who,roleIds[a.actor],a.teacherId??null,importing?"importacion":"operacion","workspace",a.message,JSON.stringify(a)]);
      for(const change of a.changes??[])await this.client.query("INSERT INTO auditoria_cambio(auditoria_id,entidad,registro_id,antes,despues) VALUES($1,$2,$3,$4,$5)",[result.rows[0].id,change.collection,change.recordId,change.before===undefined?null:JSON.stringify(change.before),change.after===undefined?null:JSON.stringify(change.after)]);
    }
    await this.client.query("UPDATE aplicacion_estado SET revision=$1,rubrica_vigente_id=$2,inicializada=true WHERE id=1",[d.revision,d.rubric.id]);
    if(importing)await this.client.query("SELECT setval('docente_codigo_seq', GREATEST(1,COALESCE((SELECT max((regexp_match(codigo,'[0-9]+$'))[1]::bigint) FROM docente),0)),true)");
    Object.assign(input,d);
  }
  async service(before:Workspace){
    let current=structuredClone(before);
    const repos:Repositories={
      workspace:{read:async()=>structuredClone(current),commit:async(next,expected,files=[])=>{requireThat(expected===current.revision,"Los datos cambiaron; actualiza la vista.",409,"REVISION_CONFLICT");await this.persist(next,current,files);current=structuredClone(next);}},
      documents:{get:id=>this.document(id)},
      teachers:{list:async()=>current.teachers},dossiers:{list:async()=>current.merits},requests:{list:async()=>current.requests},evaluations:{list:async()=>current.evaluations},
    };
    return new LegajoService(repos,()=>{throw new Error("No se inicializan ejemplos sobre PostgreSQL.");});
  }
}
