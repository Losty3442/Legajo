import { DEMO_RUBRIC } from "../domain/models";
import type { Workspace, Teacher, Merit, DocumentFile, Vacancy } from "../domain/models";
export function demoPdf(title: string): Blob {
  const clean = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/[()\\]/g, " ").slice(0, 76);
  const stream = "BT /F1 20 Tf 50 740 Td (UNP - DOCUMENTO DE DEMOSTRACION) Tj 0 -55 Td /F1 13 Tf (" + clean + ") Tj 0 -35 Td (Datos ficticios. Sin validez institucional.) Tj 0 -30 Td (Ejemplo para el sistema de legajo y promocion docente.) Tj ET";
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream"];
  let out = "%PDF-1.4\n";
  const offsets = [0];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += i + 1 + " 0 obj\n" + o + "\nendobj\n";
  });
  const start = out.length;
  out += "xref\n0 6\n0000000000 65535 f \n" + offsets.slice(1).map(n => String(n).padStart(10, "0") + " 00000 n \n").join("") + "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + start + "\n%%EOF";
  return new Blob([out], {
    type: "application/pdf"
  });
}
export function seed(): {
  data: Workspace;
  documents: DocumentFile[];
} {
  const date = "2026-09-01T10:00:00.000Z";
  const people = [["t1", "María Valeria Ríos", "Ingeniería · Demo", "Informática · Demo", "Auxiliar", "2021-03-01", "Sistemas de información"], ["t2", "Gabriel Torres Salazar", "Ciencias · Demo", "Matemática · Demo", "Asociado", "2019-04-15", "Matemática aplicada"], ["t3", "Lucía Fernández Vega", "Economía · Demo", "Economía · Demo", "Auxiliar", "2024-02-01", "Economía pública"], ["t4", "Diego Mendoza Ruiz", "Ingeniería · Demo", "Industrial · Demo", "Asociado", "2020-03-01", "Gestión de procesos"], ["t5", "Elena Castro Paredes", "Ciencias · Demo", "Biología · Demo", "Principal", "2017-04-01", "Biología ambiental"], ["t6", "Andrés Navarro León", "Ingeniería · Demo", "Informática · Demo", "Auxiliar", "2022-03-01", "Ingeniería de software"]];
  const teachers = people.map((p, i) => ({
    id: p[0],
    code: "DOC-" + String(i + 1).padStart(3, "0"),
    name: p[1],
    email: "docente" + (i + 1) + "@ejemplo.test",
    faculty: p[2],
    department: p[3],
    category: p[4],
    since: p[5],
    specialty: p[6],
    dedication: "Tiempo completo",
    createdAt: date,
    updatedAt: date
  })) as Teacher[];
  const merits: Merit[] = [];
  const documents: DocumentFile[] = [];
  function add(t: string, kind: Merit["kind"], title: string, status: Merit["status"] = "verificado") {
    const id = "m" + (merits.length + 1),
      fileId = "file-" + id;
    merits.push({
      id,
      teacherId: t,
      kind,
      title,
      institution: "Institución académica de ejemplo",
      date: "2026-06-15",
      fileId,
      fileName: title + ".pdf",
      status,
      observation: status === "observado" ? "Adjuntar un documento legible con la fecha del evento." : "",
      createdAt: date,
      updatedAt: date
    });
    documents.push({
      id: fileId,
      name: title + ".pdf",
      type: "application/pdf",
      blob: demoPdf(title)
    });
  }
  for (const id of ["t1", "t2", "t4", "t5", "t6"]) {
    add(id, id === "t2" || id === "t4" || id === "t5" ? "doctorado" : "maestria", id === "t2" || id === "t4" || id === "t5" ? "Grado de doctor" : "Grado de maestro");
    add(id, "ratificacion", "Constancia de ratificación");
    add(id, "investigacion", "Investigación aplicada 2026");
  }
  add("t1", "ponencia", "Transformación digital en la universidad", "pendiente");
  add("t1", "participacion", "Seminario de innovación educativa", "observado");
  add("t2", "investigacion", "Modelos matemáticos de aprendizaje");
  add("t2", "investigacion", "Análisis de datos académicos");
  add("t3", "maestria", "Diploma de maestría", "pendiente");
  add("t3", "ponencia", "Encuentro de economía regional", "pendiente");
  add("t4", "investigacion", "Optimización de procesos");
  add("t4", "investigacion", "Productividad sostenible");
  add("t6", "participacion", "Congreso de ingeniería de software", "pendiente");
  const vacancies: Vacancy[] = [{
    id: "v1",
    faculty: teachers[0].faculty,
    department: teachers[0].department,
    category: "Asociado",
    dedication: "Tiempo completo",
    available: true,
    label: "PL-001 · Asociado / Informática"
  }, {
    id: "v2",
    faculty: teachers[1].faculty,
    department: teachers[1].department,
    category: "Principal",
    dedication: "Tiempo completo",
    available: true,
    label: "PL-002 · Principal / Matemática"
  }, {
    id: "v3",
    faculty: teachers[2].faculty,
    department: teachers[2].department,
    category: "Asociado",
    dedication: "Tiempo completo",
    available: true,
    label: "PL-003 · Asociado / Economía"
  }, {
    id: "v4",
    faculty: teachers[3].faculty,
    department: teachers[3].department,
    category: "Principal",
    dedication: "Tiempo completo",
    available: false,
    label: "PL-004 · Principal / Industrial"
  }];
  return {
    data: {
      schemaVersion: 2,
      calls: [{ id: "c2026", name: "Promoción docente 2026 · Demo", startsOn: "2026-01-01", endsOn: "2026-12-31", status: "abierta", rubric: structuredClone(DEMO_RUBRIC), vacancyIds: vacancies.map(v => v.id), createdAt: date }],
      reviews: merits.filter(m => m.status !== "pendiente").map(m => ({
        id: "seed-review-" + m.id, meritId: m.id, teacherId: m.teacherId, at: date, action: "revision",
        reviewer: { id: "seed", name: "Registro inicial de ejemplo", role: "legajos" },
        note: m.observation || "Documento verificado del conjunto ficticio inicial.",
        before: structuredClone(m), after: structuredClone(m)
      })),
      experiences: [],
      proposals: [],
      revision: 0,
      teachers,
      merits,
      vacancies,
      evaluations: [],
      requests: [{
        id: "s1",
        callId: "c2026",
        teacherId: "t1",
        target: "Asociado",
        vacancyId: "v1",
        status: "presentada",
        note: "",
        createdAt: date,
        updatedAt: date,
        submittedAt: date
      }, {
        id: "s2",
        callId: "c2026",
        teacherId: "t2",
        target: "Principal",
        vacancyId: "v2",
        status: "presentada",
        note: "",
        createdAt: date,
        updatedAt: date,
        submittedAt: date
      }, {
        id: "s3",
        callId: "c2026",
        teacherId: "t3",
        target: "Asociado",
        vacancyId: "v3",
        status: "borrador",
        note: "",
        createdAt: date,
        updatedAt: date
      }, {
        id: "s4",
        callId: "c2026",
        teacherId: "t4",
        target: "Principal",
        vacancyId: "v4",
        status: "presentada",
        note: "",
        createdAt: date,
        updatedAt: date,
        submittedAt: date
      }],
      rubric: structuredClone(DEMO_RUBRIC),
      audit: [{
        id: "a1",
        at: date,
        actor: "legajos",
        message: "Demostración inicializada con datos y documentos ficticios."
      }]
    },
    documents
  };
}
