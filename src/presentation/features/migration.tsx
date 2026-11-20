"use client";
import {useState} from "react";
import {Database,Download,Upload,ShieldCheck} from "lucide-react";
import {createBackup,readLegacyWorkspace} from "../../application/backup";
import {legajoService} from "../../composition";
import {useWorkspace} from "../provider";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";

type Report={docentes:number;meritos:number;solicitudes:number;evaluaciones:number;documentos:number;bytes:number;advertencias:string[];comprobada?:boolean;repetida?:boolean};
export function MigrationView(){
  const{actor,refresh}=useWorkspace();const[archive,setArchive]=useState<File>();const[report,setReport]=useState<Report>();const[error,setError]=useState("");const[busy,setBusy]=useState(false);const[saved,setSaved]=useState(false);
  async function preview(file:File){const form=new FormData();form.set("backup",file);setReport(await legajoService.json<Report>("/migrations/preview",{method:"POST",body:form}));setArchive(file);}
  async function exportLegacy(){setBusy(true);setError("");try{const legacy=await readLegacyWorkspace();if(!legacy)throw new Error("No se encontraron datos del sistema en este navegador. Usa Chrome, perfil The, con la dirección localhost:5173, o selecciona un respaldo exportado.");const bytes=await createBackup(legacy.data,legacy.documents);const file=new File([new Uint8Array(bytes)],"respaldo-legajo.zip",{type:"application/zip"});const url=URL.createObjectURL(file),a=document.createElement("a");a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);setSaved(true);await preview(file);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function select(file:File|undefined){if(!file)return;setBusy(true);setError("");setSaved(false);try{await preview(file);setSaved(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function commit(){if(!archive)return;setBusy(true);setError("");try{const form=new FormData();form.set("backup",archive);setReport(await legajoService.json<Report>("/migrations",{method:"POST",body:form}));await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  if(actor.role!=="legajos")return <div className="panel padded"><h1>Preparación del sistema</h1><p>El personal de Legajos debe importar el respaldo antes de habilitar los datos.</p></div>;
  return <div className="mx-auto max-w-3xl space-y-6 p-6"><header><p className="eyebrow">PREPARACIÓN Y RESPALDO</p><h1 className="text-3xl font-bold">Conservar tus datos</h1><p className="mt-2 text-slate-600">Importa los registros y documentos del navegador a PostgreSQL. El almacenamiento anterior se conserva intacto.</p></header>
    <section className="panel padded space-y-4"><h2 className="flex items-center gap-2 text-lg font-semibold"><Download size={20}/>1. Guardar el respaldo</h2><p className="text-sm text-slate-600">Abre esta página desde el navegador donde usaste el sistema. Se descargará un ZIP con los registros, documentos y huellas de integridad.</p><Button disabled={busy} onClick={()=>void exportLegacy()}>Respaldar los datos de este navegador</Button><div className="border-t pt-4"><label htmlFor="migration-zip" className="text-sm font-medium">O selecciona un respaldo ZIP existente</label><Input id="migration-zip" type="file" accept=".zip,application/zip" disabled={busy} onChange={e=>void select(e.target.files?.[0])}/></div></section>
    {report&&<section className="panel padded space-y-4"><h2 className="flex items-center gap-2 text-lg font-semibold"><Database size={20}/>2. Revisar e importar</h2><dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">{[["Docentes",report.docentes],["Méritos",report.meritos],["Solicitudes",report.solicitudes],["Evaluaciones",report.evaluaciones],["Documentos",report.documentos]].map(([label,value])=><div key={label} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="text-2xl font-semibold">{value}</dd></div>)}</dl>{report.advertencias.map((warning,i)=><p key={i} className="rounded bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>)}<Button disabled={busy||!saved||report.comprobada} onClick={()=>void commit()}><Upload size={17}/>{busy?"Comprobando…":"Importar respaldo verificado"}</Button>{report.comprobada&&<p className="flex gap-2 text-emerald-700"><ShieldCheck size={20}/>Importación comprobada. Los datos ya están disponibles.</p>}</section>}
    {error&&<p role="alert" className="rounded bg-red-50 p-4 text-red-700">{error}</p>}
  </div>;
}
