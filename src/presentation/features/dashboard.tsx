"use client";

import Link from "next/link";
import { ArrowRight, FileCheck2, Users, ClipboardList, Clock3, ChevronRight, GraduationCap, ShieldCheck, FolderOpen } from "lucide-react";
import { useWorkspace } from "../provider";
import { Avatar, Metric, PageHeader, SectionTitle, Status, dateLabel, Empty } from "../components/common";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
export function Dashboard() {
  const {
    data,
    actor
  } = useWorkspace();
  if (!data) return null;
  const pending = data.merits.filter(m => m.status === "pendiente"),
    verified = data.merits.filter(m => m.status === "verificado"),
    observed = data.merits.filter(m => m.status === "observado");
  const rate = data.merits.length ? Math.round(verified.length / data.merits.length * 100) : 0;
  const own = actor.role === "docente";
  const authority = ["decanato", "consejo_facultad", "consejo_universitario"].includes(actor.role);
  return <><PageHeader eyebrow="OFICINA DE PERSONAL · DEMOSTRACIÓN" title={own ? "Tu trayectoria, en un solo lugar" : "Panel de gestión"} description={own ? "Mantén tus méritos al día y sigue el avance de tu promoción." : "Una visión clara del legajo docente y los procesos que requieren atención."} action={<Button asChild><Link href={authority ? "/propuestas" : own ? "/legajos/" + actor.teacherId : actor.role === "comision" ? "/evaluaciones" : "/docentes"}><FolderOpen size={17} />{authority ? "Ver propuestas" : own ? "Abrir mi legajo" : actor.role === "comision" ? "Ir a evaluaciones" : "Gestionar docentes"}</Link></Button>} />
 {authority && <div className="notice inside"><p>{data.proposals.filter(p => actor.role === "decanato" ? p.status === "decanato" : actor.role === "consejo_facultad" ? p.status === "facultad" : p.status === "universitario").length} propuestas esperan atención de este perfil.</p><Link className="text-link" href={actor.role === "decanato" ? "/orden-merito" : "/propuestas"}>Abrir bandeja de trámite</Link></div>}<div className="metrics-grid"><Metric label={own ? "Méritos registrados" : "Docentes registrados"} value={own ? data.merits.length : data.teachers.length} detail={own ? "Tu historial académico" : "En las facultades de demostración"} icon={<Users size={19} />} /><Metric label="Documentos verificados" value={verified.length} detail={rate + "% del total de evidencias"} icon={<FileCheck2 size={19} />} /><Metric label="Pendientes de revisión" value={pending.length} detail="Evidencias por comprobar" icon={<Clock3 size={19} />} /><Metric label="Solicitudes en proceso" value={data.requests.filter(r => !["aprobada", "denegada", "no_presentada"].includes(r.status)).length} detail={data.evaluations.length + " evaluaciones cerradas"} icon={<ClipboardList size={19} />} /></div>
 <div className="dashboard-grid"><section className="panel"><SectionTitle title="Por atender" href={own ? "/legajos/" + actor.teacherId : "/revision"} link="Ver evidencias" /><div className="attention-intro"><div className="attention-icon"><Clock3 size={23} /></div><div><h3>{pending.length ? pending.length + " evidencias esperan una revisión" : "Todo está revisado"}</h3><p>{own ? "Puedes consultar cada documento desde tu legajo." : "Comprueba los documentos y ayuda a que el proceso avance."}</p></div></div>
 {pending.length ? pending.slice(0, 4).map(m => {
          const t = data.teachers.find(t => t.id === m.teacherId)!;
          return <Link className="task-row" href={own ? "/legajos/" + t.id : "/revision"} key={m.id}><span className="document-icon"><FileCheck2 size={20} /></span><div><strong>{m.title}</strong><small>{t.name} · {dateLabel(m.createdAt)}</small></div><Status value={m.status} /><ChevronRight size={17} /></Link>;
        }) : <Empty title="Sin documentos pendientes" description="Las nuevas evidencias aparecerán en esta bandeja." />}</section>
 <section className="panel document-health"><SectionTitle title="Estado del legajo" /><div className="donut" role="img" aria-label={rate + " por ciento de documentos verificados"} style={{
          background: "conic-gradient(#0c8c81 " + rate + "%, #e8eff2 0)"
        }}><div><strong>{rate}<small>%</small></strong><span>verificado</span></div></div><div className="legend-row"><span><i className="dot teal" />Verificados</span><b>{verified.length}</b></div><div className="legend-row"><span><i className="dot blue" />Por revisar</span><b>{pending.length}</b></div><div className="legend-row"><span><i className="dot amber" />Observados</span><b>{observed.length}</b></div><div className="health-note"><ShieldCheck size={18} /><p>Cada mérito cuenta con su documento de respaldo.</p></div></section></div>
 <div className="dashboard-bottom"><section className="panel"><SectionTitle title="Solicitudes recientes" href="/solicitudes" />{data.requests.length ? data.requests.slice(0, 4).map(r => {
          const t = data.teachers.find(t => t.id === r.teacherId)!;
          return <Link key={r.id} href={"/evaluaciones/" + r.id} className="request-summary"><Avatar name={t.name} /><div><strong>{t.name}</strong><small>{t.category} a {r.target} · {t.department}</small></div><Status value={r.status} /><ArrowRight size={16} /></Link>;
        }) : <Empty title="Aún no hay solicitudes" description="Prepara tu primera solicitud desde la sección Solicitudes." />}</section>
 <section className="rubric-card"><GraduationCap size={29} /><div className="eyebrow">RÚBRICA DE SIMULACIÓN</div><h2>Una evaluación <br />con sustento.</h2><p>Requisitos, evidencias y puntajes reunidos en una revisión transparente.</p><div className="rubric-threshold"><strong>55</strong><span>puntos de referencia<br />sobre un máximo de 100</span></div><Progress value={55} aria-label="Umbral de ejemplo 55 de 100" /><Link href="/rubrica">Consultar la rúbrica de ejemplo <ArrowUpRightIcon /></Link></section></div>
 </>;
}
function ArrowUpRightIcon() {
  return <ArrowRight size={16} />;
}
