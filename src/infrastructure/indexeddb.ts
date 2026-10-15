import type { Repositories } from "../application/ports";
import type { DocumentFile, Workspace } from "../domain/models";
const DB_NAME = "unp-legajos-demo";
let connection: Promise<IDBDatabase> | undefined;
function open(): Promise<IDBDatabase> {
  if (!connection) connection = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("workspace");
      req.result.createObjectStore("documents", {
        keyPath: "id"
      });
    };
    req.onerror = () => {
      connection = undefined;
      reject(new Error("No se pudo abrir el almacenamiento del navegador."));
    };
    req.onblocked = () => {
      connection = undefined;
      reject(new Error("Cierra las otras pestañas de la aplicación y vuelve a intentar."));
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        connection = undefined;
      };
      resolve(db);
    };
  });
  return connection;
}
async function read<T>(store: string, key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function commit(next: Workspace, expectedRevision: number | undefined, documents: DocumentFile[] = [], reset = false): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["workspace", "documents"], "readwrite");
    let reason = "No se pudo guardar. Comprueba el espacio disponible en el navegador.";
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(reason));
    tx.onabort = () => reject(new Error(reason));
    const store = tx.objectStore("workspace");
    const current = store.get("current");
    current.onsuccess = () => {
      if (current.result?.revision !== expectedRevision) {
        reason = "Los datos cambiaron en otra pestaña. Actualiza la vista e inténtalo otra vez.";
        tx.abort();
        return;
      }
      store.put(next, "current");
      const files = tx.objectStore("documents");
      if (reset) files.clear();
      documents.forEach(file => files.put(file));
    };
  });
}
export const browserRepositories: Repositories = {
  workspace: {
    read: () => read<Workspace>("workspace", "current"),
    commit
  },
  documents: {
    get: id => read<DocumentFile>("documents", id)
  },
  teachers: {
    list: async () => (await read<Workspace>("workspace", "current"))?.teachers ?? []
  },
  dossiers: {
    list: async () => (await read<Workspace>("workspace", "current"))?.merits ?? []
  },
  requests: {
    list: async () => (await read<Workspace>("workspace", "current"))?.requests ?? []
  },
  evaluations: {
    list: async () => (await read<Workspace>("workspace", "current"))?.evaluations ?? []
  }
};
