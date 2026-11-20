import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";
import { randomBytes, randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { PoolClient } from "pg";
import { pool } from "./db";
import { settings } from "./config";
import { ApiError, requireThat, sha256, verifyPassword } from "./security";
import { accountFromRow } from "./accounts";
import { PgStore } from "./store";
import { decodeBackup, importBackup } from "./migration";
import type { Actor, AuthUser } from "../src/domain/models";
import { ranking } from "../src/domain/promotion";
import { evaluate } from "../src/domain/evaluation";

type AuthRequest=Request&{account:AuthUser;actor:Actor};
const auth=(req:Request)=>req as AuthRequest;
const fileUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fieldSize:1024*1024}}).single("file");
const archiveUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:128*1024*1024,files:1}}).single("backup");
const cookieName="legajo_session";
const loginFailures=new Map<string,{count:number;until:number}>();
const payload=(req:Request)=>typeof req.body?.payload==="string"?JSON.parse(req.body.payload):req.body;
const fileFrom=(req:Request)=>req.file?new File([new Uint8Array(req.file.buffer)],req.file.originalname,{type:req.file.mimetype}):undefined;
const parameter=(req:Request,key:string)=>String(req.params[key]);
const credentialSchema=z.object({email:z.string().email().transform(v=>v.toLowerCase().trim()),password:z.string().min(1).max(256)});

