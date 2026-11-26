import { sql } from "drizzle-orm";
import { pgTable, text, integer, bigint, boolean, numeric, date, timestamp, jsonb, primaryKey, foreignKey, uniqueIndex, check, type AnyPgColumn } from "drizzle-orm/pg-core";

export const facultad = pgTable("facultad", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  codigo: text("codigo").notNull(),
  nombre: text("nombre").notNull(),
  activo: boolean("activo").notNull().default(sql`true`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_facultad_codigo").on(t.codigo),
  uniqueIndex("uq_facultad_nombre").on(t.nombre),
]);

export const departamento_academico = pgTable("departamento_academico", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  facultad_id: text("facultad_id").notNull(),
  nombre: text("nombre").notNull(),
  activo: boolean("activo").notNull().default(sql`true`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_departamento_facultad_nombre").on(t.facultad_id,t.nombre),
  foreignKey({name:"fk_departamento_academico_0",columns:[t.facultad_id],foreignColumns:[facultad.id]}),
]);

export const categoria_docente = pgTable("categoria_docente", {
  id: integer("id").notNull(),
  nombre: text("nombre").notNull(),
  orden: integer("orden").notNull(),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_categoria_docente_nombre").on(t.nombre),
  uniqueIndex("uq_categoria_docente_orden").on(t.orden),
]);

export const dedicacion = pgTable("dedicacion", {
  id: integer("id").notNull(),
  nombre: text("nombre").notNull(),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_dedicacion_nombre").on(t.nombre),
]);

export const rol = pgTable("rol", {
  id: integer("id").notNull(),
  codigo: text("codigo").notNull(),
  nombre: text("nombre").notNull(),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_rol_codigo").on(t.codigo),
]);

export const usuario = pgTable("usuario", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  sub_externo: text("sub_externo"),
  nombre_completo: text("nombre_completo").notNull(),
  email: text("email").notNull(),
  activo: boolean("activo").notNull().default(sql`true`),
  ultimo_acceso: timestamp("ultimo_acceso", {withTimezone:true, mode:"string"}),
  creado_en: timestamp("creado_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  password_hash: text("password_hash"),
  datos: jsonb("datos").notNull().default(sql`'{}'::jsonb`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_usuario_sub_externo").on(t.sub_externo),
  uniqueIndex("uq_usuario_email").on(t.email),
]);

export const asignacion_rol = pgTable("asignacion_rol", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  usuario_id: text("usuario_id").notNull(),
  rol_id: integer("rol_id").notNull(),
  facultad_id: text("facultad_id"),
  departamento_id: text("departamento_id"),
  vigente_desde: date("vigente_desde", {mode:"string"}).notNull().default(sql`CURRENT_DATE`),
  vigente_hasta: date("vigente_hasta", {mode:"string"}),
}, (t) => [
  primaryKey({columns:[t.id]}),
  foreignKey({name:"fk_asignacion_rol_0",columns:[t.departamento_id],foreignColumns:[departamento_academico.id]}),
  foreignKey({name:"fk_asignacion_rol_1",columns:[t.facultad_id],foreignColumns:[facultad.id]}),
  foreignKey({name:"fk_asignacion_rol_2",columns:[t.rol_id],foreignColumns:[rol.id]}),
  foreignKey({name:"fk_asignacion_rol_3",columns:[t.usuario_id],foreignColumns:[usuario.id]}),
  check("ck_pg_asignacion_rol_0",sql`vigente_hasta IS NULL OR vigente_hasta >= vigente_desde`),
]);

export const docente = pgTable("docente", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  usuario_id: text("usuario_id"),
  codigo: text("codigo").notNull(),
  nombres: text("nombres"),
  apellidos: text("apellidos"),
  email: text("email").notNull(),
  departamento_id: text("departamento_id").notNull(),
  categoria_id: integer("categoria_id"),
  dedicacion_id: integer("dedicacion_id"),
  fecha_categoria: date("fecha_categoria", {mode:"string"}).notNull(),
  especialidad: text("especialidad"),
  activo: boolean("activo").notNull().default(sql`true`),
  version: integer("version").notNull().default(sql`1`),
  creado_en: timestamp("creado_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  actualizado_en: timestamp("actualizado_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  datos: jsonb("datos").notNull().default(sql`'{}'::jsonb`),
  nombre_completo: text("nombre_completo").notNull(),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_docente_usuario_id").on(t.usuario_id),
  uniqueIndex("uq_docente_codigo").on(t.codigo),
  uniqueIndex("uq_docente_email").on(t.email),
  foreignKey({name:"fk_docente_0",columns:[t.dedicacion_id],foreignColumns:[dedicacion.id]}),
  foreignKey({name:"fk_docente_1",columns:[t.categoria_id],foreignColumns:[categoria_docente.id]}),
  foreignKey({name:"fk_docente_2",columns:[t.departamento_id],foreignColumns:[departamento_academico.id]}),
  foreignKey({name:"fk_docente_3",columns:[t.usuario_id],foreignColumns:[usuario.id]}),
]);

