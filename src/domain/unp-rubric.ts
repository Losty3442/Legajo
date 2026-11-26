import type { ApplicationRequest, CommissionScores, Merit, Rubric, ScoreLine } from "./models";

export const unpRubricUrl = "https://www.unp.edu.pe/transparenciaunp/download/reglamentos/regconcursopropladocentes.pdf";
export const unpRubricVersion = "UNP-0210-CU-2015-SIM-v1";

interface ManualCriterion {
  code: string;
  label: string;
  cap: number;
  rule: string;
  kinds?: Merit["kind"][];
}

interface UnpCriterion extends ManualCriterion {
  parts?: ManualCriterion[];
}

export const unpCriteria: UnpCriterion[] = [
  { code: "unp_grado", label: "Grados y títulos", cap: 23, rule: "Maestría 18; doctorado 23. Se considera el grado de mayor nivel." },
  { code: "unp_capacitacion", label: "Actualizaciones y capacitaciones", cap: 18, rule: "Dos subrubros con un máximo de 9 puntos cada uno.", parts: [
    { code: "eventos", label: "Participación en eventos académicos", cap: 9, kinds: ["ponencia", "participacion"], rule: "Asistencia 0,5; panel o moderación 1; ponencia 2; expositor docente 3 por semestre. Eventos de hasta cinco años; 0,5 adicional si fue en el extranjero o tuvo carácter internacional." },
    { code: "cursos", label: "Capacitación de nivel universitario", cap: 9, kinds: ["capacitacion", "diplomado"], rule: "Menos de 40 h: 0,2; de 40 h a tres meses: 0,5; de tres meses a menos de un año académico: 1; más de un año académico, incluidos diplomados: 2. Posterior al bachillerato y en la especialidad. Se suma 0,5 si se realizó en el extranjero y se cumple la acreditación indicada." },
  ] },
  { code: "unp_investigacion", label: "Investigación y materiales de enseñanza", cap: 20, kinds: ["investigacion", "material_ensenanza"], rule: "Investigaciones: una 5, dos 7, tres 10. Módulo 5, preparación de libro 7, tesis 5 y libro publicado 10. Se comprueba la acreditación y la fecha exigida por la tabla." },
  { code: "unp_idiomas", label: "Idiomas", cap: 6, kinds: ["idioma"], rule: "Por idioma distinto al materno: básico 2, intermedio 3, avanzado 4. Se acredita el nivel." },
  { code: "unp_cargos", label: "Cargos directivos o apoyo administrativo", cap: 6, kinds: ["organizacion_evento"], rule: "Un punto por participación como directivo u organizador de un evento académico." },
  { code: "unp_aptitud", label: "Clase magistral y entrevista", cap: 15, rule: "La comisión califica los cinco componentes del rubro.", parts: [
    {code: "auditorio", label: "Presentación y dominio del auditorio", cap: 2, rule: "Calificación de la clase magistral."},
    {code: "asignatura", label: "Dominio de la asignatura", cap: 3, rule: "Calificación de la clase magistral."},
    {code: "respuestas", label: "Respuestas al jurado", cap: 4, rule: "Calificación de la clase magistral."},
    {code: "recursos", label: "Recursos didácticos", cap: 3, rule: "Calificación de la clase magistral."},
    {code: "entrevista", label: "Entrevista personal", cap: 3, rule: "Calificación de la entrevista."},
  ] },
  { code: "unp_proyeccion", label: "Proyección social", cap: 3, kinds: ["proyeccion_social"], rule: "Un punto por actividad acreditada." },
  { code: "unp_docencia", label: "Experiencia docente", cap: 6, kinds: ["experiencia"], rule: "Puntaje sustentado por la comisión. La tabla indica el máximo del rubro." },
  { code: "unp_profesion", label: "Ejercicio profesional", cap: 3, kinds: ["experiencia"], rule: "Puntaje sustentado por la comisión. La tabla indica el máximo del rubro." },
];

export const unpManualCriteria = unpCriteria.slice(1).flatMap(row => row.parts ?? [row]);

export function unpSimulationRubric(requirements: NonNullable<Rubric["requirements"]>): Rubric {
  return {
    id: "rub-unp-0210-cu-2015-sim-v1",
    profile: "unp-concurso-plazas-v1",
    version: unpRubricVersion,
    name: "Tabla UNP para provisión de plazas docentes",
    estadoFuente: "simulacion",
    fuenteNormativa: unpRubricUrl,
    threshold: 55,
    degrees: {maestria: 18, doctorado: 23},
    experience: {perYear: 0, max: 0},
    research: {unit: 0, max: 0},
    talks: {unit: 0, max: 0},
    attendance: {unit: 0, max: 0},
    requirements: structuredClone(requirements),
    sources: [
      ...unpCriteria.map(row => ({criterion: row.label, reference: "Resolución 0210-CU-2015, tabla de calificaciones en págs. 7–8.", status: "simulacion" as const})),
      {criterion: "Umbral", reference: "Art. 41 del reglamento de concurso, mínimo para Auxiliar aplicado como referencia local.", status: "simulacion"},
      {criterion: "Condiciones por categoría", reference: "Condiciones de promoción configuradas en el simulador.", status: "simulacion"},
    ],
  };
}

export function matchesUnpCriterion(criterion: ManualCriterion, merit: Merit, request: ApplicationRequest) {
  if (!criterion.kinds?.includes(merit.kind)) return false;
  if (criterion.code !== "eventos" || !request.submittedAt) return true;
  const submission = new Date(request.submittedAt);
  const lastDay = submission.toISOString().slice(0, 10);
  const anniversary = new Date(submission);
  anniversary.setUTCFullYear(submission.getUTCFullYear() - 5);
  return merit.date >= anniversary.toISOString().slice(0, 10) && merit.date <= lastDay;
}

export function unpDegree(verified: Merit[], rubric: Rubric) {
  const best = (kind: Merit["kind"]) => verified.find(m => m.kind === kind && !m.siged && !m.institutionalSource) ?? verified.find(m => m.kind === kind);
  const merit = best("doctorado") ?? best("maestria");
  const score = merit?.kind === "doctorado" ? rubric.degrees.doctorado : merit ? rubric.degrees.maestria : 0;
  return { merit, score };
}

export function unpBreakdown(verified: Merit[], rubric: Rubric, grades?: CommissionScores): ScoreLine[] {
  const { score, merit } = unpDegree(verified, rubric);
  return unpCriteria.map((criterion, index) => {
    const { code, label, cap } = criterion;
    if (index === 0) return { code, label, cap, score, detail: merit?.title ?? "Sin maestría o doctorado verificado", evidenceIds: merit ? [merit.id] : [] };
    if (!grades) return { code, label, cap, score: 0, detail: "Pendiente de calificación de la comisión" };
    const parts = criterion.parts ?? [criterion];
    return { code, label, cap,
      score: Math.round(parts.reduce((sum, part) => sum + grades[part.code].score, 0) * 100) / 100,
      detail: parts.map(part => `${part.label} (${grades[part.code].score}/${part.cap}) · ${grades[part.code].detail}`).join(" · "),
      evidenceIds: [...new Set(parts.flatMap(part => grades[part.code].evidenceIds))],
    };
  });
}
