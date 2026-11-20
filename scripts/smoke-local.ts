import {readFile} from "node:fs/promises";
import {pool} from "../server/db";
import {settings} from "../server/config";
import {requireThat} from "../server/security";
const origin=`http://localhost:${settings.port}`;
try{
  const counts=(await pool.query("SELECT current_database() AS database,(SELECT count(*)::int FROM docente) AS teachers,(SELECT count(*)::int FROM merito) AS merits,(SELECT count(*)::int FROM solicitud_promocion) AS requests")).rows[0];
  const health=await fetch(origin+'/api/v1/health',{redirect:'error'});
  requireThat(health.ok&&health.headers.get('content-type')?.startsWith('application/json'),"El puerto no está sirviendo la API de Legajo.");
  const status=await health.json() as {ok?:boolean;database?:string;inicializada?:boolean};
  requireThat(status.ok===true&&status.database===counts.database&&status.inicializada===true,"La API no está conectada a la base de Legajo esperada.");
  const account=JSON.parse(await readFile('.local/credenciales-cuentas.json','utf8')).find((a:{rol:string})=>a.rol==='legajos');
  const page=await fetch(origin);requireThat(page.status===200,"La página no responde correctamente.");
  const response=await fetch(origin+'/api/v1/auth/login',{method:'POST',redirect:'error',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})});requireThat(response.ok,"Falló el acceso local.");
  const session=response.headers.get('set-cookie')??'';requireThat(session.includes('HttpOnly')&&session.includes('SameSite=Strict'),"La cookie no tiene las protecciones esperadas.");const cookie=session.split(';')[0];
  try{const workspace=await(await fetch(origin+'/api/v1/workspace',{headers:{Cookie:cookie}})).json() as {teachers:unknown[];merits:unknown[];requests:unknown[]};
    requireThat(workspace.teachers.length===counts.teachers&&workspace.merits.length===counts.merits&&workspace.requests.length===counts.requests,"La API no coincide con la base de datos.");
    for(const path of ['/.env.local','/.local/credenciales-cuentas.json','/data/documents/example'])requireThat((await fetch(origin+path)).status===404,"Una ruta privada quedó accesible.");
    console.log(JSON.stringify({pagina:page.status,login:response.status,...counts,rutasPrivadas:'bloqueadas'},null,2));
  }finally{await fetch(origin+'/api/v1/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:cookie}});}
}finally{await pool.end();}
