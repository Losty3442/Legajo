"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "../provider";
import { legajoService } from "../../composition";
import { ranking, rankingPending } from "../../domain/promotion";
import type { Proposal } from "../../domain/models";
import { PageHeader, SectionTitle, Status, Empty, FilterSelect, DataTable, TableRow, TableCell, RecordDialog, Field, dateLabel } from "../components/common";

export function MeritOrder() {
  const { data, actor, busy, execute } = useWorkspace();
  const [callId, setCallId] = useState(data?.calls[0]?.id ?? "");
  const [vacancyId, setVacancyId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [report, setReport] = useState("");
  if (!data) return null;
  if (actor.role === "docente") return <Empty title="Consulta tu resultado y trámite" description="El cuadro completo corresponde a las instancias evaluadoras." action={<Button asChild><Link href="/propuestas">Mis propuestas</Link></Button>} />;
  const call = data.calls.find(c => c.id === callId);
  const selectedVacancy = call?.vacancyIds.includes(vacancyId) ? vacancyId : call?.vacancyIds[0] ?? "";
  const rows = ranking(data, callId, selectedVacancy);
  const pending = rankingPending(data, callId, selectedVacancy);
  return <><PageHeader eyebrow="RESULTADOS COMPARADOS" title="Orden de mérito" description="Postulantes de la misma convocatoria y plaza. Los empates comparten puesto y requieren una regla institucional validada." />
    <section className="panel"><div className="filter-bar">
      <FilterSelect label="Convocatoria del orden de mérito" value={callId} onChange={v => { setCallId(v); setVacancyId(""); }} options={data.calls.map(c => ({ value: c.id, label: c.name }))} />
      <FilterSelect label="Plaza del orden de mérito" value={selectedVacancy} onChange={setVacancyId} options={(call?.vacancyIds ?? []).map(id => ({ value: id, label: data.vacancies.find(v => v.id === id)?.label ?? id }))} />
    </div>
    <div className="notice inside"><p>{call?.status === "abierta" ? "Cuadro preliminar: la recepción todavía está abierta." : pending ? "Cuadro incompleto: hay solicitudes pendientes para esta plaza." : "Evaluaciones completas. El primer puesto apto sin empate puede pasar a propuesta."} El puntaje no concede un ascenso.</p></div>
    {rows.length ? <DataTable headers={["Puesto", "Docente", "Puntaje", "Resultado", "Acciones"]}>{rows.map(row => <TableRow key={row.requestId}>
      <TableCell><strong>{row.position ?? "—"}{row.tied && " · Empate"}</strong></TableCell><TableCell>{row.name}</TableCell><TableCell>{row.score}</TableCell><TableCell><Status value={row.outcome} /></TableCell>
      <TableCell><div className="row-actions"><Button asChild variant="outline" size="sm"><Link href={"/evaluaciones/" + row.requestId}>Ver resultado</Link></Button>
        {actor.role === "decanato" && row.position === 1 && row.outcome === "apto" && !data.proposals.some(p => p.requestId === row.requestId) &&
          <Button size="sm" disabled={busy || pending || row.tied || call?.status !== "evaluacion"} onClick={() => { setRequestId(row.requestId); setReport(""); }}>Preparar propuesta</Button>}</div></TableCell>
    </TableRow>)}</DataTable> : <Empty title="Sin evaluaciones cerradas" description="Cierra las evaluaciones para construir el cuadro de esta plaza." />}</section>
    {!!requestId && <RecordDialog open onClose={() => setRequestId("")} dirty={!!report} title="Preparar propuesta" description="El informe conservará el resultado y el orden de mérito considerados.">
      <form className="form-stack" onSubmit={async e => { e.preventDefault(); if (await execute(() => legajoService.createProposal(actor, requestId, report), "Propuesta preparada")) setRequestId(""); }}>
        <Label htmlFor="proposal-report">Informe del decanato</Label><Textarea id="proposal-report" value={report} onChange={e => setReport(e.target.value)} required minLength={15} rows={5} autoFocus />
        <Button disabled={busy} type="submit">Guardar propuesta</Button>
      </form>
    </RecordDialog>}
    <div className="mt-5"><Button asChild variant="outline"><Link href="/propuestas">Ir al trámite de propuestas</Link></Button></div>
  </>;
}

type Action = "remitir" | "elevar" | "aprobar" | "denegar";
const actionLabels: Record<Action, string> = { remitir: "Remitir a Facultad", elevar: "Elevar al Consejo Universitario", aprobar: "Registrar aprobación", denegar: "Registrar denegación" };
export function Proposals() {
  const { data, actor } = useWorkspace();
  const [action, setAction] = useState<{ proposal: Proposal; action: Action }>();
  if (!data) return null;
  return <><PageHeader eyebrow="TRÁMITE INSTITUCIONAL · SIMULACIÓN" title="Propuestas y decisiones" description="Sigue el informe del decanato, el acuerdo de Facultad y la decisión del Consejo Universitario."
    action={actor.role !== "docente" && <Button asChild variant="outline"><Link href="/orden-merito">Consultar orden de mérito</Link></Button>} />
    <div className="simulation-notice"><p>Las decisiones registradas son ficticias. Se conserva el expediente; la aplicación no cambia automáticamente la categoría del docente ni emite una resolución oficial.</p></div>
    {!data.proposals.length ? <Empty title="Aún no hay propuestas" description="El decanato las prepara desde el orden de mérito, después de cerrar la recepción y completar las evaluaciones de la plaza." /> :
      <div className="space-y-5">{data.proposals.map(p => {
        const evaluation = data.evaluations.find(e => e.id === p.evaluationId);
        return <section className="panel padded proposal-card" key={p.id}>
          <div className="section-title"><h2>{evaluation?.teacherSnapshot.name}</h2><Status value={p.status} /></div>
          <p className="muted-copy">{data.calls.find(c => c.id === p.callId)?.name} · {evaluation?.requestSnapshot.target}</p>
          <SectionTitle title="Informe del decanato" /><p className="evaluation-note">{p.report}</p>
          <details className="history-details"><summary>Orden de mérito conservado</summary><DataTable headers={["Puesto", "Docente", "Puntos"]}>{p.rankingSnapshot.map(r => <TableRow key={r.requestId}><TableCell>{r.position ?? "—"}</TableCell><TableCell>{r.name}</TableCell><TableCell>{r.score}</TableCell></TableRow>)}</DataTable></details>
          <SectionTitle title="Seguimiento del trámite" /><ol className="timeline">{p.events.map((event, i) => <li key={i}><span className="timeline-dot" /><div><Status value={event.stage} /><strong>{event.reference || "Informe inicial"}</strong><p>{event.note}</p><small>{dateLabel(event.at)} · {event.actor.name}</small></div></li>)}</ol>
          <div className="row-actions"><Button asChild variant="outline"><Link href={"/evaluaciones/" + p.requestId}>Ver evaluación</Link></Button>
            <Button variant="outline" onClick={() => window.print()}>Imprimir vista</Button>
            {actor.role === "decanato" && p.status === "decanato" && <Button onClick={() => setAction({ proposal: p, action: "remitir" })}>{actionLabels.remitir}</Button>}
            {actor.role === "consejo_facultad" && p.status === "facultad" && <Button onClick={() => setAction({ proposal: p, action: "elevar" })}>{actionLabels.elevar}</Button>}
            {actor.role === "consejo_universitario" && p.status === "universitario" && <><Button onClick={() => setAction({ proposal: p, action: "aprobar" })}>{actionLabels.aprobar}</Button><Button variant="outline" onClick={() => setAction({ proposal: p, action: "denegar" })}>{actionLabels.denegar}</Button></>}
          </div>
        </section>;
      })}</div>}
    {action && <ProposalAction {...action} onClose={() => setAction(undefined)} />}
  </>;
}
function ProposalAction({ proposal, action, onClose }: { proposal: Proposal; action: Action; onClose: () => void }) {
  const { actor, execute, busy } = useWorkspace();
  const [dirty, setDirty] = useState(false);
  return <RecordDialog open dirty={dirty} onClose={onClose} title={actionLabels[action]} description="Registra una referencia ficticia y el fundamento. Este paso se conservará en el expediente.">
    <form className="form-stack" onChange={() => setDirty(true)} onSubmit={async e => {
      e.preventDefault(); const fields = new FormData(e.currentTarget);
      if (await execute(() => legajoService.advanceProposal(actor, proposal.id, action, String(fields.get("reference")), String(fields.get("note"))), "Trámite registrado")) onClose();
    }}>
      <Field name="reference" label="Oficio, acuerdo o resolución de ejemplo" required minLength={3} autoFocus />
      <Label htmlFor="decision-note">Fundamento del trámite</Label><Textarea name="note" id="decision-note" required minLength={8} rows={4} />
      <Button type="submit" disabled={busy}>Confirmar trámite</Button>
    </form>
  </RecordDialog>;
}
