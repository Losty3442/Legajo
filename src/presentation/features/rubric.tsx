"use client";

import { useState } from "react";
import { Plus, Pencil, CheckCheck, ShieldCheck, ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "../provider";
import { legajoService } from "../../composition";
import { rubricSchema, type RubricInput } from "../../application/service";
import type { Rubric as RubricModel } from "../../domain/models";
import { PageHeader, SectionTitle, Status, Field, FilterSelect, RecordDialog, Confirm, DataTable, TableCell, TableRow, dateLabel } from "../components/common";

const rubricsOf = (data: { rubric: RubricModel; rubrics?: RubricModel[] }) => data.rubrics?.length ? data.rubrics : [data.rubric];
const maxOf = (r: RubricModel) => r.degrees.doctorado + r.experience.max + r.research.max + r.talks.max + r.attendance.max;
const criteriaOf = (r: RubricModel): [string, string, string][] => [
  ["Grado académico", `Maestría ${r.degrees.maestria} puntos; doctorado ${r.degrees.doctorado}. Solo el más alto.`, String(r.degrees.doctorado)],
  ["Tiempo en categoría", `${r.experience.perYear} puntos por año completo.`, String(r.experience.max)],
  ["Investigación", `${r.research.unit} puntos por evidencia verificada.`, String(r.research.max)],
  ["Ponencia", `${r.talks.unit} puntos por evidencia verificada.`, String(r.talks.max)],
  ["Participación", `${r.attendance.unit} punto(s) por evidencia verificada.`, String(r.attendance.max)]
];

/** RF10 / CUS06 · Gestiona rúbricas versionadas; una rúbrica aprobada no se modifica (RN09). */
export function Rubric() {
  const { data, actor, busy, execute } = useWorkspace();
  const [form, setForm] = useState<{ base?: RubricModel; edit: boolean }>();
  const [approve, setApprove] = useState<RubricModel>();
  if (!data) return null;
  const rubrics = rubricsOf(data);
  const canManage = actor.role === "legajos";
  return <>
    <PageHeader eyebrow="REGLAS DE LA SIMULACIÓN" title="Rúbricas y requisitos"
      description="Versiones de la rúbrica con criterios, topes y condiciones por categoría destino. Una rúbrica aprobada no se modifica: se crea una nueva versión (RN09)."
      action={canManage && <Button onClick={() => setForm({ edit: false })}><Plus />Nueva versión</Button>} />
    <div className="simulation-notice"><ShieldCheck size={20} /><p><b>Simulación académica.</b> Los criterios son ficticios. Valida el anexo oficial antes de conectar este sistema a un proceso real.</p></div>
    <div className="space-y-5">
      {rubrics.map(r => <RubricPanel key={r.id ?? r.version} r={r} vigente={!!r.id && r.id === data.rubric.id} canManage={canManage} busy={busy}
        onEdit={() => setForm({ base: r, edit: true })} onNewVersion={() => setForm({ base: r, edit: false })} onApprove={() => setApprove(r)} />)}
      {!rubrics.length && <div className="notice inside"><ClipboardCheck /><p>No hay rúbricas registradas. Crea una versión para configurar los criterios de la simulación.</p></div>}
    </div>
    {form && <RubricForm base={form.base} edit={form.edit} onClose={() => setForm(undefined)} />}
    <Confirm open={!!approve} onClose={() => setApprove(undefined)} title="¿Aprobar esta rúbrica?"
      description="Al aprobarla queda fijada como regla vigente y no podrá editarse: cualquier cambio exigirá una nueva versión (RN09)."
      onConfirm={() => { if (approve?.id) void execute(() => legajoService.approveRubric(actor, approve.id!), "Rúbrica aprobada"); setApprove(undefined); }} />
  </>;
}

function RubricPanel({ r, vigente, canManage, busy, onEdit, onNewVersion, onApprove }: {
  r: RubricModel;
  vigente: boolean;
  canManage: boolean;
  busy: boolean;
  onEdit: () => void;
  onNewVersion: () => void;
  onApprove: () => void;
}) {
  const requirements = r.requirements;
  return <section className="panel padded">
    <div className="section-title"><h2>{r.name}</h2><Status value={r.aprobadaEn ? "aprobada" : "borrador"} /></div>
    <p className="muted-copy">{r.version} · {r.estadoFuente === "oficial" ? "Fuente oficial" : "Fuente de simulación"} · {r.aprobadaEn ? "Aprobada el " + dateLabel(r.aprobadaEn) : "Borrador sin aprobar"}{vigente ? " · Regla vigente" : ""}</p>
    <div className="two-columns">
      <section className="panel">
        <SectionTitle title="Criterios de puntuación" />
        <DataTable headers={["Criterio", "Regla", "Tope"]}>{criteriaOf(r).map(([criterion, rule, cap]) => <TableRow key={criterion}><TableCell><strong>{criterion}</strong></TableCell><TableCell>{rule}</TableCell><TableCell>{cap}</TableCell></TableRow>)}</DataTable>
        <div className="table-footer">Máximo: {maxOf(r)} · Umbral de referencia: {r.threshold} · Sin redondeo</div>
      </section>
      <section className="panel padded">
        <SectionTitle title="Condiciones por categoría" />
        {requirements ? (["Asociado", "Principal"] as const).map(category => {
          const rule = requirements[category];
          return <div className="rubric-requirement" key={category}><ClipboardCheck /><div><h3>Para {category.toLowerCase()}</h3><p>{rule.degree === "doctorado" ? "Doctorado" : "Maestría"} verificado, {rule.years} año(s) en categoría, {rule.research} investigación(es){rule.ratification ? " y ratificación acreditada" : " (sin ratificación exigida)"}.</p></div></div>;
        }) : <p className="muted-copy">Esta versión no declara condiciones adicionales.</p>}
        <div className="notice"><b>Plaza pertinente</b><p>Debe coincidir en facultad, departamento, categoría destino y dedicación.</p></div>
      </section>
    </div>
    <details className="history-details"><summary>Fuentes y versionado</summary>
      {r.sources?.length ? r.sources.map(s => <p key={s.criterion}><b>{s.criterion}:</b> {s.reference}</p>) : <p>Sin fuente registrada por criterio.</p>}
      {r.fuenteNormativa && <p><b>Norma de referencia:</b> {r.fuenteNormativa}</p>}
      <p>Estado de fuente: {r.estadoFuente === "oficial" ? "oficial" : "simulación"}{r.aprobadaPor ? " · Aprobada por " + r.aprobadaPor : ""}{r.updatedAt ? " · Última edición " + dateLabel(r.updatedAt) : ""}.</p>
    </details>
    {canManage && <div className="row-actions mt-4">
      {r.aprobadaEn
        ? <Button variant="outline" onClick={onNewVersion}><Plus size={16} />Crear nueva versión</Button>
        : <><Button variant="outline" onClick={onEdit}><Pencil size={16} />Editar borrador</Button><Button disabled={busy} onClick={onApprove}><CheckCheck />Aprobar</Button></>}
    </div>}
  </section>;
}

const toNumber = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").replace(",", ".").trim();
  return text === "" ? Number.NaN : Number(text);
};
function suggestVersion(rubrics: RubricModel[], from: string) {
  let i = 2;
  while (rubrics.some(r => r.version === from + "-v" + i)) i++;
  return from + "-v" + i;
}

