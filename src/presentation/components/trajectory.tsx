"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "../provider";
import { legajoService } from "../../composition";
import type { Experience } from "../../domain/models";
import { Field, RecordDialog, FilterSelect, Empty, SectionTitle, Status, dateLabel } from "./common";

export function Trajectory({ teacherId }: { teacherId: string }) {
  const { data, actor } = useWorkspace();
  const [form, setForm] = useState<Experience | "new">();
  if (!data) return null;
  const entries = data.experiences.filter(e => e.teacherId === teacherId);
  const editable = actor.role === "legajos" || actor.role === "docente" && actor.teacherId === teacherId;
  return <section className="panel padded mt-5"><SectionTitle title="Trayectoria laboral" />
    <p className="muted-copy">Antecedentes con documento de respaldo. No suman puntos adicionales: la simulación puntúa únicamente la antigüedad en categoría.</p>
    {editable && <Button variant="outline" onClick={() => setForm("new")}>Agregar experiencia</Button>}
    {entries.length ? <ol className="timeline mt-5">{entries.map(e => <li key={e.id}><span className="timeline-dot" /><div><strong>{e.position} · {e.institution}</strong><small>{dateLabel(e.startsOn)} — {e.endsOn ? dateLabel(e.endsOn) : "Actualidad"}</small><p>Evidencia: {data.merits.find(m => m.id === e.evidenceId)?.title}</p><Status value={data.merits.find(m => m.id === e.evidenceId)?.status ?? "pendiente"} />{editable && <Button size="sm" variant="ghost" onClick={() => setForm(e)}>Editar experiencia</Button>}</div></li>)}</ol> : <Empty title="Sin antecedentes laborales registrados" description="Agrega una evidencia al legajo y vincúlala a la experiencia." />}
    {form && <ExperienceForm teacherId={teacherId} record={form === "new" ? undefined : form} onClose={() => setForm(undefined)} />}
  </section>;
}
function ExperienceForm({ teacherId, record, onClose }: { teacherId: string; record?: Experience; onClose: () => void }) {
  const { data, actor, busy, execute } = useWorkspace();
  const [evidenceId, setEvidenceId] = useState(record?.evidenceId ?? "");
  const [dirty, setDirty] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  return <RecordDialog open onClose={onClose} dirty={dirty} title={record ? "Editar experiencia" : "Agregar experiencia"} description="Registra el periodo y selecciona un documento del legajo que lo respalde.">
    <form className="form-stack" onChange={() => setDirty(true)} onSubmit={async e => {
      e.preventDefault(); const fields = new FormData(e.currentTarget);
      if (await execute(() => legajoService.saveExperience(actor, teacherId, { institution: String(fields.get("employer")), position: String(fields.get("position")), startsOn: String(fields.get("experience-start")), endsOn: String(fields.get("experience-end")) || undefined, evidenceId }, record?.id), "Experiencia guardada")) onClose();
    }}>
      <Field name="employer" label="Institución o empleador" defaultValue={record?.institution} minLength={3} required autoFocus />
      <Field name="position" label="Cargo o función" defaultValue={record?.position} minLength={3} required />
      <div className="form-grid"><Field name="experience-start" label="Inicio de experiencia" type="date" defaultValue={record?.startsOn} max={today} required /><Field name="experience-end" label="Fin de experiencia (vacío si continúa)" type="date" defaultValue={record?.endsOn} max={today} /></div>
      <Label>Documento de respaldo</Label><FilterSelect label="Evidencia de experiencia" value={evidenceId} onChange={v => { setEvidenceId(v); setDirty(true); }} options={(data?.merits.filter(m => m.teacherId === teacherId) ?? []).map(m => ({ value: m.id, label: m.title }))} />
      <Button disabled={busy || !evidenceId} type="submit">Guardar experiencia</Button>
    </form>
  </RecordDialog>;
}
