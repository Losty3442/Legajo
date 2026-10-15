"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GraduationCap, LayoutDashboard, Users, FolderOpen, FileCheck2, ClipboardList, Scale, BookOpen, RotateCcw, ShieldCheck, ArrowRight, RefreshCw } from "lucide-react";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { WorkspaceProvider, useWorkspace } from "./provider";
import { Confirm, FilterSelect, Loading, Empty } from "./components/common";
import { Dashboard } from "./features/dashboard";
import { Teachers } from "./features/teachers";
import { Dossier } from "./features/dossier";
import { Review } from "./features/review";
import { Requests } from "./features/requests";
import { EvaluationView, Rubric } from "./features/evaluation";
import { roleNames, demoUsers, type Role } from "../domain/models";
import { legajoService } from "../composition";
import { Calls } from "./features/calls";
import { MeritOrder, Proposals } from "./features/proposals";
const navigation = [{
  url: "/",
  label: "Panel de gestión",
  icon: LayoutDashboard
}, {
  url: "/docentes",
  label: "Docentes y legajos",
  icon: Users
}, {
  url: "/revision",
  label: "Revisión documental",
  icon: FileCheck2
}, {
  url: "/solicitudes",
  label: "Solicitudes",
  icon: ClipboardList
}, {
  url: "/evaluaciones",
  label: "Evaluaciones",
  icon: Scale
}, {
  url: "/convocatorias", label: "Convocatorias", icon: ClipboardList
}, {
  url: "/orden-merito", label: "Orden de mérito", icon: Scale
}, {
  url: "/propuestas", label: "Propuestas y decisiones", icon: FileCheck2
}, {
  url: "/rubrica",
  label: "Rúbrica de ejemplo",
  icon: BookOpen
}];
function Navigation() {
  const path = usePathname();
  const {
    actor,
    data
  } = useWorkspace();
  const {
    setOpenMobile
  } = useSidebar();
  const links = actor.role === "docente" ? [{
    url: "/",
    label: "Panel de gestión",
    icon: LayoutDashboard
  }, {
    url: "/legajos/" + actor.teacherId,
    label: "Mi legajo",
    icon: FolderOpen
  }, ...navigation.filter(n => ["/solicitudes", "/evaluaciones", "/rubrica", "/convocatorias", "/propuestas"].includes(n.url))] : navigation.filter(n => n.url !== "/revision" || ["legajos", "comision"].includes(actor.role));
  return <SidebarMenu>{links.map(n => {
      const active = n.url === "/" ? path === "/" : path.startsWith(n.url) || n.url === "/docentes" && path.startsWith("/legajos");
      return <SidebarMenuItem key={n.url}><SidebarMenuButton asChild isActive={active}><Link href={n.url} aria-label={n.label} onClick={() => setOpenMobile(false)}><n.icon size={19} /><span>{n.label}</span>{n.url === "/revision" && !!data?.merits.filter(m => m.status === "pendiente").length && <span className="nav-count">{data.merits.filter(m => m.status === "pendiente").length}</span>}</Link></SidebarMenuButton></SidebarMenuItem>;
    })}</SidebarMenu>;
}
function Shell({
  children
}: {
  children: ReactNode;
}) {
  const {
    actor,
    setActor,
    data,
    people,
    error,
    refresh,
    busy,
    execute
  } = useWorkspace();
  const path = usePathname();
  const router = useRouter();
  const [reset, setReset] = useState(false);
  const label = path.startsWith("/legajos") ? "Legajo docente" : navigation.find(n => n.url !== "/" && path.startsWith(n.url))?.label ?? "Panel de gestión";
  function changeRole(role: string) {
    setActor({
      ...actor,
      role: role as Role, userId: demoUsers.find(u => u.role === role)?.id
    });
    router.push("/");
  }
  return <SidebarProvider><a className="skip-link" href="#workspace">Saltar al contenido</a><Sidebar className="app-sidebar"><SidebarHeader><Link href="/" className="brand"><span className="brand-mark"><GraduationCap size={25} /></span><span><strong>Legajo<span className="brand-unp">UNP</span></strong><small>GESTIÓN DOCENTE</small></span></Link></SidebarHeader><SidebarContent><SidebarGroup><SidebarGroupLabel>ESPACIO DE TRABAJO</SidebarGroupLabel><Navigation /></SidebarGroup></SidebarContent><SidebarFooter><div className="sidebar-note"><ShieldCheck size={19} /><b>Tu información, organizada.</b><p>Un respaldo para cada etapa de la trayectoria docente.</p></div><div className="local-chip"><span />DEMOSTRACIÓN LOCAL</div>{actor.role === "legajos" && <button disabled={busy} className="reset-button" onClick={() => setReset(true)}><RotateCcw size={15} />Restaurar datos de ejemplo</button>}</SidebarFooter></Sidebar><SidebarInset className="app-inset"><header className="topbar"><div className="breadcrumb"><SidebarTrigger aria-label="Abrir navegación" /><span>Oficina de personal</span><i>/</i><strong>{label}</strong></div><div className="profile-controls"><span className="demo-pill">DEMO</span><FilterSelect label="Perfil de demostración" value={actor.role} onChange={changeRole} options={Object.entries(roleNames).map(([value, label]) => ({
            value,
            label
          }))} />{actor.role === "docente" && <FilterSelect label="Docente de demostración" value={actor.teacherId} onChange={teacherId => {
            setActor({
              ...actor,
              teacherId
            });
            router.push("/");
          }} options={people.map(t => ({
            value: t.id,
            label: t.name
          }))} />}{actor.role !== "docente" && <FilterSelect label="Responsable de demostración" value={actor.userId ?? demoUsers.find(u => u.role === actor.role)!.id} onChange={userId => setActor({ ...actor, userId })} options={demoUsers.filter(u => u.role === actor.role).map(u => ({ value: u.id, label: u.name }))} />}<span className="profile-avatar">{actor.role === "legajos" ? "LP" : actor.role === "comision" ? "CE" : actor.role === "decanato" ? "DE" : actor.role === "consejo_facultad" ? "CF" : actor.role === "consejo_universitario" ? "CU" : "DO"}</span></div></header><div id="workspace" className="workspace-content" tabIndex={-1}>{error ? <div className="panel padded"><Empty title="No pudimos cargar los datos" description={error} action={<Button onClick={() => void refresh()}><RefreshCw />Volver a intentar</Button>} /></div> : data ? children : <Loading />}</div><footer className="app-footer"><span>Legajo UNP · Prototipo académico</span><span>Datos ficticios · Almacenados en este navegador</span></footer></SidebarInset><Toaster theme="light" position="bottom-right" richColors closeButton /><Confirm open={reset} onClose={() => setReset(false)} title="¿Restaurar la demostración?" description="Se eliminarán los registros y documentos de prueba agregados en este navegador y volverán los ejemplos iniciales." destructive onConfirm={() => {
      setReset(false);
      void execute(() => legajoService.reset(actor), "Demostración restaurada");
      router.push("/");
    }} /></SidebarProvider>;
}
export function AppFrame({
  children
}: {
  children: ReactNode;
}) {
  return <WorkspaceProvider><Shell>{children}</Shell></WorkspaceProvider>;
}
export function RouteView() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return <Dashboard />;
  if (segments[0] === "docentes" && segments.length === 1) return <Teachers />;
  if (segments[0] === "legajos" && segments[1]) return <Dossier key={segments[1]} id={segments[1]} />;
  if (segments[0] === "revision") return <Review />;
  if (segments[0] === "solicitudes" && segments.length === 1) return <Requests />;
  if (segments[0] === "evaluaciones") return segments[1] ? <EvaluationView key={segments[1]} id={segments[1]} /> : <Requests evaluations />;
  if (segments[0] === "convocatorias") return <Calls />;
  if (segments[0] === "orden-merito") return <MeritOrder />;
  if (segments[0] === "propuestas") return <Proposals />;
  if (segments[0] === "rubrica") return <Rubric />;
  return <Empty title="Página no encontrada" description="Vuelve al panel para continuar." action={<Button asChild><Link href="/">Ir al panel <ArrowRight /></Link></Button>} />;
}