export const legajo = pgTable("legajo", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  docente_id: text("docente_id").notNull(),
  fecha_apertura: date("fecha_apertura", {mode:"string"}).notNull().default(sql`CURRENT_DATE`),
  observaciones: text("observaciones"),
  creado_en: timestamp("creado_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_legajo_docente_id").on(t.docente_id),
  foreignKey({name:"fk_legajo_0",columns:[t.docente_id],foreignColumns:[docente.id]}),
]);

export const tipo_merito = pgTable("tipo_merito", {
  id: integer("id").notNull(),
  codigo: text("codigo").notNull(),
  nombre: text("nombre").notNull(),
  grupo: text("grupo").notNull(),
  puntua: boolean("puntua").notNull().default(sql`false`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_tipo_merito_codigo").on(t.codigo),
  check("ck_pg_tipo_merito_1",sql`grupo IN ('grado','actividad','antecedente','requisito')`),
]);

export const documento = pgTable("documento", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  legajo_id: text("legajo_id").notNull(),
  subido_por: text("subido_por").notNull(),
  nombre_original: text("nombre_original").notNull(),
  tipo_mime: text("tipo_mime").notNull(),
  tamano_bytes: bigint("tamano_bytes", {mode:"number"}).notNull(),
  hash_sha256: text("hash_sha256").notNull(),
  clave_almacenamiento: text("clave_almacenamiento").notNull(),
  version: integer("version").notNull().default(sql`1`),
  reemplaza_a: text("reemplaza_a").references(():AnyPgColumn=>documento.id),
  retener_hasta: date("retener_hasta", {mode:"string"}),
  subido_en: timestamp("subido_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_documento_clave_almacenamiento").on(t.clave_almacenamiento),
  foreignKey({name:"fk_documento_1",columns:[t.subido_por],foreignColumns:[usuario.id]}),
  foreignKey({name:"fk_documento_2",columns:[t.legajo_id],foreignColumns:[legajo.id]}),
  check("ck_pg_documento_0",sql`tamano_bytes > 0`),
  check("ck_pg_documento_1",sql`hash_sha256 ~ '^[0-9a-f]{64}$'`),
]);