function RubricForm({ base, edit, onClose }: { base?: RubricModel; edit: boolean; onClose: () => void }) {
  const { data, actor, busy, execute } = useWorkspace();
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [estadoFuente, setEstadoFuente] = useState<"simulacion" | "oficial">(base?.estadoFuente ?? "simulacion");
  const [associateDegree, setAssociateDegree] = useState<"maestria" | "doctorado">(base?.requirements?.Asociado.degree ?? "maestria");
  const [principalDegree, setPrincipalDegree] = useState<"maestria" | "doctorado">(base?.requirements?.Principal.degree ?? "doctorado");
  if (!data) return null;
  const source = base ?? data.rubric;
  const requirements = source.requirements;
  const version = edit ? source.version : suggestVersion(rubricsOf(data), source.version);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    const input: RubricInput = {
      version: String(fields.get("version") ?? "").trim(),
      name: String(fields.get("name") ?? "").trim(),
      estadoFuente,
      fuenteNormativa: String(fields.get("fuenteNormativa") ?? "").trim(),
      threshold: toNumber(fields.get("threshold")),
      degrees: { maestria: toNumber(fields.get("degrees.maestria")), doctorado: toNumber(fields.get("degrees.doctorado")) },
      experience: { perYear: toNumber(fields.get("experience.perYear")), max: toNumber(fields.get("experience.max")) },
      research: { unit: toNumber(fields.get("research.unit")), max: toNumber(fields.get("research.max")) },
      talks: { unit: toNumber(fields.get("talks.unit")), max: toNumber(fields.get("talks.max")) },
      attendance: { unit: toNumber(fields.get("attendance.unit")), max: toNumber(fields.get("attendance.max")) },
      requirements: {
        Asociado: { degree: associateDegree, years: toNumber(fields.get("requirements.Asociado.years")), research: toNumber(fields.get("requirements.Asociado.research")), ratification: fields.get("requirements.Asociado.ratification") === "on" },
        Principal: { degree: principalDegree, years: toNumber(fields.get("requirements.Principal.years")), research: toNumber(fields.get("requirements.Principal.research")), ratification: fields.get("requirements.Principal.ratification") === "on" }
      }
    };
    const parsed = rubricSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join("."), issue.message])));
      return;
    }
    setErrors({});
    if (await execute(() => legajoService.saveRubric(actor, parsed.data, edit ? source.id : undefined), edit ? "Rúbrica actualizada" : "Versión de rúbrica guardada como borrador")) onClose();
  }
  return <RecordDialog open onClose={onClose} dirty={dirty} title={edit ? "Editar rúbrica (borrador)" : "Nueva versión de rúbrica"}
    description="Los criterios son de simulación. Se guarda como borrador y debe aprobarse antes de aplicarse a una convocatoria.">
    <form className="form-stack" onChange={() => setDirty(true)} onSubmit={save}>
      <div className="form-grid">
        <Field name="version" label="Versión" defaultValue={version} error={errors.version} required autoFocus />
        <Field name="name" label="Nombre de la rúbrica" defaultValue={source.name} error={errors.name} required />
      </div>
      <div className="form-grid">
        <div className="field"><Label>Estado de la fuente</Label><FilterSelect label="Estado de la fuente" value={estadoFuente} onChange={v => { setEstadoFuente(v as "simulacion" | "oficial"); setDirty(true); }} options={[{ value: "simulacion", label: "Simulación (sin validar)" }, { value: "oficial", label: "Fuente oficial validada" }]} /></div>
        <Field name="fuenteNormativa" label="Norma o fuente de referencia" defaultValue={source.fuenteNormativa} error={errors.fuenteNormativa} placeholder="Ej. Reglamento de promoción docente" />
      </div>
      <Field name="threshold" label="Umbral de referencia (puntos)" type="number" min={0} max={100} defaultValue={source.threshold} error={errors.threshold} required />
      <fieldset className="form-stack"><legend>Puntaje por criterio</legend>
        <div className="form-grid">
          <Field name="degrees.maestria" label="Grado de maestría" type="number" min={0} max={100} defaultValue={source.degrees.maestria} error={errors["degrees.maestria"]} required />
          <Field name="degrees.doctorado" label="Grado de doctorado" type="number" min={0} max={100} defaultValue={source.degrees.doctorado} error={errors["degrees.doctorado"]} required />
        </div>
        <div className="form-grid">
          <Field name="experience.perYear" label="Puntos por año en categoría" type="number" min={0} max={100} defaultValue={source.experience.perYear} error={errors["experience.perYear"]} required />
          <Field name="experience.max" label="Tope por tiempo en categoría" type="number" min={0} max={100} defaultValue={source.experience.max} error={errors["experience.max"]} required />
        </div>
        <div className="form-grid">
          <Field name="research.unit" label="Puntos por investigación" type="number" min={0} max={100} defaultValue={source.research.unit} error={errors["research.unit"]} required />
          <Field name="research.max" label="Tope por investigación" type="number" min={0} max={100} defaultValue={source.research.max} error={errors["research.max"]} required />
        </div>
        <div className="form-grid">
          <Field name="talks.unit" label="Puntos por ponencia" type="number" min={0} max={100} defaultValue={source.talks.unit} error={errors["talks.unit"]} required />
          <Field name="talks.max" label="Tope por ponencias" type="number" min={0} max={100} defaultValue={source.talks.max} error={errors["talks.max"]} required />
        </div>
        <div className="form-grid">
          <Field name="attendance.unit" label="Puntos por participación" type="number" min={0} max={100} defaultValue={source.attendance.unit} error={errors["attendance.unit"]} required />
          <Field name="attendance.max" label="Tope por participaciones" type="number" min={0} max={100} defaultValue={source.attendance.max} error={errors["attendance.max"]} required />
        </div>
      </fieldset>
      <fieldset className="form-stack"><legend>Requisitos por categoría destino</legend>
        <fieldset className="form-stack"><legend>Para Asociado</legend>
          <div className="form-grid">
            <div className="field"><Label>Grado mínimo</Label><FilterSelect label="Grado mínimo para Asociado" value={associateDegree} onChange={v => { setAssociateDegree(v as "maestria" | "doctorado"); setDirty(true); }} options={[{ value: "maestria", label: "Maestría" }, { value: "doctorado", label: "Doctorado" }]} /></div>
            <Field name="requirements.Asociado.years" label="Años mínimos" type="number" min={0} max={60} defaultValue={requirements?.Asociado.years ?? 3} error={errors["requirements.Asociado.years"]} required />
            <Field name="requirements.Asociado.research" label="Investigaciones mínimas" type="number" min={0} max={50} defaultValue={requirements?.Asociado.research ?? 1} error={errors["requirements.Asociado.research"]} required />
          </div>
          <label className="checkbox-row"><input type="checkbox" name="requirements.Asociado.ratification" defaultChecked={requirements?.Asociado.ratification ?? true} />Exige ratificación acreditada</label>
        </fieldset>
        <fieldset className="form-stack"><legend>Para Principal</legend>
          <div className="form-grid">
            <div className="field"><Label>Grado mínimo</Label><FilterSelect label="Grado mínimo para Principal" value={principalDegree} onChange={v => { setPrincipalDegree(v as "maestria" | "doctorado"); setDirty(true); }} options={[{ value: "maestria", label: "Maestría" }, { value: "doctorado", label: "Doctorado" }]} /></div>
            <Field name="requirements.Principal.years" label="Años mínimos" type="number" min={0} max={60} defaultValue={requirements?.Principal.years ?? 5} error={errors["requirements.Principal.years"]} required />
            <Field name="requirements.Principal.research" label="Investigaciones mínimas" type="number" min={0} max={50} defaultValue={requirements?.Principal.research ?? 3} error={errors["requirements.Principal.research"]} required />
          </div>
          <label className="checkbox-row"><input type="checkbox" name="requirements.Principal.ratification" defaultChecked={requirements?.Principal.ratification ?? true} />Exige ratificación acreditada</label>
        </fieldset>
      </fieldset>
      <div className="notice"><b>{edit ? "Borrador en edición" : "Nueva versión"}</b><p>{edit ? "Se actualiza el borrador." : "Se crea un borrador."} Solo una versión aprobada puede aplicarse a una convocatoria.</p></div>
      <div className="form-footer"><span>{estadoFuente === "oficial" ? "Fuente oficial declarada" : "Simulación académica"}</span><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{edit ? "Guardar borrador" : "Crear borrador"}</Button></div>
    </form>
  </RecordDialog>;
}
