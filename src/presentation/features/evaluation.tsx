"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, FileText, LockKeyhole, CheckCheck, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "../provider";
import { legajoService } from "../../composition";
import type { ApplicationRequest, CommissionScores, Evaluation, Merit } from "../../domain/models";
import { kinds } from "../../domain/models";
import { matchesUnpCriterion, unpManualCriteria, unpRubricUrl } from "../../domain/unp-rubric";
import { Avatar, PageHeader, Empty, Score, Status, RequirementRow, SectionTitle, Confirm, EvidencePreview, dateLabel, DataTable, TableCell, TableRow } from "../components/common";
export function EvaluationView({
  id
}: {
  id: string;
}) {
  const {
    data,
    actor,
    busy,
    execute
  } = useWorkspace();
  const [note, setNote] = useState("");
  const [scores, setScores] = useState<CommissionScores>({});
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [preliminary,setPreliminary]=useState<Omit<Evaluation,"id"|"note">>();
  const [loadError,setLoadError]=useState("");
  useEffect(()=>{let live=true;setPreliminary(undefined);setLoadError("");void legajoService.evaluationPreview(id).then(result=>{if(live)setPreliminary(result);}).catch(e=>{if(live)setLoadError(e.message);});return()=>{live=false;};},[id,data?.revision]);
  if (!data) return null;
  const request = data.requests.find(r => r.id === id),
    teacher = data.teachers.find(t => t.id === request?.teacherId);
  if (!request || !teacher) return <Empty title="Expediente no disponible" description="Regresa a la lista para seleccionar una solicitud." />;
  const saved = data.evaluations.find(e => e.requestId === request.id);
  const call = data.calls.find(c => c.id === request.callId);
  const result = saved ?? preliminary;
  if(!result)return <Empty title={loadError?"No se pudo calcular la evaluación":"Calculando evaluación"} description={loadError||"El servidor está revisando los requisitos y las evidencias."}/>;
  const profile = result.teacherSnapshot;
  const unp = result.rubric.profile === "unp-concurso-plazas-v1";
  const grading = unp && !saved && actor.role === "comision" && request.status === "presentada";
  const pending = data.merits.filter(m => m.teacherId === teacher.id && m.status === "pendiente").length;
  const outcomeText = {
    apto: "Cumple las condiciones de la simulación",
    no_apto: "Aún no cumple las condiciones",
    sin_vacante: "Cumple, pero no hay plaza disponible"
  }[result.outcome];
  return <><Link href="/solicitudes" className="back-link"><ArrowLeft size={16} />Solicitudes de promoción</Link><PageHeader eyebrow={saved ? "RESULTADO CONSERVADO" : "REVISIÓN DEL EXPEDIENTE"} title={saved ? "Resultado de evaluación" : "Evaluación de promoción"} description={saved ? "Copia de la rúbrica, ficha y evidencias consideradas al cerrar la evaluación." : "Comprueba cada condición antes de registrar una conclusión."} action={saved && <Button variant="outline" onClick={() => window.print()}><Printer />Imprimir resultado</Button>} />
 <div className="evaluation-identity"><Avatar name={profile.name} /><div><strong>{profile.name}</strong><small>{profile.category} → {request.target} · {profile.department}</small></div><Status value={request.status} /></div>
 <p className="muted-copy">Convocatoria: {result.callSnapshot?.name ?? call?.name} · {saved ? "Reglas conservadas al cierre" : "Reglas de la convocatoria"}</p><div className="simulation-notice"><ShieldCheck size={19} /><p><b>Simulación académica · {result.rubric.version}.</b> {unp ? <>Tabla de concurso de plazas, págs. 7–8. <a href={unpRubricUrl} className="text-link">Consultar el reglamento</a></> : "Criterios de la convocatoria de simulación."}</p></div>
 <details className="history-details"><summary>Fuentes y versión de las reglas</summary>{result.rubric.sources?.map(s => <p key={s.criterion}><b>{s.criterion}:</b> {s.reference}</p>) ?? <p>Evaluación heredada: no se registró la fuente de cada criterio.</p>}<p>Versión: {result.rubric.version}. Requisitos: {result.rubric.requirements ? Object.entries(result.rubric.requirements).map(([category, rule]) => `${category}: ${rule.degree}, ${rule.years} años, ${rule.research} investigaciones${rule.ratification ? ", ratificación obligatoria" : ""}`).join(". ") : "No registrados como configuración en esta versión histórica."}</p></details>{saved && <div className="row-actions mb-5"><Button variant="outline" asChild><Link href="/propuestas">Consultar trámite y decisión</Link></Button></div>}{request.status === "observada" && <div className="notice warning inside"><b>Corrección solicitada</b><p>{request.note}</p></div>}
 <div className="evaluation-grid"><div className="space-y-5"><section className="panel padded"><SectionTitle title="Cumplimiento de requisitos" />{result.requirements.map(r => <RequirementRow key={r.label} {...r} />)}<RequirementRow label="Plaza correspondiente disponible" met={result.vacancyMet} detail={result.vacancySnapshot?.label ?? "No hay plaza correspondiente"} /></section>
 <section className="panel"><SectionTitle title="Desglose del puntaje" /><DataTable headers={["Criterio", "Sustento", "Puntos"]}>{result.breakdown.map(line => <TableRow key={line.label}><TableCell><strong>{line.label}</strong></TableCell><TableCell>{line.detail}{line.evidenceIds?.length ? <div className="row-actions">{line.evidenceIds.map(id => {
   const merit = result.evidenceSnapshot.find(m => m.id === id);
   return merit && <Button key={id} type="button" size="sm" variant="ghost" onClick={() => setPreview(merit.fileId)}><FileText size={14} />{kinds[merit.kind]}</Button>;
 })}</div> : null}</TableCell><TableCell>{unp && !saved && line.code !== "unp_grado" ? "Pendiente" : <><b>{line.score}</b> / {line.cap}</>}</TableCell></TableRow>)}</DataTable></section>
 {grading && <CommissionGrading request={request} evidence={result.evidenceSnapshot} scores={scores} onChange={(code, score) => { setScores(values => ({...values, [code]: score})); setError(""); }} />}</div>
 <div className="space-y-5"><section className="panel padded score-card"><div className="eyebrow">PUNTAJE {saved ? "REGISTRADO" : "PRELIMINAR"}</div><Score value={result.score} threshold={result.rubric.threshold} />{unp && !saved ? <h3>Pendiente de calificación de la comisión</h3> : <><Status value={result.outcome} /><h3>{outcomeText}</h3></>}<p>La decisión considera el puntaje, todos los requisitos y la disponibilidad de plaza.</p>{saved && <div className="saved-stamp"><LockKeyhole size={17} /><span>Cerrada el {dateLabel(saved.createdAt)}</span></div>}</section>
 <section className="panel padded"><SectionTitle title={saved ? "Conclusión registrada" : "Conclusión de la comisión"} />{saved ? <p className="evaluation-note">{saved.note}</p> : actor.role === "comision" && request.status === "presentada" ? <><Label htmlFor="evaluation-note">Fundamento del resultado</Label><Textarea id="evaluation-note" value={note} onChange={e => {
              setNote(e.target.value);
              setError("");
            }} placeholder="Explica los requisitos, puntaje y situación de la plaza…" rows={4} aria-invalid={!!error} />{error && <p className="field-error">{error}</p>}{pending > 0 && <div className="notice warning"><b>{pending} evidencias pendientes</b><p>Debes revisarlas antes de cerrar.</p><Link className="text-link" href="/revision">Ir a la bandeja de revisión</Link></div>}<Button className="w-full mt-4" disabled={busy || pending > 0} onClick={() => {
              if (note.trim().length < 8) {
                setError("Escribe una conclusión de al menos 8 caracteres.");
                return;
              }
              const missing = grading && unpManualCriteria.find(({code, cap, kinds}) => {
                const value = scores[code];
                return !value || !Number.isFinite(value.score) || value.score < 0 || value.score > cap || !value.detail.trim() || (value.score > 0 && kinds && !value.evidenceIds.length);
              });
              if (missing) {
                setError("Completa el puntaje y el sustento de «" + missing.label + "».");
                return;
              }
              setConfirm(true);
            }}><CheckCheck />Cerrar evaluación</Button></> : <p className="muted-copy">{request.status === "presentada" ? "La comisión puede registrar la conclusión desde su perfil." : "Presenta o reenvía la solicitud para que la comisión pueda evaluarla."}</p>}</section></div></div>
 <section className="panel mt-5"><SectionTitle title={"Evidencias " + (saved ? "conservadas" : "consideradas") + " · " + result.evidenceSnapshot.length} />{result.evidenceSnapshot.length ? <DataTable headers={["Documento", "Tipo", "Fecha", ""]}>{result.evidenceSnapshot.map(m => <TableRow key={m.id}><TableCell><strong>{m.title}</strong>{m.siged && <small>Respaldo SIGED · simulación</small>}</TableCell><TableCell>{kinds[m.kind]}</TableCell><TableCell>{dateLabel(m.date)}{m.siged && !m.siged.recordDate && <small>Fecha de consulta</small>}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => setPreview(m.fileId)}><FileText size={14} />Abrir</Button></TableCell></TableRow>)}</DataTable> : <Empty title="Sin evidencias verificadas" description="Los documentos pendientes u observados no se contabilizan." />}</section>
 <Confirm open={confirm} onClose={() => setConfirm(false)} title="¿Cerrar esta evaluación?" description="Se conservarán el resultado, la rúbrica y las evidencias actuales. Este resultado quedará disponible para consulta." onConfirm={() => {
      setConfirm(false);
      void execute(() => legajoService.closeEvaluation(actor, id, note, grading ? scores : undefined), "Evaluación cerrada y conservada");
    }} />
 {preview && <EvidencePreview fileId={preview} onClose={() => setPreview("")} />}
 </>;
}

