"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {GraduationCap,ShieldCheck,Eye,EyeOff,LogIn,Database} from "lucide-react";
import {useWorkspace} from "../provider";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";

export function LoginView(){
  const {login,busy,currentUser,isAuthenticated,logout}=useWorkspace();const router=useRouter();
  const[email,setEmail]=useState("");const[password,setPassword]=useState("");const[visible,setVisible]=useState(false);const[error,setError]=useState("");
  async function submit(event:React.FormEvent){event.preventDefault();setError("");try{await login(email,password);setPassword("");router.push("/");}catch(e){setError(e instanceof Error?e.message:"No se pudo iniciar sesión.");}}
  return <div className="flex w-full items-center justify-center py-6"><div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl md:grid-cols-2">
    <section className="bg-[#123349] p-9 text-white md:p-12"><GraduationCap className="mb-10 h-12 w-12 text-teal-300"/><p className="mb-3 text-xs font-semibold tracking-widest text-teal-300">UNIVERSIDAD NACIONAL DE PIURA</p><h1 className="text-4xl font-bold leading-tight">Tu trayectoria,<br/>con respaldo.</h1><p className="mt-6 leading-relaxed text-slate-300">Gestión de legajos y promoción docente. Accede con tu cuenta para consultar los documentos y procesos que te corresponden.</p><div className="mt-12 flex items-center gap-3 text-sm text-teal-200"><Database size={19}/><span>PostgreSQL local · Datos compartidos entre tus navegadores</span></div></section>
    <section className="p-9 md:p-12"><h2 className="text-2xl font-bold text-slate-900">Iniciar sesión</h2><p className="mt-2 text-sm text-slate-500">Usa el correo y la contraseña de tu cuenta del sistema.</p>
      {isAuthenticated?<div className="mt-8 space-y-5"><p>Ya ingresaste como <strong>{currentUser?.name}</strong>.</p><Button onClick={()=>router.push("/")}>Ir al sistema</Button><Button variant="outline" onClick={()=>void logout()}>Cerrar sesión</Button></div>:<form onSubmit={submit} className="mt-8 space-y-5">
        <div className="space-y-2"><Label htmlFor="login-email">Correo de acceso</Label><Input id="login-email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="correo@unp.edu.pe"/></div>
        <div className="space-y-2"><Label htmlFor="login-password">Contraseña</Label><div className="relative"><Input id="login-password" type={visible?"text":"password"} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required className="pr-12"/><button type="button" aria-label={visible?"Ocultar contraseña":"Mostrar contraseña"} onClick={()=>setVisible(!visible)} className="absolute right-3 top-2.5 text-slate-500">{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></div>
        {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full"><LogIn size={17}/>{busy?"Verificando…":"Ingresar"}</Button>
        <p className="flex gap-2 text-xs leading-relaxed text-slate-500"><ShieldCheck size={17} className="shrink-0"/>El servidor verifica tu cuenta y los permisos de tu rol. Las cuentas son locales de prueba; no se usa autenticación institucional OIDC.</p>
      </form>}
    </section></div></div>;
}
