export type Role = "docente" | "legajos" | "comision" | "decanato" | "consejo_facultad" | "consejo_universitario";
export type Category = "Auxiliar" | "Asociado" | "Principal";
export type MeritKind = "experiencia" | "titulo" | "maestria" | "doctorado" | "investigacion" | "ponencia" | "participacion" | "ratificacion";
export type ReviewStatus = "pendiente" | "verificado" | "observado";
export type RequestStatus = "borrador" | "presentada" | "observada" | "evaluada" | "no_presentada" | "propuesta" | "en_facultad" | "en_consejo" | "aprobada" | "denegada";
export interface Actor {
  role: Role;
  teacherId: string;
  userId?: string;
}
export interface Teacher {
  id: string;
  code: string;
  name: string;
  email: string;
  faculty: string;
  department: string;
  category: Category;
  dedication: "Tiempo completo" | "Dedicación exclusiva";
  since: string;
  specialty: string;
  createdAt: string;
  updatedAt: string;
}
export interface Merit {
  id: string;
  teacherId: string;
  kind: MeritKind;
  title: string;
  institution: string;
  date: string;
  fileId: string;
  fileName: string;
  status: ReviewStatus;
  observation: string;
  createdAt: string;
  updatedAt: string;
  reviewedBy?: Role;
}
export interface ApplicationRequest {
  callId: string;
  id: string;
  teacherId: string;
  target: Category;
  vacancyId: string;
  status: RequestStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}
