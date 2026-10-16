/**
 * Esquema Drizzle (dialecto sqlite / Cloudflare D1) del sistema de legajo y
 * promoción docente de la UNP.
 *
 * Refleja el modelo relacional de 35 tablas descrito en el capítulo 6 del
 * documento "Análisis del sistema de legajo y promoción docente de la UNP v2.0"
 * (módulos A–F). Es la pieza que deja el proyecto *listo para conectarse* a una
 * base de datos real sin alterar el prototipo, que hoy sigue funcionando con
 * IndexedDB (ver src/infrastructure/indexeddb.ts y src/composition.ts).
 *
 * Este archivo es solo el modelo de datos (tablas, columnas, claves e índices).
 * Las reglas que no se pueden expresar solo con DDL (triggers de inmutabilidad,
 * validación de categoría destino, rúbrica bloqueada, etc.) y los datos de
 * catálogo viven en drizzle/0000_legajo_promocion_unp.sql, que es el DDL
 * completo y probado del anexo B del documento.
 *
 * Convenciones del documento (§6.1):
 *  - uuid en columnas de negocio (text) y smallint/integer para catálogos.
 *  - time/date separados: date para el día académico, timestamptz UTC para auditoría.
 *  - sin ON DELETE CASCADE (baja lógica con «activo»).
 *  - columna «version» para control de concurrencia optimista (If-Match).
 *  - nombres de tabla/columna en snake_case, sin tildes, en singular.
 */
import { sql, type SQL } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

/* -------------------------------------------------------------------------- */
/* Valores por defecto compartidos (equivalentes a la variante SQLite/D1 §6.10) */
/* -------------------------------------------------------------------------- */

