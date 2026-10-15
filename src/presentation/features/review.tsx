"use client";

import { useState } from "react";
import { Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "../provider";
import { kinds } from "../../domain/models";
import type { Merit } from "../../domain/models";
import { PageHeader, Empty, DataTable, TableRow, TableCell, Avatar, FilterSelect, Status, dateLabel, EvidencePreview } from "../components/common";
import { ReviewForm } from "../components/forms";
export function Review() {
  const {
    data,
    actor
  } = useWorkspace();
  const [filter, setFilter] = useState("pendiente");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Merit>();
  const [preview, setPreview] = useState("");
  if (!data) return null;
  if (!["legajos", "comision"].includes(actor.role)) return <Empty title="Vista reservada a los revisores" description="Consulta tus documentos desde Mi legajo." />;
  const rows = data.merits.filter(m => (filter === "all" || m.status === filter) && (m.title + " " + data.teachers.find(t => t.id === m.teacherId)?.name).toLowerCase().includes(search.toLowerCase()));
  return <><PageHeader eyebrow="VERIFICACIÓN DOCUMENTAL" title="Bandeja de revisión" description="Comprueba el respaldo de cada mérito y deja indicaciones claras cuando haga falta corregirlo." /><section className="panel"><div className="filter-bar"><div className="search-field"><Search size={17} /><Input aria-label="Buscar evidencias" placeholder="Buscar documento o docente…" value={search} onChange={e => setSearch(e.target.value)} /></div><FilterSelect label="Estado de revisión" value={filter} onChange={setFilter} options={[{
          value: "pendiente",
          label: "Por revisar"
        }, {
          value: "observado",
          label: "Observados"
        }, {
          value: "verificado",
          label: "Verificados"
        }, {
          value: "all",
          label: "Todos los estados"
        }]} /></div>{rows.length ? <DataTable headers={["Evidencia", "Docente", "Fecha", "Estado", "Acciones"]}>{rows.map(m => <TableRow key={m.id}><TableCell><strong>{m.title}</strong><small>{kinds[m.kind]}</small>{m.observation && <span className="observation-text">{m.observation}</span>}</TableCell><TableCell><div className="person-cell"><Avatar name={data.teachers.find(t => t.id === m.teacherId)?.name ?? "Docente"} />{data.teachers.find(t => t.id === m.teacherId)?.name}</div></TableCell><TableCell>{dateLabel(m.date)}</TableCell><TableCell><Status value={m.status} /></TableCell><TableCell><div className="row-actions"><Button variant="outline" size="sm" onClick={() => setPreview(m.fileId)}><FileText size={14} />Documento</Button>{m.status === "pendiente" && <Button size="sm" onClick={() => setSelected(m)}>Revisar</Button>}</div></TableCell></TableRow>)}</DataTable> : <Empty title="Bandeja al día" description="No hay evidencias que coincidan con estos filtros." />}<div className="table-footer">{rows.length} evidencias encontradas</div></section>{selected && <ReviewForm merit={selected} onClose={() => setSelected(undefined)} />} {preview && <EvidencePreview fileId={preview} onClose={() => setPreview("")} />}</>;
}
