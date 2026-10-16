import { z } from "zod";
import type { Repositories } from "./ports";
import type { Actor, DocumentFile, Workspace, Identity, PromotionCall, Experience, Rubric } from "../domain/models";
import { catalog, nextCategory, demoUsers } from "../domain/models";
import { evaluate } from "../domain/evaluation";
import { ranking, rankingPending } from "../domain/promotion";
import { migrateWorkspace } from "./migrations";
export const teacherSchema = z.object({
  name: z.string().trim().min(5, "Escribe nombres y apellidos."),
  email: z.string().email("Escribe un correo válido."),
  faculty: z.string().min(1),
  department: z.string().min(1),
  specialty: z.string().trim().min(3, "Indica la especialidad."),
  category: z.enum(["Auxiliar", "Asociado", "Principal"]),
  dedication: z.enum(["Tiempo completo", "Dedicación exclusiva"]),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha.")
});
export const meritSchema = z.object({
  kind: z.enum(["experiencia", "titulo", "maestria", "doctorado", "investigacion", "ponencia", "participacion", "ratificacion"]),
  title: z.string().trim().min(4, "Describe el mérito con al menos 4 caracteres."),
  institution: z.string().trim().min(3, "Indica la institución emisora."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha.")
});
export type TeacherInput = z.infer<typeof teacherSchema>;
export type MeritInput = z.infer<typeof meritSchema>;
/** RF10 / CUS06 · Rúbrica versionada: criterios, topes, requisitos por categoría destino y fuente por criterio. */
const rubricLevelSchema = z.object({
  degree: z.enum(["maestria", "doctorado"]),
  years: z.number().int().min(0, "Los años exigidos no pueden ser negativos.").max(60, "Revisa los años exigidos."),
  research: z.number().int().min(0, "Las investigaciones exigidas no pueden ser negativas.").max(50, "Revisa las investigaciones exigidas."),
  ratification: z.boolean()
});
export const rubricSchema = z.object({
  version: z.string().trim().min(3, "Indica una versión de al menos 3 caracteres.").max(40, "La versión es demasiado larga.")
    .regex(/^[A-Za-z0-9._-]+$/, "Usa solo letras, números, punto, guion o guion bajo."),
  name: z.string().trim().min(5, "Describe la rúbrica."),
  estadoFuente: z.enum(["simulacion", "oficial"]),
  fuenteNormativa: z.string().trim().max(160, "La fuente de referencia es demasiado larga.").optional(),
  threshold: z.number({ invalid_type_error: "El umbral debe ser un número." }).int("El umbral debe ser un número entero.").min(0, "El umbral no puede ser negativo.").max(100, "El umbral no puede superar 100."),
  degrees: z.object({ maestria: z.number().min(0).max(100), doctorado: z.number().min(0).max(100) }),
  experience: z.object({ perYear: z.number().min(0).max(100), max: z.number().min(0).max(100) }),
  research: z.object({ unit: z.number().min(0).max(100), max: z.number().min(0).max(100) }),
  talks: z.object({ unit: z.number().min(0).max(100), max: z.number().min(0).max(100) }),
  attendance: z.object({ unit: z.number().min(0).max(100), max: z.number().min(0).max(100) }),
  requirements: z.object({ Asociado: rubricLevelSchema, Principal: rubricLevelSchema })
});
export type RubricInput = z.infer<typeof rubricSchema>;
function rubricSources(input: RubricInput): NonNullable<Rubric["sources"]> {
  const reference = input.fuenteNormativa?.trim() || "Supuesto didáctico de simulación; sin validación normativa.";
  return ["Grado académico", "Tiempo en categoría", "Investigaciones", "Ponencias", "Participaciones", "Requisitos", "Umbral"]
    .map(criterion => ({ criterion, reference, status: input.estadoFuente }));
}
type Seed = () => {
  data: Workspace;
  documents: DocumentFile[];
};
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function realDate(value: string) {
  const d = new Date(value + "T12:00:00Z");
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value;
}
export class LegajoService {
  constructor(private repos: Repositories, private initial: Seed, private now = () => new Date().toISOString(), private uid = () => crypto.randomUUID()) {}
  async initialize(): Promise<void> {
    const previous = await this.repos.workspace.read();
    if (previous) {
      if (previous.schemaVersion !== 2) {
        try { await this.repos.workspace.commit(migrateWorkspace(previous, this.now()), previous.revision); }
        catch (error) { if ((await this.repos.workspace.read())?.schemaVersion !== 2) throw error; }
      }
      return;
    }
    const {
      data,
      documents
    } = this.initial();
    try {
      await this.repos.workspace.commit(data, undefined, documents);
    } catch (e) {
      if (!(await this.repos.workspace.read())) throw e;
    }
  }
  async snapshot(actor: Actor): Promise<Workspace> {
    const data = await this.repos.workspace.read();
    ensure(data, "Inicializa la demostración.");
    if (actor.role !== "docente") return data;
    return {
      ...data,
      teachers: data.teachers.filter(t => t.id === actor.teacherId),
      merits: data.merits.filter(m => m.teacherId === actor.teacherId),
      requests: data.requests.filter(r => r.teacherId === actor.teacherId),
      evaluations: data.evaluations.filter(e => e.teacherId === actor.teacherId),
      reviews: data.reviews.filter(e => e.teacherId === actor.teacherId),
      experiences: data.experiences.filter(e => e.teacherId === actor.teacherId),
      rubrics: (data.rubrics ?? [data.rubric]).filter(r => r.aprobadaEn),
      proposals: data.proposals.filter(e => e.teacherId === actor.teacherId).map(p => ({
        ...p, rankingSnapshot: p.rankingSnapshot.filter(r => r.teacherId === actor.teacherId)
      })),
      audit: data.audit.filter(a => a.teacherId === actor.teacherId).map(a => ({ ...a, changes: undefined }))
    };
  }
  private async change(actor: Actor, teacherId: string | undefined, message: string, fn: (data: Workspace) => void, files: DocumentFile[] = []) {
    const data = await this.repos.workspace.read();
    ensure(data, "No se encontraron los datos.");
    const expected = data.revision;
    const who = this.identity(actor, data);
    const before = structuredClone(data);
    fn(data);
    const changes: NonNullable<Workspace["audit"][number]["changes"]> = [];
    for (const collection of ["teachers", "merits", "requests", "evaluations", "calls", "experiences", "proposals", "reviews", "rubrics"] as const) {
      for (const record of data[collection] ?? []) {
        const old = (before[collection] ?? []).find(r => r.id === record.id);
        if (JSON.stringify(old) !== JSON.stringify(record)) changes.push({
          collection, recordId: record.id ?? "sin-id", before: old, after: structuredClone(record)
        });
      }
    }
    data.revision++;
    data.audit.unshift({
      id: this.uid(),
      at: this.now(),
      actor: actor.role,
      actorId: who.id,
      actorName: who.name,
      changes,
      teacherId,
      message
    });
    await this.repos.workspace.commit(data, expected, files);
  }
  private identity(actor: Actor, data: Workspace): Identity {
    if (actor.role === "docente") {
      const teacher = data.teachers.find(t => t.id === actor.teacherId);
      ensure(teacher, "Docente no encontrado.");
      return { id: "docente-" + teacher.id, name: teacher.name, role: "docente" };
    }
    const who = demoUsers.find(u => u.role === actor.role && (!actor.userId || u.id === actor.userId));
    ensure(who, "El responsable no corresponde al perfil seleccionado.");
    return structuredClone(who);
  }
  private own(actor: Actor, teacherId: string) {
    ensure(actor.role === "legajos" || actor.role === "docente" && actor.teacherId === teacherId, "Este perfil no puede modificar ese legajo.");
  }
  async saveTeacher(actor: Actor, input: TeacherInput, id?: string) {
    ensure(actor.role === "legajos", "Solo personal de legajos puede editar docentes.");
    const parsed = teacherSchema.parse(input);
    ensure(catalog[parsed.faculty]?.includes(parsed.department), "El departamento debe pertenecer a la facultad.");
    ensure(realDate(parsed.since) && parsed.since <= this.now().slice(0, 10), "La fecha debe ser válida y no puede estar en el futuro.");
    const teacherId = id ?? this.uid();
    await this.change(actor, teacherId, id ? "Ficha docente actualizada." : "Docente registrado.", d => {
      ensure(!d.teachers.some(t => t.email.toLowerCase() === parsed.email.toLowerCase() && t.id !== id), "Ya existe un docente con ese correo.");
      if (id) {
        const t = d.teachers.find(t => t.id === id);
        ensure(t, "Docente no encontrado.");
        Object.assign(t, parsed, {
          updatedAt: this.now()
        });
      } else d.teachers.push({
        ...parsed,
        id: teacherId,
        code: "DOC-" + String(d.teachers.length + 1).padStart(3, "0"),
        createdAt: this.now(),
        updatedAt: this.now()
      });
    });
    return teacherId;
  }
  async saveMerit(actor: Actor, teacherId: string, input: MeritInput, file?: File, id?: string) {
    this.own(actor, teacherId);
    const parsed = meritSchema.parse(input);
    ensure(realDate(parsed.date) && parsed.date <= this.now().slice(0, 10), "Elige una fecha válida hasta hoy.");
    let document: DocumentFile | undefined;
    if (file) {
      ensure(file.size > 0 && file.size <= 10 * 1024 * 1024, "El archivo debe tener contenido y pesar como máximo 10 MB.");
      const mime = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
      ensure(mime.includes(file.type), "Adjunta un PDF o una imagen PNG, JPG o WebP.");
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const valid = file.type === "application/pdf" ? String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-" : file.type === "image/png" ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 : file.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
      ensure(valid, "El contenido del archivo no coincide con un documento o imagen válido.");
      document = {
        id: this.uid(),
        name: file.name,
        type: file.type,
        blob: file
      };
    }
    await this.change(actor, teacherId, id ? "Mérito corregido y enviado a revisión." : "Mérito incorporado, pendiente de verificación.", d => {
      ensure(d.teachers.some(t => t.id === teacherId), "Docente no encontrado.");
      if (id) {
        const m = d.merits.find(m => m.id === id && m.teacherId === teacherId);
        ensure(m, "Mérito no encontrado.");
        ensure(m.status !== "verificado", "Los méritos verificados se conservan; registra una nueva evidencia.");
        const before = structuredClone(m);
        Object.assign(m, parsed, {
          status: "pendiente",
          observation: "",
          updatedAt: this.now(),
          reviewedBy: undefined
        }, document ? {
          fileId: document.id,
          fileName: document.name
        } : {});
        d.reviews.unshift({ id: this.uid(), meritId: m.id, teacherId, at: this.now(),
          action: "correccion", reviewer: this.identity(actor, d), note: "Evidencia corregida y reenviada.",
          before, after: structuredClone(m) });
      } else {
        ensure(document, "Adjunta una evidencia documental.");
        d.merits.unshift({
          ...parsed,
          id: this.uid(),
          teacherId,
          fileId: document.id,
          fileName: document.name,
          status: "pendiente",
          observation: "",
          createdAt: this.now(),
          updatedAt: this.now()
        });
      }
    }, document ? [document] : []);
  }
  async review(actor: Actor, meritId: string, status: "verificado" | "observado", note: string) {
    ensure(["legajos", "comision"].includes(actor.role), "Solo legajos y comisión pueden revisar; el docente no puede verificar su propia evidencia.");
    ensure(status === "verificado" || note.trim().length >= 8, "Explica la observación con al menos 8 caracteres.");
    const state = await this.repos.workspace.read(),
      merit = state?.merits.find(m => m.id === meritId);
    ensure(merit, "Evidencia no encontrada.");
    await this.change(actor, merit.teacherId, status === "verificado" ? "Evidencia validada: " + merit.title : "Evidencia observada: " + merit.title, d => {
      const m = d.merits.find(m => m.id === meritId)!;
      ensure(m.status === "pendiente", "La evidencia ya fue revisada.");
      const before = structuredClone(m);
      m.status = status;
      m.observation = note.trim();
      m.updatedAt = this.now();
      m.reviewedBy = actor.role;
      d.reviews.unshift({ id: this.uid(), meritId, teacherId: m.teacherId, at: this.now(),
        action: "revision", reviewer: this.identity(actor, d), note: note.trim(),
        before, after: structuredClone(m) });
    });
  }
  async saveRequest(actor: Actor, teacherId: string, vacancyId: string, id?: string, callId?: string) {
    this.own(actor, teacherId);
    const resultId = id ?? this.uid();
    await this.change(actor, teacherId, id ? "Solicitud corregida." : "Borrador de solicitud creado.", d => {
      const t = d.teachers.find(t => t.id === teacherId);
      ensure(t, "Docente no encontrado.");
      const target = nextCategory(t.category);
      ensure(target, "La categoría principal no tiene promoción superior en esta demostración.");
      const v = d.vacancies.find(v => v.id === vacancyId);
      ensure(v && v.category === target && v.faculty === t.faculty && v.department === t.department && v.dedication === t.dedication, "Selecciona una plaza pertinente al docente.");
      const existing = id ? d.requests.find(r => r.id === id) : undefined;
      const call = d.calls.find(c => c.id === (callId ?? existing?.callId)) ?? (!callId && !existing ? d.calls.find(c => c.status === "abierta" && c.vacancyIds.includes(vacancyId)) : undefined);
      ensure(call && call.vacancyIds.includes(vacancyId), "Selecciona una convocatoria con esa plaza.");
      ensure(call.status === "abierta" && call.startsOn <= this.now().slice(0, 10) && call.endsOn >= this.now().slice(0, 10), "La convocatoria está fuera del plazo de presentación.");
      ensure(!d.requests.some(r => r.id !== id && r.teacherId === teacherId && r.callId === call.id), "Ya existe una solicitud abierta o evaluada para este docente en la convocatoria.");
      if (id) {
        const r = d.requests.find(r => r.id === id && r.teacherId === teacherId);
        ensure(r && ["borrador", "observada"].includes(r.status), "Esta solicitud no se puede editar.");
        r.vacancyId = vacancyId;
        r.callId = call.id;
        r.target = target;
        r.updatedAt = this.now();
      } else {
        d.requests.unshift({
          callId: call.id,
          id: resultId,
          teacherId,
          target,
          vacancyId,
          status: "borrador",
          note: "",
          createdAt: this.now(),
          updatedAt: this.now()
        });
      }
    });
    return resultId;
  }
  async submit(actor: Actor, id: string) {
    const d = await this.repos.workspace.read(),
      r = d?.requests.find(r => r.id === id);
    ensure(r, "Solicitud no encontrada.");
    this.own(actor, r.teacherId);
    await this.change(actor, r.teacherId, "Solicitud presentada a la comisión.", d => {
      const req = d.requests.find(r => r.id === id)!;
      ensure(["borrador", "observada"].includes(req.status), "La solicitud ya fue enviada.");
      const call = d.calls.find(c => c.id === req.callId);
      ensure(call && call.status === "abierta" && call.startsOn <= this.now().slice(0, 10) && call.endsOn >= this.now().slice(0, 10), "La convocatoria está fuera del plazo de presentación.");
      ensure(d.merits.some(m => m.teacherId === req.teacherId), "Incorpora al menos una evidencia antes de presentar la solicitud.");
      req.status = "presentada";
      req.submittedAt = this.now();
      req.updatedAt = this.now();
    });
  }
  async observeRequest(actor: Actor, id: string, note: string) {
    ensure(["legajos", "comision"].includes(actor.role), "Este perfil no puede observar solicitudes.");
    ensure(note.trim().length >= 8, "Describe qué debe corregirse.");
    const state = await this.repos.workspace.read();
    const req = state?.requests.find(r => r.id === id);
    ensure(req, "Solicitud no encontrada.");
    await this.change(actor, req.teacherId, "Solicitud observada: " + note.trim(), d => {
      const r = d.requests.find(r => r.id === id)!;
      ensure(r.status === "presentada", "Solo se observan solicitudes presentadas.");
      ensure(d.calls.find(c => c.id === r.callId)?.status === "abierta", "La recepción está cerrada; no se pueden pedir correcciones fuera de plazo.");
      r.status = "observada";
      r.note = note.trim();
      r.updatedAt = this.now();
    });
  }
  async closeEvaluation(actor: Actor, id: string, note: string) {
    ensure(actor.role === "comision", "Solo la comisión puede cerrar evaluaciones.");
    ensure(note.trim().length >= 8, "Incluye una conclusión de al menos 8 caracteres.");
    const state = await this.repos.workspace.read();
    const req = state?.requests.find(r => r.id === id);
    ensure(req, "Solicitud no encontrada.");
    let evaluationId = "";
    await this.change(actor, req.teacherId, "Evaluación cerrada con rúbrica y evidencias conservadas.", d => {
      const r = d.requests.find(r => r.id === id)!;
      ensure(r.status === "presentada", "La solicitud debe estar presentada y no tener evaluación cerrada.");
      ensure(!d.merits.some(m => m.teacherId === r.teacherId && m.status === "pendiente"), "Revisa las evidencias pendientes antes de cerrar la evaluación.");
      const t = d.teachers.find(t => t.id === r.teacherId)!;
      const call = d.calls.find(c => c.id === r.callId);
      ensure(call && call.status !== "cerrada", "La convocatoria no está disponible para evaluar.");
      evaluationId = this.uid();
      d.evaluations.unshift({
        ...evaluate(t, d.merits, r, d.vacancies.find(v => v.id === r.vacancyId), call.rubric, this.now()),
        callSnapshot: structuredClone(call),
        id: evaluationId,
        note: note.trim()
      });
      r.status = "evaluada";
      r.updatedAt = this.now();
    });
    return evaluationId;
  }
  /** RF10 / CUS06 · Normaliza el catálogo de rúbricas y conserva la versión vigente en datos heredados. */
  private rubricsOf(data: Workspace): Rubric[] {
    if (!data.rubrics?.length) {
      data.rubrics = [{
        ...structuredClone(data.rubric),
        id: data.rubric.id ?? "rub-vigente",
        estadoFuente: data.rubric.estadoFuente ?? "simulacion"
      }];
    }
    return data.rubrics;
  }
  async saveRubric(actor: Actor, input: RubricInput, id?: string) {
    ensure(actor.role === "legajos", "Solo personal de legajos puede gestionar rúbricas.");
    const parsed = rubricSchema.parse(input);
    const totalMax = parsed.degrees.doctorado + parsed.experience.max + parsed.research.max + parsed.talks.max + parsed.attendance.max;
    ensure(totalMax <= 100, "La suma de topes no puede superar 100 puntos.");
    ensure(parsed.threshold <= totalMax, "El umbral no puede superar la suma de topes de la rúbrica.");
    ensure(parsed.degrees.doctorado >= parsed.degrees.maestria, "El doctorado no puede otorgar menos puntos que la maestría.");
    const resultId = id ?? this.uid();
    await this.change(actor, undefined, id ? "Rúbrica de borrador actualizada." : "Nueva versión de rúbrica creada como borrador.", d => {
      const rubrics = this.rubricsOf(d);
      const existing = id ? rubrics.find(r => r.id === id) : undefined;
      if (id) ensure(existing, "Rúbrica no encontrada.");
      ensure(!rubrics.some(r => r.id !== id && r.version.toLowerCase() === parsed.version.toLowerCase()), "Ya existe una rúbrica con esa versión.");
      if (existing) ensure(!existing.aprobadaEn, "Una rúbrica aprobada no se modifica: crea una nueva versión (RN09).");
      const at = this.now();
      const record: Rubric = {
        ...parsed,
        id: resultId,
        fuenteNormativa: parsed.fuenteNormativa?.trim() || undefined,
        sources: rubricSources(parsed),
        createdAt: existing?.createdAt ?? at,
        updatedAt: at
      };
      if (existing) Object.assign(existing, record);
      else rubrics.unshift(record);
    });
    return resultId;
  }
  async approveRubric(actor: Actor, id: string) {
    ensure(actor.role === "legajos", "Solo personal de legajos puede aprobar rúbricas.");
    await this.change(actor, undefined, "Rúbrica aprobada y fijada como regla vigente.", d => {
      const rubrics = this.rubricsOf(d);
      const rubric = rubrics.find(r => r.id === id);
      ensure(rubric, "Rúbrica no encontrada.");
      ensure(!rubric.aprobadaEn, "La rúbrica ya está aprobada.");
      const at = this.now();
      rubric.aprobadaEn = at;
      rubric.aprobadaPor = this.identity(actor, d).id;
      rubric.updatedAt = at;
      d.rubric = structuredClone(rubric);
    });
  }
  async saveCall(actor: Actor, input: Pick<PromotionCall, "name" | "startsOn" | "endsOn" | "vacancyIds"> & { rubricId?: string }, id?: string) {
    ensure(actor.role === "legajos", "Solo personal de legajos puede gestionar convocatorias.");
    ensure(input.name.trim().length >= 5, "Escribe el nombre de la convocatoria.");
    ensure(realDate(input.startsOn) && realDate(input.endsOn) && input.startsOn <= input.endsOn, "El periodo de la convocatoria no es válido.");
    const resultId = id ?? this.uid();
    await this.change(actor, undefined, id ? "Convocatoria actualizada." : "Convocatoria de simulación registrada.", d => {
      ensure(input.vacancyIds.length > 0 && input.vacancyIds.every(v => d.vacancies.some(p => p.id === v)), "Selecciona al menos una plaza válida.");
      ensure(!d.calls.some(c => c.id !== id && c.name.toLowerCase() === input.name.trim().toLowerCase()), "Ya existe una convocatoria con ese nombre.");
      if (id) {
        const call = d.calls.find(c => c.id === id);
        ensure(call && call.status === "abierta" && !d.requests.some(r => r.callId === id), "No se modifica una convocatoria que ya tiene solicitudes.");
      }
      const rubrics = this.rubricsOf(d);
      const rubric = input.rubricId ? rubrics.find(r => r.id === input.rubricId) : d.rubric;
      ensure(rubric, "Selecciona una rúbrica válida.");
      ensure(rubric.aprobadaEn, "La convocatoria requiere una rúbrica aprobada. Aprueba la versión antes de aplicarla (RN09).");
      const patch = { name: input.name.trim(), startsOn: input.startsOn, endsOn: input.endsOn, vacancyIds: [...input.vacancyIds], rubric: structuredClone(rubric) };
      if (id) Object.assign(d.calls.find(c => c.id === id)!, patch);
      else d.calls.push({ ...patch, id: resultId, status: "abierta", createdAt: this.now() });
    });
    return resultId;
  }
  async advanceCall(actor: Actor, id: string) {
    ensure(actor.role === "legajos", "Solo personal de legajos puede cambiar la fase.");
    await this.change(actor, undefined, "Fase de convocatoria actualizada.", d => {
      const call = d.calls.find(c => c.id === id);
      ensure(call && call.status !== "cerrada", "La convocatoria ya está cerrada.");
      const requests = d.requests.filter(r => r.callId === id);
      if (call.status === "abierta") {
        ensure(!requests.some(r => r.status === "observada"), "Resuelve las solicitudes observadas antes de cerrar la recepción.");
        requests.filter(r => r.status === "borrador").forEach(r => { r.status = "no_presentada"; r.updatedAt = this.now(); });
        call.status = "evaluacion";
      } else {
        ensure(!requests.some(r => ["presentada", "observada", "borrador"].includes(r.status)), "Hay solicitudes pendientes de evaluación.");
        ensure(!d.proposals.some(p => p.callId === id && !["aprobada", "denegada"].includes(p.status)), "Hay propuestas en trámite.");
        ensure(!requests.some(r => r.status === "evaluada" && ranking(d, id, r.vacancyId).some(e => e.requestId === r.id && e.outcome === "apto" && e.position === 1)), "Tramita las propuestas aptas del primer puesto antes del cierre definitivo.");
        call.status = "cerrada";
      }
    });
  }
  async saveExperience(actor: Actor, teacherId: string, input: Omit<Experience, "id" | "teacherId" | "updatedAt">, id?: string) {
    this.own(actor, teacherId);
    ensure(input.institution.trim().length >= 3 && input.position.trim().length >= 3, "Completa institución y cargo.");
    ensure(realDate(input.startsOn) && input.startsOn <= this.now().slice(0, 10), "La fecha de inicio no es válida.");
    ensure(!input.endsOn || realDate(input.endsOn) && input.endsOn >= input.startsOn && input.endsOn <= this.now().slice(0, 10), "La fecha final no es válida.");
    await this.change(actor, teacherId, id ? "Trayectoria laboral corregida." : "Experiencia laboral incorporada.", d => {
      ensure(d.teachers.some(t => t.id === teacherId), "Docente no encontrado.");
      ensure(d.merits.some(m => m.teacherId === teacherId && m.id === input.evidenceId), "Selecciona una evidencia del legajo.");
      const record = { ...input, institution: input.institution.trim(), position: input.position.trim(), teacherId, updatedAt: this.now() };
      if (id) {
        const existing = d.experiences.find(e => e.id === id && e.teacherId === teacherId);
        ensure(existing, "Experiencia no encontrada.");
        Object.assign(existing, record);
      } else d.experiences.push({ ...record, id: this.uid() });
    });
  }
  async createProposal(actor: Actor, requestId: string, report: string) {
    ensure(actor.role === "decanato", "Solo el decanato prepara la propuesta.");
    ensure(report.trim().length >= 15, "Redacta un informe de al menos 15 caracteres.");
    const state = await this.repos.workspace.read();
    const teacherId = state?.requests.find(r => r.id === requestId)?.teacherId;
    ensure(teacherId, "Solicitud no encontrada.");
    await this.change(actor, teacherId, "Propuesta preparada por el decanato.", d => {
      const request = d.requests.find(r => r.id === requestId)!;
      const call = d.calls.find(c => c.id === request.callId);
      ensure(call?.status === "evaluacion", "Cierra la recepción de la convocatoria antes de preparar propuestas.");
      ensure(request.status === "evaluada", "La solicitud no está disponible para propuesta.");
      ensure(!rankingPending(d, call.id, request.vacancyId), "Completa las evaluaciones de todos los postulantes a esta plaza.");
      const order = ranking(d, call.id, request.vacancyId), candidate = order.find(r => r.requestId === requestId);
      ensure(candidate?.outcome === "apto" && candidate.position === 1, "Solo el primer puesto apto puede ser propuesto.");
      ensure(!candidate.tied, "Hay empate en el primer puesto. Se requiere una regla institucional validada antes de tramitar.");
      ensure(d.vacancies.find(v => v.id === request.vacancyId)?.available, "La plaza ya no está disponible.");
      ensure(!d.proposals.some(p => p.requestId === requestId), "La propuesta ya existe.");
      ensure(!d.proposals.some(p => p.vacancyId === request.vacancyId && p.status !== "denegada"), "La plaza ya tiene una propuesta en trámite o aprobada.");
      const at = this.now();
      d.proposals.unshift({ id: this.uid(), requestId, teacherId, evaluationId: candidate.evaluationId,
        callId: call.id, vacancyId: request.vacancyId, status: "decanato", report: report.trim(),
        rankingSnapshot: structuredClone(order), createdAt: at, updatedAt: at,
        events: [{ at, actor: this.identity(actor, d), stage: "decanato", reference: "", note: report.trim() }] });
      request.status = "propuesta";
      request.updatedAt = at;
    });
  }
  async advanceProposal(actor: Actor, id: string, action: "remitir" | "elevar" | "aprobar" | "denegar", reference: string, note: string) {
    ensure(reference.trim().length >= 3 && note.trim().length >= 8, "Registra el número de oficio/acuerdo/resolución y su fundamento.");
    const state = await this.repos.workspace.read();
    const teacherId = state?.proposals.find(p => p.id === id)?.teacherId;
    ensure(teacherId, "Propuesta no encontrada.");
    await this.change(actor, teacherId, "Trámite de propuesta: " + action + " · " + reference.trim(), d => {
      const proposal = d.proposals.find(p => p.id === id)!;
      const request = d.requests.find(r => r.id === proposal.requestId)!;
      if (action === "remitir") {
        ensure(actor.role === "decanato" && proposal.status === "decanato", "Solo el decanato puede remitir una propuesta preparada.");
        proposal.status = "facultad"; request.status = "en_facultad";
      } else if (action === "elevar") {
        ensure(actor.role === "consejo_facultad" && proposal.status === "facultad", "Solo el Consejo de Facultad puede elevar esta propuesta.");
        proposal.status = "universitario"; request.status = "en_consejo";
      } else {
        ensure(actor.role === "consejo_universitario" && proposal.status === "universitario", "Solo el Consejo Universitario registra la decisión de una propuesta elevada.");
        if (action === "aprobar") {
          ensure(d.vacancies.find(v => v.id === proposal.vacancyId)?.available, "La plaza ya no está disponible.");
          ensure(!d.proposals.some(p => p.id !== id && p.vacancyId === proposal.vacancyId && p.status === "aprobada"), "Esta plaza ya tiene una decisión aprobatoria.");
        }
        proposal.status = action === "aprobar" ? "aprobada" : "denegada";
        request.status = proposal.status;
      }
      proposal.updatedAt = request.updatedAt = this.now();
      proposal.events.push({ at: this.now(), actor: this.identity(actor, d), stage: proposal.status,
        reference: reference.trim(), note: note.trim() });
    });
  }
  async document(actor: Actor, id: string) {
    const d = await this.repos.workspace.read();
    ensure(d, "Datos no disponibles.");
    const owner = d.merits.find(m => m.fileId === id)?.teacherId ?? d.evaluations.flatMap(e => e.evidenceSnapshot).find(m => m.fileId === id)?.teacherId ?? d.reviews.find(r => r.before.fileId === id || r.after.fileId === id)?.teacherId;
    ensure(owner && (actor.role !== "docente" || owner === actor.teacherId), "Documento no accesible.");
    const doc = await this.repos.documents.get(id);
    ensure(doc, "Documento no encontrado.");
    return doc;
  }
  async reset(actor: Actor) {
    ensure(actor.role === "legajos", "Solo personal de legajos puede restaurar la demostración.");
    const current = await this.repos.workspace.read();
    const {
      data,
      documents
    } = this.initial();
    data.revision = (current?.revision ?? -1) + 1;
    await this.repos.workspace.commit(data, current?.revision, documents, true);
  }
}
