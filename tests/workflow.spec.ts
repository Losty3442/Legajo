import { test, expect } from "@playwright/test";
import "fake-indexeddb/auto";
import { LegajoService } from "../src/application/service";
import { browserRepositories } from "../src/infrastructure/indexeddb";
import { seed, demoPdf } from "../src/infrastructure/seed";
import { ranking } from "../src/domain/promotion";
import { evaluate } from "../src/domain/evaluation";
import type { Actor, Workspace } from "../src/domain/models";

const at = "2026-09-16T12:00:00.000Z";
const office: Actor = { role: "legajos", teacherId: "t1", userId: "legajos-ana" };
const commission: Actor = { role: "comision", teacherId: "t1", userId: "comision-rosa" };
const dean: Actor = { role: "decanato", teacherId: "t1" };
const faculty: Actor = { role: "consejo_facultad", teacherId: "t1" };
const council: Actor = { role: "consejo_universitario", teacherId: "t1" };
const teacher: Actor = { role: "docente", teacherId: "t1" };
const service = new LegajoService(browserRepositories, seed, () => at);
test.beforeEach(async () => { await service.reset(office); });
async function state() { return service.snapshot(office); }
async function mutate(fn: (data: Workspace) => void) {
  const data = await state(), revision = data.revision;
  fn(data); data.revision++; await browserRepositories.workspace.commit(data, revision);
}
async function prepare() {
  await service.closeEvaluation(commission, "s2", "Cumple todos los requisitos de la simulación.");
  await service.advanceCall(office, "c2026");
  await service.createProposal(dean, "s2", "Se propone al docente que obtuvo el primer puesto con 84 puntos.");
  return (await state()).proposals[0];
}

test("conserva revisiones nominales, observación anterior y archivos reemplazados", async () => {
  await service.review(office, "m16", "observado", "Falta la fecha legible en el documento original.");
  const before = (await state()).merits.find(m => m.id === "m16")!;
  await service.saveMerit(teacher, "t1", { ...before, title: "Ponencia con fecha corregida" },
    new File([demoPdf("Nuevo soporte")], "nuevo.pdf", { type: "application/pdf" }), before.id);
  await service.review({ ...office, userId: "legajos-luis" }, before.id, "verificado", "Documento legible y completo.");
  const events = (await state()).reviews.filter(r => r.meritId === before.id);
  expect(events).toHaveLength(3);
  expect(events.find(r => r.after.status === "observado")?.note).toContain("fecha legible");
  expect(events[0].reviewer.id).toBe("legajos-luis");
  expect(events[2].reviewer.id).toBe("legajos-ana");
  expect(events[1].before.fileId).toBe(before.fileId);
  expect(events[1].after.fileId).not.toBe(before.fileId);
  expect((await service.document(teacher, before.fileId)).blob.size).toBeGreaterThan(0);
  await expect(service.review(dean, "m20", "verificado", "")).rejects.toThrow("Solo legajos");
  await expect(service.review({ ...office, userId: "comision-rosa" }, "m20", "verificado", "")).rejects.toThrow("responsable");
});

test("convocatoria valida plazos, congela configuración y permite postular en otro proceso", async () => {
  await expect(service.saveCall(office, { name: "Periodo inválido", startsOn: "2026-02-30", endsOn: "2026-12-31", vacancyIds: ["v1"] })).rejects.toThrow("periodo");
  await expect(service.saveCall(office, { name: "Editar convocatoria usada", startsOn: "2026-01-01", endsOn: "2026-12-31", vacancyIds: ["v1"] }, "c2026")).rejects.toThrow("ya tiene solicitudes");
  await expect(service.saveRequest(teacher, "t1", "v1")).rejects.toThrow("Ya existe");
  const past = await service.saveCall(office, { name: "Plazo vencido", startsOn: "2026-01-01", endsOn: "2026-02-01", vacancyIds: ["v1"] });
  await expect(service.saveRequest(teacher, "t1", "v1", undefined, past)).rejects.toThrow("fuera del plazo");
  const next = await service.saveCall(office, { name: "Segundo proceso", startsOn: "2026-01-01", endsOn: "2026-12-31", vacancyIds: ["v1"] });
  const requestId = await service.saveRequest(teacher, "t1", "v1", undefined, next);
  expect((await state()).requests.find(r => r.id === requestId)?.callId).toBe(next);
  await service.advanceCall(office, next);
  expect((await state()).requests.find(r => r.id === requestId)?.status).toBe("no_presentada");
  await expect(service.saveRequest({ ...teacher, teacherId: "t6" }, "t6", "v1", undefined, next)).rejects.toThrow("fuera del plazo");
});

