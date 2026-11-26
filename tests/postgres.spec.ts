import {expect} from "@playwright/test";
import {randomUUID} from "node:crypto";
import {pool} from "../server/db";
import {seed,demoPdf} from "../src/infrastructure/seed";
import {createBackup} from "../src/application/backup";
import {decodeBackup,importBackup} from "../server/migration";
import {test,resetTestDatabase,login,mutation,revision,testOrigin} from "./postgres-fixture";
import {unpManualCriteria, unpSimulationRubric} from "../src/domain/unp-rubric";

test.beforeEach(async()=>resetTestDatabase());
test("autenticación real, sesión, permisos y aislamiento del docente",async({request})=>{
  for(const path of ["/.local/credenciales-cuentas.json","/.env.local","/data/documents/example","/@fs/C:/project/.local/credenciales-cuentas.json"])expect((await request.get(path)).status()).toBe(404);
  expect((await request.get("/api/v1/workspace")).status()).toBe(401);
  expect((await request.post("/api/v1/auth/login",{headers:{Origin:testOrigin},data:{email:"asalas@unp.edu.pe",password:"incorrecta"}})).status()).toBe(401);
  await login(request,"docente","t1");const d=await(await request.get("/api/v1/workspace")).json();expect(d.teachers.map((t:{id:string})=>t.id)).toEqual(["t1"]);
  const forged=await mutation(request,"/teachers",{name:"Docente falsificado",email:"otro@example.test",actor:{role:"legajos"}});expect(forged.status()).toBe(403);
  expect((await request.get("/api/v1/files/file-m4")).status()).toBe(403);
  await request.post("/api/v1/auth/logout",{headers:{Origin:testOrigin}});expect((await request.get("/api/v1/workspace")).status()).toBe(401);
  await login(request,"legajos");
  await pool.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename=current_user AND application_name='legajo-unp-api' AND pid<>pg_backend_pid() AND state='idle'");
  await expect.poll(async()=>(await request.get("/api/v1/workspace")).status()).toBe(200);
});
test("actualiza solo las filas afectadas y rechaza una revisión antigua",async({request})=>{
  await login(request,"legajos");const d=await(await request.get("/api/v1/workspace")).json(),t=d.teachers.find((t:{id:string})=>t.id==="t1");
  const r=await request.patch("/api/v1/teachers/t1",{headers:{Origin:testOrigin,"If-Match":String(d.revision)},data:{...t,specialty:"Especialidad actualizada"}});expect(r.ok(),await r.text()).toBeTruthy();
  expect((await request.patch("/api/v1/teachers/t1",{headers:{Origin:testOrigin,"If-Match":String(d.revision)},data:t})).status()).toBe(409);
  expect((await pool.query("SELECT count(*)::int AS n FROM auditoria_evento")).rows[0].n).toBe(d.audit.length+1);
  expect((await pool.query("SELECT datos->>'specialty' AS name FROM docente WHERE id='t2'")).rows[0].name).toBe(d.teachers.find((t:{id:string})=>t.id==="t2").specialty);
});
test("alta docente crea una cuenta diferente y permite acceder a ella",async({request})=>{
  await login(request,"legajos");const r=await mutation(request,"/teachers",{name:"Docente Nuevo Integración",email:"nuevo-integracion@example.test",faculty:"Ingeniería · Demo",department:"Informática · Demo",specialty:"Bases de datos",category:"Auxiliar",dedication:"Tiempo completo",since:"2020-01-01"});expect(r.ok(),await r.text()).toBeTruthy();const result=await r.json();expect(result.accounts).toHaveLength(1);
  const response=await request.post("/api/v1/auth/login",{headers:{Origin:testOrigin},data:result.accounts[0]});expect(response.ok()).toBeTruthy();const d=await(await request.get("/api/v1/workspace")).json();expect(d.teachers).toHaveLength(1);expect(d.teachers[0].id).toBe(result.result);
});
test("dos guardados concurrentes y salto de categoría rechazado",async({request})=>{
  await login(request,"legajos");const d=await(await request.get("/api/v1/workspace")).json();const teacher=d.teachers.find((t:{id:string})=>t.id==="t1");
  const responses=await Promise.all(["Especialidad concurrente A","Especialidad concurrente B"].map(specialty=>request.patch("/api/v1/teachers/t1",{headers:{Origin:testOrigin,"If-Match":String(d.revision)},data:{...teacher,specialty}})));
  expect(responses.map(r=>r.status()).sort()).toEqual([200,409]);
  await expect(pool.query("UPDATE solicitud_promocion SET categoria_destino_id=3 WHERE id='s1'")).rejects.toMatchObject({code:"23514"});
});
test("documentos privados, corrección, verificación e historial inmutable",async({request})=>{
  await login(request,"legajos");const original=await request.get("/api/v1/files/file-m16");expect(original.ok()).toBeTruthy();const bytes=await original.body();
  expect((await mutation(request,"/merits/m16/reviews",{status:"observado",note:"El documento necesita una corrección legible."})).ok()).toBeTruthy();
  await login(request,"docente","t1");const d=await(await request.get("/api/v1/workspace")).json();const m=d.merits.find((m:{id:string})=>m.id==="m16");
  const invalid=await request.patch("/api/v1/merits/m16",{headers:{Origin:testOrigin,"If-Match":String(d.revision)},multipart:{payload:JSON.stringify(m),file:{name:"falso.pdf",mimeType:"application/pdf",buffer:Buffer.from("no es pdf")}}});expect(invalid.status()).toBe(422);
  const updated=await request.patch("/api/v1/merits/m16",{headers:{Origin:testOrigin,"If-Match":String(d.revision)},multipart:{payload:JSON.stringify({...m,title:"Ponencia corregida de integración"}),file:{name:"corregido.pdf",mimeType:"application/pdf",buffer:Buffer.from(await demoPdf("Corregido").arrayBuffer())}}});expect(updated.ok(),await updated.text()).toBeTruthy();
  await login(request,"legajos");expect((await mutation(request,"/merits/m16/reviews",{status:"verificado",note:"Documento revisado y legible."})).ok()).toBeTruthy();
  const historical=await request.get("/api/v1/files/file-m16");expect(await historical.body()).toEqual(bytes);
  await expect(pool.query("DELETE FROM revision_merito WHERE merito_id='m16'")).rejects.toMatchObject({code:"23514"});
});
test("evaluación y propuesta completas, reintentos y decisión terminal",async({request})=>{
  await login(request,"comision");const key=randomUUID();const rev=await revision(request);
  const first=await request.post("/api/v1/applications/s2/evaluations",{headers:{Origin:testOrigin,"If-Match":String(rev),"Idempotency-Key":key},data:{note:"Cumple los requisitos de la convocatoria de simulación."}});expect(first.ok(),await first.text()).toBeTruthy();const evaluation=await first.json();
  const retry=await request.post("/api/v1/applications/s2/evaluations",{headers:{Origin:testOrigin,"If-Match":String(rev),"Idempotency-Key":key},data:{note:"Cumple los requisitos de la convocatoria de simulación."}});expect((await retry.json()).result).toBe(evaluation.result);
  expect((await pool.query("SELECT count(*)::int AS n FROM evaluacion")).rows[0].n).toBe(1);
  await expect(pool.query("UPDATE evaluacion SET fundamento='alterado'")).rejects.toMatchObject({code:"23514"});
  await login(request,"legajos");expect((await mutation(request,"/calls/c2026/phase")).ok()).toBeTruthy();
  await login(request,"decanato");const proposal=await mutation(request,"/proposals",{requestId:"s2",report:"Se propone al docente del primer puesto de esta plaza."},"post",randomUUID());expect(proposal.ok(),await proposal.text()).toBeTruthy();const d=await(await request.get("/api/v1/workspace")).json();const id=d.proposals[0].id;
  expect((await mutation(request,`/proposals/${id}/referrals`,{reference:"OF-TEST-1",note:"Se remite la propuesta a la facultad."})).ok()).toBeTruthy();
  await login(request,"consejo_facultad");expect((await mutation(request,`/proposals/${id}/escalations`,{reference:"AC-TEST-1",note:"Se eleva la propuesta al Consejo Universitario."})).ok()).toBeTruthy();
  await login(request,"consejo_universitario");expect((await mutation(request,`/proposals/${id}/decisions`,{action:"aprobar",reference:"RES-TEST-1",note:"Se registra la decisión de simulación."})).ok()).toBeTruthy();
  const final=await(await request.get("/api/v1/workspace")).json();expect(final.proposals[0].status).toBe("aprobada");expect(final.requests.find((r:{id:string})=>r.id==="s2").status).toBe("aprobada");
  expect((await mutation(request,`/proposals/${id}/decisions`,{action:"denegar",reference:"RES-TEST-2",note:"Cambio posterior no permitido."})).status()).toBe(403);
});
test("rúbrica aprobada y detalles bloqueados en PostgreSQL",async({request})=>{
  await login(request,"legajos");const d=await(await request.get("/api/v1/workspace")).json();
  await expect(pool.query("UPDATE rubrica SET nombre='Otro nombre' WHERE id=$1",[d.rubric.id])).rejects.toMatchObject({code:"23514"});
  await expect(pool.query("INSERT INTO rubrica_criterio(id,rubrica_id,codigo,nombre,puntos_por_unidad,tope,fuente_referencia,estado_fuente) VALUES('mal',$1,'mal','mal',1,1,'x','simulacion')",[d.rubric.id])).rejects.toMatchObject({code:"23514"});
  const fresh={...d.rubric,version:"TEST-EDITABLE",name:"Nueva rúbrica de integración",estadoFuente:"simulacion"};const created=await mutation(request,"/rubrics",fresh);expect(created.ok(),await created.text()).toBeTruthy();const id=(await created.json()).result;expect((await mutation(request,`/rubrics/${id}/approvals`)).ok()).toBeTruthy();
});
test("tabla UNP conserva los nueve rubros y exige sustento verificado",async({request})=>{
  await resetTestDatabase(false);
  const fixture=seed();
  const approvedAt=fixture.data.rubric.aprobadaEn;
  const rubric={...unpSimulationRubric(fixture.data.rubric.requirements!),aprobadaEn:approvedAt,aprobadaPor:"legajos-ana"};
  fixture.data.rubric=rubric;
  fixture.data.rubrics=[rubric];
  fixture.data.calls[0].rubric=rubric;
  const client=await pool.connect();
  try {
    await importBackup(client,{role:"legajos",teacherId:"t1",userId:"legajos-ana"},await createBackup(fixture.data,fixture.documents,"Rúbrica UNP de prueba"));
  } finally { client.release(); }
  await login(request,"comision");
  const preview=await (await request.get("/api/v1/applications/s2/evaluation-preview")).json();
  expect(preview.score).toBe(23);
  expect(preview.breakdown).toHaveLength(9);

  const scores=Object.fromEntries(unpManualCriteria.map(criterion=>[criterion.code,{
    score: criterion.kinds ? 0 : criterion.cap,
    detail: criterion.kinds ? "Revisión documental del expediente de prueba." : "Acta de calificación de prueba núm. 01.",
    evidenceIds: [] as string[],
  }]));
  scores.unp_investigacion.score=10;
  const note="Se registra la evaluación de la convocatoria de prueba.";
  const close=()=>mutation(request,"/applications/s2/evaluations",{note,scores},"post",randomUUID());
  expect((await close()).status()).toBe(422);
  scores.unp_investigacion.evidenceIds=fixture.data.merits.filter(m=>m.teacherId==="t2"&&m.kind==="investigacion").map(m=>m.id);
  const response=await close();
  expect(response.ok(),await response.text()).toBeTruthy();
  const {result:id}=await response.json();
  const closed=await (await request.get(`/api/v1/evaluations/${id}`)).json();
  expect(closed.score).toBe(48);
  expect(closed.breakdown.find((line:{code:string})=>line.code==="unp_investigacion").evidenceIds).toEqual(scores.unp_investigacion.evidenceIds);
  expect((await pool.query("SELECT count(*)::int AS n FROM evaluacion_criterio WHERE evaluacion_id=$1",[id])).rows[0].n).toBe(9);
});
test("respaldo repetible, validación y reversión de una importación fallida",async()=>{
  const s=seed();const archive=await createBackup(s.data,s.documents,"fixture de pruebas");const parsed=decodeBackup(archive);expect(parsed.report.documentos).toBe(s.documents.length);
  const client=await pool.connect();try{expect((await importBackup(client,{role:"legajos",teacherId:"t1",userId:"legajos-ana"},archive)).repetida).toBeTruthy();}finally{client.release();}
  const invalid=await createBackup(s.data,s.documents.slice(1));expect(()=>decodeBackup(invalid)).toThrow(/documento inexistente/);
  const legacy=seed();legacy.data.schemaVersion=1;delete legacy.data.rubric.aprobadaEn;delete legacy.data.rubric.aprobadaPor;
  const legacyArchive=await createBackup(legacy.data,legacy.documents);expect(decodeBackup(legacyArchive).data.rubric.aprobadaEn).toBeUndefined();
  const incompatible=seed();incompatible.data.calls[0].rubric.threshold=1;const conflictingArchive=await createBackup(incompatible.data,incompatible.documents);expect(()=>decodeBackup(conflictingArchive)).toThrow(/incompatibles/);
  await resetTestDatabase(false);
  const corrupted=seed();corrupted.data.teachers[1].email=corrupted.data.teachers[0].email;const bad=await createBackup(corrupted.data,corrupted.documents);const c=await pool.connect();try{await expect(importBackup(c,{role:"legajos",teacherId:"t1",userId:"legajos-ana"},bad)).rejects.toThrow();}finally{c.release();}
  expect((await pool.query("SELECT count(*)::int AS n FROM docente")).rows[0].n).toBe(0);
  expect((await pool.query("SELECT inicializada FROM aplicacion_estado WHERE id=1")).rows[0].inicializada).toBe(false);
  expect((await pool.query("SELECT count(*)::int AS n FROM migracion_lote")).rows[0].n).toBe(0);
  const restored=await pool.connect();try{expect((await importBackup(restored,{role:"legajos",teacherId:"t1",userId:"legajos-ana"},legacyArchive)).comprobada).toBeTruthy();}finally{restored.release();}
  expect((await pool.query("SELECT count(*)::int AS n FROM rubrica WHERE aprobada_en IS NOT NULL")).rows[0].n).toBe(0);
});
