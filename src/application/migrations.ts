import { DEMO_RUBRIC, type Workspace } from "../domain/models";

/** Preserve closed evaluations and blobs byte-for-byte; missing historical identities stay unknown. */
export function migrateWorkspace(previous: Workspace, at: string): Workspace {
  if (previous.schemaVersion === 2) return previous;
  const data = structuredClone(previous);
  data.schemaVersion = 2;
  data.calls = [{
    id: "convocatoria-legada", name: "Convocatoria heredada · Demo",
    startsOn: "2000-01-01", endsOn: "2099-12-31", status: "abierta",
    rubric: { ...structuredClone(data.rubric), requirements: structuredClone(DEMO_RUBRIC.requirements),
      sources: [{ criterion: "Todos los criterios", reference: "Reglas del prototipo anterior, sin fuente normativa validada.", status: "simulacion" }] },
    vacancyIds: data.vacancies.map(v => v.id), createdAt: at
  }];
  const assigned = new Set<string>();
  const requests = [...data.requests].sort((a, b) =>
    Number(a.status === "evaluada") - Number(b.status === "evaluada") || b.createdAt.localeCompare(a.createdAt));
  requests.forEach(r => {
    if (!assigned.has(r.teacherId)) {
      r.callId = "convocatoria-legada";
      assigned.add(r.teacherId);
      return;
    }
    // v1 allowed repeated applications without a call. Never rank one person against themself.
    r.callId = "legacy-history-" + r.id;
    data.calls.push({ ...structuredClone(data.calls[0]), id: r.callId,
      name: "Histórico heredado · " + r.id, status: "cerrada", vacancyIds: [r.vacancyId] });
  });
  data.rubric = structuredClone(DEMO_RUBRIC);
  data.experiences = [];
  data.proposals = [];
  data.reviews = data.merits.filter(m => m.status !== "pendiente").map(m => ({
    id: "legacy-review-" + m.id, meritId: m.id, teacherId: m.teacherId, at: m.updatedAt,
    action: "migracion", reviewer: { id: "legacy-unknown", name: "Responsable no registrado en la versión anterior", role: m.reviewedBy ?? "legajos" },
    note: m.observation || "Estado heredado; no se dispone de la revisión original.",
    before: structuredClone(m), after: structuredClone(m)
  }));
  data.revision++;
  data.audit.unshift({ id: "migration-v2", at, actor: "legajos", actorId: "system-migration",
    actorName: "Migración automática", message: "Actualización a versión 2: se conservan registros, archivos y evaluaciones anteriores. No se reconstruye información histórica inexistente." });
  return data;
}
