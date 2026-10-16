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
export type RubricSource = "simulacion" | "oficial";
export interface Rubric {
  /** RF10 / CUS06 · Identidad y versionado de la rúbrica. El modelo relacional lo refleja en `rubrica`. */
  id?: string;
  estadoFuente?: RubricSource;
  fuenteNormativa?: string;
  aprobadaEn?: string;
  aprobadaPor?: string;
  createdAt?: string;
  updatedAt?: string;
  sources?: { criterion: string; reference: string; status: RubricSource }[];
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
  /** RF10 / CUS06 · Catálogo versionado de rúbricas. `rubric` conserva la versión vigente por compatibilidad. */
  rubrics?: Rubric[];
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
/** Casos de uso del sistema (§5 del Análisis v2.0) agrupados por rol. `route` es la pantalla del prototipo que los soporta. */
export interface RoleUseCase {
  code: string;
  name: string;
  route?: string;
  pending?: boolean;
}
export const roleUseCases: Record<Role, RoleUseCase[]> = {
  docente: [
    { code: "CUS02", name: "Registrar mérito y evidencia", route: "/legajos/:id" },
    { code: "CUS03", name: "Registrar trayectoria laboral", route: "/legajos/:id" },
    { code: "CUS05", name: "Corregir mérito observado", route: "/legajos/:id" },
    { code: "CUS09", name: "Presentar solicitud de promoción", route: "/solicitudes" },
    { code: "CUS16", name: "Consultar propuestas y decisiones", route: "/propuestas" },
    { code: "CUS17", name: "Consultar mi historial y auditoría", route: "/legajos/:id" }
  ],
  legajos: [
    { code: "CUS01", name: "Registrar y editar ficha del docente", route: "/docentes" },
    { code: "CUS02", name: "Registrar mérito y evidencia", route: "/legajos/:id" },
    { code: "CUS03", name: "Registrar trayectoria laboral", route: "/legajos/:id" },
    { code: "CUS04", name: "Verificar u observar mérito", route: "/revision" },
    { code: "CUS06", name: "Gestionar rúbrica y requisitos", route: "/rubrica" },
    { code: "CUS07", name: "Gestionar convocatoria y plazas", route: "/convocatorias" },
    { code: "CUS08", name: "Designar comisión evaluadora", pending: true },
    { code: "CUS10", name: "Observar y devolver solicitud", route: "/solicitudes" },
    { code: "CUS17", name: "Consultar historial y auditoría", route: "/docentes" }
  ],
  comision: [
    { code: "CUS04", name: "Verificar u observar mérito", route: "/revision" },
    { code: "CUS06", name: "Consultar rúbrica y requisitos", route: "/rubrica" },
    { code: "CUS10", name: "Observar y devolver solicitud", route: "/solicitudes" },
    { code: "CUS11", name: "Evaluar y cerrar evaluación", route: "/evaluaciones" },
    { code: "CUS12", name: "Consultar orden de mérito", route: "/orden-merito" },
    { code: "CUS17", name: "Consultar historial y auditoría", route: "/docentes" }
  ],
  decanato: [
    { code: "CUS12", name: "Consultar orden de mérito", route: "/orden-merito" },
    { code: "CUS13", name: "Preparar propuesta", route: "/orden-merito" },
    { code: "CUS14", name: "Remitir y elevar propuesta", route: "/propuestas" },
    { code: "CUS16", name: "Consultar propuestas y decisiones", route: "/propuestas" }
  ],
  consejo_facultad: [
    { code: "CUS14", name: "Remitir y elevar propuesta", route: "/propuestas" },
    { code: "CUS16", name: "Consultar propuestas y decisiones", route: "/propuestas" }
  ],
  consejo_universitario: [
    { code: "CUS15", name: "Registrar decisión", route: "/propuestas" },
    { code: "CUS16", name: "Consultar propuestas y decisiones", route: "/propuestas" }
  ]
};
export const catalog: Record<string, string[]> = {
  "Ingeniería · Demo": ["Informática · Demo", "Industrial · Demo"],
  "Ciencias · Demo": ["Matemática · Demo", "Biología · Demo"],
  "Economía · Demo": ["Economía · Demo"]
};
export const nextCategory = (category: Category): Category | undefined => category === "Auxiliar" ? "Asociado" : category === "Asociado" ? "Principal" : undefined;
export const DEMO_RUBRIC: Rubric = {
  version: "DEMO-2026.2",
  estadoFuente: "simulacion",
  fuenteNormativa: "Supuesto didáctico DEMO-2026.2; sin validación normativa.",
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
/** RF10 / RN09 · Versión inicial aprobada de la demostración. Al estar aprobada no se edita: se crea una nueva versión. */
export const DEMO_RUBRIC_ID = "rub-demo-2026-2";
export function approvedDemoRubric(at: string): Rubric {
  return {
    ...structuredClone(DEMO_RUBRIC),
    id: DEMO_RUBRIC_ID,
    aprobadaEn: at,
    aprobadaPor: "legajos-ana",
    createdAt: at,
    updatedAt: at
  };
}
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

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  teacherId?: string;
  userId?: string;
  faculty?: string;
  department?: string;
  category?: Category;
  avatarInitials: string;
}

export const INSTITUTIONAL_ACCOUNTS: AuthUser[] = [
  {
    id: "legajos-ana",
    userId: "legajos-ana",
    name: "Dra. Ana Salas Paredes",
    email: "asalas@unp.edu.pe",
    role: "legajos",
    avatarInitials: "AS",
    faculty: "Rectorado / URH",
    department: "Oficina Central de Legajos y Escalafón"
  },
  {
    id: "legajos-luis",
    userId: "legajos-luis",
    name: "Mg. Luis Pérez Gómez",
    email: "lperez@unp.edu.pe",
    role: "legajos",
    avatarInitials: "LP",
    faculty: "Rectorado / URH",
    department: "Oficina Central de Legajos y Escalafón"
  },
  {
    id: "comision-rosa",
    userId: "comision-rosa",
    name: "Dra. Rosa Medina Alvites",
    email: "rmedina@unp.edu.pe",
    role: "comision",
    avatarInitials: "RM",
    faculty: "Comisión Central UNP",
    department: "Comisión Evaluadora de Promoción"
  },
  {
    id: "comision-pablo",
    userId: "comision-pablo",
    name: "Dr. Pablo León Seminario",
    email: "pleon@unp.edu.pe",
    role: "comision",
    avatarInitials: "PL",
    faculty: "Comisión Central UNP",
    department: "Comisión Evaluadora de Promoción"
  },
  {
    id: "decanato-elena",
    userId: "decanato-elena",
    name: "Dra. Elena Soto Carrillo",
    email: "esoto@unp.edu.pe",
    role: "decanato",
    avatarInitials: "ES",
    faculty: "Ciencias · Demo",
    department: "Decanato de Facultad"
  },
  {
    id: "facultad-carlos",
    userId: "facultad-carlos",
    name: "Dr. Carlos Vera Mogollón",
    email: "cvera@unp.edu.pe",
    role: "consejo_facultad",
    avatarInitials: "CV",
    faculty: "Ciencias · Demo",
    department: "Consejo de Facultad"
  },
  {
    id: "consejo-irene",
    userId: "consejo-irene",
    name: "Dra. Irene Díaz Montenegro",
    email: "idiaz@unp.edu.pe",
    role: "consejo_universitario",
    avatarInitials: "ID",
    faculty: "Gobierno Central UNP",
    department: "Consejo Universitario"
  },
  {
    id: "t1",
    teacherId: "t1",
    name: "María Valeria Ríos",
    email: "mvrios@unp.edu.pe",
    role: "docente",
    avatarInitials: "MR",
    category: "Auxiliar",
    faculty: "Ingeniería · Demo",
    department: "Informática · Demo"
  },
  {
    id: "t2",
    teacherId: "t2",
    name: "Gabriel Torres Salazar",
    email: "gtorres@unp.edu.pe",
    role: "docente",
    avatarInitials: "GT",
    category: "Asociado",
    faculty: "Ciencias · Demo",
    department: "Matemática · Demo"
  },
  {
    id: "t3",
    teacherId: "t3",
    name: "Lucía Fernández Vega",
    email: "lfernandez@unp.edu.pe",
    role: "docente",
    avatarInitials: "LF",
    category: "Auxiliar",
    faculty: "Economía · Demo",
    department: "Economía · Demo"
  },
  {
    id: "t4",
    teacherId: "t4",
    name: "Diego Mendoza Ruiz",
    email: "dmendoza@unp.edu.pe",
    role: "docente",
    avatarInitials: "DM",
    category: "Asociado",
    faculty: "Ingeniería · Demo",
    department: "Industrial · Demo"
  },
  {
    id: "t5",
    teacherId: "t5",
    name: "Elena Castro Paredes",
    email: "ecastro@unp.edu.pe",
    role: "docente",
    avatarInitials: "EC",
    category: "Principal",
    faculty: "Ciencias · Demo",
    department: "Biología · Demo"
  },
  {
    id: "t6",
    teacherId: "t6",
    name: "Andrés Navarro León",
    email: "anavarro@unp.edu.pe",
    role: "docente",
    avatarInitials: "AN",
    category: "Auxiliar",
    faculty: "Ingeniería · Demo",
    department: "Informática · Demo"
  }
];
