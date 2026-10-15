import { test, expect } from "@playwright/test";
import "fake-indexeddb/auto";
import { evaluate, completedYears } from "../src/domain/evaluation";
import { seed, demoPdf } from "../src/infrastructure/seed";
import { LegajoService } from "../src/application/service";
import { browserRepositories } from "../src/infrastructure/indexeddb";
import type { Actor, Merit } from "../src/domain/models";
const at = "2026-09-15T12:00:00.000Z";
const office: Actor = {
  role: "legajos",
  teacherId: "t1"
};
const commission: Actor = {
  role: "comision",
  teacherId: "t1"
};
const teacher: Actor = {
  role: "docente",
  teacherId: "t1"
};
const service = new LegajoService(browserRepositories, seed, () => at);
test.beforeEach(async () => {
  await service.reset(office);
});
function scenario() {
  const {
    data
  } = seed();
  const t = data.teachers[0],
    request = data.requests[0],
    vacancy = data.vacancies[0];
  const merits = data.merits.filter(m => m.teacherId === t.id && m.status === "verificado");
  const merit = (kind: Merit["kind"], status: Merit["status"] = "verificado"): Merit => ({
    ...merits[0],
    id: crypto.randomUUID(),
    kind,
    status
  });
  const run = () => evaluate(t, merits, request, vacancy, data.rubric, at);
  return {
    data,
    t,
    request,
    vacancy,
    merits,
    merit,
    run
  };
}
test("el umbral distingue exactamente 54, 55 y 56 puntos", () => {
  const s = scenario();
  s.merits.push(s.merit("participacion"));
  expect(s.run().score).toBe(54);
  expect(s.run().outcome).toBe("no_apto");
  s.merits.push(s.merit("participacion"));
  expect(s.run().score).toBe(55);
  expect(s.run().outcome).toBe("apto");
  s.merits.push(s.merit("participacion"));
  expect(s.run().score).toBe(56);
  expect(s.run().outcome).toBe("apto");
});
test("solo considera evidencias propias, verificadas y no futuras", () => {
  const s = scenario();
  s.merits.push(s.merit("doctorado", "pendiente"), s.merit("ponencia", "observado"));
  s.merits.push({
    ...s.merit("doctorado"),
    teacherId: "t2"
  });
  s.merits.push({
    ...s.merit("doctorado"),
    date: "2027-01-01"
  });
  expect(s.run().score).toBe(53);
  expect(s.run().evidenceSnapshot).toHaveLength(3);
});
test("aplica topes por criterio y solo el mayor grado, máximo 100", () => {
  const s = scenario();
  s.merits.push(s.merit("doctorado"));
  for (let i = 0; i < 20; i++) for (const k of ["maestria", "doctorado", "investigacion", "ponencia", "participacion"] as const) s.merits.push(s.merit(k));
  expect(s.run().score).toBe(100);
  expect(s.run().breakdown.map(b => b.score)).toEqual([45, 15, 24, 12, 4]);
});
test("un puntaje alto no sustituye ratificación o años mínimos", () => {
  const s = scenario();
  s.merits.push(s.merit("doctorado"));
  s.merits.splice(s.merits.findIndex(m => m.kind === "ratificacion"), 1);
  expect(s.run().score).toBeGreaterThanOrEqual(55);
  expect(s.run().outcome).toBe("no_apto");
  s.merits.push(s.merit("ratificacion"));
  s.t.since = "2025-01-01";
  expect(s.run().outcome).toBe("no_apto");
});
test("sin vacante y plaza ajena no equivalen a aptitud para propuesta", () => {
  const s = scenario();
  s.merits.push(s.merit("ponencia"));
  s.vacancy.available = false;
  expect(s.run().outcome).toBe("sin_vacante");
  s.vacancy.available = true;
  s.vacancy.department = "Otro departamento";
  expect(s.run().vacancyMet).toBe(false);
});
test("principal exige doctorado, cinco años y tres investigaciones", () => {
  const {
    data
  } = seed();
  const req = data.requests[1],
    t = data.teachers[1],
    v = data.vacancies[1];
  const result = evaluate(t, data.merits, req, v, data.rubric, at);
  expect(result.outcome).toBe("apto");
  expect(result.score).toBe(84);
  const fewer = data.merits.filter(m => m.title !== "Análisis de datos académicos");
  expect(evaluate(t, fewer, req, v, data.rubric, at).outcome).toBe("no_apto");
});
test("calcula aniversarios completos, rechaza saltos de categoría", () => {
  expect(completedYears("2021-09-16", at)).toBe(4);
  expect(completedYears("2021-09-15", at)).toBe(5);
  expect(completedYears("2028-01-01", at)).toBe(0);
  const s = scenario();
  s.request.target = "Principal";
  expect(s.run().requirements[0].met).toBe(false);
});
test("registro, observación, corrección y verificación de un archivo", async () => {
  const file = new File([demoPdf("Prueba")], "prueba.pdf", {
    type: "application/pdf"
  });
  const input = {
    kind: "ponencia" as const,
    title: "Ponencia de prueba",
    institution: "Instituto de prueba",
    date: "2026-08-01"
  };
  await service.saveMerit(teacher, "t1", input, file);
  let data = await service.snapshot(teacher);
  const merit = data.merits[0];
  expect(merit.status).toBe("pendiente");
  await service.review(office, merit.id, "observado", "Corregir título de la evidencia.");
  await service.saveMerit(teacher, "t1", {
    ...input,
    title: "Ponencia corregida"
  }, file, merit.id);
  data = await service.snapshot(teacher);
  const corrected = data.merits.find(m => m.id === merit.id)!;
  expect(corrected.status).toBe("pendiente");
  expect(corrected.observation).toBe("");
  await service.review(commission, merit.id, "verificado", "");
  const stored = await service.document(teacher, corrected.fileId);
  expect(await stored.blob.text()).toContain("%PDF-1.4");
  await expect(service.saveMerit(teacher, "t1", input, file, merit.id)).rejects.toThrow("verificados");
});
test("solicitud observada se corrige y reenvía; cierre conserva historial", async () => {
  await service.observeRequest(office, "s1", "Revisar el documento de ponencia.");
  await service.saveRequest(teacher, "t1", "v1", "s1");
  await service.submit(teacher, "s1");
  const pending = (await service.snapshot(teacher)).merits.find(m => m.status === "pendiente")!;
  await expect(service.closeEvaluation(commission, "s1", "Evaluación de prueba")).rejects.toThrow("pendientes");
  await service.review(office, pending.id, "verificado", "");
  await service.closeEvaluation(commission, "s1", "Cumple requisitos, puntaje y plaza.");
  const first = (await service.snapshot(teacher)).evaluations[0];
  expect(first.score).toBe(56);
  expect(first.outcome).toBe("apto");
  const current = (await service.snapshot(teacher)).teachers[0];
  await service.saveTeacher(office, {
    ...current,
    name: "Nombre cambiado después"
  }, current.id);
  const nextCall = await service.saveCall(office, { name: "Segunda convocatoria", startsOn: "2026-09-01", endsOn: "2026-12-31", vacancyIds: ["v1"] });
  const nextRequest = await service.saveRequest(teacher, "t1", "v1", undefined, nextCall);
  await service.submit(teacher, nextRequest);
  await service.closeEvaluation(commission, nextRequest, "Segunda evaluación de demostración.");
  const after = await service.snapshot(teacher);
  expect(after.evaluations).toHaveLength(2);
  expect(after.evaluations.find(e => e.id === first.id)).toEqual(first);
  expect((await service.document(teacher, first.evidenceSnapshot[0].fileId)).blob.size).toBeGreaterThan(0);
  await expect(service.closeEvaluation(commission, "s1", "No duplicar resultado")).rejects.toThrow("cerrada");
});
test("validaciones de perfil, duplicados, fechas, tamaño y contenido", async () => {
  const current = (await service.snapshot(teacher)).teachers[0];
  await expect(service.saveTeacher(teacher, current, current.id)).rejects.toThrow("Solo personal");
  await expect(service.saveTeacher(office, current)).rejects.toThrow("correo");
  await expect(service.saveTeacher(office, {
    ...current,
    since: "2026-02-31"
  }, current.id)).rejects.toThrow("fecha");
  const input = {
    kind: "ponencia" as const,
    title: "Prueba inválida",
    institution: "Instituto",
    date: "2026-06-01"
  };
  await expect(service.saveMerit(teacher, "t2", input)).rejects.toThrow("perfil");
  await expect(service.saveMerit(teacher, "t1", input, new File(["mal"], "mal.pdf", {
    type: "application/pdf"
  }))).rejects.toThrow("contenido");
  await expect(service.saveMerit(teacher, "t1", input, new File([new Uint8Array(10 * 1024 * 1024 + 1)], "grande.pdf", {
    type: "application/pdf"
  }))).rejects.toThrow("10 MB");
  await expect(service.review(teacher, "m16", "verificado", "")).rejects.toThrow("propia");
  await expect(service.closeEvaluation(office, "s2", "Intento de cierre")).rejects.toThrow("Solo la comisión");
  await expect(service.document(teacher, "file-m4")).rejects.toThrow("accesible");
  await expect(service.saveRequest(teacher, "t1", "v1")).rejects.toThrow("abierta");
  await expect(service.saveRequest({
    ...teacher,
    teacherId: "t6"
  }, "t6", "v2")).rejects.toThrow("pertinente");
});
test("IndexedDB conserva registros y blobs; transacciones rechazan versiones antiguas", async () => {
  const before = (await browserRepositories.workspace.read())!;
  const changed = structuredClone(before);
  changed.revision++;
  changed.teachers[0].specialty = "Cambio persistido";
  await browserRepositories.workspace.commit(changed, before.revision);
  const reloadedService = new LegajoService(browserRepositories, seed, () => at);
  await reloadedService.initialize();
  expect((await reloadedService.snapshot(office)).teachers[0].specialty).toBe("Cambio persistido");
  expect(await (await reloadedService.document(teacher, "file-m1")).blob.text()).toContain("DOCUMENTO DE DEMOSTRACION");
  await expect(browserRepositories.workspace.commit(before, before.revision)).rejects.toThrow("otra pestaña");
  expect((await browserRepositories.workspace.read())!.revision).toBe(changed.revision);
});
test("restauración repone ejemplos y elimina archivos agregados", async () => {
  const file = new File([demoPdf("Temporal")], "temporal.pdf", {
    type: "application/pdf"
  });
  await service.saveMerit(teacher, "t1", {
    kind: "ponencia",
    title: "Temporal prueba",
    institution: "Instituto",
    date: "2026-08-01"
  }, file);
  const fileId = (await service.snapshot(teacher)).merits[0].fileId;
  await service.reset(office);
  expect((await service.snapshot(office)).merits).toHaveLength(seed().data.merits.length);
  expect(await browserRepositories.documents.get(fileId)).toBeUndefined();
  await expect(service.reset(teacher)).rejects.toThrow("Solo personal");
});
