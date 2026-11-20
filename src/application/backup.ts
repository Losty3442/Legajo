import { strToU8, zipSync } from "fflate";
import type { DocumentFile, Workspace } from "../domain/models";

export interface BackupManifest {
  format:"legajo-backup-v1";
  origin:string;
  documents:{id:string;name:string;type:string;path:string;size:number;sha256:string}[];
}
export async function createBackup(data:Workspace,documents:DocumentFile[],origin="http://localhost:5173"){
  const entries:Record<string,Uint8Array>={"workspace.json":strToU8(JSON.stringify(data))};
  const manifest:BackupManifest={format:"legajo-backup-v1",origin,documents:[]};
  for(const [index,file]of documents.entries()){
    const bytes=new Uint8Array(await file.blob.arrayBuffer());
    const digest=await crypto.subtle.digest("SHA-256",bytes);
    const hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,"0")).join("");
    const path=`documents/${index}.bin`;entries[path]=bytes;
    manifest.documents.push({id:file.id,name:file.name,type:file.type,path,size:bytes.length,sha256:hash});
  }
  entries["manifest.json"]=strToU8(JSON.stringify(manifest));
  return zipSync(entries,{level:6});
}
export async function readLegacyWorkspace(){
  const available=await indexedDB.databases();
  if(!available.some(db=>db.name==="unp-legajos-demo"))return undefined;
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("unp-legajos-demo");r.onupgradeneeded=()=>{r.transaction?.abort();reject(new Error("El almacenamiento de origen ya no está disponible."));};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{
    if(!db.objectStoreNames.contains("workspace")||!db.objectStoreNames.contains("documents"))throw new Error("El almacenamiento anterior no tiene las colecciones esperadas.");
    return await new Promise<{data:Workspace;documents:DocumentFile[]}|undefined>((resolve,reject)=>{
      const tx=db.transaction(["workspace","documents"],"readonly");
      const workspace=tx.objectStore("workspace").get("current"),files=tx.objectStore("documents").getAll();
      tx.oncomplete=()=>resolve(workspace.result?{data:workspace.result,documents:files.result}:undefined);
      tx.onerror=()=>reject(tx.error);
    });
  }finally{db.close();}
}
