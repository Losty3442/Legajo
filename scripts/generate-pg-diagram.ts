import {writeFile,mkdir} from "node:fs/promises";
import {Pool} from "pg";
import {settings} from "../server/config";
const pool=new Pool({connectionString:settings.ownerUrl});
try{
  const columns=(await pool.query("SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
  const primary=(await pool.query("SELECT k.table_name,k.column_name FROM information_schema.table_constraints c JOIN information_schema.key_column_usage k USING(constraint_catalog,constraint_schema,constraint_name) WHERE c.table_schema='public' AND c.constraint_type='PRIMARY KEY'")).rows;
  const foreign=(await pool.query("SELECT child.relname AS child,parent.relname AS parent,array_agg(ca.attname::text ORDER BY s.i) AS columns,array_agg(pa.attname::text ORDER BY s.i) AS referenced FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid JOIN pg_class parent ON parent.oid=c.confrelid JOIN pg_namespace n ON n.oid=child.relnamespace CROSS JOIN LATERAL generate_subscripts(c.conkey,1) AS s(i) JOIN pg_attribute ca ON ca.attrelid=child.oid AND ca.attnum=c.conkey[s.i] JOIN pg_attribute pa ON pa.attrelid=parent.oid AND pa.attnum=c.confkey[s.i] WHERE c.contype='f' AND n.nspname='public' GROUP BY c.oid,child.relname,parent.relname ORDER BY child.relname,parent.relname")).rows as {child:string;parent:string;columns:string[];referenced:string[]}[];
  const pk=new Set(primary.map(r=>r.table_name+'.'+r.column_name));const fk=new Set(foreign.flatMap(r=>r.columns.map(c=>r.child+'.'+c)));
  const unique=(await pool.query("SELECT t.relname AS table_name,array_agg(a.attname::text ORDER BY a.attname) AS columns FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace CROSS JOIN LATERAL unnest(c.conkey) AS k(num) JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.num WHERE c.contype IN ('p','u') AND n.nspname='public' GROUP BY c.oid,t.relname")).rows as {table_name:string;columns:string[]}[];
  const lines=['@startuml','!theme plain','title Legajo UNP · PostgreSQL local · esquema implementado','hide circle','skinparam linetype ortho','skinparam shadowing false','skinparam dpi 90','skinparam entityFontSize 12','skinparam defaultFontName Arial','left to right direction'];
  for(const name of [...new Set(columns.map(c=>c.table_name))]){
    const support=['sesion','aplicacion_estado','operacion_idempotente','migracion_lote','migracion_esquema'].includes(name);
    lines.push(`entity "${name}" as ${name} ${support?'#E8EAF6':'#E0F2F1'} {`);
    for(const c of columns.filter(c=>c.table_name===name)){const key=name+'.'+c.column_name;const flags=[pk.has(key)?'PK':'',fk.has(key)?'FK':'',c.is_nullable==='NO'?'NN':''].filter(Boolean);lines.push(`  ${c.column_name} : ${c.data_type.replace('timestamp with time zone','timestamptz').replace('character varying','varchar')} ${flags.length?'<<'+flags.join(', ')+'>>':''}`);}
    lines.push('}');
  }
  for(const r of foreign){const optional=columns.some(c=>c.table_name===r.child&&r.columns.includes(c.column_name)&&c.is_nullable==='YES');const single=unique.some(u=>u.table_name===r.child&&u.columns.every(c=>r.columns.includes(c)));lines.push(`${r.parent} ${optional?'|o':'||'}--${single?'o|':'o{'} ${r.child} : "${r.columns.join(', ')}"`);}
  lines.push('legend bottom left','  35 tablas del dominio + 4 de soporte + control de migraciones.','  PK: clave primaria · FK: relación · NN: obligatorio.','  IDs heredados: texto; nuevos registros: UUID.','  Triggers: evaluaciones/documentos/auditoría inmutables,','  rúbricas aprobadas bloqueadas y promoción inmediata.','  Índice parcial: una propuesta activa o aprobada por plaza.','endlegend','@enduml');
  await mkdir('docs/diagramas',{recursive:true});await writeFile('docs/diagramas/postgresql-legajos-unp.puml',lines.join('\n')+'\n');
  console.log(`PlantUML generado del catálogo PostgreSQL: ${new Set(columns.map(c=>c.table_name)).size} tablas, ${foreign.length} relaciones.`);
}finally{await pool.end();}
