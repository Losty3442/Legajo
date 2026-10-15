"use client";

import { useState } from "react";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { legajoService } from "../../composition";
import { teacherSchema, meritSchema } from "../../application/service";
import { catalog, kinds, nextCategory } from "../../domain/models";
import type { Teacher, Merit, ApplicationRequest, Category } from "../../domain/models";
import { useWorkspace } from "../provider";
import { Field, FilterSelect, RecordDialog, EvidencePreview } from "./common";
const today = () => new Date().toISOString().slice(0, 10);
export function TeacherForm({
  teacher,
  onClose
}: {
  teacher?: Teacher;
  onClose: () => void;
}) {
  const {
    actor,
    busy,
    execute
  } = useWorkspace();
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [faculty, setFaculty] = useState(teacher?.faculty ?? Object.keys(catalog)[0]);
  const [department, setDepartment] = useState(teacher?.department ?? catalog[faculty][0]);
  const [category, setCategory] = useState(teacher?.category ?? "Auxiliar");
  const [dedication, setDedication] = useState(teacher?.dedication ?? "Tiempo completo");
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = teacherSchema.safeParse({
      ...fields,
      faculty,
      department,
      category,
      dedication
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map(i => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    if (await execute(() => legajoService.saveTeacher(actor, parsed.data, teacher?.id), "Ficha docente guardada")) onClose();
  }
  return <RecordDialog open onClose={onClose} dirty={dirty} title={teacher ? "Editar ficha docente" : "Registrar docente"} description="Usa datos ficticios para esta demostración."><form onSubmit={save} onChange={() => setDirty(true)} className="form-stack">
   <Field name="name" label="Nombres y apellidos" defaultValue={teacher?.name} error={errors.name} required autoFocus placeholder="Ej. Valeria Ríos Mendoza" />
   <div className="form-grid"><Field name="email" label="Correo electrónico" type="email" defaultValue={teacher?.email} error={errors.email} required placeholder="docente@ejemplo.test" /><Field name="specialty" label="Especialidad" defaultValue={teacher?.specialty} error={errors.specialty} required /></div>
   <div className="form-grid"><div className="field"><Label>Facultad</Label><FilterSelect label="Facultad del docente" value={faculty} onChange={v => {
            setFaculty(v);
            setDepartment(catalog[v][0]);
            setDirty(true);
          }} options={Object.keys(catalog).map(v => ({
            value: v,
            label: v
          }))} /></div><div className="field"><Label>Departamento</Label><FilterSelect label="Departamento del docente" value={department} onChange={v => {
            setDepartment(v);
            setDirty(true);
          }} options={catalog[faculty].map(v => ({
            value: v,
            label: v
          }))} /></div></div>
   <div className="form-grid"><div className="field"><Label>Categoría actual</Label><FilterSelect label="Categoría actual" value={category} onChange={v => {
            setCategory(v as Category);
            setDirty(true);
          }} options={["Auxiliar", "Asociado", "Principal"].map(v => ({
            value: v,
            label: v
          }))} /></div><div className="field"><Label>Dedicación</Label><FilterSelect label="Dedicación" value={dedication} onChange={v => {
            setDedication(v as Teacher["dedication"]);
            setDirty(true);
          }} options={["Tiempo completo", "Dedicación exclusiva"].map(v => ({
            value: v,
            label: v
          }))} /></div></div>
   <Field name="since" label="Inicio en la categoría actual" type="date" max={today()} defaultValue={teacher?.since} error={errors.since} required />
   <div className="form-footer"><span>Los cambios quedarán en el historial.</span><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Guardar docente</Button></div>
 </form></RecordDialog>;
}
export function MeritForm({
  teacherId,
  merit,
  onClose
}: {
  teacherId: string;
  merit?: Merit;
  onClose: () => void;
}) {
  const {
    actor,
    busy,
    execute
  } = useWorkspace();
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<Merit["kind"]>(merit?.kind ?? "ponencia");
  const [file, setFile] = useState<File>();
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = meritSchema.safeParse({
      ...Object.fromEntries(new FormData(e.currentTarget)),
      kind
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map(i => [i.path[0], i.message])));
      return;
    }
    if (!file && !merit) {
      setErrors({
        file: "Adjunta una evidencia para continuar."
      });
      return;
    }
    if (file && file.size > 10 * 1024 * 1024) {
      setErrors({
        file: "El tamaño máximo es 10 MB."
      });
      return;
    }
    setErrors({});
    if (await execute(() => legajoService.saveMerit(actor, teacherId, parsed.data, file, merit?.id), "Mérito enviado a revisión")) onClose();
  }
  return <RecordDialog open onClose={onClose} dirty={dirty} title={merit ? "Corregir evidencia" : "Agregar mérito al legajo"} description="Cada mérito debe tener un documento que lo respalde."><form className="form-stack" onSubmit={save} onChange={() => setDirty(true)}>
   {merit?.observation && <div className="notice warning"><b>Observación</b><p>{merit.observation}</p></div>}
   <div className="field"><Label>Tipo de mérito</Label><FilterSelect label="Tipo de mérito" value={kind} onChange={v => {
          setKind(v as Merit["kind"]);
          setDirty(true);
        }} options={Object.entries(kinds).map(([value, label]) => ({
          value,
          label
        }))} /></div>
   <Field name="title" label="Nombre del mérito" defaultValue={merit?.title} error={errors.title} required placeholder="Ej. Ponencia sobre innovación educativa" autoFocus />
   <div className="form-grid"><Field name="institution" label="Institución emisora" defaultValue={merit?.institution} error={errors.institution} required /><Field name="date" label="Fecha del documento o actividad" type="date" max={today()} defaultValue={merit?.date} error={errors.date} required /></div>
   <div className="upload-field"><UploadCloud size={29} /><Label htmlFor="evidence-file">{file?.name ?? (merit ? "Seleccionar un documento corregido" : "Seleccionar evidencia")}</Label><p>PDF, PNG, JPG o WebP · Hasta 10 MB</p><Input id="evidence-file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e => {
          setFile(e.target.files?.[0]);
          setDirty(true);
        }} aria-describedby="file-error" />{merit && !file && <small>Documento actual: {merit.fileName}</small>}</div>
   {errors.file && <p id="file-error" className="field-error">{errors.file}</p>}
   <div className="form-footer"><span>Estado inicial: por revisar.</span><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{merit ? "Reenviar evidencia" : "Guardar mérito"}</Button></div>
 </form></RecordDialog>;
}
export function RequestForm({
  teacherId,
  request,
  onClose
}: {
  teacherId?: string;
  request?: ApplicationRequest;
  onClose: () => void;
}) {
  const {
    actor,
    data,
    busy,
    execute
  } = useWorkspace();
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState(request?.teacherId ?? teacherId ?? data?.teachers[0]?.id ?? "");
  const [vacancy, setVacancy] = useState(request?.vacancyId ?? "");
  const [callId, setCallId] = useState(request?.callId ?? data?.calls.find(c => c.status === "abierta")?.id ?? "");
  const call = data?.calls.find(c => c.id === callId);
  const t = data?.teachers.find(t => t.id === selected);
  const target = t ? nextCategory(t.category) : undefined;
  const vacancies = data?.vacancies.filter(v => call?.vacancyIds.includes(v.id) && t && v.category === target && v.faculty === t.faculty && v.department === t.department && v.dedication === t.dedication) ?? [];
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (await execute(() => legajoService.saveRequest(actor, selected, vacancy, request?.id, callId), "Borrador guardado; ya puedes presentarlo")) onClose();
  }
  return <RecordDialog open dirty={dirty} onClose={onClose} title={request ? "Corregir solicitud" : "Nueva solicitud de promoción"} description="Prepara un borrador antes de enviarlo a la comisión."><form className="form-stack" onSubmit={save}>
   <div className="field"><Label>Docente</Label>{request ? <p>{t?.name}</p> : <FilterSelect label="Docente de la solicitud" value={selected} onChange={v => {
          setSelected(v);
          setVacancy("");
          setDirty(true);
        }} options={data?.teachers.map(t => ({
          value: t.id,
          label: t.name
        })) ?? []} />}</div>
   <div className="field"><Label>Convocatoria</Label><FilterSelect label="Convocatoria de la solicitud" value={callId} onChange={v => { setCallId(v); setVacancy(""); setDirty(true); }} options={(data?.calls.filter(c => c.status === "abierta") ?? []).map(c => ({ value: c.id, label: c.name }))} /></div><div className="notice"><b>{t?.category} → {target ?? "Sin categoría superior"}</b><p>{t?.faculty} / {t?.department}</p></div>
   {target && vacancies.length ? <div className="field"><Label>Plaza correspondiente</Label><FilterSelect label="Plaza correspondiente" value={vacancy} onChange={v => {
          setVacancy(v);
          setDirty(true);
        }} options={vacancies.map(v => ({
          value: v.id,
          label: v.label + (v.available ? " · Disponible" : " · Sin disponibilidad")
        }))} /></div> : <div className="notice warning">No hay una plaza configurada para este perfil docente en la demostración.</div>}
   <div className="form-footer"><span>{call?.rubric.version ?? "Selecciona convocatoria"}</span><Button disabled={busy || !vacancy} type="submit">Guardar borrador</Button></div>
 </form></RecordDialog>;
}
export function ReviewForm({
  merit,
  onClose
}: {
  merit: Merit;
  onClose: () => void;
}) {
  const {
    actor,
    busy,
    execute
  } = useWorkspace();
  const [status, setStatus] = useState("verificado");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (status === "observado" && note.trim().length < 8) {
      setError("Describe qué debe corregirse (mínimo 8 caracteres).");
      return;
    }
    if (await execute(() => legajoService.review(actor, merit.id, status as "verificado" | "observado", note), "Revisión registrada")) onClose();
  }
  return <><RecordDialog open onClose={onClose} dirty={!!note || status !== "verificado"} title="Revisar evidencia" description={merit.title}><form className="form-stack" onSubmit={save}>
   <Button type="button" variant="outline" onClick={() => setPreview(true)}><FileText />Abrir documento</Button>
   <div className="field"><Label>Resultado de revisión</Label><FilterSelect label="Resultado de revisión" value={status} onChange={setStatus} options={[{
            value: "verificado",
            label: "Verificar evidencia"
          }, {
            value: "observado",
            label: "Observar y solicitar corrección"
          }]} /></div>
   <div className="field"><Label htmlFor="review-note">Justificación {status === "observado" ? "(obligatoria)" : "(opcional)"}</Label><Textarea id="review-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Indica qué se verificó o qué debe corregirse." aria-invalid={!!error} />{error && <p className="field-error">{error}</p>}</div>
   <Button type="submit" disabled={busy}>Registrar revisión</Button>
 </form></RecordDialog>{preview && <EvidencePreview fileId={merit.fileId} onClose={() => setPreview(false)} />}</>;
}
export function ObserveRequestForm({
  request,
  onClose
}: {
  request: ApplicationRequest;
  onClose: () => void;
}) {
  const {
    actor,
    busy,
    execute
  } = useWorkspace();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  return <RecordDialog open onClose={onClose} dirty={!!note} title="Solicitar una corrección" description="La solicitud volverá al docente con esta observación."><form className="form-stack" onSubmit={async e => {
      e.preventDefault();
      if (note.trim().length < 8) {
        setError("Explica la corrección con al menos 8 caracteres.");
        return;
      }
      if (await execute(() => legajoService.observeRequest(actor, request.id, note), "Solicitud devuelta para corrección")) onClose();
    }}><Label htmlFor="request-note">Observación</Label><Textarea id="request-note" value={note} onChange={e => setNote(e.target.value)} autoFocus aria-invalid={!!error} />{error && <p className="field-error">{error}</p>}<Button disabled={busy}>Enviar observación</Button></form></RecordDialog>;
}