test("cierre de recepción exige resolver observaciones; cierre definitivo exige evaluación", async () => {
  await service.observeRequest(office, "s1", "Corregir los documentos presentados.");
  await expect(service.advanceCall(office, "c2026")).rejects.toThrow("observadas");
  await service.submit(teacher, "s1");
  await service.advanceCall(office, "c2026");
  await expect(service.observeRequest(office, "s1", "Otra corrección fuera de recepción")).rejects.toThrow("recepción está cerrada");
  await expect(service.advanceCall(office, "c2026")).rejects.toThrow("pendientes de evaluación");
});

test("rúbrica y requisitos corresponden a la convocatoria y se conservan al cerrar", async () => {
  await mutate(d => { d.rubric.threshold = 100; d.rubric.requirements!.Principal.years = 100; });
  await service.closeEvaluation(commission, "s2", "Evaluación según las condiciones de la convocatoria.");
  const result = (await state()).evaluations[0];
  expect(result.outcome).toBe("apto");
  expect(result.rubric.threshold).toBe(55);
  expect(result.rubric.requirements!.Principal.years).toBe(5);
  expect(result.rubric.sources!.length).toBeGreaterThan(0);
  expect(result.callSnapshot?.id).toBe("c2026");
  await mutate(d => { d.calls[0].rubric.threshold = 95; });
  expect((await state()).evaluations[0]).toEqual(result);
});

test("orden de mérito agrupa por plaza, conserva empates y excluye no aptos del puesto", () => {
  const d = seed().data;
  const req = { ...d.requests[0], id: "s6", teacherId: "t6" };
  d.requests.push(req);
  const a = evaluate(d.teachers[0], d.merits, d.requests[0], d.vacancies[0], d.rubric, at);
  const b = evaluate(d.teachers[5], d.merits, req, d.vacancies[0], d.rubric, at);
  d.evaluations = [{ ...a, id: "e1", note: "", score: 60, outcome: "apto" }, { ...b, id: "e6", note: "", score: 60, outcome: "apto" }];
  expect(ranking(d, "c2026", "v1").map(r => [r.position, r.tied])).toEqual([[1, true], [1, true]]);
  expect(ranking(d, "c2026", "v2")).toEqual([]);
  d.evaluations[1].outcome = "no_apto";
  expect(ranking(d, "c2026", "v1").map(r => [r.position, r.tied])).toEqual([[1, false], [null, false]]);
});

test("propuesta recorre decanato, Facultad y Consejo con permisos y decisión inmutable", async () => {
  const p = await prepare();
  const originalEvaluation = (await state()).evaluations[0];
  await expect(service.advanceProposal(office, p.id, "remitir", "OF-01", "Enviar expediente completo")).rejects.toThrow("decanato");
  await expect(service.advanceProposal(council, p.id, "aprobar", "RES-01", "Decisión anticipada")).rejects.toThrow("elevada");
  await service.advanceProposal(dean, p.id, "remitir", "OF-DEMO-01", "Se remite el expediente a Facultad.");
  await service.advanceProposal(faculty, p.id, "elevar", "AC-DEMO-01", "Acuerdo favorable para elevar al Consejo.");
  await service.advanceProposal(council, p.id, "aprobar", "RES-DEMO-01", "Decisión aprobatoria de demostración.");
  const after = await state();
  expect(after.proposals[0].events).toHaveLength(4);
  expect(after.proposals[0].status).toBe("aprobada");
  expect(after.requests.find(r => r.id === "s2")?.status).toBe("aprobada");
  expect(after.evaluations[0]).toEqual(originalEvaluation);
  expect(after.teachers.find(t => t.id === "t2")?.category).toBe("Asociado");
  expect(after.audit[0].actorId).toBe("consejo-irene");
  await expect(service.advanceProposal(council, p.id, "denegar", "RES-02", "Intentar sobrescribir decisión")).rejects.toThrow("elevada");
  expect((await service.snapshot({ role: "docente", teacherId: "t2" })).proposals).toHaveLength(1);
  expect((await service.snapshot(teacher)).proposals).toHaveLength(0);
});

