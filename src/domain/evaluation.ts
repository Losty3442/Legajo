import type { ApplicationRequest, Evaluation, Merit, Rubric, Teacher, Vacancy } from "./models";
import { nextCategory } from "./models";
export function completedYears(since: string, at: string): number {
  const a = new Date(since + "T12:00:00Z"),
    b = new Date(at);
  if (!Number.isFinite(+a) || !Number.isFinite(+b) || +a > +b) return 0;
  return Math.max(0, b.getUTCFullYear() - a.getUTCFullYear() - (b.getUTCMonth() < a.getUTCMonth() || b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate() ? 1 : 0));
}
export function evaluate(teacher: Teacher, merits: Merit[], request: ApplicationRequest, vacancy: Vacancy | undefined, rubric: Rubric, at: string): Omit<Evaluation, "id" | "note"> {
  const verified = merits.filter(m => m.teacherId === teacher.id && m.status === "verificado" && m.date <= at.slice(0, 10));
  const count = (kind: Merit["kind"]) => verified.filter(m => m.kind === kind).length;
  const phd = count("doctorado") > 0,
    master = count("maestria") > 0;
  const years = completedYears(teacher.since, at);
  const principal = request.target === "Principal";
  const rules = rubric.requirements?.[principal ? "Principal" : "Asociado"];
  if (!rules) throw new Error("La rúbrica no tiene requisitos versionados para evaluar.");
  const requiredYears = rules.years;
  const researches = count("investigacion");
  const breakdown = [{
    label: "Grado académico",
    score: phd ? rubric.degrees.doctorado : master ? rubric.degrees.maestria : 0,
    cap: Math.max(rubric.degrees.maestria, rubric.degrees.doctorado),
    detail: "Solo el grado más alto verificado"
  }, {
    label: "Tiempo en categoría",
    score: Math.min(years * rubric.experience.perYear, rubric.experience.max),
    cap: rubric.experience.max,
    detail: years + " años completos"
  }, {
    label: "Investigaciones",
    score: Math.min(researches * rubric.research.unit, rubric.research.max),
    cap: rubric.research.max,
    detail: researches + " evidencias verificadas"
  }, {
    label: "Ponencias",
    score: Math.min(count("ponencia") * rubric.talks.unit, rubric.talks.max),
    cap: rubric.talks.max,
    detail: count("ponencia") + " evidencias verificadas"
  }, {
    label: "Participaciones",
    score: Math.min(count("participacion") * rubric.attendance.unit, rubric.attendance.max),
    cap: rubric.attendance.max,
    detail: count("participacion") + " evidencias verificadas"
  }];
  const requirements = [{
    label: "Categoría inmediata superior",
    met: nextCategory(teacher.category) === request.target,
    detail: teacher.category + " → " + request.target
  }, {
    label: rules.degree === "doctorado" ? "Doctorado acreditado" : "Maestría o doctorado acreditado",
    met: rules.degree === "doctorado" ? phd : master || phd,
    detail: "Grado con documento verificado"
  }, {
    label: "Antigüedad mínima de ejemplo",
    met: years >= requiredYears,
    detail: years + " de " + requiredYears + " años"
  }, {
    label: "Investigación acreditada",
    met: researches >= rules.research,
    detail: researches + " de " + rules.research + " investigaciones"
  }, {
    label: "Ratificación acreditada",
    met: !rules.ratification || count("ratificacion") > 0,
    detail: "Documento de ratificación verificado"
  }];
  const vacancyMet = Boolean(vacancy?.available && vacancy.faculty === teacher.faculty && vacancy.department === teacher.department && vacancy.category === request.target && vacancy.dedication === teacher.dedication);
  const score = breakdown.reduce((a, b) => a + b.score, 0);
  const qualified = score >= rubric.threshold && requirements.every(r => r.met);
  return {
    requestId: request.id,
    teacherId: teacher.id,
    createdAt: at,
    score,
    breakdown,
    requirements,
    vacancyMet,
    outcome: !qualified ? "no_apto" : vacancyMet ? "apto" : "sin_vacante",
    rubric: structuredClone(rubric),
    teacherSnapshot: structuredClone(teacher),
    evidenceSnapshot: structuredClone(verified),
    requestSnapshot: structuredClone(request),
    vacancySnapshot: vacancy ? structuredClone(vacancy) : undefined
  };
}
