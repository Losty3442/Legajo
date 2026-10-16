"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, FileText, LockKeyhole, CheckCheck, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "../provider";
import { legajoService } from "../../composition";
import { evaluate } from "../../domain/evaluation";
import { kinds } from "../../domain/models";
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
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  if (!data) return null;
  const request = data.requests.find(r => r.id === id),
    teacher = data.teachers.find(t => t.id === request?.teacherId);
  if (!request || !teacher) return <Empty title="Expediente no disponible" description="Regresa a la lista para seleccionar una solicitud." />;
  const saved = data.evaluations.find(e => e.requestId === request.id);
  const call = data.calls.find(c => c.id === request.callId);
  const result = saved ?? evaluate(teacher, data.merits, request, data.vacancies.find(v => v.id === request.vacancyId), call?.rubric ?? data.rubric, new Date().toISOString());
  const profile = result.teacherSnapshot;
  const pending = data.merits.filter(m => m.teacherId === teacher.id && m.status === "pendiente").length;
  const outcomeText = {
    apto: "Cumple las condiciones de la simulación",
    no_apto: "Aún no cumple las condiciones",
    sin_vacante: "Cumple, pero no hay plaza disponible"
  }[result.outcome];
  return <><Link href="/solicitudes" className="back-link"><ArrowLeft size={16} />Solicitudes de promoción</Link><PageHeader eyebrow={saved ? "RESULTADO CONSERVADO" : "REVISIÓN DEL EXPEDIENTE"} title={saved ? "Resultado de evaluación" : "Evaluación de promoción"} description={saved ? "Copia de la rúbrica, ficha y evidencias consideradas al cerrar la evaluación." : "Comprueba cada condición antes de registrar una conclusión."} action={saved && <Button variant="outline" onClick={() => window.print()}><Printer />Imprimir resultado</Button>} />
 <div className="evaluation-identity"><Avatar name={profile.name} /><div><strong>{profile.name}</strong><small>{profile.category} → {request.target} · {profile.department}</small></div><Status value={request.status} /></div>
 <p className="muted-copy">Convocatoria: {result.callSnapshot?.name ?? call?.name} · {saved ? "Reglas conservadas al cierre" : "Reglas de la convocatoria"}</p><div className="simulation-notice"><ShieldCheck size={19} /><p><b>Simulación académica · {result.rubric.version}.</b> Criterios ficticios. Este resultado no concede un ascenso institucional.</p></div>
 <details className="history-details"><summary>Fuentes y versión de las reglas</summary>{result.rubric.sources?.map(s => <p key={s.criterion}><b>{s.criterion}:</b> {s.reference}</p>) ?? <p>Evaluación heredada: no se registró la fuente de cada criterio.</p>}<p>Versión: {result.rubric.version}. Requisitos: {result.rubric.requirements ? Object.entries(result.rubric.requirements).map(([category, rule]) => `${category}: ${rule.degree}, ${rule.years} años, ${rule.research} investigaciones${rule.ratification ? ", ratificación obligatoria" : ""}`).join(". ") : "No registrados como configuración en esta versión histórica."}</p></details>{saved && <div className="row-actions mb-5"><Button variant="outline" asChild><Link href="/propuestas">Consultar trámite y decisión</Link></Button></div>}{request.status === "observada" && <div className="notice warning inside"><b>Corrección solicitada</b><p>{request.note}</p></div>}
 <div className="evaluation-grid"><div className="space-y-5"><section className="panel padded"><SectionTitle title="Cumplimiento de requisitos" />{result.requirements.map(r => <RequirementRow key={r.label} {...r} />)}<RequirementRow label="Plaza correspondiente disponible" met={result.vacancyMet} detail={result.vacancySnapshot?.label ?? "No hay plaza correspondiente"} /></section>
 <section className="panel"><SectionTitle title="Desglose del puntaje" /><DataTable headers={["Criterio", "Sustento", "Puntos"]}>{result.breakdown.map(line => <TableRow key={line.label}><TableCell><strong>{line.label}</strong></TableCell><TableCell>{line.detail}</TableCell><TableCell><b>{line.score}</b> / {line.cap}</TableCell></TableRow>)}</DataTable></section></div>
 <div className="space-y-5"><section className="panel padded score-card"><div className="eyebrow">PUNTAJE {saved ? "REGISTRADO" : "PRELIMINAR"}</div><Score value={result.score} threshold={result.rubric.threshold} /><Status value={result.outcome} /><h3>{outcomeText}</h3><p>La decisión considera el puntaje, todos los requisitos y la disponibilidad de plaza.</p>{saved && <div className="saved-stamp"><LockKeyhole size={17} /><span>Cerrada el {dateLabel(saved.createdAt)}</span></div>}</section>
 <section className="panel padded"><SectionTitle title={saved ? "Conclusión registrada" : "Conclusión de la comisión"} />{saved ? <p className="evaluation-note">{saved.note}</p> : actor.role === "comision" && request.status === "presentada" ? <><Label htmlFor="evaluation-note">Fundamento del resultado</Label><Textarea id="evaluation-note" value={note} onChange={e => {
              setNote(e.target.value);
              setError("");
            }} placeholder="Explica los requisitos, puntaje y situación de la plaza…" rows={4} aria-invalid={!!error} />{error && <p className="field-error">{error}</p>}{pending > 0 && <div className="notice warning"><b>{pending} evidencias pendientes</b><p>Debes revisarlas antes de cerrar.</p><Link className="text-link" href="/revision">Ir a la bandeja de revisión</Link></div>}<Button className="w-full mt-4" disabled={busy || pending > 0} onClick={() => {
              if (note.trim().length < 8) {
                setError("Escribe una conclusión de al menos 8 caracteres.");
                return;
              }
              setConfirm(true);
            }}><CheckCheck />Cerrar evaluación</Button></> : <p className="muted-copy">{request.status === "presentada" ? "La comisión puede registrar la conclusión desde su perfil." : "Presenta o reenvía la solicitud para que la comisión pueda evaluarla."}</p>}</section></div></div>
 <section className="panel mt-5"><SectionTitle title={"Evidencias " + (saved ? "conservadas" : "consideradas") + " · " + result.evidenceSnapshot.length} />{result.evidenceSnapshot.length ? <DataTable headers={["Documento", "Tipo", "Fecha", ""]}>{result.evidenceSnapshot.map(m => <TableRow key={m.id}><TableCell><strong>{m.title}</strong></TableCell><TableCell>{kinds[m.kind]}</TableCell><TableCell>{dateLabel(m.date)}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => setPreview(m.fileId)}><FileText size={14} />Abrir</Button></TableCell></TableRow>)}</DataTable> : <Empty title="Sin evidencias verificadas" description="Los documentos pendientes u observados no se contabilizan." />}</section>
 <Confirm open={confirm} onClose={() => setConfirm(false)} title="¿Cerrar esta evaluación?" description="Se conservarán el resultado, la rúbrica y las evidencias actuales. Este resultado quedará disponible para consulta." onConfirm={() => {
      setConfirm(false);
      void execute(() => legajoService.closeEvaluation(actor, id, note), "Evaluación cerrada y conservada");
    }} />
 {preview && <EvidencePreview fileId={preview} onClose={() => setPreview("")} />}
 </>;
}
