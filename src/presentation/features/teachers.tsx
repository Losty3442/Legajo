"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "../provider";
import { Avatar, DataTable, TableRow, TableCell, Empty, PageHeader, FilterSelect } from "../components/common";
import { TeacherForm } from "../components/forms";
export function Teachers() {
  const {
    data,
    actor
  } = useWorkspace();
  const [search, setSearch] = useState("");
  const [faculty, setFaculty] = useState("all");
  const [category, setCategory] = useState("all");
  const [department, setDepartment] = useState("all");
  const [create, setCreate] = useState(false);
  if (!data) return null;
  const departments = [...new Set(data.teachers.filter(t => faculty === "all" || t.faculty === faculty).map(t => t.department))];
  const teachers = data.teachers.filter(t => (faculty === "all" || t.faculty === faculty) && (category === "all" || t.category === category) && (department === "all" || t.department === department) && (t.name + " " + t.code + " " + t.email).toLowerCase().includes(search.toLowerCase()));
  return <><PageHeader eyebrow="DIRECTORIO" title="Docentes" description="Consulta las fichas y accede al historial académico de cada docente." action={actor.role === "legajos" && <Button onClick={() => setCreate(true)}><Plus />Registrar docente</Button>} /><section className="panel"><div className="filter-bar"><div className="search-field"><Search size={17} /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre, código o correo…" aria-label="Buscar docentes" /></div><SlidersHorizontal size={17} className="filter-icon" /><FilterSelect label="Filtrar por facultad" value={faculty} onChange={v => {
          setFaculty(v);
          setDepartment("all");
        }} options={[{
          value: "all",
          label: "Todas las facultades"
        }, ...[...new Set(data.teachers.map(t => t.faculty))].map(v => ({
          value: v,
          label: v
        }))]} /><FilterSelect label="Filtrar por departamento" value={department} onChange={setDepartment} options={[{
          value: "all",
          label: "Departamentos"
        }, ...departments.map(v => ({
          value: v,
          label: v
        }))]} /><FilterSelect label="Filtrar por categoría" value={category} onChange={setCategory} options={[{
          value: "all",
          label: "Categorías"
        }, ...["Auxiliar", "Asociado", "Principal"].map(v => ({
          value: v,
          label: v
        }))]} /></div>
 {teachers.length ? <DataTable headers={["Docente", "Facultad y departamento", "Categoría", "Legajo", ""]}>{teachers.map(t => {
          const total = data.merits.filter(m => m.teacherId === t.id),
            verified = total.filter(m => m.status === "verificado");
          return <TableRow key={t.id}><TableCell><div className="person-cell"><Avatar name={t.name} /><div><strong>{t.name}</strong><small>{t.code} · {t.email}</small></div></div></TableCell><TableCell><strong>{t.faculty}</strong><small>{t.department}</small></TableCell><TableCell><span className="category-tag">{t.category}</span><small>{t.dedication}</small></TableCell><TableCell><strong>{verified.length} / {total.length}</strong><small>evidencias verificadas</small></TableCell><TableCell><Button asChild variant="ghost"><Link href={"/legajos/" + t.id}>Ver legajo <ArrowUpRight size={15} /></Link></Button></TableCell></TableRow>;
        })}</DataTable> : <Empty title="No encontramos docentes" description="Prueba con otro nombre o cambia los filtros." />}<div className="table-footer">{teachers.length} {teachers.length === 1 ? "docente" : "docentes"} · Datos ficticios de demostración</div></section>{create && <TeacherForm onClose={() => setCreate(false)} />}</>;
}