function CommissionGrading({ request, evidence, scores, onChange }: {
  request: ApplicationRequest;
  evidence: Merit[];
  scores: CommissionScores;
  onChange: (code: string, value: CommissionScores[string]) => void;
}) {
  return <section className="panel padded">
    <SectionTitle title="Calificación de la comisión" />
    <p className="muted-copy">Registra el puntaje y su fundamento en cada rubro. Adjunta el sustento verificado o identifica el acta para la clase magistral y la entrevista. Usa 0 cuando la calificación no otorga puntos.</p>
    {unpManualCriteria.map(criterion => {
      const entry = scores[criterion.code] ?? {score: Number.NaN, detail: "", evidenceIds: []};
      const options = evidence.filter(merit => matchesUnpCriterion(criterion, merit, request));
      const id = `score-${criterion.code}`;
      return <fieldset className="history-details form-stack" key={id}>
        <legend><b>{criterion.label}</b> · hasta {criterion.cap}</legend>
        <p className="muted-copy">{criterion.rule}</p>
        <Label htmlFor={id}>Puntaje</Label>
        <input className="border rounded-md p-2 w-32" id={id} type="number" min={0} max={criterion.cap} step="0.01"
          value={Number.isFinite(entry.score) ? entry.score : ""} onChange={e => onChange(criterion.code, {...entry, score: e.currentTarget.valueAsNumber})} />
        <Label htmlFor={`${id}-note`}>{criterion.kinds ? "Fundamento" : "Acta o fundamento"}</Label>
        <Textarea id={`${id}-note`} rows={2} maxLength={400} value={entry.detail} onChange={e => onChange(criterion.code, {...entry, detail: e.currentTarget.value})} />
        {criterion.kinds && (options.length ? <div>{options.map(merit => <label className="checkbox-row" key={merit.id}>
          <input type="checkbox" checked={entry.evidenceIds.includes(merit.id)} onChange={e => onChange(criterion.code, {...entry,
            evidenceIds: e.target.checked ? [...entry.evidenceIds, merit.id] : entry.evidenceIds.filter(id => id !== merit.id)})} />{merit.title}
        </label>)}</div> : <p className="muted-copy">Pendiente de respaldo documental verificado.</p>)}
      </fieldset>;
    })}
  </section>;
}