export const merito = pgTable("merito", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  legajo_id: text("legajo_id").notNull(),
  tipo_merito_id: integer("tipo_merito_id").notNull(),
  titulo: text("titulo").notNull(),
  institucion: text("institucion").notNull(),
  fecha_merito: date("fecha_merito", {mode:"string"}).notNull(),
  documento_id: text("documento_id").notNull(),
  estado_revision: text("estado_revision").notNull().default(sql`'pendiente'`),
  observacion: text("observacion"),
  revisado_por: text("revisado_por"),
  revisado_en: timestamp("revisado_en", {withTimezone:true, mode:"string"}),
  version: integer("version").notNull().default(sql`1`),
  creado_en: timestamp("creado_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  actualizado_en: timestamp("actualizado_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  datos: jsonb("datos").notNull().default(sql`'{}'::jsonb`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  foreignKey({name:"fk_merito_0",columns:[t.revisado_por],foreignColumns:[usuario.id]}),
  foreignKey({name:"fk_merito_1",columns:[t.documento_id],foreignColumns:[documento.id]}),
  foreignKey({name:"fk_merito_2",columns:[t.tipo_merito_id],foreignColumns:[tipo_merito.id]}),
  foreignKey({name:"fk_merito_3",columns:[t.legajo_id],foreignColumns:[legajo.id]}),
  check("ck_pg_merito_0",sql`estado_revision IN ('pendiente', 'verificado', 'observado')`),
  check("ck_pg_merito_1",sql`estado_revision <> 'observado' OR length(trim(coalesce(observacion,''))) > 0`),
  check("ck_pg_merito_2",sql`estado_revision = 'pendiente' OR revisado_por IS NOT NULL`),
]);

export const revision_merito = pgTable("revision_merito", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  merito_id: text("merito_id").notNull(),
  revisor_id: text("revisor_id").notNull(),
  rol_id: integer("rol_id").notNull(),
  accion: text("accion").notNull(),
  estado_anterior: text("estado_anterior"),
  estado_posterior: text("estado_posterior").notNull(),
  documento_anterior_id: text("documento_anterior_id"),
  documento_posterior_id: text("documento_posterior_id"),
  nota: text("nota"),
  copia_antes: jsonb("copia_antes"),
  copia_despues: jsonb("copia_despues"),
  ocurrido_en: timestamp("ocurrido_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  datos: jsonb("datos").notNull().default(sql`'{}'::jsonb`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  foreignKey({name:"fk_revision_merito_0",columns:[t.documento_posterior_id],foreignColumns:[documento.id]}),
  foreignKey({name:"fk_revision_merito_1",columns:[t.documento_anterior_id],foreignColumns:[documento.id]}),
  foreignKey({name:"fk_revision_merito_2",columns:[t.rol_id],foreignColumns:[rol.id]}),
  foreignKey({name:"fk_revision_merito_3",columns:[t.revisor_id],foreignColumns:[usuario.id]}),
  foreignKey({name:"fk_revision_merito_4",columns:[t.merito_id],foreignColumns:[merito.id]}),
  check("ck_pg_revision_merito_0",sql`accion IN ('revision', 'correccion', 'migracion')`),
  check("ck_pg_revision_merito_1",sql`estado_anterior IN ('pendiente', 'verificado', 'observado')`),
  check("ck_pg_revision_merito_2",sql`estado_posterior IN ('pendiente', 'verificado', 'observado')`),
]);

export const experiencia_laboral = pgTable("experiencia_laboral", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  legajo_id: text("legajo_id").notNull(),
  institucion: text("institucion").notNull(),
  cargo: text("cargo").notNull(),
  fecha_inicio: date("fecha_inicio", {mode:"string"}).notNull(),
  fecha_fin: date("fecha_fin", {mode:"string"}),
  documento_id: text("documento_id").notNull(),
  actualizado_en: timestamp("actualizado_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  datos: jsonb("datos").notNull().default(sql`'{}'::jsonb`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  foreignKey({name:"fk_experiencia_laboral_0",columns:[t.documento_id],foreignColumns:[documento.id]}),
  foreignKey({name:"fk_experiencia_laboral_1",columns:[t.legajo_id],foreignColumns:[legajo.id]}),
  check("ck_pg_experiencia_laboral_0",sql`fecha_fin IS NULL OR fecha_fin >= fecha_inicio`),
]);

export const rubrica = pgTable("rubrica", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  version: text("version").notNull(),
  nombre: text("nombre").notNull(),
  umbral: numeric("umbral").notNull().default(sql`55`),
  puntaje_maximo: numeric("puntaje_maximo").notNull().default(sql`100`),
  estado_fuente: text("estado_fuente").notNull().default(sql`'simulacion'`),
  fuente_normativa: text("fuente_normativa"),
  aprobada_en: timestamp("aprobada_en", {withTimezone:true, mode:"string"}),
  creada_por: text("creada_por").notNull(),
  creada_en: timestamp("creada_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  datos: jsonb("datos").notNull().default(sql`'{}'::jsonb`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_rubrica_version").on(t.version),
  foreignKey({name:"fk_rubrica_0",columns:[t.creada_por],foreignColumns:[usuario.id]}),
  check("ck_pg_rubrica_0",sql`estado_fuente IN ('simulacion', 'oficial')`),
  check("ck_pg_rubrica_1",sql`umbral >= 0 AND umbral <= puntaje_maximo`),
]);

export const rubrica_criterio = pgTable("rubrica_criterio", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  rubrica_id: text("rubrica_id").notNull(),
  codigo: text("codigo").notNull(),
  nombre: text("nombre").notNull(),
  tipo_merito_id: integer("tipo_merito_id"),
  puntos_por_unidad: numeric("puntos_por_unidad").notNull(),
  tope: numeric("tope").notNull(),
  fuente_referencia: text("fuente_referencia").notNull(),
  estado_fuente: text("estado_fuente").notNull().default(sql`'simulacion'`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_criterio_rubrica_codigo").on(t.rubrica_id,t.codigo),
  foreignKey({name:"fk_rubrica_criterio_0",columns:[t.tipo_merito_id],foreignColumns:[tipo_merito.id]}),
  foreignKey({name:"fk_rubrica_criterio_1",columns:[t.rubrica_id],foreignColumns:[rubrica.id]}),
  check("ck_pg_rubrica_criterio_0",sql`estado_fuente IN ('simulacion', 'oficial')`),
  check("ck_pg_rubrica_criterio_1",sql`puntos_por_unidad >= 0 AND tope >= 0`),
]);

