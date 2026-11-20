import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { DocumentFile } from "../src/domain/models";
import { ApiError, requireThat, sha256 } from "./security";
import { settings } from "./config";

export function validateDocument(bytes: Uint8Array, type: string) {
  requireThat(bytes.length>0 && bytes.length<=10*1024*1024,"El archivo debe tener contenido y pesar como máximo 10 MB.",413,"FILE_SIZE");
  const b=Buffer.from(bytes);
  const valid=type==="application/pdf"?b.subarray(0,5).toString()==="%PDF-":type==="image/png"?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==="image/jpeg"?b[0]===255&&b[1]===216&&b[2]===255:type==="image/webp"?b.subarray(0,4).toString()==="RIFF"&&b.subarray(8,12).toString()==="WEBP":false;
  requireThat(valid,"El contenido no coincide con un PDF, PNG, JPG o WebP válido.",422,"FILE_TYPE");
}
export class FileStorage {
  created:string[]=[];
  path(key:string){requireThat(/^[a-f0-9]{64}$/.test(key),"Clave documental inválida.");return join(settings.dataDir,"documents",key);}
  async put(file:DocumentFile) {
    const bytes=Buffer.from(await file.blob.arrayBuffer());validateDocument(bytes,file.type);
    const key=sha256(file.id),hash=sha256(bytes),path=this.path(key);
    await mkdir(join(settings.dataDir,"documents"),{recursive:true});
    try {await writeFile(path,bytes,{flag:"wx",mode:0o600});this.created.push(path);}
    catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;requireThat(sha256(await readFile(path))===hash,"Ya existe otra versión de ese documento.",409,"FILE_CONFLICT");}
    return {key,hash,size:bytes.length};
  }
  async read(key:string,hash:string){const bytes=await readFile(this.path(key));if(sha256(bytes)!==hash)throw new ApiError(500,"FILE_INTEGRITY","El documento almacenado no supera la comprobación de integridad.");return bytes;}
  async rollback(){await Promise.all(this.created.map(path=>unlink(path).catch(()=>{})));this.created=[];}
}
