"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { legajoService } from "../composition";
import { roleNames, INSTITUTIONAL_ACCOUNTS, type Actor, type AuthUser, type Teacher, type Workspace } from "../domain/models";
type ContextValue = {
  actor: Actor;
  setActor: (actor: Actor) => void;
  currentUser?: AuthUser;
  isAuthenticated: boolean;
  login: (account: AuthUser) => void;
  logout: () => void;
  data?: Workspace;
  people: Teacher[];
  error: string;
  busy: boolean;
  refresh: () => Promise<void>;
  execute: (fn: () => Promise<unknown>, message?: string) => Promise<boolean>;
};
const AppContext = createContext<ContextValue | null>(null);
const defaultProfile = '{"role":"legajos","teacherId":"t1"}';
let memoryProfile = defaultProfile;
let memoryAuthStatus = "authenticated";
let memoryAuthUser: string | null = null;
function readProfile() {
  try { return sessionStorage.getItem("unp-demo-profile") ?? memoryProfile; }
  catch { return memoryProfile; }
}
function subscribeProfile(listener: () => void) {
  window.addEventListener("unp-profile-change", listener);
  return () => window.removeEventListener("unp-profile-change", listener);
}
function readAuthStatus(): boolean {
  try {
    return (sessionStorage.getItem("unp-auth-status") ?? memoryAuthStatus) !== "unauthenticated";
  } catch {
    return memoryAuthStatus !== "unauthenticated";
  }
}
function subscribeAuth(listener: () => void) {
  window.addEventListener("unp-auth-change", listener);
  return () => window.removeEventListener("unp-auth-change", listener);
}
function readAuthUser(): string | null {
  try { return sessionStorage.getItem("unp-auth-user") ?? memoryAuthUser; }
  catch { return memoryAuthUser; }
}
function subscribeAuthUser(listener: () => void) {
  window.addEventListener("unp-auth-change", listener);
  return () => window.removeEventListener("unp-auth-change", listener);
}
/**
 * Resuelve la cuenta activa sin leer el almacenamiento durante el render.
 * El valor llega por `useSyncExternalStore`, de modo que la hidratación en el
 * cliente coincide siempre con el HTML del servidor (RN de sesión única).
 */
function resolveUser(actor: Actor, saved: string | null): AuthUser {
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.name === "string" && parsed.email) return parsed as AuthUser;
    } catch { /* Un dato local inválido cae al perfil por defecto. */ }
  }
  if (actor.role === "docente") {
    const match = INSTITUTIONAL_ACCOUNTS.find(a => a.teacherId === actor.teacherId);
    if (match) return match;
  }
  const match = INSTITUTIONAL_ACCOUNTS.find(a => a.userId === actor.userId || a.role === actor.role);
  return match ?? INSTITUTIONAL_ACCOUNTS[0];
}
export function WorkspaceProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const profileValue = useSyncExternalStore(subscribeProfile, readProfile, () => defaultProfile);
  const isAuthenticated = useSyncExternalStore(subscribeAuth, readAuthStatus, () => true);
  const authUser = useSyncExternalStore(subscribeAuthUser, readAuthUser, () => null);

  const actor = useMemo<Actor>(() => {
    try {
      const candidate = JSON.parse(profileValue);
      if (Object.hasOwn(roleNames, candidate.role) && typeof candidate.teacherId === "string") return candidate;
    } catch { /* An invalid local preference returns to the default demo profile. */ }
    return { role: "legajos", teacherId: "t1" };
  }, [profileValue]);

  const currentUser = useMemo(() => resolveUser(actor, authUser), [actor, authUser]);

  const [data, setData] = useState<Workspace>();
  const [people, setPeople] = useState<Teacher[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      await legajoService.initialize();
      const full = await legajoService.snapshot({
        role: "legajos",
        teacherId: actor.teacherId
      });
      setPeople(full.teachers);
      setData(await legajoService.snapshot(actor));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar la demostración.");
    }
  }, [actor]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await legajoService.initialize();
        const all = await legajoService.snapshot({
          role: "legajos",
          teacherId: actor.teacherId
        });
        const visible = await legajoService.snapshot(actor);
        if (active) {
          setPeople(all.teachers);
          setData(visible);
          setError("");
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Error de almacenamiento.");
      }
    })();
    return () => {
      active = false;
    };
  }, [actor]);
  useEffect(() => {
    const handler = () => {
      void refresh();
    };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [refresh]);
  const setActor = (next: Actor) => {
    setData(undefined);
    memoryProfile = JSON.stringify(next);
    memoryAuthStatus = "authenticated";
    const matched = INSTITUTIONAL_ACCOUNTS.find(a => next.role === "docente" ? a.teacherId === next.teacherId : a.userId === next.userId)
      ?? INSTITUTIONAL_ACCOUNTS.find(a => a.role === next.role)
      ?? INSTITUTIONAL_ACCOUNTS[0];
    memoryAuthUser = JSON.stringify(matched);
    try {
      sessionStorage.setItem("unp-demo-profile", memoryProfile);
      sessionStorage.setItem("unp-auth-user", memoryAuthUser);
      sessionStorage.setItem("unp-auth-status", "authenticated");
    } catch { /* Memory remains usable if browser storage is restricted. */ }
    window.dispatchEvent(new Event("unp-profile-change"));
    window.dispatchEvent(new Event("unp-auth-change"));
  };
  const login = (account: AuthUser) => {
    memoryAuthStatus = "authenticated";
    memoryAuthUser = JSON.stringify(account);
    try {
      sessionStorage.setItem("unp-auth-status", "authenticated");
      sessionStorage.setItem("unp-auth-user", memoryAuthUser);
    } catch { /* storage fallback */ }
    setActor({
      role: account.role,
      teacherId: account.teacherId ?? "t1",
      userId: account.userId
    });
  };
  const logout = () => {
    memoryAuthStatus = "unauthenticated";
    memoryAuthUser = null;
    try {
      sessionStorage.setItem("unp-auth-status", "unauthenticated");
      sessionStorage.removeItem("unp-auth-user");
    } catch { /* storage fallback */ }
    window.dispatchEvent(new Event("unp-auth-change"));
  };
  async function execute(fn: () => Promise<unknown>, message = "Cambios guardados") {
    setBusy(true);
    try {
      await fn();
      await refresh();
      toast.success(message);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar la operación.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return <AppContext.Provider value={{
    actor,
    setActor,
    currentUser,
    isAuthenticated,
    login,
    logout,
    data,
    people,
    error,
    busy,
    refresh,
    execute
  }}>{children}</AppContext.Provider>;
}
export function useWorkspace() {
  const c = useContext(AppContext);
  if (!c) throw new Error("WorkspaceProvider ausente");
  return c;
}