export const rubrica_requisito = pgTable("rubrica_requisito", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  rubrica_id: text("rubrica_id").notNull(),
  categoria_destino_id: integer("categoria_destino_id").notNull(),
  grado_minimo_id: integer("grado_minimo_id").notNull(),
  anios_minimos: integer("anios_minimos").notNull(),
  investigaciones_minimas: integer("investigaciones_minimas").notNull(),
  exige_ratificacion: boolean("exige_ratificacion").notNull().default(sql`true`),
  fuente_referencia: text("fuente_referencia").notNull(),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_requisito_rubrica_categoria").on(t.rubrica_id,t.categoria_destino_id),
  foreignKey({name:"fk_rubrica_requisito_0",columns:[t.grado_minimo_id],foreignColumns:[tipo_merito.id]}),
  foreignKey({name:"fk_rubrica_requisito_1",columns:[t.categoria_destino_id],foreignColumns:[categoria_docente.id]}),
  foreignKey({name:"fk_rubrica_requisito_2",columns:[t.rubrica_id],foreignColumns:[rubrica.id]}),
  check("ck_pg_rubrica_requisito_1",sql`anios_minimos >= 0 AND investigaciones_minimas >= 0`),
]);

export const plaza = pgTable("plaza", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  codigo: text("codigo").notNull(),
  etiqueta: text("etiqueta").notNull(),
  departamento_id: text("departamento_id").notNull(),
  categoria_id: integer("categoria_id").notNull(),
  dedicacion_id: integer("dedicacion_id").notNull(),
  habilitada: boolean("habilitada").notNull().default(sql`true`),
  creada_en: timestamp("creada_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  datos: jsonb("datos").notNull().default(sql`'{}'::jsonb`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_plaza_codigo").on(t.codigo),
  foreignKey({name:"fk_plaza_0",columns:[t.dedicacion_id],foreignColumns:[dedicacion.id]}),
  foreignKey({name:"fk_plaza_1",columns:[t.categoria_id],foreignColumns:[categoria_docente.id]}),
  foreignKey({name:"fk_plaza_2",columns:[t.departamento_id],foreignColumns:[departamento_academico.id]}),
]);

export const convocatoria = pgTable("convocatoria", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  codigo: text("codigo").notNull(),
  nombre: text("nombre").notNull(),
  fecha_inicio: date("fecha_inicio", {mode:"string"}).notNull(),
  fecha_fin: date("fecha_fin", {mode:"string"}).notNull(),
  estado: text("estado").notNull().default(sql`'abierta'`),
  rubrica_id: text("rubrica_id").notNull(),
  resolucion_referencia: text("resolucion_referencia"),
  recepcion_cerrada_en: timestamp("recepcion_cerrada_en", {withTimezone:true, mode:"string"}),
  creada_por: text("creada_por").notNull(),
  version: integer("version").notNull().default(sql`1`),
  creada_en: timestamp("creada_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  datos: jsonb("datos").notNull().default(sql`'{}'::jsonb`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_convocatoria_codigo").on(t.codigo),
  foreignKey({name:"fk_convocatoria_0",columns:[t.creada_por],foreignColumns:[usuario.id]}),
  foreignKey({name:"fk_convocatoria_1",columns:[t.rubrica_id],foreignColumns:[rubrica.id]}),
  check("ck_pg_convocatoria_0",sql`estado IN ('abierta', 'evaluacion', 'cerrada')`),
  check("ck_pg_convocatoria_1",sql`fecha_fin >= fecha_inicio`),
]);

export const convocatoria_plaza = pgTable("convocatoria_plaza", {
  convocatoria_id: text("convocatoria_id").notNull(),
  plaza_id: text("plaza_id").notNull(),
}, (t) => [
  primaryKey({columns:[t.convocatoria_id,t.plaza_id]}),
  foreignKey({name:"fk_convocatoria_plaza_0",columns:[t.plaza_id],foreignColumns:[plaza.id]}),
  foreignKey({name:"fk_convocatoria_plaza_1",columns:[t.convocatoria_id],foreignColumns:[convocatoria.id]}),
]);