export function createApp(proxyFrontend=true){
  const app=express();app.disable("x-powered-by");
  app.use((req,_res,next)=>{
    let path=req.path;
    try{for(let n=0;n<3;n++){const decoded=decodeURIComponent(path);if(decoded===path)break;path=decoded;}}catch{next(new ApiError(400,"INVALID_PATH","Ruta inválida."));return;}
    if(/(?:^|[\\/])(?:\.local|data|\.git|\.codex|\.agents|\.env(?:\.[^\\/]*)?)(?:[\\/]|$)/i.test(path))next(new ApiError(404,"NOT_FOUND","Recurso no disponible."));else next();
  });
  app.use((req,res,next)=>{
    res.setHeader("X-Content-Type-Options","nosniff");
    res.locals.requestId=randomUUID();res.setHeader("X-Request-ID",res.locals.requestId);
    if(req.path.startsWith("/api/"))res.setHeader("Cache-Control","no-store");
    if(req.path.startsWith("/api/")&&!["GET","HEAD","OPTIONS"].includes(req.method)){
      const origin=req.headers.origin;
      if(origin!==`http://localhost:${settings.port}`&&origin!==`http://127.0.0.1:${settings.port}`)return next(new ApiError(403,"ORIGIN_REJECTED","La operación debe realizarse desde la aplicación local."));
    }next();
  });
  app.use("/api",express.json({limit:"2mb"}));
  app.get("/api/v1/health",async(_req,res)=>{const state=await pool.query("SELECT current_database() AS database,inicializada FROM aplicacion_estado WHERE id=1");res.json({ok:true,...state.rows[0]});});
  app.post("/api/v1/auth/login",async(req,res)=>{
    const input=credentialSchema.parse(req.body);const failures=loginFailures.get(input.email);
    requireThat(!failures||failures.until<Date.now()||failures.count<10,"Demasiados intentos. Espera unos minutos.",429,"LOGIN_RATE_LIMIT");
    const found=await pool.query("SELECT u.* FROM usuario u WHERE lower(u.email)=$1 AND u.activo=true",[input.email]);const row=found.rows[0];
    const valid=row?.password_hash?await verifyPassword(input.password,row.password_hash):await verifyPassword(input.password,"scrypt:invalid:"+"00".repeat(64));
    if(!row||!valid){loginFailures.set(input.email,{count:(failures && failures.until>Date.now()?failures.count:0)+1,until:Date.now()+5*60000});throw new ApiError(401,"INVALID_CREDENTIALS","Correo o contraseña incorrectos.");}
    loginFailures.delete(input.email);const token=randomBytes(32).toString("base64url");
    await pool.query("INSERT INTO sesion(token_hash,usuario_id,expira_en) VALUES($1,$2,now()+interval '8 hours')",[sha256(token),row.id]);
    res.setHeader("Set-Cookie",serializeCookie(cookieName,token,{httpOnly:true,sameSite:"strict",path:"/",maxAge:settings.sessionHours*3600}));res.json({user:accountFromRow(row)});
  });
  app.post("/api/v1/auth/logout",async(req,res)=>{const token=parseCookie(req.headers.cookie??"")[cookieName];if(token)await pool.query("DELETE FROM sesion WHERE token_hash=$1",[sha256(token)]);res.setHeader("Set-Cookie",serializeCookie(cookieName,"",{httpOnly:true,sameSite:"strict",path:"/",maxAge:0}));res.json({ok:true});});
  app.get("/api/v1/session",async(req,res)=>{
    const account=await authenticate(req);const state=(await pool.query("SELECT inicializada FROM aplicacion_estado WHERE id=1")).rows[0];res.json({user:account,initialized:state.inicializada});
  });
  app.use("/api/v1",async(req,res,next)=>{
    const account=await authenticate(req);if(!account)throw new ApiError(401,"SESSION_REQUIRED","Inicia sesión para continuar.");
    auth(req).account=account;auth(req).actor={role:account.role,teacherId:account.teacherId??"",userId:account.userId??account.id,identity:{id:account.userId??account.id,name:account.name,role:account.role}};next();
  });
  app.get("/api/v1/migrations",async(req,res)=>{requireThat(auth(req).actor.role==="legajos","Solo Legajos puede consultar la importación.",403,"FORBIDDEN");const state=await pool.query("SELECT inicializada FROM aplicacion_estado WHERE id=1");const batch=await pool.query("SELECT informe FROM migracion_lote ORDER BY creada_en DESC LIMIT 1");res.json({initialized:state.rows[0].inicializada,report:batch.rows[0]?.informe});});
  app.post("/api/v1/migrations/preview",archiveUpload,async(req,res)=>{requireThat(auth(req).actor.role==="legajos","Solo Legajos puede importar.",403,"FORBIDDEN");requireThat(req.file,"Selecciona un respaldo ZIP.");res.json(decodeBackup(req.file.buffer).report);});
  app.post("/api/v1/migrations",archiveUpload,async(req,res)=>{requireThat(auth(req).actor.role==="legajos","Solo Legajos puede importar.",403,"FORBIDDEN");requireThat(req.file,"Selecciona un respaldo ZIP.");const client=await pool.connect();try{res.json(await importBackup(client,auth(req).actor,req.file.buffer));}finally{client.release();}});
  async function readWorkspace(req:Request){const client=await pool.connect();try{await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");const store=new PgStore(client,auth(req).actor);const full=await store.read();requireThat(full,"Importa el respaldo para habilitar la aplicación.",503,"SETUP_REQUIRED");const result=await(await store.service(full)).snapshot(auth(req).actor);await client.query("COMMIT");return result;}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}}
  app.get("/api/v1/workspace",async(req,res)=>res.json(await readWorkspace(req)));
  app.get("/api/v1/teachers",async(req,res)=>{const d=await readWorkspace(req);const search=String(req.query.search??"").toLocaleLowerCase();const filtered=d.teachers.filter(t=>(!search||`${t.name} ${t.code} ${t.email}`.toLocaleLowerCase().includes(search))&&(!req.query.faculty||t.faculty===req.query.faculty)&&(!req.query.department||t.department===req.query.department));const start=req.query.cursor?Math.max(0,filtered.findIndex(t=>t.id===req.query.cursor)+1):0;const limit=Math.max(1,Math.min(100,Number(req.query.limit)||50));const teachers=filtered.slice(start,start+limit);res.json({teachers,nextCursor:start+limit<filtered.length?teachers.at(-1)?.id:null,total:filtered.length});});
  app.get("/api/v1/teachers/:id/dossier",async(req,res)=>{const d=await readWorkspace(req),id=parameter(req,"id");requireThat(d.teachers.some(t=>t.id===id),"Legajo no disponible.",404,"NOT_FOUND");res.json({teacher:d.teachers.find(t=>t.id===id),merits:d.merits.filter(m=>m.teacherId===id),experiences:d.experiences.filter(e=>e.teacherId===id)});});
  app.get("/api/v1/files/:id",async(req,res)=>{
    const client=await pool.connect();try{const store=new PgStore(client,auth(req).actor);const full=await store.read();requireThat(full,"Datos no disponibles.",503,"SETUP_REQUIRED");const doc=await(await store.service(full)).document(auth(req).actor,parameter(req,"id"));res.setHeader("Content-Type",doc.type);res.setHeader("Content-Disposition",`inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`);res.setHeader("X-File-Name",encodeURIComponent(doc.name));res.send(Buffer.from(await doc.blob.arrayBuffer()));}finally{client.release();}
  });
  app.get("/api/v1/evaluations/:id",async(req,res)=>{const d=await readWorkspace(req);const value=d.evaluations.find(e=>e.id===parameter(req,"id"));requireThat(value,"Evaluación no disponible.",404,"NOT_FOUND");res.json(value);});
  app.get("/api/v1/applications",async(req,res)=>res.json({applications:(await readWorkspace(req)).requests}));
  app.get("/api/v1/applications/:id/evaluation-preview",async(req,res)=>{const d=await readWorkspace(req),r=d.requests.find(r=>r.id===parameter(req,"id"));requireThat(r,"Solicitud no disponible.",404,"NOT_FOUND");const saved=d.evaluations.find(e=>e.requestId===r.id);if(saved){res.json(saved);return;}const teacher=d.teachers.find(t=>t.id===r.teacherId),call=d.calls.find(c=>c.id===r.callId);requireThat(teacher&&call,"El expediente tiene referencias incompletas.");res.json(evaluate(teacher,d.merits,r,d.vacancies.find(v=>v.id===r.vacancyId),call.rubric,new Date().toISOString()));});
  app.get("/api/v1/evaluations",async(req,res)=>res.json({evaluations:(await readWorkspace(req)).evaluations}));
  app.get("/api/v1/calls",async(req,res)=>res.json({calls:(await readWorkspace(req)).calls}));
  app.get("/api/v1/proposals",async(req,res)=>res.json({proposals:(await readWorkspace(req)).proposals}));
  app.get("/api/v1/vacancies",async(req,res)=>res.json({vacancies:(await readWorkspace(req)).vacancies.filter(v=>(!req.query.faculty||v.faculty===req.query.faculty)&&(!req.query.department||v.department===req.query.department)&&(!req.query.category||v.category===req.query.category))}));
  app.get("/api/v1/teachers/:id/experiences",async(req,res)=>{const d=await readWorkspace(req);requireThat(d.teachers.some(t=>t.id===parameter(req,"id")),"Docente no disponible.",404,"NOT_FOUND");res.json({experiences:d.experiences.filter(e=>e.teacherId===parameter(req,"id"))});});
  app.get("/api/v1/rubrics/:version",async(req,res)=>{const d=await readWorkspace(req);const rubric=d.rubrics?.find(r=>r.version===parameter(req,"version"));requireThat(rubric,"Rúbrica no disponible.",404,"NOT_FOUND");res.json(rubric);});
  app.get("/api/v1/teachers/:id/history",async(req,res)=>{const d=await readWorkspace(req);requireThat(d.teachers.some(t=>t.id===parameter(req,"id")),"Docente no disponible.",404,"NOT_FOUND");res.json({history:d.audit.filter(a=>a.teacherId===parameter(req,"id"))});});
  app.get("/api/v1/merits/:id/reviews",async(req,res)=>res.json({reviews:(await readWorkspace(req)).reviews.filter(r=>r.meritId===parameter(req,"id"))}));
  app.get("/api/v1/calls/:id/ranking",async(req,res)=>{requireThat(auth(req).actor.role!=="docente","El cuadro general está reservado a los responsables del proceso.",403,"FORBIDDEN");const d=await readWorkspace(req);res.json(ranking(d,parameter(req,"id"),String(req.query.vacancyId??"")));});
  type Command=(service:Awaited<ReturnType<PgStore["service"]>>,actor:Actor,body:any,req:Request,client:PoolClient)=>Promise<unknown>;
  const command=(fn:Command)=>async(req:Request,res:Response)=>{
    const actor=auth(req).actor,body=payload(req);const client=await pool.connect();const store=new PgStore(client,actor);const type=req.method+" "+req.path;
    const key=req.get("Idempotency-Key");const fingerprint=sha256(type+JSON.stringify(body??{})+(req.file?sha256(req.file.buffer):""));
    try{
      await client.query("BEGIN");const state=(await client.query("SELECT * FROM aplicacion_estado WHERE id=1 FOR UPDATE")).rows[0];
      if(key){const old=(await client.query("SELECT * FROM operacion_idempotente WHERE clave=$1",[key])).rows[0];if(old){requireThat(old.usuario_id===actor.userId&&old.tipo===type&&old.huella===fingerprint,"La clave de reintento corresponde a otra operación.",409,"IDEMPOTENCY_CONFLICT");await client.query("COMMIT");res.json(old.resultado);return;}}
      requireThat(state.inicializada,"Importa los datos antes de operar.",503,"SETUP_REQUIRED");
      const expected=req.get("If-Match");requireThat(expected!==undefined,"Actualiza la vista antes de guardar.",428,"REVISION_REQUIRED");requireThat(Number(expected)===state.revision,"Los datos cambiaron en otra sesión. Actualiza la vista y vuelve a intentar.",409,"REVISION_CONFLICT");
      const before=await store.read();requireThat(before,"Datos no disponibles.",503,"SETUP_REQUIRED");const service=await store.service(before);
      const result=await fn(service,actor,body,req,client);
      const revision=(await client.query("SELECT revision FROM aplicacion_estado WHERE id=1")).rows[0].revision;
      const response={result:result??null,revision,accounts:store.newCredentials};
      if(key)await client.query("INSERT INTO operacion_idempotente(clave,usuario_id,tipo,huella,resultado) VALUES($1,$2,$3,$4,$5)",[key,actor.userId,type,fingerprint,JSON.stringify({...response,accounts:[]})]);
      await client.query("COMMIT");res.json(response);
    }catch(error){await client.query("ROLLBACK");await store.files.rollback();throw error;}finally{client.release();}
  };
  app.post("/api/v1/teachers",command((s,a,b)=>s.saveTeacher(a,b)));
  app.patch("/api/v1/teachers/:id",command((s,a,b,r)=>s.saveTeacher(a,b,parameter(r,"id"))));
  app.post("/api/v1/teachers/:id/merits",fileUpload,command((s,a,b,r)=>s.saveMerit(a,parameter(r,"id"),b,fileFrom(r))));
  app.post("/api/v1/files",fileUpload,command((s,a,b,r)=>s.saveMerit(a,z.string().min(1).parse(b.teacherId),b,fileFrom(r))));
  app.patch("/api/v1/merits/:id",fileUpload,command(async(s,a,b,r)=>{const d=await s.snapshot(a);const merit=d.merits.find(m=>m.id===parameter(r,"id"));requireThat(merit,"Mérito no disponible.",404,"NOT_FOUND");return s.saveMerit(a,merit.teacherId,b,fileFrom(r),merit.id);}));
  app.post("/api/v1/merits/:id/reviews",command((s,a,b,r)=>s.review(a,parameter(r,"id"),b.status,b.note??"")));
  app.post("/api/v1/applications",command((s,a,b)=>s.saveRequest(a,b.teacherId,b.vacancyId,undefined,b.callId)));
  app.patch("/api/v1/applications/:id",command((s,a,b,r)=>s.saveRequest(a,b.teacherId,b.vacancyId,parameter(r,"id"),b.callId)));
  app.post("/api/v1/applications/:id/submissions",command((s,a,_b,r)=>s.submit(a,parameter(r,"id"))));
  app.post("/api/v1/applications/:id/observations",command((s,a,b,r)=>s.observeRequest(a,parameter(r,"id"),b.note)));
  app.post("/api/v1/applications/:id/evaluations",command(async(s,a,b,r,client)=>{requireThat(r.get("Idempotency-Key"),"El cierre requiere una clave de reintento.",428,"IDEMPOTENCY_REQUIRED");const request=(await s.snapshot(a)).requests.find(x=>x.id===parameter(r,"id"));requireThat(request,"Solicitud no disponible.",404,"NOT_FOUND");const member=await client.query("SELECT 1 FROM miembro_comision WHERE comision_id=$1 AND usuario_id=$2",[`comision-${request.callId}`,a.userId]);requireThat(member.rowCount,"No perteneces a la comisión de esta convocatoria.",403,"FORBIDDEN");return s.closeEvaluation(a,request.id,b.note);}));
  app.post("/api/v1/rubrics",command((s,a,b)=>s.saveRubric(a,b)));
  app.patch("/api/v1/rubrics/:id",command((s,a,b,r)=>s.saveRubric(a,b,parameter(r,"id"))));
  app.post("/api/v1/rubrics/:id/approvals",command((s,a,_b,r)=>s.approveRubric(a,parameter(r,"id"))));
  app.post("/api/v1/calls",command((s,a,b)=>s.saveCall(a,b)));
  app.patch("/api/v1/calls/:id",command((s,a,b,r)=>s.saveCall(a,b,parameter(r,"id"))));
  app.post("/api/v1/calls/:id/phase",command((s,a,_b,r)=>s.advanceCall(a,parameter(r,"id"))));
  app.post("/api/v1/teachers/:id/experiences",command((s,a,b,r)=>s.saveExperience(a,parameter(r,"id"),b)));
  app.patch("/api/v1/teachers/:id/experiences/:experienceId",command((s,a,b,r)=>s.saveExperience(a,parameter(r,"id"),b,parameter(r,"experienceId"))));
  app.post("/api/v1/proposals",command((s,a,b)=>s.createProposal(a,b.requestId,b.report)));
  for(const [path,action]of [["referrals","remitir"],["escalations","elevar"]] as const)app.post(`/api/v1/proposals/:id/${path}`,command((s,a,b,r)=>s.advanceProposal(a,parameter(r,"id"),action,b.reference,b.note)));
  app.post("/api/v1/proposals/:id/decisions",command((s,a,b,r)=>{requireThat(b.action==="aprobar"||b.action==="denegar","Decisión inválida.");return s.advanceProposal(a,parameter(r,"id"),b.action,b.reference,b.note);}));
  app.use("/api",(_req,_res,next)=>next(new ApiError(404,"NOT_FOUND","La operación solicitada no existe.")));
  if(proxyFrontend){const proxy=createProxyMiddleware({target:`http://127.0.0.1:${settings.frontendPort}`,changeOrigin:false,ws:true,logger:console});app.use(proxy);app.locals.frontendProxy=proxy;}
  app.use((error:unknown,req:Request,res:Response,_next:NextFunction)=>{
    const raw=error as {code?:string;message?:string;status?:number};let status=500,code="INTERNAL_ERROR",message="No se pudo completar la operación. Inténtalo de nuevo.";
    if(error instanceof ApiError){status=error.status;code=error.code;message=error.message;}
    else if(error instanceof ZodError){status=422;code="VALIDATION_ERROR";message=error.issues.map(i=>i.message).join(" ");}
    else if(error instanceof multer.MulterError){status=413;code="FILE_SIZE";message="El archivo supera el tamaño permitido.";}
    else if(raw.code==="23505"){status=409;code="DUPLICATE";message="El registro ya existe o la plaza tiene una propuesta activa.";}
    else if(raw.code==="23514"||raw.code==="23503"){status=422;code="DATA_CONSTRAINT";message="La operación incumple una regla de integridad o tiene referencias inválidas.";}
    else if(error instanceof Error&&!raw.code&&req.path.startsWith("/api/v1/")){status=/^(Solo |Este perfil )|Documento no accesible|responsable no corresponde/i.test(error.message)?403:422;code=status===403?"FORBIDDEN":"BUSINESS_RULE";message=error.message;}
    if(status>=500)console.error(JSON.stringify({requestId:res.locals.requestId,event:"request_failed",code:raw.code??"internal"}));
    res.status(status).json({code,message,requestId:res.locals.requestId});
  });
  return app;
}
async function authenticate(req:Request){
  const token=parseCookie(req.headers.cookie??"")[cookieName];if(!token)return null;
  const result=await pool.query("SELECT u.* FROM sesion s JOIN usuario u ON u.id=s.usuario_id WHERE s.token_hash=$1 AND s.expira_en>now() AND u.activo=true",[sha256(token)]);
  const row=result.rows[0];if(!row)return null;
  const account=accountFromRow(row);const role=await pool.query("SELECT r.codigo FROM asignacion_rol a JOIN rol r ON r.id=a.rol_id WHERE a.usuario_id=$1 AND a.vigente_desde<=current_date AND (a.vigente_hasta IS NULL OR a.vigente_hasta>=current_date)",[row.id]);
  requireThat(role.rows.some(r=>r.codigo===account.role),"La cuenta no tiene un rol vigente.",403,"FORBIDDEN");return account;
}
