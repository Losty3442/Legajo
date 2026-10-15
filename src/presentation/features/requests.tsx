"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ArrowUpRight, Send, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "../provider";
import type { ApplicationRequest } from "../../domain/models";
import { legajoService } from "../../composition";
import { Avatar, Empty, PageHeader, DataTable, TableRow, TableCell, Status, dateLabel, FilterSelect, Confirm } from "../components/common";
import { RequestForm, ObserveRequestForm } from "../components/forms";
export function Requests({
  evaluations = false
}: {
  evaluations?: boolean;
}) {
  const {
    data,
    actor,
    execute,
    busy
  } = useWorkspace();
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<ApplicationRequest>();
  const [observe, setObserve] = useState<ApplicationRequest>();
  const [submit, setSubmit] = useState<ApplicationRequest>();
  const [filter, setFilter] = useState("all");
  if (!data) return null;
  const rows = data.requests.filter(r => (filter === "all" || r.status === filter) && (!evaluations || (r.status === "presentada" || data.evaluations.some(e => e.requestId === r.id))));
  return <><PageHeader eyebrow={evaluations ? "COMISIÓN EVALUADORA" : "PROMOCIÓN DOCENTE"} title={evaluations ? "Evaluaciones" : "Solicitudes de promoción"} description={evaluations ? "Revisa requisitos, puntaje y plaza. Cada resultado conserva su evidencia." : "Sigue cada expediente desde el borrador hasta el resultado de evaluación."} action={!evaluations && ["docente", "legajos"].includes(actor.role) && <Button onClick={() => setCreate(true)}><Plus />Nueva solicitud</Button>} /><section className="panel"><div className="filter-bar"><p className="list-caption">{rows.length} expedientes · Historial de convocatorias</p><FilterSelect label="Estado de solicitud" value={filter} onChange={setFilter} options={[{
          value: "all",
          label: "Todos los estados"
        }, ...Object.entries({
          borrador: "Borrador",
          presentada: "Presentada",
          observada: "Por corregir",
          evaluada: "Evaluada", propuesta: "Propuesta", en_facultad: "En Facultad", en_consejo: "En Consejo", aprobada: "Aprobada", denegada: "Denegada", no_presentada: "No presentada"
        }).filter(([v]) => !evaluations || !["borrador", "observada", "no_presentada"].includes(v)).map(([value, label]) => ({
          value,
          label
        }))]} /></div>{rows.length ? <DataTable headers={["Docente", "Promoción", "Estado", "Actualización", "Acciones"]}>{rows.map(r => {
          const t = data.teachers.find(t => t.id === r.teacherId)!;
          return <TableRow key={r.id}><TableCell><div className="person-cell"><Avatar name={t.name} /><div><strong>{t.name}</strong><small>{t.code} · {data.calls.find(c => c.id === r.callId)?.name}</small></div></div>{r.note && r.status === "observada" && <span className="observation-text">{r.note}</span>}</TableCell><TableCell><strong>{r.target}</strong><small>{t.department}</small></TableCell><TableCell><Status value={r.status} /></TableCell><TableCell>{dateLabel(r.updatedAt)}</TableCell><TableCell><div className="row-actions"><Button variant="outline" size="sm" asChild><Link href={"/evaluaciones/" + r.id}>{data.evaluations.some(e => e.requestId === r.id) ? "Resultado" : evaluations ? "Evaluar" : "Detalle"}<ArrowUpRight size={14} /></Link></Button>{["docente", "legajos"].includes(actor.role) && ["borrador", "observada"].includes(r.status) && <><Button size="sm" variant="ghost" onClick={() => setEdit(r)}><Pencil size={14} />Editar</Button><Button size="sm" onClick={() => setSubmit(r)} disabled={busy}><Send size={14} />{r.status === "observada" ? "Reenviar" : "Presentar"}</Button></>}{["legajos", "comision"].includes(actor.role) && r.status === "presentada" && <Button size="sm" variant="ghost" onClick={() => setObserve(r)}>Observar</Button>}</div></TableCell></TableRow>;
        })}</DataTable> : <Empty title="No hay solicitudes en esta vista" description="Crea un borrador o cambia el filtro para ver otros expedientes." />}</section>
 {(create || edit) && <RequestForm teacherId={actor.role === "docente" ? actor.teacherId : undefined} request={edit} onClose={() => {
      setCreate(false);
      setEdit(undefined);
    }} />}{observe && <ObserveRequestForm request={observe} onClose={() => setObserve(undefined)} />}
 <Confirm open={!!submit} onClose={() => setSubmit(undefined)} title="¿Presentar la solicitud?" description="La comisión podrá revisar el expediente. Si necesita correcciones, te devolverá una observación." onConfirm={() => {
      if (submit) void execute(() => legajoService.submit(actor, submit.id), "Solicitud presentada");
      setSubmit(undefined);
    }} />
 </>;
}