export const comision_evaluadora = pgTable("comision_evaluadora", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  convocatoria_id: text("convocatoria_id").notNull(),
  facultad_id: text("facultad_id"),
  nombre: text("nombre").notNull(),
  resolucion_designacion: text("resolucion_designacion"),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_comision_convocatoria_nombre").on(t.convocatoria_id,t.nombre),
  foreignKey({name:"fk_comision_evaluadora_0",columns:[t.facultad_id],foreignColumns:[facultad.id]}),
  foreignKey({name:"fk_comision_evaluadora_1",columns:[t.convocatoria_id],foreignColumns:[convocatoria.id]}),
]);

export const miembro_comision = pgTable("miembro_comision", {
  comision_id: text("comision_id").notNull(),
  usuario_id: text("usuario_id").notNull(),
  cargo: text("cargo").notNull().default(sql`'miembro'`),
}, (t) => [
  primaryKey({columns:[t.comision_id,t.usuario_id]}),
  foreignKey({name:"fk_miembro_comision_0",columns:[t.usuario_id],foreignColumns:[usuario.id]}),
  foreignKey({name:"fk_miembro_comision_1",columns:[t.comision_id],foreignColumns:[comision_evaluadora.id]}),
  check("ck_pg_miembro_comision_0",sql`cargo IN ('presidente','secretario','miembro')`),
]);