test("no propone durante recepción, con empate, sin vacante o con evaluaciones pendientes", async () => {
  await service.closeEvaluation(commission, "s2", "Cumple requisitos y puntaje.");
  await expect(service.createProposal(dean, "s2", "Propuesta antes de cerrar recepción.")).rejects.toThrow("Cierra la recepción");
  await service.advanceCall(office, "c2026");
  await mutate(d => { d.requests.push({ ...d.requests.find(r => r.id === "s2")!, id: "competidor", teacherId: "t6", status: "presentada" }); });
  await expect(service.createProposal(dean, "s2", "Propuesta con otro expediente pendiente.")).rejects.toThrow("todos los postulantes");
  await mutate(d => {
    const r = d.requests.find(r => r.id === "competidor")!; r.status = "evaluada";
    d.evaluations.push({ ...structuredClone(d.evaluations[0]), id: "otro-resultado", requestId: r.id, teacherId: r.teacherId });
  });
  await expect(service.createProposal(dean, "s2", "Propuesta con empate de puntaje.")).rejects.toThrow("empate");
  await mutate(d => { d.evaluations.find(e => e.id === "otro-resultado")!.score = 70; d.vacancies.find(v => v.id === "v2")!.available = false; });
  await expect(service.createProposal(dean, "s2", "Propuesta sin plaza disponible.")).rejects.toThrow("no está disponible");
});

test("decisión denegatoria conserva fundamento y no concede ascenso", async () => {
  const p = await prepare();
  await service.advanceProposal(dean, p.id, "remitir", "OF-02", "Se remite para revisión.");
  await service.advanceProposal(faculty, p.id, "elevar", "AC-02", "Se eleva a instancia decisora.");
  await service.advanceProposal(council, p.id, "denegar", "RES-02", "Se deniega en este ejemplo académico.");
  expect((await state()).proposals[0].status).toBe("denegada");
  expect((await state()).proposals[0].events[3].note).toContain("deniega");
});

test("trayectoria y título se respaldan con evidencia sin otorgar puntos nuevos", async () => {
  const input = { institution: "Institución anterior", position: "Docente contratado", startsOn: "2018-01-01", endsOn: "2020-12-31", evidenceId: "m1" };
  await service.saveExperience(teacher, "t1", input);
  const entry = (await state()).experiences[0];
  await service.saveExperience(teacher, "t1", { ...input, position: "Docente investigador" }, entry.id);
  expect((await state()).audit[0].changes?.find(c => c.collection === "experiences")?.before).toMatchObject({ position: "Docente contratado" });
  await expect(service.saveExperience(teacher, "t1", { ...input, endsOn: "2017-01-01" })).rejects.toThrow("fecha final");
  await expect(service.saveExperience(teacher, "t1", { ...input, evidenceId: "m4" })).rejects.toThrow("evidencia del legajo");
  await service.saveMerit(teacher, "t1", { kind: "titulo", title: "Título profesional de prueba", institution: "Universidad ejemplo", date: "2015-01-01" },
    new File([demoPdf("Título")], "titulo.pdf", { type: "application/pdf" }));
  const merit = (await state()).merits[0];
  await service.review(office, merit.id, "verificado", "");
  const d = await state();
  expect(evaluate(d.teachers[0], d.merits, d.requests[0], d.vacancies[0], d.rubric, at).score).toBe(53);
});

test("migración conserva resultados, observaciones, archivos y no inventa responsables", async () => {
  await service.closeEvaluation(commission, "s2", "Resultado previo a migración.");
  await mutate(d => {
    const old = { ...d.requests.find(r => r.id === "s2")!, id: "s2-antigua", createdAt: "2025-01-01T12:00:00Z" };
    d.requests.push(old);
    d.evaluations.push({ ...structuredClone(d.evaluations[0]), id: "evaluacion-antigua", requestId: old.id });
  });
  const original = await state();
  const legacy = structuredClone(original) as Partial<Workspace>;
  legacy.schemaVersion = 1;
  delete legacy.calls; delete legacy.reviews; delete legacy.experiences; delete legacy.proposals;
  const revision = original.revision;
  legacy.revision = revision + 1;
  await browserRepositories.workspace.commit(legacy as Workspace, revision);
  await service.initialize();
  const migrated = await state();
  expect(migrated.schemaVersion).toBe(2);
  expect(migrated.evaluations).toEqual(original.evaluations);
  expect(migrated.merits).toEqual(original.merits);
  const teacherCalls = migrated.requests.filter(r => r.teacherId === "t2").map(r => r.callId);
  expect(new Set(teacherCalls).size).toBe(2);
  expect(migrated.calls.find(c => c.id === "legacy-history-s2-antigua")?.status).toBe("cerrada");
  expect(migrated.reviews[0].reviewer.name).toContain("no registrado");
  expect((await service.document(teacher, "file-m1")).blob.size).toBeGreaterThan(0);
  await service.initialize();
  expect((await state()).revision).toBe(migrated.revision);
});
