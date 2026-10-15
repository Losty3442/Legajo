"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { legajoService } from "../composition";
import { roleNames, type Actor, type Teacher, type Workspace } from "../domain/models";
type ContextValue = {
  actor: Actor;
  setActor: (actor: Actor) => void;
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
function readProfile() {
  try { return sessionStorage.getItem("unp-demo-profile") ?? memoryProfile; }
  catch { return memoryProfile; }
}
function subscribeProfile(listener: () => void) {
  window.addEventListener("unp-profile-change", listener);
  return () => window.removeEventListener("unp-profile-change", listener);
}
export function WorkspaceProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const profileValue = useSyncExternalStore(subscribeProfile, readProfile, () => defaultProfile);
  const actor = useMemo<Actor>(() => {
    try {
      const candidate = JSON.parse(profileValue);
      if (Object.hasOwn(roleNames, candidate.role) && typeof candidate.teacherId === "string") return candidate;
    } catch { /* An invalid local preference returns to the default demo profile. */ }
    return { role: "legajos", teacherId: "t1" };
  }, [profileValue]);
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
    try { sessionStorage.setItem("unp-demo-profile", memoryProfile); } catch { /* Memory remains usable if browser storage is restricted. */ }
    window.dispatchEvent(new Event("unp-profile-change"));
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
