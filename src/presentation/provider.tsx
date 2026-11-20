"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useState} from "react";
import {toast} from "sonner";
import {legajoService} from "../composition";
import type {Actor,AuthUser,Teacher,Workspace} from "../domain/models";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "@/components/ui/dialog";

type ContextValue={actor:Actor;currentUser?:AuthUser;isAuthenticated:boolean;ready:boolean;needsMigration:boolean;login:(email:string,password:string)=>Promise<void>;logout:()=>Promise<void>;data?:Workspace;people:Teacher[];error:string;busy:boolean;refresh:()=>Promise<void>;execute:(fn:()=>Promise<unknown>,message?:string)=>Promise<boolean>};
const Context=createContext<ContextValue|null>(null);
export function WorkspaceProvider({children}:{children:React.ReactNode}){
  const [user,setUser]=useState<AuthUser>();const[ready,setReady]=useState(false);const[needsMigration,setNeedsMigration]=useState(false);
  const[data,setData]=useState<Workspace>();const[error,setError]=useState("");const[busy,setBusy]=useState(false);
  const[credentials,setCredentials]=useState<{email:string;password:string}[]>([]);
  const actor=useMemo<Actor>(()=>({role:user?.role??"docente",teacherId:user?.teacherId??"",userId:user?.userId??user?.id}),[user]);
  const refresh=useCallback(async()=>{
    try{const session=await legajoService.session();setUser(session.user??undefined);setNeedsMigration(Boolean(session.user&&!session.initialized));
      if(session.user&&session.initialized)setData(await legajoService.snapshot());else setData(undefined);
      setError("");
    }catch(e){setError(e instanceof Error?e.message:"No se pudo conectar con el servidor.");}
    finally{setReady(true);}
  },[]);
  useEffect(()=>{void refresh();const focus=()=>void refresh();const expired=()=>{setUser(undefined);setData(undefined);};const accounts=(event:Event)=>setCredentials((event as CustomEvent).detail);
    window.addEventListener("focus",focus);window.addEventListener("legajo-session-expired",expired);window.addEventListener("legajo-new-accounts",accounts);
    return()=>{window.removeEventListener("focus",focus);window.removeEventListener("legajo-session-expired",expired);window.removeEventListener("legajo-new-accounts",accounts);};
  },[refresh]);
  async function login(email:string,password:string){setBusy(true);try{await legajoService.login(email,password);await refresh();}finally{setBusy(false);}}
  async function logout(){try{await legajoService.logout();}finally{setUser(undefined);setData(undefined);}}
  async function execute(fn:()=>Promise<unknown>,message="Cambios guardados"){
    setBusy(true);try{await fn();await refresh();toast.success(message);return true;}catch(e){toast.error(e instanceof Error?e.message:"No se pudo completar la operación.");return false;}finally{setBusy(false);}
  }
  return <Context.Provider value={{actor,currentUser:user,isAuthenticated:!!user,ready,needsMigration,login,logout,data,people:data?.teachers??[],error,busy,refresh,execute}}>{children}
    <Dialog open={credentials.length>0} onOpenChange={open=>{if(!open)setCredentials([]);}}><DialogContent><DialogHeader><DialogTitle>Cuenta docente creada</DialogTitle><DialogDescription>Entrega estos datos al docente. La contraseña inicial se muestra una sola vez.</DialogDescription></DialogHeader>{credentials.map(c=><div key={c.email} className="space-y-2 rounded border p-4"><p><strong>Correo:</strong> {c.email}</p><p><strong>Contraseña inicial:</strong> <code className="select-all">{c.password}</code></p></div>)}</DialogContent></Dialog>
  </Context.Provider>;
}
export function useWorkspace(){const c=useContext(Context);if(!c)throw new Error("WorkspaceProvider ausente");return c;}