/** UUID v4 generado por la base, igual que en el DDL del anexo B. */
const uuidDefault: SQL = sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random())%4+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`;
/** Marca de tiempo del servidor en UTC ISO 8601 (RNF15). */
const nowDefault: SQL = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;
/** Día académico (RNF15). */
const todayDefault: SQL = sql`(date('now'))`;

/* -------------------------------------------------------------------------- */
/* Tipos enumerados (§6.5). En SQLite son columnas text con CHECK.            */
/* -------------------------------------------------------------------------- */

export const estadoRevisionValues = ["pendiente", "verificado", "observado"] as const;
export type EstadoRevision = (typeof estadoRevisionValues)[number];

export const accionRevisionValues = ["revision", "correccion", "migracion"] as const;
export type AccionRevision = (typeof accionRevisionValues)[number];

export const estadoSolicitudValues = [
  "borrador",
  "presentada",
  "observada",
  "evaluada",
  "no_presentada",
  "propuesta",
  "en_facultad",
  "en_consejo",
  "aprobada",
  "denegada",
] as const;
export type EstadoSolicitud = (typeof estadoSolicitudValues)[number];

export const estadoConvocatoriaValues = ["abierta", "evaluacion", "cerrada"] as const;
export type EstadoConvocatoria = (typeof estadoConvocatoriaValues)[number];

export const resultadoEvaluacionValues = ["apto", "no_apto", "sin_vacante"] as const;
export type ResultadoEvaluacion = (typeof resultadoEvaluacionValues)[number];

export const etapaPropuestaValues = ["decanato", "facultad", "universitario", "aprobada", "denegada"] as const;
export type EtapaPropuesta = (typeof etapaPropuestaValues)[number];

export const estadoFuenteValues = ["simulacion", "oficial"] as const;
export type EstadoFuente = (typeof estadoFuenteValues)[number];

export const grupoTipoMeritoValues = ["grado", "actividad", "antecedente", "requisito"] as const;
export type GrupoTipoMerito = (typeof grupoTipoMeritoValues)[number];

export const cargoComisionValues = ["presidente", "secretario", "miembro"] as const;
export type CargoComision = (typeof cargoComisionValues)[number];

const activoCheck = (column: string) => sql`${sql.raw(column)} IN (0, 1)`;

/* ========================================================================== */
/* Módulo A · Organización y seguridad (§6.4)                                  */
/* ========================================================================== */

export const facultad = sqliteTable(
  "facultad",
  {
    id: text("id").primaryKey().default(uuidDefault),
    codigo: text("codigo").notNull().unique(),
    nombre: text("nombre").notNull().unique(),
    activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [check("ck_facultad_activo", activoCheck("activo"))],
);

export const departamentoAcademico = sqliteTable(
  "departamento_academico",
  {
    id: text("id").primaryKey().default(uuidDefault),
    facultadId: text("facultad_id")
      .notNull()
      .references(() => facultad.id),
    nombre: text("nombre").notNull(),
    activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [
    uniqueIndex("uq_departamento_facultad_nombre").on(t.facultadId, t.nombre),
    check("ck_departamento_activo", activoCheck("activo")),
  ],
);

export const categoriaDocente = sqliteTable(
  "categoria_docente",
  {
    id: integer("id").primaryKey(),
    nombre: text("nombre").notNull().unique(),
    orden: integer("orden").notNull().unique(),
  },
);

export const dedicacion = sqliteTable("dedicacion", {
  id: integer("id").primaryKey(),
  nombre: text("nombre").notNull().unique(),
});

export const rol = sqliteTable("rol", {
  id: integer("id").primaryKey(),
  codigo: text("codigo").notNull().unique(),
  nombre: text("nombre").notNull(),
});

export const usuario = sqliteTable("usuario", {
  id: text("id").primaryKey().default(uuidDefault),
  subExterno: text("sub_externo").notNull().unique(),
  nombreCompleto: text("nombre_completo").notNull(),
  email: text("email").notNull().unique(),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  ultimoAcceso: text("ultimo_acceso"),
  creadoEn: text("creado_en").notNull().default(nowDefault),
});

export const asignacionRol = sqliteTable(
  "asignacion_rol",
  {
    id: text("id").primaryKey().default(uuidDefault),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuario.id),
    rolId: integer("rol_id")
      .notNull()
      .references(() => rol.id),
    facultadId: text("facultad_id").references(() => facultad.id),
    departamentoId: text("departamento_id").references(() => departamentoAcademico.id),
    vigenteDesde: text("vigente_desde").notNull().default(todayDefault),
    vigenteHasta: text("vigente_hasta"),
  },
  (t) => [
    index("ix_asignacion_usuario").on(t.usuarioId),
    check("ck_asignacion_vigencia", sql`${t.vigenteHasta} IS NULL OR ${t.vigenteHasta} >= ${t.vigenteDesde}`),
  ],
);

/* ========================================================================== */
/* Módulo B · Docente, legajo y evidencias (§6.4)                              */
/* ========================================================================== */

export const docente = sqliteTable(
  "docente",
  {
    id: text("id").primaryKey().default(uuidDefault),
    usuarioId: text("usuario_id").unique().references(() => usuario.id),
    codigo: text("codigo").notNull().unique(),
    nombres: text("nombres").notNull(),
    apellidos: text("apellidos").notNull(),
    email: text("email").notNull().unique(),
    departamentoId: text("departamento_id")
      .notNull()
      .references(() => departamentoAcademico.id),
    categoriaId: integer("categoria_id")
      .notNull()
      .references(() => categoriaDocente.id),
    dedicacionId: integer("dedicacion_id")
      .notNull()
      .references(() => dedicacion.id),
    fechaCategoria: text("fecha_categoria").notNull(),
    especialidad: text("especialidad"),
    activo: integer("activo", { mode: "boolean" }).notNull().default(true),
    version: integer("version").notNull().default(1),
    creadoEn: text("creado_en").notNull().default(nowDefault),
    actualizadoEn: text("actualizado_en").notNull().default(nowDefault),
  },
  (t) => [
    index("ix_docente_departamento").on(t.departamentoId),
    index("ix_docente_apellidos").on(t.apellidos, t.nombres),
    check("ck_docente_activo", activoCheck("activo")),
  ],
);

export const legajo = sqliteTable("legajo", {
  id: text("id").primaryKey().default(uuidDefault),
  docenteId: text("docente_id")
    .notNull()
    .unique()
    .references(() => docente.id),
  fechaApertura: text("fecha_apertura").notNull().default(todayDefault),
  observaciones: text("observaciones"),
  creadoEn: text("creado_en").notNull().default(nowDefault),
});

export const tipoMerito = sqliteTable(
  "tipo_merito",
  {
    id: integer("id").primaryKey(),
    codigo: text("codigo").notNull().unique(),
    nombre: text("nombre").notNull(),
    grupo: text("grupo", { enum: grupoTipoMeritoValues }).notNull(),
    puntua: integer("puntua", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [check("ck_tipo_merito_grupo", sql`${t.grupo} IN ('grado','actividad','antecedente','requisito')`)],
);

export const documento = sqliteTable(
  "documento",
  {
    id: text("id").primaryKey().default(uuidDefault),
    legajoId: text("legajo_id")
      .notNull()
      .references(() => legajo.id),
    subidoPor: text("subido_por")
      .notNull()
      .references(() => usuario.id),
    nombreOriginal: text("nombre_original").notNull(),
    tipoMime: text("tipo_mime").notNull(),
    tamanoBytes: integer("tamano_bytes").notNull(),
    hashSha256: text("hash_sha256").notNull(),
    claveAlmacenamiento: text("clave_almacenamiento").notNull().unique(),
    version: integer("version").notNull().default(1),
    reemplazaA: text("reemplaza_a").references((): AnySQLiteColumn => documento.id),
    retenerHasta: text("retener_hasta"),
    subidoEn: text("subido_en").notNull().default(nowDefault),
  },
  (t) => [
    index("ix_documento_legajo").on(t.legajoId),
    index("ix_documento_hash").on(t.hashSha256),
    check("ck_documento_tamano", sql`${t.tamanoBytes} > 0`),
    check("ck_documento_hash", sql`length(${t.hashSha256}) = 64 AND ${t.hashSha256} NOT GLOB '*[^0-9a-f]*'`),
  ],
);

export const merito = sqliteTable(
  "merito",
  {
    id: text("id").primaryKey().default(uuidDefault),
    legajoId: text("legajo_id")
      .notNull()
      .references(() => legajo.id),
    tipoMeritoId: integer("tipo_merito_id")
      .notNull()
      .references(() => tipoMerito.id),
    titulo: text("titulo").notNull(),
    institucion: text("institucion").notNull(),
    fechaMerito: text("fecha_merito").notNull(),
    documentoId: text("documento_id")
      .notNull()
      .references(() => documento.id),
    estadoRevision: text("estado_revision", { enum: estadoRevisionValues }).notNull().default("pendiente"),
    observacion: text("observacion"),
    revisadoPor: text("revisado_por").references(() => usuario.id),
    revisadoEn: text("revisado_en"),
    version: integer("version").notNull().default(1),
    creadoEn: text("creado_en").notNull().default(nowDefault),
    actualizadoEn: text("actualizado_en").notNull().default(nowDefault),
  },
  (t) => [
    index("ix_merito_legajo_estado").on(t.legajoId, t.estadoRevision),
    index("ix_merito_tipo").on(t.tipoMeritoId),
    check("ck_merito_observado", sql`${t.estadoRevision} <> 'observado' OR length(trim(coalesce(${t.observacion},''))) > 0`),
    check("ck_merito_revisor", sql`${t.estadoRevision} = 'pendiente' OR ${t.revisadoPor} IS NOT NULL`),
  ],
);

export const revisionMerito = sqliteTable(
  "revision_merito",
  {
    id: text("id").primaryKey().default(uuidDefault),
    meritoId: text("merito_id")
      .notNull()
      .references(() => merito.id),
    revisorId: text("revisor_id")
      .notNull()
      .references(() => usuario.id),
    rolId: integer("rol_id")
      .notNull()
      .references(() => rol.id),
    accion: text("accion", { enum: accionRevisionValues }).notNull(),
    estadoAnterior: text("estado_anterior", { enum: estadoRevisionValues }),
    estadoPosterior: text("estado_posterior", { enum: estadoRevisionValues }).notNull(),
    documentoAnteriorId: text("documento_anterior_id").references(() => documento.id),
    documentoPosteriorId: text("documento_posterior_id").references(() => documento.id),
    nota: text("nota"),
    copiaAntes: text("copia_antes"),
    copiaDespues: text("copia_despues"),
    ocurridoEn: text("ocurrido_en").notNull().default(nowDefault),
  },
  (t) => [
    index("ix_revision_merito").on(t.meritoId, t.ocurridoEn),
    check("ck_revision_copia_antes", sql`${t.copiaAntes} IS NULL OR json_valid(${t.copiaAntes})`),
    check("ck_revision_copia_despues", sql`${t.copiaDespues} IS NULL OR json_valid(${t.copiaDespues})`),
  ],
);

export const experienciaLaboral = sqliteTable(
  "experiencia_laboral",
  {
    id: text("id").primaryKey().default(uuidDefault),
    legajoId: text("legajo_id")
      .notNull()
      .references(() => legajo.id),
    institucion: text("institucion").notNull(),
    cargo: text("cargo").notNull(),
    fechaInicio: text("fecha_inicio").notNull(),
    fechaFin: text("fecha_fin"),
    documentoId: text("documento_id")
      .notNull()
      .references(() => documento.id),
    actualizadoEn: text("actualizado_en").notNull().default(nowDefault),
  },
  (t) => [
    index("ix_experiencia_legajo").on(t.legajoId),
    check("ck_experiencia_fechas", sql`${t.fechaFin} IS NULL OR ${t.fechaFin} >= ${t.fechaInicio}`),
  ],
);

/* ========================================================================== */
/* Módulo C · Convocatoria, rúbrica y plazas (§6.4)                            */
/* ========================================================================== */

export const rubrica = sqliteTable(
  "rubrica",
  {
    id: text("id").primaryKey().default(uuidDefault),
    version: text("version").notNull().unique(),
    nombre: text("nombre").notNull(),
    umbral: real("umbral").notNull().default(55),
    puntajeMaximo: real("puntaje_maximo").notNull().default(100),
    estadoFuente: text("estado_fuente", { enum: estadoFuenteValues }).notNull().default("simulacion"),
    fuenteNormativa: text("fuente_normativa"),
    aprobadaEn: text("aprobada_en"),
    creadaPor: text("creada_por")
      .notNull()
      .references(() => usuario.id),
    creadaEn: text("creada_en").notNull().default(nowDefault),
  },
  (t) => [check("ck_rubrica_umbral", sql`${t.umbral} >= 0 AND ${t.umbral} <= ${t.puntajeMaximo}`)],
);

export const rubricaCriterio = sqliteTable(
  "rubrica_criterio",
  {
    id: text("id").primaryKey().default(uuidDefault),
    rubricaId: text("rubrica_id")
      .notNull()
      .references(() => rubrica.id),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    tipoMeritoId: integer("tipo_merito_id").references(() => tipoMerito.id),
    puntosPorUnidad: real("puntos_por_unidad").notNull(),
    tope: real("tope").notNull(),
    fuenteReferencia: text("fuente_referencia").notNull(),
    estadoFuente: text("estado_fuente", { enum: estadoFuenteValues }).notNull().default("simulacion"),
  },
  (t) => [
    uniqueIndex("uq_criterio_rubrica_codigo").on(t.rubricaId, t.codigo),
    check("ck_criterio_puntos", sql`${t.puntosPorUnidad} >= 0 AND ${t.tope} >= 0`),
  ],
);

export const rubricaRequisito = sqliteTable(
  "rubrica_requisito",
  {
    id: text("id").primaryKey().default(uuidDefault),
    rubricaId: text("rubrica_id")
      .notNull()
      .references(() => rubrica.id),
    categoriaDestinoId: integer("categoria_destino_id")
      .notNull()
      .references(() => categoriaDocente.id),
    gradoMinimoId: integer("grado_minimo_id")
      .notNull()
      .references(() => tipoMerito.id),
    aniosMinimos: integer("anios_minimos").notNull(),
    investigacionesMinimas: integer("investigaciones_minimas").notNull(),
    exigeRatificacion: integer("exige_ratificacion", { mode: "boolean" }).notNull().default(true),
    fuenteReferencia: text("fuente_referencia").notNull(),
  },
  (t) => [
    uniqueIndex("uq_requisito_rubrica_categoria").on(t.rubricaId, t.categoriaDestinoId),
    check("ck_requisito_valores", sql`${t.aniosMinimos} >= 0 AND ${t.investigacionesMinimas} >= 0`),
    check("ck_requisito_ratificacion", sql`${t.exigeRatificacion} IN (0, 1)`),
  ],
);

export const plaza = sqliteTable(
  "plaza",
  {
    id: text("id").primaryKey().default(uuidDefault),
    codigo: text("codigo").notNull().unique(),
    etiqueta: text("etiqueta").notNull(),
    departamentoId: text("departamento_id")
      .notNull()
      .references(() => departamentoAcademico.id),
    categoriaId: integer("categoria_id")
      .notNull()
      .references(() => categoriaDocente.id),
    dedicacionId: integer("dedicacion_id")
      .notNull()
      .references(() => dedicacion.id),
    habilitada: integer("habilitada", { mode: "boolean" }).notNull().default(true),
    creadaEn: text("creada_en").notNull().default(nowDefault),
  },
  (t) => [
    index("ix_plaza_ambito").on(t.departamentoId, t.categoriaId, t.dedicacionId),
    check("ck_plaza_habilitada", sql`${t.habilitada} IN (0, 1)`),
  ],
);

export const convocatoria = sqliteTable(
  "convocatoria",
  {
    id: text("id").primaryKey().default(uuidDefault),
    codigo: text("codigo").notNull().unique(),
    nombre: text("nombre").notNull(),
    fechaInicio: text("fecha_inicio").notNull(),
    fechaFin: text("fecha_fin").notNull(),
    estado: text("estado", { enum: estadoConvocatoriaValues }).notNull().default("abierta"),
    rubricaId: text("rubrica_id")
      .notNull()
      .references(() => rubrica.id),
    resolucionReferencia: text("resolucion_referencia"),
    recepcionCerradaEn: text("recepcion_cerrada_en"),
    creadaPor: text("creada_por")
      .notNull()
      .references(() => usuario.id),
    version: integer("version").notNull().default(1),
    creadaEn: text("creada_en").notNull().default(nowDefault),
  },
  (t) => [
    index("ix_convocatoria_estado").on(t.estado),
    check("ck_convocatoria_fechas", sql`${t.fechaFin} >= ${t.fechaInicio}`),
  ],
);

export const convocatoriaPlaza = sqliteTable(
  "convocatoria_plaza",
  {
    convocatoriaId: text("convocatoria_id")
      .notNull()
      .references(() => convocatoria.id),
    plazaId: text("plaza_id")
      .notNull()
      .references(() => plaza.id),
  },
  (t) => [primaryKey({ columns: [t.convocatoriaId, t.plazaId] })],
);

export const comisionEvaluadora = sqliteTable(
  "comision_evaluadora",
  {
    id: text("id").primaryKey().default(uuidDefault),
    convocatoriaId: text("convocatoria_id")
      .notNull()
      .references(() => convocatoria.id),
    facultadId: text("facultad_id").references(() => facultad.id),
    nombre: text("nombre").notNull(),
    resolucionDesignacion: text("resolucion_designacion"),
  },
  (t) => [uniqueIndex("uq_comision_convocatoria_nombre").on(t.convocatoriaId, t.nombre)],
);

export const miembroComision = sqliteTable(
  "miembro_comision",
  {
    comisionId: text("comision_id")
      .notNull()
      .references(() => comisionEvaluadora.id),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuario.id),
    cargo: text("cargo", { enum: cargoComisionValues }).notNull().default("miembro"),
  },
  (t) => [
    primaryKey({ columns: [t.comisionId, t.usuarioId] }),
    check("ck_miembro_cargo", sql`${t.cargo} IN ('presidente','secretario','miembro')`),
  ],
);

/* ========================================================================== */
/* Módulo D · Solicitud y evaluación (§6.4)                                    */
/* ========================================================================== */

export const solicitudPromocion = sqliteTable(
  "solicitud_promocion",
  {
    id: text("id").primaryKey().default(uuidDefault),
    codigo: text("codigo").notNull().unique(),
    docenteId: text("docente_id")
      .notNull()
      .references(() => docente.id),
    convocatoriaId: text("convocatoria_id").notNull(),
    plazaId: text("plaza_id").notNull(),
    categoriaOrigenId: integer("categoria_origen_id")
      .notNull()
      .references(() => categoriaDocente.id),
    categoriaDestinoId: integer("categoria_destino_id")
      .notNull()
      .references(() => categoriaDocente.id),
    estado: text("estado", { enum: estadoSolicitudValues }).notNull().default("borrador"),
    nota: text("nota"),
    presentadaEn: text("presentada_en"),
    version: integer("version").notNull().default(1),
    creadaEn: text("creada_en").notNull().default(nowDefault),
    actualizadaEn: text("actualizada_en").notNull().default(nowDefault),
  },
  (t) => [
    uniqueIndex("uq_solicitud_docente_convocatoria").on(t.docenteId, t.convocatoriaId),
    index("ix_solicitud_plaza_estado").on(t.convocatoriaId, t.plazaId, t.estado),
    index("ix_solicitud_docente").on(t.docenteId),
    foreignKey({
      name: "fk_solicitud_convocatoria_plaza",
      columns: [t.convocatoriaId, t.plazaId],
      foreignColumns: [convocatoriaPlaza.convocatoriaId, convocatoriaPlaza.plazaId],
    }),
    check("ck_solicitud_presentada", sql`${t.estado} = 'borrador' OR ${t.presentadaEn} IS NOT NULL OR ${t.estado} = 'no_presentada'`),
    check("ck_solicitud_categorias", sql`${t.categoriaDestinoId} <> ${t.categoriaOrigenId}`),
  ],
);

export const expedienteItem = sqliteTable(
  "expediente_item",
  {
    solicitudId: text("solicitud_id")
      .notNull()
      .references(() => solicitudPromocion.id),
    meritoId: text("merito_id")
      .notNull()
      .references(() => merito.id),
    documentoId: text("documento_id")
      .notNull()
      .references(() => documento.id),
    incorporadoEn: text("incorporado_en").notNull().default(nowDefault),
  },
  (t) => [primaryKey({ columns: [t.solicitudId, t.meritoId] })],
);

export const observacionSolicitud = sqliteTable(
  "observacion_solicitud",
  {
    id: text("id").primaryKey().default(uuidDefault),
    solicitudId: text("solicitud_id")
      .notNull()
      .references(() => solicitudPromocion.id),
    autorId: text("autor_id")
      .notNull()
      .references(() => usuario.id),
    texto: text("texto").notNull(),
    creadaEn: text("creada_en").notNull().default(nowDefault),
    subsanadaEn: text("subsanada_en"),
  },
  (t) => [index("ix_observacion_solicitud").on(t.solicitudId)],
);

export const solicitudHistorialEstado = sqliteTable(
  "solicitud_historial_estado",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    solicitudId: text("solicitud_id")
      .notNull()
      .references(() => solicitudPromocion.id),
    estadoAnterior: text("estado_anterior", { enum: estadoSolicitudValues }),
    estadoNuevo: text("estado_nuevo", { enum: estadoSolicitudValues }).notNull(),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuario.id),
    motivo: text("motivo"),
    cambiadoEn: text("cambiado_en").notNull().default(nowDefault),
  },
  (t) => [index("ix_hist_solicitud").on(t.solicitudId, t.cambiadoEn)],
);

export const evaluacion = sqliteTable(
  "evaluacion",
  {
    id: text("id").primaryKey().default(uuidDefault),
    solicitudId: text("solicitud_id")
      .notNull()
      .unique()
      .references(() => solicitudPromocion.id),
    rubricaId: text("rubrica_id")
      .notNull()
      .references(() => rubrica.id),
    comisionId: text("comision_id")
      .notNull()
      .references(() => comisionEvaluadora.id),
    evaluadorId: text("evaluador_id")
      .notNull()
      .references(() => usuario.id),
    puntajeTotal: real("puntaje_total").notNull(),
    umbralAplicado: real("umbral_aplicado").notNull(),
    plazaDisponible: integer("plaza_disponible", { mode: "boolean" }).notNull(),
    resultado: text("resultado", { enum: resultadoEvaluacionValues }).notNull(),
    fundamento: text("fundamento").notNull(),
    claveIdempotencia: text("clave_idempotencia").notNull().unique(),
    instantaneaDocente: text("instantanea_docente").notNull(),
    instantaneaPlaza: text("instantanea_plaza"),
    instantaneaConvocatoria: text("instantanea_convocatoria").notNull(),
    cerradaEn: text("cerrada_en").notNull().default(nowDefault),
  },
  (t) => [
    index("ix_evaluacion_rubrica").on(t.rubricaId),
    check("ck_evaluacion_puntaje", sql`${t.puntajeTotal} >= 0 AND ${t.puntajeTotal} <= 100`),
    check("ck_evaluacion_plaza_disponible", sql`${t.plazaDisponible} IN (0, 1)`),
    check("ck_evaluacion_sin_vacante", sql`${t.resultado} <> 'apto' OR ${t.plazaDisponible} = 1`),
    check("ck_evaluacion_instantanea_docente", sql`json_valid(${t.instantaneaDocente})`),
    check("ck_evaluacion_instantanea_plaza", sql`${t.instantaneaPlaza} IS NULL OR json_valid(${t.instantaneaPlaza})`),
    check("ck_evaluacion_instantanea_convocatoria", sql`json_valid(${t.instantaneaConvocatoria})`),
  ],
);

export const evaluacionCriterio = sqliteTable(
  "evaluacion_criterio",
  {
    id: text("id").primaryKey().default(uuidDefault),
    evaluacionId: text("evaluacion_id")
      .notNull()
      .references(() => evaluacion.id),
    rubricaCriterioId: text("rubrica_criterio_id")
      .notNull()
      .references(() => rubricaCriterio.id),
    etiqueta: text("etiqueta").notNull(),
    puntaje: real("puntaje").notNull(),
    tope: real("tope").notNull(),
    detalle: text("detalle"),
  },
  (t) => [
    index("ix_eval_criterio").on(t.evaluacionId),
    check("ck_eval_criterio_tope", sql`${t.puntaje} >= 0 AND ${t.puntaje} <= ${t.tope}`),
  ],
);

export const evaluacionRequisito = sqliteTable(
  "evaluacion_requisito",
  {
    id: text("id").primaryKey().default(uuidDefault),
    evaluacionId: text("evaluacion_id")
      .notNull()
      .references(() => evaluacion.id),
    etiqueta: text("etiqueta").notNull(),
    cumple: integer("cumple", { mode: "boolean" }).notNull(),
    detalle: text("detalle"),
  },
  (t) => [
    index("ix_eval_requisito").on(t.evaluacionId),
    check("ck_eval_requisito_cumple", sql`${t.cumple} IN (0, 1)`),
  ],
);

export const evaluacionEvidencia = sqliteTable(
  "evaluacion_evidencia",
  {
    evaluacionId: text("evaluacion_id")
      .notNull()
      .references(() => evaluacion.id),
    meritoId: text("merito_id")
      .notNull()
      .references(() => merito.id),
    documentoId: text("documento_id")
      .notNull()
      .references(() => documento.id),
    hashSha256: text("hash_sha256").notNull(),
    estadoRevision: text("estado_revision", { enum: estadoRevisionValues }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.evaluacionId, t.meritoId] })],
);

/* ========================================================================== */
/* Módulo E · Propuesta y decisión (§6.4)                                      */
/* ========================================================================== */

export const propuesta = sqliteTable(
  "propuesta",
  {
    id: text("id").primaryKey().default(uuidDefault),
    solicitudId: text("solicitud_id")
      .notNull()
      .unique()
      .references(() => solicitudPromocion.id),
    evaluacionId: text("evaluacion_id")
      .notNull()
      .unique()
      .references(() => evaluacion.id),
    convocatoriaId: text("convocatoria_id").notNull(),
    plazaId: text("plaza_id").notNull(),
    estado: text("estado", { enum: etapaPropuestaValues }).notNull().default("decanato"),
    informe: text("informe").notNull(),
    creadaPor: text("creada_por")
      .notNull()
      .references(() => usuario.id),
    version: integer("version").notNull().default(1),
    creadaEn: text("creada_en").notNull().default(nowDefault),
    actualizadaEn: text("actualizada_en").notNull().default(nowDefault),
  },
  (t) => [
    foreignKey({
      name: "fk_propuesta_convocatoria_plaza",
      columns: [t.convocatoriaId, t.plazaId],
      foreignColumns: [convocatoriaPlaza.convocatoriaId, convocatoriaPlaza.plazaId],
    }),
    // RN18: una plaza no admite dos propuestas activas o aprobadas.
    uniqueIndex("ux_propuesta_plaza_activa")
      .on(t.plazaId)
      .where(sql`${t.estado} <> 'denegada'`),
  ],
);

export const propuestaOrdenMerito = sqliteTable(
  "propuesta_orden_merito",
  {
    propuestaId: text("propuesta_id")
      .notNull()
      .references(() => propuesta.id),
    solicitudId: text("solicitud_id")
      .notNull()
      .references(() => solicitudPromocion.id),
    evaluacionId: text("evaluacion_id")
      .notNull()
      .references(() => evaluacion.id),
    docenteId: text("docente_id")
      .notNull()
      .references(() => docente.id),
    nombreDocente: text("nombre_docente").notNull(),
    puntaje: real("puntaje").notNull(),
    resultado: text("resultado", { enum: resultadoEvaluacionValues }).notNull(),
    puesto: integer("puesto"),
    empate: integer("empate", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.propuestaId, t.solicitudId] }),
    check("ck_orden_empate", sql`${t.empate} IN (0, 1)`),
  ],
);

export const propuestaEvento = sqliteTable(
  "propuesta_evento",
  {
    id: text("id").primaryKey().default(uuidDefault),
    propuestaId: text("propuesta_id")
      .notNull()
      .references(() => propuesta.id),
    etapa: text("etapa", { enum: etapaPropuestaValues }).notNull(),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuario.id),
    rolId: integer("rol_id")
      .notNull()
      .references(() => rol.id),
    referencia: text("referencia").notNull(),
    documentoId: text("documento_id").references(() => documento.id),
    nota: text("nota"),
    ocurridoEn: text("ocurrido_en").notNull().default(nowDefault),
  },
  (t) => [index("ix_propuesta_evento").on(t.propuestaId, t.ocurridoEn)],
);

/* ========================================================================== */
/* Módulo F · Auditoría (§6.4)                                                 */
/* ========================================================================== */

export const auditoriaEvento = sqliteTable(
  "auditoria_evento",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ocurridoEn: text("ocurrido_en").notNull().default(nowDefault),
    usuarioId: text("usuario_id").references(() => usuario.id),
    rolId: integer("rol_id").references(() => rol.id),
    docenteId: text("docente_id").references(() => docente.id),
    accion: text("accion").notNull(),
    entidad: text("entidad").notNull(),
    mensaje: text("mensaje").notNull(),
    motivo: text("motivo"),
    idSolicitudHttp: text("id_solicitud_http"),
  },
  (t) => [
    index("ix_auditoria_fecha").on(t.ocurridoEn),
    index("ix_auditoria_docente").on(t.docenteId, t.ocurridoEn),
  ],
);

export const auditoriaCambio = sqliteTable(
  "auditoria_cambio",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    auditoriaId: integer("auditoria_id")
      .notNull()
      .references(() => auditoriaEvento.id),
    entidad: text("entidad").notNull(),
    registroId: text("registro_id").notNull(),
    antes: text("antes"),
    despues: text("despues"),
  },
  (t) => [
    index("ix_auditoria_cambio").on(t.auditoriaId),
    check("ck_auditoria_antes", sql`${t.antes} IS NULL OR json_valid(${t.antes})`),
    check("ck_auditoria_despues", sql`${t.despues} IS NULL OR json_valid(${t.despues})`),
  ],
);
