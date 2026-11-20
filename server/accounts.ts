import type { PoolClient } from "pg";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { INSTITUTIONAL_ACCOUNTS, type AuthUser, type Role } from "../src/domain/models";
import { hashPassword, newPassword, sha256 } from "./security";

export const roleIds: Record<Role, number> = {docente:1,legajos:2,comision:3,decanato:4,consejo_facultad:5,consejo_universitario:6};
export function accountFromRow(row: {id:string;nombre_completo:string;email:string;datos:unknown}): AuthUser {
  const data = row.datos as Partial<AuthUser>;
  return { ...data, id:row.id, userId:row.id, name:row.nombre_completo, email:row.email, role:data.role!, avatarInitials:data.avatarInitials ?? row.nombre_completo.split(" ").slice(0,2).map(x=>x[0]).join("") };
}
export async function insertAccount(client: PoolClient, account: AuthUser, password: string) {
  const id = account.userId ?? account.id;
  const hash = await hashPassword(password);
  await client.query("INSERT INTO usuario(id,sub_externo,nombre_completo,email,password_hash,datos) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING", [id,`local:${id}`,account.name,account.email.toLowerCase(),hash,JSON.stringify({...account,id,userId:id})]);
  await client.query("INSERT INTO asignacion_rol(id,usuario_id,rol_id) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING", [`role-${sha256(id+account.role).slice(0,24)}`,id,roleIds[account.role]]);
}
export async function bootstrapAccounts(client: PoolClient, directory = ".local") {
  await mkdir(directory,{recursive:true});
  const file = join(directory,"credenciales-cuentas.json");
  let credentials: {email:string;nombre:string;rol:Role;password:string}[]=[];
  try { credentials=JSON.parse(await readFile(file,"utf8")); } catch(error) { if((error as NodeJS.ErrnoException).code!=="ENOENT") throw error; }
  let changed=false;
  for(const account of INSTITUTIONAL_ACCOUNTS) {
    const found=await client.query("SELECT id FROM usuario WHERE id=$1",[account.userId??account.id]);
    if(found.rowCount) continue;
    const saved=credentials.find(c=>c.email===account.email);
    const password=saved?.password??newPassword();
    await insertAccount(client,account,password);
    if(!saved){credentials.push({email:account.email,nombre:account.name,rol:account.role,password});changed=true;}
  }
  if(changed) await writeFile(file,JSON.stringify(credentials,null,2)+"\n",{mode:0o600});
  return file;
}
export async function technicalIdentity(client: PoolClient, id: string | undefined, role: Role = "legajos") {
  if(id) { const exists=await client.query("SELECT id FROM usuario WHERE id=$1",[id]);if(exists.rowCount)return id; }
  const key=`legacy-${sha256(id??role).slice(0,24)}`;
  await client.query("INSERT INTO usuario(id,sub_externo,nombre_completo,email,activo,datos) VALUES($1,$2,$3,$4,false,$5) ON CONFLICT(id) DO NOTHING",[key,`legacy:${key}`,"Responsable no identificado · importación",`${key}@local.invalid`,JSON.stringify({role,originalId:id??null,origen:"importacion",identidadVerificada:false})]);
  return key;
}
