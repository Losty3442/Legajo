import { test, expect } from "@playwright/test";
import "fake-indexeddb/auto";
import { LegajoService, type RubricInput } from "../src/application/service";
import { browserRepositories } from "../src/infrastructure/indexeddb";
import { seed } from "../src/infrastructure/seed";
import type { Actor } from "../src/domain/models";

const at = "2026-09-15T12:00:00.000Z";
const office: Actor = { role: "legajos", teacherId: "t1", userId: "legajos-ana" };
const commission: Actor = { role: "comision", teacherId: "t1", userId: "comision-rosa" };
const teacher: Actor = { role: "docente", teacherId: "t1" };
const service = new LegajoService(browserRepositories, seed, () => at);
test.beforeEach(async () => { await service.reset(office); });

function draft(overrides: Partial<RubricInput> = {}): RubricInput {
  return {
    version: "DEMO-2027.1",
    name: "Rúbrica 2027 de simulación",
    estadoFuente: "simulacion",
    fuenteNormativa: "Acuerdo de prueba, sin validación institucional.",
    threshold: 55,
    degrees: { maestria: 30, doctorado: 45 },
    experience: { perYear: 3, max: 15 },
    research: { unit: 8, max: 24 },
    talks: { unit: 3, max: 12 },
    attendance: { unit: 1, max: 4 },
    requirements: {
      Asociado: { degree: "maestria", years: 3, research: 1, ratification: true },
      Principal: { degree: "doctorado", years: 5, research: 3, ratification: true }
    },
    ...overrides
  };
}

test("la rúbrica inicial está aprobada y no se puede editar (RN09)", async () => {
  const data = await service.snapshot(office);
  expect(data.rubrics).toHaveLength(1);
  const initial = data.rubrics![0];
  expect(initial.aprobadaEn).toBeTruthy();
  expect(initial.estadoFuente).toBe("simulacion");
  expect(data.rubric.id).toBe(initial.id);
  await expect(service.saveRubric(office, draft(), initial.id)).rejects.toThrow("aprobada no se modifica");
  await expect(service.approveRubric(office, initial.id!)).rejects.toThrow("ya está aprobada");
});

test("crear, editar y aprobar una nueva versión la fija como vigente", async () => {
  const id = await service.saveRubric(office, draft());
  let data = await service.snapshot(office);
  const created = data.rubrics!.find(r => r.id === id)!;
  expect(created.aprobadaEn).toBeUndefined();
  expect(created.sources?.every(s => s.status === "simulacion")).toBe(true);
  expect(created.sources?.some(s => s.reference.includes("Acuerdo de prueba"))).toBe(true);

  await service.saveRubric(office, draft({ name: "Rúbrica 2027 revisada", threshold: 60 }), id);
  data = await service.snapshot(office);
  expect(data.rubrics!.find(r => r.id === id)!.threshold).toBe(60);

  await service.approveRubric(office, id);
  data = await service.snapshot(office);
  expect(data.rubric.id).toBe(id);
  expect(data.rubrics!.find(r => r.id === id)!.aprobadaPor).toBe("legajos-ana");
  await expect(service.saveRubric(office, draft({ threshold: 40 }), id)).rejects.toThrow("aprobada no se modifica");
});

test("la convocatoria solo aplica una rúbrica aprobada y la congela", async () => {
  const draftId = await service.saveRubric(office, draft());
  await expect(service.saveCall(office, { name: "Con borrador", startsOn: "2026-01-01", endsOn: "2026-12-31", vacancyIds: ["v1"], rubricId: draftId })).rejects.toThrow("rúbrica aprobada");

  const callId = await service.saveCall(office, { name: "Con aprobada vigente", startsOn: "2026-01-01", endsOn: "2026-12-31", vacancyIds: ["v1"] });
  expect((await service.snapshot(office)).calls.find(c => c.id === callId)!.rubric.aprobadaEn).toBeTruthy();

  await service.approveRubric(office, draftId);
  const second = await service.saveCall(office, { name: "Con nueva vigente", startsOn: "2026-01-01", endsOn: "2026-12-31", vacancyIds: ["v1"], rubricId: draftId });
  expect((await service.snapshot(office)).calls.find(c => c.id === second)!.rubric.version).toBe("DEMO-2027.1");
});

test("rechaza versiones duplicadas y topes inconsistentes", async () => {
  await expect(service.saveRubric(office, draft({ version: "DEMO-2026.2" }))).rejects.toThrow("esa versión");
  await expect(service.saveRubric(office, draft({ degrees: { maestria: 30, doctorado: 90 } }))).rejects.toThrow("100");
  await expect(service.saveRubric(office, draft({
    threshold: 100, degrees: { maestria: 10, doctorado: 20 }, experience: { perYear: 1, max: 5 },
    research: { unit: 1, max: 5 }, talks: { unit: 1, max: 5 }, attendance: { unit: 1, max: 5 }
  }))).rejects.toThrow("umbral");
  await expect(service.saveRubric(office, draft({ degrees: { maestria: 50, doctorado: 40 } }))).rejects.toThrow("doctorado");
  await expect(service.saveRubric(office, draft({ version: "x" }))).rejects.toThrow("versión");
});

test("solo legajos gestiona y aprueba rúbricas; el docente solo ve las aprobadas", async () => {
  await expect(service.saveRubric(commission, draft())).rejects.toThrow("Solo personal de legajos");
  const id = await service.saveRubric(office, draft());
  await expect(service.approveRubric(commission, id)).rejects.toThrow("Solo personal de legajos");
  const visible = (await service.snapshot(teacher)).rubrics ?? [];
  expect(visible.length).toBeGreaterThan(0);
  expect(visible.every(r => r.aprobadaEn)).toBe(true);
  expect((await service.snapshot(office)).rubrics).toHaveLength(2);
});
