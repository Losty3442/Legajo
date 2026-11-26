"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "../provider";
import { legajoService } from "../../composition";
import type { VacancyInput } from "../../application/service";
import { catalog, promotionTargets, vacancyDedications, type PromotionCall } from "../../domain/models";
import { PageHeader, SectionTitle, Status, Field, FilterSelect, RecordDialog, Confirm, Empty, dateLabel } from "../components/common";

export function Calls() {
  const { data, actor, busy, execute } = useWorkspace();
  const [form, setForm] = useState<PromotionCall | "new">();
  const [advance, setAdvance] = useState<PromotionCall>();
  const [registerVacancy, setRegisterVacancy] = useState(false);
  if (!data) return null;
  const canRegister = actor.role === "legajos";
  const hasVacancies = data.vacancies.length > 0;
  return <><PageHeader eyebrow="PROMOCIÓN DOCENTE" title="Convocatorias" description="Periodos, plazas y reglas conservadas para cada proceso de simulación."
    action={canRegister && <div className="row-actions">
      <Button variant={hasVacancies ? "outline" : "default"} onClick={() => setRegisterVacancy(true)}><Plus />Registrar plaza</Button>
      <Button disabled={!hasVacancies} onClick={() => setForm("new")}><Plus />Nueva convocatoria</Button>
    </div>} />
    <div className="notice inside"><CalendarDays /><p>Cierra la recepción cuando termine la presentación. Después de evaluar a todos los postulantes de una plaza, el decanato podrá preparar la propuesta según el orden de mérito.</p></div>
    <div className="space-y-5">{data.calls.map(call => {
      const count = data.requests.filter(r => r.callId === call.id).length;
      return <section className="panel padded" key={call.id}>
        <div className="section-title"><h2>{call.name}</h2><Status value={call.status} /></div>
        <p className="muted-copy">{dateLabel(call.startsOn)} — {dateLabel(call.endsOn)} · {count} solicitudes · {call.rubric.version}</p>
        <SectionTitle title="Plazas asociadas" />
        <ul className="call-vacancies">{call.vacancyIds.map(id => <li key={id}>{data.vacancies.find(v => v.id === id)?.label}</li>)}</ul>
        <div className="row-actions mt-4"><Button asChild variant="outline"><Link href="/orden-merito">Consultar orden de mérito</Link></Button>
          {actor.role === "legajos" && <>{!count && call.status === "abierta" && <Button variant="outline" onClick={() => setForm(call)}>Editar convocatoria</Button>}
          {call.status !== "cerrada" && <Button disabled={busy} onClick={() => setAdvance(call)}>{call.status === "abierta" ? "Cerrar recepción" : "Cerrar convocatoria"}</Button>}</>}
        </div>
      </section>;
    })}{!data.calls.length && <Empty title="Sin convocatorias" description={canRegister && !hasVacancies ? "Registra una plaza para crear la primera convocatoria." : undefined} />}</div>
    {registerVacancy && <VacancyForm onClose={() => setRegisterVacancy(false)} />}
    {form && <CallForm call={form === "new" ? undefined : form} onClose={() => setForm(undefined)} />}
    <Confirm open={!!advance} onClose={() => setAdvance(undefined)} title={advance?.status === "abierta" ? "¿Cerrar recepción?" : "¿Cerrar convocatoria?"}
      description={advance?.status === "abierta" ? "No se admitirán nuevas solicitudes ni correcciones. Los borradores quedarán como no presentados. Las solicitudes observadas deben resolverse primero." : "El proceso quedará disponible para consulta; deben estar resueltas las evaluaciones y propuestas."}
      onConfirm={() => { if (advance) void execute(() => legajoService.advanceCall(actor, advance.id), "Fase actualizada"); setAdvance(undefined); }} />
  </>;
}

