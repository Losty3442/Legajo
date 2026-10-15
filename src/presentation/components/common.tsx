"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Inbox, ArrowUpRight, CheckCircle2, Clock3, AlertCircle, FileText, XCircle } from "lucide-react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogHeader, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty as EmptyRoot, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import Link from "next/link";
import { legajoService } from "../../composition";
import { useWorkspace } from "../provider";
export const dateLabel = (s: string) => new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric"
}).format(new Date(s.length === 10 ? s + "T12:00:00" : s));
export const initials = (name: string) => name.split(" ").slice(0, 2).map(x => x[0]).join("");
export function Avatar({
  name,
  large = false
}: {
  name: string;
  large?: boolean;
}) {
  return <span className={"avatar " + (large ? "large" : "")}>{initials(name)}</span>;
}
const statusLabels: Record<string, string> = {
  pendiente: "Por revisar",
  verificado: "Verificado",
  observado: "Observado",
  borrador: "Borrador",
  presentada: "Presentada",
  observada: "Por corregir",
  evaluada: "Evaluada",
  apto: "Apto para propuesta",
  no_apto: "No apto",
  sin_vacante: "Sin vacante"
  ,abierta: "Recepción abierta", evaluacion: "En evaluación y trámite", cerrada: "Cerrada",
  no_presentada: "No presentada", propuesta: "Propuesta preparada", en_facultad: "En Consejo de Facultad",
  en_consejo: "En Consejo Universitario", aprobada: "Aprobada · Demo", denegada: "Denegada · Demo",
  decanato: "Preparada en decanato", facultad: "En Consejo de Facultad", universitario: "En Consejo Universitario"
};
export function Status({
  value
}: {
  value: string;
}) {
  const good = ["verificado", "apto", "evaluada", "aprobada"].includes(value),
    bad = ["observado", "observada", "no_apto", "denegada"].includes(value);
  const Icon = good ? CheckCircle2 : bad ? AlertCircle : Clock3;
  return <span className={"status " + (good ? "success" : bad ? "warning" : "neutral")}><Icon size={13} />{statusLabels[value] ?? value}</span>;
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
export function Empty({
  title = "No hay registros",
  description = "Los nuevos registros aparecerán aquí.",
  action
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return <EmptyRoot className="empty-state"><EmptyHeader><EmptyMedia variant="icon"><Inbox size={27} /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader>{action && <EmptyContent>{action}</EmptyContent>}</EmptyRoot>;
}
export function Loading() {
  return <div className="space-y-6 p-8" aria-label="Cargando"><Skeleton className="h-12 w-80" /><div className="grid grid-cols-2 gap-4"><Skeleton className="h-36" /><Skeleton className="h-36" /></div><Skeleton className="h-80" /></div>;
}
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  id
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    label: string;
  }[];
  id?: string;
}) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger id={id} aria-label={label} className="filter-select"><SelectValue placeholder={label} /></SelectTrigger><SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;
}
export function Field({
  name,
  label,
  error,
  ...props
}: {
  name: string;
  label: string;
  error?: string;
} & React.ComponentProps<typeof Input>) {
  return <div className="field"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} aria-invalid={!!error} aria-describedby={error ? name + "-error" : undefined} {...props} />{error && <p id={name + "-error"} className="field-error">{error}</p>}</div>;
}
export function DataTable({
  headers,
  children
}: {
  headers: string[];
  children: ReactNode;
}) {
  return <><p className="scroll-hint">Desliza para ver todas las columnas →</p><div className="table-scroll" role="region" aria-label="Tabla de registros con desplazamiento horizontal" tabIndex={0}><Table><TableHeader><TableRow>{headers.map((h, i) => <TableHead key={h || i}>{h || "Acciones"}</TableHead>)}</TableRow></TableHeader><TableBody>{children}</TableBody></Table></div></>;
}
export { TableRow, TableCell };
export function Metric({
  label,
  value,
  detail,
  icon
}: {
  label: string;
  value: ReactNode;
  detail: string;
  icon: ReactNode;
}) {
  return <div className="metric"><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}</strong><p>{detail}</p></div>;
}
export function Score({
  value,
  threshold = 55
}: {
  value: number;
  threshold?: number;
}) {
  return <div className="score-line"><div><b>{value}</b><span> / 100 puntos</span></div><Progress value={value} aria-label={"Puntaje " + value + " de 100"} /><small>Umbral de ejemplo: {threshold} puntos</small></div>;
}
export function SectionTitle({
  title,
  link,
  href
}: {
  title: string;
  link?: string;
  href?: string;
}) {
  return <div className="section-title"><h2>{title}</h2>{href && <Link href={href}>{link ?? "Ver todos"} <ArrowUpRight size={15} /></Link>}</div>;
}
export function Confirm({
  open,
  onClose,
  title,
  description,
  onConfirm,
  destructive = false
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return <AlertDialog open={open} onOpenChange={v => !v && onClose()}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className={destructive ? "bg-destructive" : ""} onClick={onConfirm}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
export function RecordDialog({
  open,
  onClose,
  title,
  description,
  dirty,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  dirty: boolean;
  children: ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return <><Dialog open={open} onOpenChange={v => {
      if (!v) {
        if (dirty) setConfirm(true);else onClose();
      }
    }}><DialogContent className="record-dialog"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{children}</DialogContent></Dialog><Confirm open={confirm} onClose={() => setConfirm(false)} title="¿Descartar los cambios?" description="Los datos que todavía no guardaste se perderán." onConfirm={() => {
      setConfirm(false);
      onClose();
    }} /></>;
}
export function EvidencePreview({
  fileId,
  onClose
}: {
  fileId: string;
  onClose: () => void;
}) {
  const {
    actor
  } = useWorkspace();
  const [file, setFile] = useState<{
    url: string;
    type: string;
    name: string;
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    let url = "",
      active = true;
    legajoService.document(actor, fileId).then(doc => {
      if (!active) return;
      url = URL.createObjectURL(doc.blob);
      if (active) setFile({
        url,
        type: doc.type,
        name: doc.name
      });
    }).catch(e => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [actor, fileId]);
  return <Dialog open onOpenChange={v => !v && onClose()}><DialogContent className="preview-dialog"><DialogHeader><DialogTitle>{file?.name ?? "Evidencia documental"}</DialogTitle><DialogDescription>Documento de la demostración local.</DialogDescription></DialogHeader>{error ? <div role="alert" className="error-box">{error}</div> : file ? <><div className="document-preview">{file.type === "application/pdf" ? <iframe title={file.name} src={file.url} /> : <Image src={file.url} alt={file.name} width={1000} height={1000} unoptimized />}</div><a href={file.url} download={file.name} className="text-link"><FileText size={16} />Descargar documento</a></> : <Loading />}</DialogContent></Dialog>;
}
export function RequirementRow({
  label,
  met,
  detail
}: {
  label: string;
  met: boolean;
  detail: string;
}) {
  return <div className="requirement">{met ? <CheckCircle2 className="text-teal-700" size={19} /> : <XCircle className="text-amber-700" size={19} />}<div><strong>{label}</strong><small>{detail}</small></div></div>;
}