export interface Vacancy {
  id: string;
  faculty: string;
  department: string;
  category: Category;
  dedication: Teacher["dedication"];
  available: boolean;
  label: string;
}
export interface Rubric {
  sources?: { criterion: string; reference: string; status: "simulacion" }[];
  requirements?: Record<"Asociado" | "Principal", { degree: "maestria" | "doctorado"; years: number; research: number; ratification: boolean }>;
  version: string;
  name: string;
  threshold: number;
  degrees: {
    maestria: number;
    doctorado: number;
  };
  experience: {
    perYear: number;
    max: number;
  };
  research: {
    unit: number;
    max: number;
  };
  talks: {
    unit: number;
    max: number;
  };
  attendance: {
    unit: number;
    max: number;
  };
}
export interface Requirement {
  label: string;
  met: boolean;
  detail: string;
}
export interface ScoreLine {
  label: string;
  score: number;
  cap: number;
  detail: string;
}
export interface Evaluation {
  callSnapshot?: PromotionCall;
  id: string;
  requestId: string;
  teacherId: string;
  createdAt: string;
  note: string;
  score: number;
  breakdown: ScoreLine[];
  requirements: Requirement[];
  vacancyMet: boolean;
  outcome: "apto" | "no_apto" | "sin_vacante";
  rubric: Rubric;
  teacherSnapshot: Teacher;
  evidenceSnapshot: Merit[];
  vacancySnapshot?: Vacancy;
  requestSnapshot: ApplicationRequest;
}
export interface AuditEntry {
  actorId?: string;
  actorName?: string;
  changes?: { collection: string; recordId: string; before?: unknown; after?: unknown }[];
  id: string;
  at: string;
  actor: Role;
  teacherId?: string;
  message: string;
}
export interface DocumentFile {
  id: string;
  name: string;
  type: string;
  blob: Blob;
}
export interface Workspace {
  schemaVersion: 1 | 2;
  calls: PromotionCall[];
  reviews: ReviewEvent[];
  experiences: Experience[];
  proposals: Proposal[];
  revision: number;
  teachers: Teacher[];
  merits: Merit[];
  requests: ApplicationRequest[];
  evaluations: Evaluation[];
  vacancies: Vacancy[];
  rubric: Rubric;
  audit: AuditEntry[];
}
export const kinds: Record<MeritKind, string> = {
  experiencia: "Constancia laboral",
  titulo: "Título profesional",
  maestria: "Grado de maestría",
  doctorado: "Grado de doctor",
  investigacion: "Investigación",
  ponencia: "Ponencia",
  participacion: "Participación académica",
  ratificacion: "Ratificación"
};
export const roleNames: Record<Role, string> = {
  docente: "Docente",
  legajos: "Personal de legajos",
  comision: "Comisión evaluadora",
  decanato: "Decanato",
  consejo_facultad: "Consejo de Facultad",
  consejo_universitario: "Consejo Universitario"
};
export const catalog: Record<string, string[]> = {
  "Ingeniería · Demo": ["Informática · Demo", "Industrial · Demo"],
  "Ciencias · Demo": ["Matemática · Demo", "Biología · Demo"],
  "Economía · Demo": ["Economía · Demo"]
};
export const nextCategory = (category: Category): Category | undefined => category === "Auxiliar" ? "Asociado" : category === "Asociado" ? "Principal" : undefined;
export const DEMO_RUBRIC: Rubric = {
  version: "DEMO-2026.2",
  sources: ["Grado académico", "Tiempo en categoría", "Investigaciones", "Ponencias", "Participaciones", "Requisitos", "Umbral"].map(criterion => ({
    criterion, reference: "Supuesto didáctico DEMO-2026.2; sin validación normativa. El umbral 55 es solo referencia.", status: "simulacion"
  })),
  requirements: {
    Asociado: { degree: "maestria", years: 3, research: 1, ratification: true },
    Principal: { degree: "doctorado", years: 5, research: 3, ratification: true }
  },
  name: "Rúbrica académica de ejemplo",
  threshold: 55,
  degrees: {
    maestria: 30,
    doctorado: 45
  },
  experience: {
    perYear: 3,
    max: 15
  },
  research: {
    unit: 8,
    max: 24
  },
  talks: {
    unit: 3,
    max: 12
  },
  attendance: {
    unit: 1,
    max: 4
  }
};
export interface Identity { id: string; name: string; role: Role }
export const demoUsers: Identity[] = [
  { id: "legajos-ana", name: "Ana Salas · Demo", role: "legajos" },
  { id: "legajos-luis", name: "Luis Pérez · Demo", role: "legajos" },
  { id: "comision-rosa", name: "Rosa Medina · Demo", role: "comision" },
  { id: "comision-pablo", name: "Pablo León · Demo", role: "comision" },
  { id: "decanato-elena", name: "Elena Soto · Demo", role: "decanato" },
  { id: "facultad-carlos", name: "Carlos Vera · Demo", role: "consejo_facultad" },
  { id: "consejo-irene", name: "Irene Díaz · Demo", role: "consejo_universitario" }
];
export interface PromotionCall {
  id: string; name: string; startsOn: string; endsOn: string;
  status: "abierta" | "evaluacion" | "cerrada";
  rubric: Rubric; vacancyIds: string[]; createdAt: string;
}
export interface ReviewEvent {
  id: string; meritId: string; teacherId: string; at: string;
  action: "revision" | "correccion" | "migracion";
  reviewer: Identity; note: string; before: Merit; after: Merit;
}
export interface Experience {
  id: string; teacherId: string; institution: string; position: string;
  startsOn: string; endsOn?: string; evidenceId: string; updatedAt: string;
}
export interface RankingRow {
  requestId: string; evaluationId: string; teacherId: string; name: string;
  score: number; outcome: Evaluation["outcome"]; position: number | null; tied: boolean;
}
export interface Proposal {
  id: string; requestId: string; evaluationId: string; teacherId: string;
  callId: string; vacancyId: string;
  status: "decanato" | "facultad" | "universitario" | "aprobada" | "denegada";
  report: string; createdAt: string; updatedAt: string;
  rankingSnapshot: RankingRow[];
  events: { at: string; actor: Identity; stage: Proposal["status"]; reference: string; note: string }[];
}