export const solicitud_promocion = pgTable("solicitud_promocion", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  codigo: text("codigo").notNull(),
  docente_id: text("docente_id").notNull(),
  convocatoria_id: text("convocatoria_id").notNull(),
  plaza_id: text("plaza_id").notNull(),
  categoria_origen_id: integer("categoria_origen_id").notNull(),
  categoria_destino_id: integer("categoria_destino_id").notNull(),
  estado: text("estado").notNull().default(sql`'borrador'`),
  nota: text("nota"),
  presentada_en: timestamp("presentada_en", {withTimezone:true, mode:"string"}),
  version: integer("version").notNull().default(sql`1`),
  creada_en: timestamp("creada_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  actualizada_en: timestamp("actualizada_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  datos: jsonb("datos").notNull().default(sql`'{}'::jsonb`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_solicitud_promocion_codigo").on(t.codigo),
  uniqueIndex("uq_solicitud_docente_convocatoria").on(t.docente_id,t.convocatoria_id),
  foreignKey({name:"fk_solicitud_promocion_0",columns:[t.convocatoria_id,t.plaza_id],foreignColumns:[convocatoria_plaza.convocatoria_id,convocatoria_plaza.plaza_id]}),
  foreignKey({name:"fk_solicitud_promocion_1",columns:[t.categoria_destino_id],foreignColumns:[categoria_docente.id]}),
  foreignKey({name:"fk_solicitud_promocion_2",columns:[t.categoria_origen_id],foreignColumns:[categoria_docente.id]}),
  foreignKey({name:"fk_solicitud_promocion_3",columns:[t.docente_id],foreignColumns:[docente.id]}),
  check("ck_pg_solicitud_promocion_0",sql`estado IN ('borrador', 'presentada', 'observada', 'evaluada', 'no_presentada', 'propuesta', 'en_facultad', 'en_consejo', 'aprobada', 'denegada')`),
  check("ck_pg_solicitud_promocion_1",sql`estado = 'borrador' OR presentada_en IS NOT NULL OR estado = 'no_presentada'`),
  check("ck_pg_solicitud_promocion_2",sql`categoria_destino_id <> categoria_origen_id`),
]);

export const expediente_item = pgTable("expediente_item", {
  solicitud_id: text("solicitud_id").notNull(),
  merito_id: text("merito_id").notNull(),
  documento_id: text("documento_id").notNull(),
  incorporado_en: timestamp("incorporado_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
}, (t) => [
  primaryKey({columns:[t.solicitud_id,t.merito_id]}),
  foreignKey({name:"fk_expediente_item_0",columns:[t.documento_id],foreignColumns:[documento.id]}),
  foreignKey({name:"fk_expediente_item_1",columns:[t.merito_id],foreignColumns:[merito.id]}),
  foreignKey({name:"fk_expediente_item_2",columns:[t.solicitud_id],foreignColumns:[solicitud_promocion.id]}),
]);

export const observacion_solicitud = pgTable("observacion_solicitud", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  solicitud_id: text("solicitud_id").notNull(),
  autor_id: text("autor_id").notNull(),
  texto: text("texto").notNull(),
  creada_en: timestamp("creada_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  subsanada_en: timestamp("subsanada_en", {withTimezone:true, mode:"string"}),
}, (t) => [
  primaryKey({columns:[t.id]}),
  foreignKey({name:"fk_observacion_solicitud_0",columns:[t.autor_id],foreignColumns:[usuario.id]}),
  foreignKey({name:"fk_observacion_solicitud_1",columns:[t.solicitud_id],foreignColumns:[solicitud_promocion.id]}),
]);

export const solicitud_historial_estado = pgTable("solicitud_historial_estado", {
  id: bigint("id", {mode:"number"}).generatedByDefaultAsIdentity().notNull(),
  solicitud_id: text("solicitud_id").notNull(),
  estado_anterior: text("estado_anterior"),
  estado_nuevo: text("estado_nuevo").notNull(),
  usuario_id: text("usuario_id").notNull(),
  motivo: text("motivo"),
  cambiado_en: timestamp("cambiado_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  foreignKey({name:"fk_solicitud_historial_estado_0",columns:[t.usuario_id],foreignColumns:[usuario.id]}),
  foreignKey({name:"fk_solicitud_historial_estado_1",columns:[t.solicitud_id],foreignColumns:[solicitud_promocion.id]}),
  check("ck_pg_solicitud_historial_estado_0",sql`estado_anterior IN ('borrador', 'presentada', 'observada', 'evaluada', 'no_presentada', 'propuesta', 'en_facultad', 'en_consejo', 'aprobada', 'denegada')`),
  check("ck_pg_solicitud_historial_estado_1",sql`estado_nuevo IN ('borrador', 'presentada', 'observada', 'evaluada', 'no_presentada', 'propuesta', 'en_facultad', 'en_consejo', 'aprobada', 'denegada')`),
]);

export const evaluacion = pgTable("evaluacion", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  solicitud_id: text("solicitud_id").notNull(),
  rubrica_id: text("rubrica_id").notNull(),
  comision_id: text("comision_id").notNull(),
  evaluador_id: text("evaluador_id").notNull(),
  puntaje_total: numeric("puntaje_total").notNull(),
  umbral_aplicado: numeric("umbral_aplicado").notNull(),
  plaza_disponible: boolean("plaza_disponible").notNull(),
  resultado: text("resultado").notNull(),
  fundamento: text("fundamento").notNull(),
  clave_idempotencia: text("clave_idempotencia").notNull(),
  instantanea_docente: jsonb("instantanea_docente").notNull(),
  instantanea_plaza: jsonb("instantanea_plaza"),
  instantanea_convocatoria: jsonb("instantanea_convocatoria").notNull(),
  cerrada_en: timestamp("cerrada_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  datos: jsonb("datos").notNull().default(sql`'{}'::jsonb`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_evaluacion_solicitud_id").on(t.solicitud_id),
  uniqueIndex("uq_evaluacion_clave_idempotencia").on(t.clave_idempotencia),
  foreignKey({name:"fk_evaluacion_0",columns:[t.evaluador_id],foreignColumns:[usuario.id]}),
  foreignKey({name:"fk_evaluacion_1",columns:[t.comision_id],foreignColumns:[comision_evaluadora.id]}),
  foreignKey({name:"fk_evaluacion_2",columns:[t.rubrica_id],foreignColumns:[rubrica.id]}),
  foreignKey({name:"fk_evaluacion_3",columns:[t.solicitud_id],foreignColumns:[solicitud_promocion.id]}),
  check("ck_pg_evaluacion_1",sql`resultado IN ('apto', 'no_apto', 'sin_vacante')`),
  check("ck_pg_evaluacion_5",sql`puntaje_total >= 0 AND puntaje_total <= 100`),
  check("ck_pg_evaluacion_6",sql`resultado <> 'apto' OR plaza_disponible = true`),
]);

export const evaluacion_criterio = pgTable("evaluacion_criterio", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  evaluacion_id: text("evaluacion_id").notNull(),
  rubrica_criterio_id: text("rubrica_criterio_id").notNull(),
  etiqueta: text("etiqueta").notNull(),
  puntaje: numeric("puntaje").notNull(),
  tope: numeric("tope").notNull(),
  detalle: text("detalle"),
}, (t) => [
  primaryKey({columns:[t.id]}),
  foreignKey({name:"fk_evaluacion_criterio_0",columns:[t.rubrica_criterio_id],foreignColumns:[rubrica_criterio.id]}),
  foreignKey({name:"fk_evaluacion_criterio_1",columns:[t.evaluacion_id],foreignColumns:[evaluacion.id]}),
  check("ck_pg_evaluacion_criterio_0",sql`puntaje >= 0 AND puntaje <= tope`),
]);

export const evaluacion_requisito = pgTable("evaluacion_requisito", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  evaluacion_id: text("evaluacion_id").notNull(),
  etiqueta: text("etiqueta").notNull(),
  cumple: boolean("cumple").notNull(),
  detalle: text("detalle"),
}, (t) => [
  primaryKey({columns:[t.id]}),
  foreignKey({name:"fk_evaluacion_requisito_0",columns:[t.evaluacion_id],foreignColumns:[evaluacion.id]}),
]);

