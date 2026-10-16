"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GraduationCap, LayoutDashboard, Users, FolderOpen, FileCheck2, ClipboardList, Scale, BookOpen, RotateCcw, ShieldCheck, ArrowRight, RefreshCw, LogOut, LogIn } from "lucide-react";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { WorkspaceProvider, useWorkspace } from "./provider";
import { Confirm, FilterSelect, Loading, Empty } from "./components/common";
import { Dashboard } from "./features/dashboard";
import { Teachers } from "./features/teachers";
import { Dossier } from "./features/dossier";
import { Review } from "./features/review";
import { Requests } from "./features/requests";
import { EvaluationView } from "./features/evaluation";
import { Rubric } from "./features/rubric";
import { roleNames, demoUsers, type Role } from "../domain/models";
import { legajoService } from "../composition";
import { Calls } from "./features/calls";
import { MeritOrder, Proposals } from "./features/proposals";
import { LoginView } from "./features/login";
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
    })}
    <SidebarMenuItem key="/login">
      <SidebarMenuButton asChild isActive={path === "/login"}>
        <Link href="/login" aria-label="Inicio / Cambiar de cuenta" onClick={() => setOpenMobile(false)}>
          <LogIn size={19} />
          <span>Inicio / Cuentas</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>;
}
function Shell({
  children
}: {
  children: ReactNode;
}) {
  const {
    actor,
    setActor,
    currentUser,
    isAuthenticated,
    logout,
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

  // If unauthenticated or explicitly on /login route, show full login portal
  if (!isAuthenticated || path === "/login") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white flex flex-col justify-between">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-xs">
          <Link href="/" className="flex items-center gap-2.5 text-slate-900">
            <span className="w-10 h-10 rounded-xl bg-teal-800 text-teal-100 flex items-center justify-center font-bold shadow-xs">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div>
              <strong className="block text-base leading-tight font-extrabold tracking-tight">Legajo<span className="text-teal-700">UNP</span></strong>
              <small className="block text-[10px] tracking-widest text-slate-500 uppercase font-bold">Universidad Nacional de Piura</small>
            </div>
          </Link>
          {isAuthenticated && (
            <Button size="sm" variant="outline" onClick={() => router.push("/")} className="text-xs gap-1.5 border-slate-300">
              Ir al panel <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </header>
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <LoginView />
        </main>
        <footer className="border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500 bg-white/60">
          <span>Universidad Nacional de Piura · Sistema de Legajo y Promoción Docente · Versión 2.0</span>
        </footer>
        <Toaster theme="light" position="bottom-right" richColors closeButton />
      </div>
    );
  }

  const label = path.startsWith("/legajos") ? "Legajo docente" : navigation.find(n => n.url !== "/" && path.startsWith(n.url))?.label ?? "Panel de gestión";
  function changeRole(role: string) {
    setActor({
      ...actor,
      role: role as Role, userId: demoUsers.find(u => u.role === role)?.id
    });
    router.push("/");
  }
  return <SidebarProvider><a className="skip-link" href="#workspace">Saltar al contenido</a><Sidebar className="app-sidebar"><SidebarHeader><Link href="/" className="brand"><span className="brand-mark"><GraduationCap size={25} /></span><span><strong>Legajo<span className="brand-unp">UNP</span></strong><small>GESTIÓN DOCENTE</small></span></Link></SidebarHeader><SidebarContent><SidebarGroup><SidebarGroupLabel>ESPACIO DE TRABAJO</SidebarGroupLabel><Navigation /></SidebarGroup></SidebarContent><SidebarFooter><div className="user-profile-card border border-[#2d475d] bg-[#1a384f] rounded-xl p-3 text-slate-200"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0">{currentUser?.avatarInitials ?? "UN"}</div><div className="min-w-0 flex-1"><span className="block text-xs font-semibold text-white truncate">{currentUser?.name ?? "Usuario Conectado"}</span><span className="block text-[10px] text-teal-300 truncate">{currentUser?.role.replace("_", " ")}</span></div><button onClick={() => { logout(); toast.info("Sesión finalizada"); router.push("/login"); }} title="Cerrar sesión" className="text-slate-400 hover:text-red-400 p-1 rounded transition-colors"><LogOut size={15} /></button></div></div><div className="sidebar-note"><ShieldCheck size={19} /><b>Tu información, organizada.</b><p>Un respaldo para cada etapa de la trayectoria docente.</p></div><div className="local-chip"><span />DEMOSTRACIÓN LOCAL</div>{actor.role === "legajos" && <button disabled={busy} className="reset-button" onClick={() => setReset(true)}><RotateCcw size={15} />Restaurar datos de ejemplo</button>}</SidebarFooter></Sidebar><SidebarInset className="app-inset"><header className="topbar"><div className="breadcrumb"><SidebarTrigger aria-label="Abrir navegación" /><span>Oficina de personal</span><i>/</i><strong>{label}</strong></div><div className="profile-controls"><span className="demo-pill">DEMO</span><FilterSelect label="Perfil de demostración" value={actor.role} onChange={changeRole} options={Object.entries(roleNames).map(([value, label]) => ({
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
          }))} />}{actor.role !== "docente" && <FilterSelect label="Responsable de demostración" value={actor.userId ?? demoUsers.find(u => u.role === actor.role)!.id} onChange={userId => setActor({ ...actor, userId })} options={demoUsers.filter(u => u.role === actor.role).map(u => ({ value: u.id, label: u.name }))} />}<div className="flex items-center gap-2 pl-2 border-l border-slate-200"><span className="profile-avatar text-xs font-bold" title={currentUser?.email}>{currentUser?.avatarInitials ?? (actor.role === "legajos" ? "LP" : actor.role === "comision" ? "CE" : actor.role === "decanato" ? "DE" : actor.role === "consejo_facultad" ? "CF" : actor.role === "consejo_universitario" ? "CU" : "DO")}</span><div className="hidden lg:flex flex-col text-left"><span className="text-xs font-bold text-slate-800 leading-tight max-w-[120px] truncate" title={currentUser?.name}>{currentUser?.name ?? "Usuario UNP"}</span><span className="text-[10px] text-slate-500 leading-tight font-mono truncate max-w-[120px]">{currentUser?.email ?? "unp.edu.pe"}</span></div><Button variant="ghost" size="sm" onClick={() => { logout(); toast.info("Sesión cerrada correctamente"); router.push("/login"); }} className="h-8 px-2 text-slate-500 hover:text-red-700 hover:bg-red-50 text-xs ml-1" title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={15} /><span className="hidden xl:inline ml-1 text-xs">Salir</span></Button></div></div></header><div id="workspace" className="workspace-content" tabIndex={-1}>{error ? <div className="panel padded"><Empty title="No pudimos cargar los datos" description={error} action={<Button onClick={() => void refresh()}><RefreshCw />Volver a intentar</Button>} /></div> : data ? children : <Loading />}</div><footer className="app-footer"><span>Legajo UNP · Prototipo académico</span><span>Datos ficticios · Almacenados en este navegador</span></footer></SidebarInset><Toaster theme="light" position="bottom-right" richColors closeButton /><Confirm open={reset} onClose={() => setReset(false)} title="¿Restaurar la demostración?" description="Se eliminarán los registros y documentos de prueba agregados en este navegador y volverán los ejemplos iniciales." destructive onConfirm={() => {
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
  if (segments[0] === "login") return <LoginView />;
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
