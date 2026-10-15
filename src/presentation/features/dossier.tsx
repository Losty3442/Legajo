"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, FileText, ArrowLeft, GraduationCap, Mail, Building2, CalendarDays, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useWorkspace } from "../provider";
import { kinds, roleNames } from "../../domain/models";
import type { Merit } from "../../domain/models";
import { completedYears } from "../../domain/evaluation";
import { Avatar, PageHeader, Empty, Status, DataTable, TableCell, TableRow, dateLabel, EvidencePreview, SectionTitle } from "../components/common";
import { TeacherForm, MeritForm, ReviewForm } from "../components/forms";
import { Trajectory } from "../components/trajectory";
export function Dossier({
  id
}: {
  id: string;
}) {
  const {
    data,
    actor
  } = useWorkspace();
  const [edit, setEdit] = useState(false);
  const [add, setAdd] = useState(false);
  const [merit, setMerit] = useState<Merit>();
  const [review, setReview] = useState<Merit>();
  const [preview, setPreview] = useState("");
  if (!data) return null;
  const t = data.teachers.find(t => t.id === id);
  if (!t) return <Empty title="Legajo no disponible" description="El docente no está disponible para este perfil." action={<Button asChild><Link href="/docentes">Volver al directorio</Link></Button>} />;
  const merits = data.merits.filter(m => m.teacherId === id),
    audit = data.audit.filter(a => a.teacherId === id),
    verified = merits.filter(m => m.status === "verificado");
  const editable = actor.role === "legajos" || actor.role === "docente";
  const meritTable = (list: Merit[]) => <>{list.length ? <DataTable headers={["Mérito y documento", "Tipo", "Fecha", "Estado", "Acciones"]}>{list.map(m => <TableRow key={m.id}><TableCell><strong>{m.title}</strong><small>{m.institution}</small>{m.observation && <span className="observation-text">{m.observation}</span>}</TableCell><TableCell>{kinds[m.kind]}</TableCell><TableCell>{dateLabel(m.date)}</TableCell><TableCell><Status value={m.status} /></TableCell><TableCell><div className="row-actions"><Button size="sm" variant="outline" onClick={() => setPreview(m.fileId)}><FileText size={14} />Ver</Button>{editable && m.status !== "verificado" && <Button size="sm" variant="ghost" onClick={() => setMerit(m)}>Corregir</Button>}{["legajos", "comision"].includes(actor.role) && m.status === "pendiente" && <Button size="sm" onClick={() => setReview(m)}>Revisar</Button>}</div></TableCell></TableRow>)}</DataTable> : <Empty title="Todavía no hay evidencias" description="Agrega un mérito con su documento para iniciar el historial." />}</>;
  return <><Link href="/docentes" className="back-link"><ArrowLeft size={16} />Directorio docente</Link><PageHeader eyebrow={t.code + " · LEGAJO DOCENTE"} title={t.name} description={t.specialty} action={<div className="row-actions">{actor.role === "legajos" && <Button variant="outline" onClick={() => setEdit(true)}><Pencil />Editar ficha</Button>}{editable && <Button onClick={() => setAdd(true)}><Plus />Agregar mérito</Button>}</div>} />
 <section className="profile-strip"><Avatar name={t.name} large /><div><span className="category-tag">{t.category}</span><p>{t.dedication}</p></div><div><small><Building2 size={14} />Adscripción</small><strong>{t.faculty}</strong><p>{t.department}</p></div><div><small><Mail size={14} />Correo</small><strong>{t.email}</strong></div><div className="profile-count"><strong>{verified.length}<span>/{merits.length}</span></strong><small>evidencias verificadas</small></div></section>
 <Tabs defaultValue="resumen" className="dossier-tabs"><TabsList variant="line"><TabsTrigger value="resumen">Resumen</TabsTrigger><TabsTrigger value="grados">Grados y experiencia</TabsTrigger><TabsTrigger value="meritos">Méritos</TabsTrigger><TabsTrigger value="documentos">Documentos</TabsTrigger><TabsTrigger value="historial">Historial</TabsTrigger></TabsList>
 <TabsContent value="resumen"><div className="two-columns"><section className="panel padded"><SectionTitle title="Trayectoria académica" /><div className="profile-fact"><GraduationCap /><div><small>Categoría actual</small><strong>{t.category}</strong></div></div><div className="profile-fact"><CalendarDays /><div><small>Inicio en la categoría</small><strong>{dateLabel(t.since)} · {completedYears(t.since, new Date().toISOString())} años completos</strong></div></div><div className="profile-fact"><CheckCircle2 /><div><small>Ratificación documental</small><strong>{verified.some(m => m.kind === "ratificacion") ? "Acreditada en la demostración" : "Pendiente de acreditar"}</strong></div></div></section><section className="panel padded"><SectionTitle title="Tu próximo paso" /><h3>{merits.some(m => m.status === "observado") ? "Hay evidencias por corregir" : merits.some(m => m.status === "pendiente") ? "El legajo está en revisión" : "Legajo disponible para evaluación"}</h3><p className="muted-copy">Consulta las observaciones en la pestaña Méritos. Los documentos verificados se considerarán al evaluar la solicitud.</p><Button asChild variant="outline"><Link href="/solicitudes">Consultar solicitudes</Link></Button><div className="mini-stats"><div><b>{merits.filter(m => m.status === "pendiente").length}</b><span>Por revisar</span></div><div><b>{merits.filter(m => m.status === "observado").length}</b><span>Observados</span></div></div></section></div></TabsContent>
 <TabsContent value="grados"><section className="panel"><SectionTitle title="Grados acreditados y antecedentes" />{meritTable(merits.filter(m => ["titulo", "doctorado", "maestria", "ratificacion"].includes(m.kind)))}<div className="notice inside"><CalendarDays /><div><b>Tiempo en categoría: {completedYears(t.since, new Date().toISOString())} años</b><p>Se calcula desde el {dateLabel(t.since)}. El dato de la ficha es referencial para la simulación.</p></div></div></section><Trajectory teacherId={id} /></TabsContent>
 <TabsContent value="meritos"><section className="panel"><SectionTitle title="Todos los méritos" />{meritTable(merits)}</section></TabsContent>
 <TabsContent value="documentos"><section className="panel"><SectionTitle title="Archivo documental" />{merits.length ? <div className="document-grid">{merits.map(m => <button className="document-card" key={m.id} onClick={() => setPreview(m.fileId)}><FileText size={28} /><strong>{m.fileName}</strong><Status value={m.status} /><span>Abrir documento</span></button>)}</div> : <Empty />}</section></TabsContent>
 <TabsContent value="historial"><section className="panel padded"><SectionTitle title="Revisiones y correcciones conservadas" />{data.reviews.filter(r => r.teacherId === id).map(r => <details key={r.id} className="history-details"><summary>{r.after.title} · {r.action === "correccion" ? "Corrección" : r.action === "migracion" ? "Registro heredado" : "Revisión"} · {r.reviewer.name}</summary><p>{new Date(r.at).toLocaleString("es-PE")}</p><p>{r.note || "Sin observación adicional"}</p><p>{r.before.status} → {r.after.status}</p><div className="row-actions"><Button variant="outline" size="sm" onClick={() => setPreview(r.before.fileId)}>Documento anterior</Button><Button variant="outline" size="sm" onClick={() => setPreview(r.after.fileId)}>Documento de esta versión</Button></div></details>)}<SectionTitle title="Historial del legajo" />{audit.length ? <ol className="timeline">{audit.map(a => <li key={a.id}><span className="timeline-dot" /><div><strong>{a.message}</strong><small>{dateLabel(a.at)} · {a.actorName ?? roleNames[a.actor]}</small></div></li>)}</ol> : <Empty title="El historial comienza contigo" description="Las nuevas operaciones quedarán registradas con fecha y perfil." />}</section></TabsContent></Tabs>
 {edit && <TeacherForm teacher={t} onClose={() => setEdit(false)} />} {(add || merit) && <MeritForm teacherId={id} merit={merit} onClose={() => {
      setAdd(false);
      setMerit(undefined);
    }} />}{review && <ReviewForm merit={review} onClose={() => setReview(undefined)} />} {preview && <EvidencePreview fileId={preview} onClose={() => setPreview("")} />}
 </>;
}