function VacancyForm({ onClose }: { onClose: () => void }) {
  const { data, actor, busy, execute } = useWorkspace();
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [category, setCategory] = useState<VacancyInput["category"] | "">("");
  const [dedication, setDedication] = useState<VacancyInput["dedication"] | "">("");
  const [dirty, setDirty] = useState(false);
  const organizations = data?.organizations ?? catalog;
  const departments = organizations[faculty] ?? [];

  return <RecordDialog open onClose={onClose} dirty={dirty} title="Registrar plaza" description="La plaza quedará disponible para seleccionarla en una convocatoria.">
    <form className="form-stack" onChange={() => setDirty(true)} onSubmit={async e => {
      e.preventDefault();
      if (!faculty || !department || !category || !dedication) return;
      const values = new FormData(e.currentTarget);
      const code = String(values.get("vacancy-code"));
      if (await execute(() => legajoService.createVacancy(actor, { code, faculty, department, category, dedication }), "Plaza registrada")) onClose();
    }}>
      <Field name="vacancy-code" label="Código de la plaza" placeholder="PL-101" required autoFocus />
      <div className="field">
        <Label htmlFor="vacancy-faculty">Facultad</Label>
        <FilterSelect id="vacancy-faculty" label="Facultad" value={faculty} onChange={value => { setFaculty(value); setDepartment(""); setDirty(true); }}
          options={Object.keys(organizations).map(name => ({ value: name, label: name }))} />
      </div>
      <div className="field">
        <Label htmlFor="vacancy-department">Departamento académico</Label>
        <FilterSelect id="vacancy-department" label="Departamento académico" value={department} disabled={!faculty} onChange={value => { setDepartment(value); setDirty(true); }}
          options={departments.map(name => ({ value: name, label: name }))} />
      </div>
      <div className="form-grid">
        <div className="field">
          <Label htmlFor="vacancy-category">Categoría de destino</Label>
          <FilterSelect id="vacancy-category" label="Categoría de destino" value={category} onChange={value => { setCategory(value as VacancyInput["category"]); setDirty(true); }}
            options={promotionTargets.map(name => ({ value: name, label: name }))} />
        </div>
        <div className="field">
          <Label htmlFor="vacancy-dedication">Dedicación</Label>
          <FilterSelect id="vacancy-dedication" label="Dedicación" value={dedication} onChange={value => { setDedication(value as VacancyInput["dedication"]); setDirty(true); }}
            options={vacancyDedications.map(name => ({ value: name, label: name }))} />
        </div>
      </div>
      <Button type="submit" disabled={busy || !faculty || !department || !category || !dedication}>Guardar plaza</Button>
    </form>
  </RecordDialog>;
}

function CallForm({ call, onClose }: { call?: PromotionCall; onClose: () => void }) {
  const { data, actor, busy, execute } = useWorkspace();
  const [vacancyIds, setVacancyIds] = useState(call?.vacancyIds ?? []);
  const [dirty, setDirty] = useState(false);
  const rubrics = (data?.rubrics?.length ? data.rubrics : data ? [data.rubric] : []).filter(r => r.aprobadaEn);
  const defaultRubric = rubrics.find(r => r.id === data?.rubric.id) ?? rubrics[0];
  const [rubricId, setRubricId] = useState(call?.rubric.id ?? defaultRubric?.id ?? "");
  if (!data) return null;
  const selectedRubric = rubrics.find(r => r.id === rubricId);
  return <RecordDialog open onClose={onClose} dirty={dirty} title={call ? "Editar convocatoria" : "Nueva convocatoria"} description="La rúbrica se copia al crear el proceso. Sus condiciones se congelan desde la primera solicitud.">
    <form className="form-stack" onChange={() => setDirty(true)} onSubmit={async e => {
      e.preventDefault(); const values = new FormData(e.currentTarget);
      if (await execute(() => legajoService.saveCall(actor, { name: String(values.get("call-name")), startsOn: String(values.get("call-start")), endsOn: String(values.get("call-end")), vacancyIds, rubricId }, call?.id), "Convocatoria guardada")) onClose();
    }}>
      <Field name="call-name" label="Nombre de la convocatoria" defaultValue={call?.name} minLength={5} required autoFocus />
      <div className="form-grid"><Field name="call-start" label="Inicio de presentación" type="date" defaultValue={call?.startsOn} required /><Field name="call-end" label="Fin de presentación" type="date" defaultValue={call?.endsOn} required /></div>
      <div className="field"><Label>Rúbrica aplicada</Label>{rubrics.length ? <FilterSelect label="Rúbrica de la convocatoria" value={rubricId} onChange={v => { setRubricId(v); setDirty(true); }} options={rubrics.map(r => ({ value: r.id!, label: r.profile ? "Tabla UNP · Simulación" : r.version + (r.estadoFuente === "oficial" ? " · Fuente oficial" : " · Simulación") }))} /> : <div className="notice warning">No hay una rúbrica aprobada. Aprueba una versión antes de crear la convocatoria (RN09).</div>}</div>
      <fieldset className="form-stack"><legend>Plazas de la convocatoria</legend>{data.vacancies.map(v => <label className="checkbox-row" key={v.id}><input type="checkbox" checked={vacancyIds.includes(v.id)} onChange={e => setVacancyIds(e.target.checked ? [...vacancyIds, v.id] : vacancyIds.filter(id => id !== v.id))} />{v.label}{!v.available && " · Sin disponibilidad"}</label>)}</fieldset>
      {!data.vacancies.length && <div className="notice warning">Se requiere una plaza registrada para guardar la convocatoria.</div>}
      {selectedRubric && <div className="notice"><b>{selectedRubric.version}</b><p>{selectedRubric.profile ? "Tabla de concurso de plazas de la UNP aplicada como referencia de la simulación." : selectedRubric.fuenteNormativa || "Reglas de simulación."}</p></div>}
      <Button disabled={busy || !vacancyIds.length || !rubricId} type="submit">Guardar convocatoria</Button>
    </form>
  </RecordDialog>;
}