export const evaluacion_evidencia = pgTable("evaluacion_evidencia", {
  evaluacion_id: text("evaluacion_id").notNull(),
  merito_id: text("merito_id").notNull(),
  documento_id: text("documento_id").notNull(),
  hash_sha256: text("hash_sha256").notNull(),
  estado_revision: text("estado_revision").notNull(),
}, (t) => [
  primaryKey({columns:[t.evaluacion_id,t.merito_id]}),
  foreignKey({name:"fk_evaluacion_evidencia_0",columns:[t.documento_id],foreignColumns:[documento.id]}),
  foreignKey({name:"fk_evaluacion_evidencia_1",columns:[t.merito_id],foreignColumns:[merito.id]}),
  foreignKey({name:"fk_evaluacion_evidencia_2",columns:[t.evaluacion_id],foreignColumns:[evaluacion.id]}),
  check("ck_pg_evaluacion_evidencia_0",sql`estado_revision IN ('pendiente', 'verificado', 'observado')`),
]);

export const propuesta = pgTable("propuesta", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  solicitud_id: text("solicitud_id").notNull(),
  evaluacion_id: text("evaluacion_id").notNull(),
  convocatoria_id: text("convocatoria_id").notNull(),
  plaza_id: text("plaza_id").notNull(),
  estado: text("estado").notNull().default(sql`'decanato'`),
  informe: text("informe").notNull(),
  creada_por: text("creada_por").notNull(),
  version: integer("version").notNull().default(sql`1`),
  creada_en: timestamp("creada_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  actualizada_en: timestamp("actualizada_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  datos: jsonb("datos").notNull().default(sql`'{}'::jsonb`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_propuesta_solicitud_id").on(t.solicitud_id),
  uniqueIndex("uq_propuesta_evaluacion_id").on(t.evaluacion_id),
  foreignKey({name:"fk_propuesta_0",columns:[t.convocatoria_id,t.plaza_id],foreignColumns:[convocatoria_plaza.convocatoria_id,convocatoria_plaza.plaza_id]}),
  foreignKey({name:"fk_propuesta_1",columns:[t.creada_por],foreignColumns:[usuario.id]}),
  foreignKey({name:"fk_propuesta_2",columns:[t.evaluacion_id],foreignColumns:[evaluacion.id]}),
  foreignKey({name:"fk_propuesta_3",columns:[t.solicitud_id],foreignColumns:[solicitud_promocion.id]}),
  check("ck_pg_propuesta_0",sql`estado IN ('decanato', 'facultad', 'universitario', 'aprobada', 'denegada')`),
]);

export const propuesta_orden_merito = pgTable("propuesta_orden_merito", {
  propuesta_id: text("propuesta_id").notNull(),
  solicitud_id: text("solicitud_id").notNull(),
  evaluacion_id: text("evaluacion_id").notNull(),
  docente_id: text("docente_id").notNull(),
  nombre_docente: text("nombre_docente").notNull(),
  puntaje: numeric("puntaje").notNull(),
  resultado: text("resultado").notNull(),
  puesto: integer("puesto"),
  empate: boolean("empate").notNull().default(sql`false`),
}, (t) => [
  primaryKey({columns:[t.propuesta_id,t.solicitud_id]}),
  foreignKey({name:"fk_propuesta_orden_merito_0",columns:[t.docente_id],foreignColumns:[docente.id]}),
  foreignKey({name:"fk_propuesta_orden_merito_1",columns:[t.evaluacion_id],foreignColumns:[evaluacion.id]}),
  foreignKey({name:"fk_propuesta_orden_merito_2",columns:[t.solicitud_id],foreignColumns:[solicitud_promocion.id]}),
  foreignKey({name:"fk_propuesta_orden_merito_3",columns:[t.propuesta_id],foreignColumns:[propuesta.id]}),
  check("ck_pg_propuesta_orden_merito_0",sql`resultado IN ('apto', 'no_apto', 'sin_vacante')`),
]);

export const propuesta_evento = pgTable("propuesta_evento", {
  id: text("id").notNull().default(sql`gen_random_uuid()::text`),
  propuesta_id: text("propuesta_id").notNull(),
  etapa: text("etapa").notNull(),
  usuario_id: text("usuario_id").notNull(),
  rol_id: integer("rol_id").notNull(),
  referencia: text("referencia").notNull(),
  documento_id: text("documento_id"),
  nota: text("nota"),
  ocurrido_en: timestamp("ocurrido_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
}, (t) => [
  primaryKey({columns:[t.id]}),
  foreignKey({name:"fk_propuesta_evento_0",columns:[t.documento_id],foreignColumns:[documento.id]}),
  foreignKey({name:"fk_propuesta_evento_1",columns:[t.rol_id],foreignColumns:[rol.id]}),
  foreignKey({name:"fk_propuesta_evento_2",columns:[t.usuario_id],foreignColumns:[usuario.id]}),
  foreignKey({name:"fk_propuesta_evento_3",columns:[t.propuesta_id],foreignColumns:[propuesta.id]}),
  check("ck_pg_propuesta_evento_0",sql`etapa IN ('decanato', 'facultad', 'universitario', 'aprobada', 'denegada')`),
]);

export const auditoria_evento = pgTable("auditoria_evento", {
  id: bigint("id", {mode:"number"}).generatedByDefaultAsIdentity().notNull(),
  ocurrido_en: timestamp("ocurrido_en", {withTimezone:true, mode:"string"}).notNull().default(sql`now()`),
  usuario_id: text("usuario_id"),
  rol_id: integer("rol_id"),
  docente_id: text("docente_id"),
  accion: text("accion").notNull(),
  entidad: text("entidad").notNull(),
  mensaje: text("mensaje").notNull(),
  motivo: text("motivo"),
  id_solicitud_http: text("id_solicitud_http"),
  datos: jsonb("datos").notNull().default(sql`'{}'::jsonb`),
  origen_id: text("origen_id").notNull(),
}, (t) => [
  primaryKey({columns:[t.id]}),
  uniqueIndex("uq_auditoria_origen").on(t.origen_id),
  foreignKey({name:"fk_auditoria_evento_0",columns:[t.docente_id],foreignColumns:[docente.id]}),
  foreignKey({name:"fk_auditoria_evento_1",columns:[t.rol_id],foreignColumns:[rol.id]}),
  foreignKey({name:"fk_auditoria_evento_2",columns:[t.usuario_id],foreignColumns:[usuario.id]}),
]);

export const auditoria_cambio = pgTable("auditoria_cambio", {
  id: bigint("id", {mode:"number"}).generatedByDefaultAsIdentity().notNull(),
  auditoria_id: bigint("auditoria_id", {mode:"number"}).notNull(),
  entidad: text("entidad").notNull(),
  registro_id: text("registro_id").notNull(),
  antes: jsonb("antes"),
  despues: jsonb("despues"),
}, (t) => [
  primaryKey({columns:[t.id]}),
  foreignKey({name:"fk_auditoria_cambio_0",columns:[t.auditoria_id],foreignColumns:[auditoria_evento.id]}),
]);

export const aplicacion_estado = pgTable("aplicacion_estado", {id:integer("id").primaryKey(),revision:integer("revision").notNull(),schema_version:integer("schema_version").notNull(),inicializada:boolean("inicializada").notNull(),rubrica_vigente_id:text("rubrica_vigente_id").references(()=>rubrica.id)});
export const sesion = pgTable("sesion",{token_hash:text("token_hash").primaryKey(),usuario_id:text("usuario_id").notNull().references(()=>usuario.id),creada_en:timestamp("creada_en",{withTimezone:true,mode:"string"}).notNull().defaultNow(),expira_en:timestamp("expira_en",{withTimezone:true,mode:"string"}).notNull()});
export const migracion_lote = pgTable("migracion_lote",{id:text("id").primaryKey(),huella:text("huella").notNull().unique(),creada_en:timestamp("creada_en",{withTimezone:true,mode:"string"}).notNull().defaultNow(),usuario_id:text("usuario_id").notNull().references(()=>usuario.id),informe:jsonb("informe").notNull()});
export const operacion_idempotente = pgTable("operacion_idempotente",{clave:text("clave").primaryKey(),usuario_id:text("usuario_id").notNull().references(()=>usuario.id),tipo:text("tipo").notNull(),huella:text("huella").notNull(),resultado:jsonb("resultado").notNull(),creada_en:timestamp("creada_en",{withTimezone:true,mode:"string"}).notNull().defaultNow()});
