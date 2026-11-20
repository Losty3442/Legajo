-- PostgreSQL local · IDs heredados conservados como text.
-- Las columnas datos son proyecciones por entidad; las relaciones y reglas viven en SQL.

CREATE TABLE facultad (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  codigo text NOT NULL,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT pk_facultad PRIMARY KEY (id),
  CONSTRAINT uq_facultad_codigo UNIQUE (codigo),
  CONSTRAINT uq_facultad_nombre UNIQUE (nombre)
);

CREATE TABLE departamento_academico (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  facultad_id text NOT NULL,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT pk_departamento_academico PRIMARY KEY (id),
  CONSTRAINT uq_departamento_facultad_nombre UNIQUE (facultad_id, nombre),
  CONSTRAINT fk_departamento_academico_0 FOREIGN KEY (facultad_id) REFERENCES facultad (id)
);

CREATE TABLE categoria_docente (
  id integer NOT NULL,
  nombre text NOT NULL,
  orden integer NOT NULL,
  CONSTRAINT pk_categoria_docente PRIMARY KEY (id),
  CONSTRAINT uq_categoria_docente_nombre UNIQUE (nombre),
  CONSTRAINT uq_categoria_docente_orden UNIQUE (orden)
);

CREATE TABLE dedicacion (
  id integer NOT NULL,
  nombre text NOT NULL,
  CONSTRAINT pk_dedicacion PRIMARY KEY (id),
  CONSTRAINT uq_dedicacion_nombre UNIQUE (nombre)
);

CREATE TABLE rol (
  id integer NOT NULL,
  codigo text NOT NULL,
  nombre text NOT NULL,
  CONSTRAINT pk_rol PRIMARY KEY (id),
  CONSTRAINT uq_rol_codigo UNIQUE (codigo)
);

CREATE TABLE usuario (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  sub_externo text,
  nombre_completo text NOT NULL,
  email text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  ultimo_acceso timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  password_hash text,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT pk_usuario PRIMARY KEY (id),
  CONSTRAINT uq_usuario_sub_externo UNIQUE (sub_externo),
  CONSTRAINT uq_usuario_email UNIQUE (email)
);

CREATE TABLE asignacion_rol (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  usuario_id text NOT NULL,
  rol_id integer NOT NULL,
  facultad_id text,
  departamento_id text,
  vigente_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta date,
  CONSTRAINT pk_asignacion_rol PRIMARY KEY (id),
  CONSTRAINT fk_asignacion_rol_0 FOREIGN KEY (departamento_id) REFERENCES departamento_academico (id),
  CONSTRAINT fk_asignacion_rol_1 FOREIGN KEY (facultad_id) REFERENCES facultad (id),
  CONSTRAINT fk_asignacion_rol_2 FOREIGN KEY (rol_id) REFERENCES rol (id),
  CONSTRAINT fk_asignacion_rol_3 FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT ck_pg_asignacion_rol_0 CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE TABLE docente (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  usuario_id text,
  codigo text NOT NULL,
  nombres text,
  apellidos text,
  email text NOT NULL,
  departamento_id text NOT NULL,
  categoria_id integer NOT NULL,
  dedicacion_id integer NOT NULL,
  fecha_categoria date NOT NULL,
  especialidad text,
  activo boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  nombre_completo text NOT NULL,
  CONSTRAINT pk_docente PRIMARY KEY (id),
  CONSTRAINT uq_docente_usuario_id UNIQUE (usuario_id),
  CONSTRAINT uq_docente_codigo UNIQUE (codigo),
  CONSTRAINT uq_docente_email UNIQUE (email),
  CONSTRAINT fk_docente_0 FOREIGN KEY (dedicacion_id) REFERENCES dedicacion (id),
  CONSTRAINT fk_docente_1 FOREIGN KEY (categoria_id) REFERENCES categoria_docente (id),
  CONSTRAINT fk_docente_2 FOREIGN KEY (departamento_id) REFERENCES departamento_academico (id),
  CONSTRAINT fk_docente_3 FOREIGN KEY (usuario_id) REFERENCES usuario (id)
);

CREATE TABLE legajo (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  docente_id text NOT NULL,
  fecha_apertura date NOT NULL DEFAULT CURRENT_DATE,
  observaciones text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_legajo PRIMARY KEY (id),
  CONSTRAINT uq_legajo_docente_id UNIQUE (docente_id),
  CONSTRAINT fk_legajo_0 FOREIGN KEY (docente_id) REFERENCES docente (id)
);

CREATE TABLE tipo_merito (
  id integer NOT NULL,
  codigo text NOT NULL,
  nombre text NOT NULL,
  grupo text NOT NULL,
  puntua boolean NOT NULL DEFAULT false,
  CONSTRAINT pk_tipo_merito PRIMARY KEY (id),
  CONSTRAINT uq_tipo_merito_codigo UNIQUE (codigo),
  CONSTRAINT ck_pg_tipo_merito_1 CHECK (grupo IN ('grado','actividad','antecedente','requisito'))
);

CREATE TABLE documento (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  legajo_id text NOT NULL,
  subido_por text NOT NULL,
  nombre_original text NOT NULL,
  tipo_mime text NOT NULL,
  tamano_bytes bigint NOT NULL,
  hash_sha256 text NOT NULL,
  clave_almacenamiento text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  reemplaza_a text,
  retener_hasta date,
  subido_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_documento PRIMARY KEY (id),
  CONSTRAINT uq_documento_clave_almacenamiento UNIQUE (clave_almacenamiento),
  CONSTRAINT fk_documento_0 FOREIGN KEY (reemplaza_a) REFERENCES documento (id),
  CONSTRAINT fk_documento_1 FOREIGN KEY (subido_por) REFERENCES usuario (id),
  CONSTRAINT fk_documento_2 FOREIGN KEY (legajo_id) REFERENCES legajo (id),
  CONSTRAINT ck_pg_documento_0 CHECK (tamano_bytes > 0),
  CONSTRAINT ck_pg_documento_1 CHECK (hash_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE merito (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  legajo_id text NOT NULL,
  tipo_merito_id integer NOT NULL,
  titulo text NOT NULL,
  institucion text NOT NULL,
  fecha_merito date NOT NULL,
  documento_id text NOT NULL,
  estado_revision text NOT NULL DEFAULT 'pendiente',
  observacion text,
  revisado_por text,
  revisado_en timestamptz,
  version integer NOT NULL DEFAULT 1,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT pk_merito PRIMARY KEY (id),
  CONSTRAINT fk_merito_0 FOREIGN KEY (revisado_por) REFERENCES usuario (id),
  CONSTRAINT fk_merito_1 FOREIGN KEY (documento_id) REFERENCES documento (id),
  CONSTRAINT fk_merito_2 FOREIGN KEY (tipo_merito_id) REFERENCES tipo_merito (id),
  CONSTRAINT fk_merito_3 FOREIGN KEY (legajo_id) REFERENCES legajo (id),
  CONSTRAINT ck_pg_merito_0 CHECK (estado_revision IN ('pendiente', 'verificado', 'observado')),
  CONSTRAINT ck_pg_merito_1 CHECK (estado_revision <> 'observado' OR length(trim(coalesce(observacion,''))) > 0),
  CONSTRAINT ck_pg_merito_2 CHECK (estado_revision = 'pendiente' OR revisado_por IS NOT NULL)
);

CREATE TABLE revision_merito (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  merito_id text NOT NULL,
  revisor_id text NOT NULL,
  rol_id integer NOT NULL,
  accion text NOT NULL,
  estado_anterior text,
  estado_posterior text NOT NULL,
  documento_anterior_id text,
  documento_posterior_id text,
  nota text,
  copia_antes jsonb,
  copia_despues jsonb,
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT pk_revision_merito PRIMARY KEY (id),
  CONSTRAINT fk_revision_merito_0 FOREIGN KEY (documento_posterior_id) REFERENCES documento (id),
  CONSTRAINT fk_revision_merito_1 FOREIGN KEY (documento_anterior_id) REFERENCES documento (id),
  CONSTRAINT fk_revision_merito_2 FOREIGN KEY (rol_id) REFERENCES rol (id),
  CONSTRAINT fk_revision_merito_3 FOREIGN KEY (revisor_id) REFERENCES usuario (id),
  CONSTRAINT fk_revision_merito_4 FOREIGN KEY (merito_id) REFERENCES merito (id),
  CONSTRAINT ck_pg_revision_merito_0 CHECK (accion IN ('revision', 'correccion', 'migracion')),
  CONSTRAINT ck_pg_revision_merito_1 CHECK (estado_anterior IN ('pendiente', 'verificado', 'observado')),
  CONSTRAINT ck_pg_revision_merito_2 CHECK (estado_posterior IN ('pendiente', 'verificado', 'observado'))
);

CREATE TABLE experiencia_laboral (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  legajo_id text NOT NULL,
  institucion text NOT NULL,
  cargo text NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date,
  documento_id text NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT pk_experiencia_laboral PRIMARY KEY (id),
  CONSTRAINT fk_experiencia_laboral_0 FOREIGN KEY (documento_id) REFERENCES documento (id),
  CONSTRAINT fk_experiencia_laboral_1 FOREIGN KEY (legajo_id) REFERENCES legajo (id),
  CONSTRAINT ck_pg_experiencia_laboral_0 CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE rubrica (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  version text NOT NULL,
  nombre text NOT NULL,
  umbral numeric NOT NULL DEFAULT 55,
  puntaje_maximo numeric NOT NULL DEFAULT 100,
  estado_fuente text NOT NULL DEFAULT 'simulacion',
  fuente_normativa text,
  aprobada_en timestamptz,
  creada_por text NOT NULL,
  creada_en timestamptz NOT NULL DEFAULT now(),
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT pk_rubrica PRIMARY KEY (id),
  CONSTRAINT uq_rubrica_version UNIQUE (version),
  CONSTRAINT fk_rubrica_0 FOREIGN KEY (creada_por) REFERENCES usuario (id),
  CONSTRAINT ck_pg_rubrica_0 CHECK (estado_fuente IN ('simulacion', 'oficial')),
  CONSTRAINT ck_pg_rubrica_1 CHECK (umbral >= 0 AND umbral <= puntaje_maximo)
);

CREATE TABLE rubrica_criterio (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  rubrica_id text NOT NULL,
  codigo text NOT NULL,
  nombre text NOT NULL,
  tipo_merito_id integer,
  puntos_por_unidad numeric NOT NULL,
  tope numeric NOT NULL,
  fuente_referencia text NOT NULL,
  estado_fuente text NOT NULL DEFAULT 'simulacion',
  CONSTRAINT pk_rubrica_criterio PRIMARY KEY (id),
  CONSTRAINT uq_criterio_rubrica_codigo UNIQUE (rubrica_id, codigo),
  CONSTRAINT fk_rubrica_criterio_0 FOREIGN KEY (tipo_merito_id) REFERENCES tipo_merito (id),
  CONSTRAINT fk_rubrica_criterio_1 FOREIGN KEY (rubrica_id) REFERENCES rubrica (id),
  CONSTRAINT ck_pg_rubrica_criterio_0 CHECK (estado_fuente IN ('simulacion', 'oficial')),
  CONSTRAINT ck_pg_rubrica_criterio_1 CHECK (puntos_por_unidad >= 0 AND tope >= 0)
);

CREATE TABLE rubrica_requisito (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  rubrica_id text NOT NULL,
  categoria_destino_id integer NOT NULL,
  grado_minimo_id integer NOT NULL,
  anios_minimos integer NOT NULL,
  investigaciones_minimas integer NOT NULL,
  exige_ratificacion boolean NOT NULL DEFAULT true,
  fuente_referencia text NOT NULL,
  CONSTRAINT pk_rubrica_requisito PRIMARY KEY (id),
  CONSTRAINT uq_requisito_rubrica_categoria UNIQUE (rubrica_id, categoria_destino_id),
  CONSTRAINT fk_rubrica_requisito_0 FOREIGN KEY (grado_minimo_id) REFERENCES tipo_merito (id),
  CONSTRAINT fk_rubrica_requisito_1 FOREIGN KEY (categoria_destino_id) REFERENCES categoria_docente (id),
  CONSTRAINT fk_rubrica_requisito_2 FOREIGN KEY (rubrica_id) REFERENCES rubrica (id),
  CONSTRAINT ck_pg_rubrica_requisito_1 CHECK (anios_minimos >= 0 AND investigaciones_minimas >= 0)
);

CREATE TABLE plaza (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  codigo text NOT NULL,
  etiqueta text NOT NULL,
  departamento_id text NOT NULL,
  categoria_id integer NOT NULL,
  dedicacion_id integer NOT NULL,
  habilitada boolean NOT NULL DEFAULT true,
  creada_en timestamptz NOT NULL DEFAULT now(),
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT pk_plaza PRIMARY KEY (id),
  CONSTRAINT uq_plaza_codigo UNIQUE (codigo),
  CONSTRAINT fk_plaza_0 FOREIGN KEY (dedicacion_id) REFERENCES dedicacion (id),
  CONSTRAINT fk_plaza_1 FOREIGN KEY (categoria_id) REFERENCES categoria_docente (id),
  CONSTRAINT fk_plaza_2 FOREIGN KEY (departamento_id) REFERENCES departamento_academico (id)
);

CREATE TABLE convocatoria (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  codigo text NOT NULL,
  nombre text NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  estado text NOT NULL DEFAULT 'abierta',
  rubrica_id text NOT NULL,
  resolucion_referencia text,
  recepcion_cerrada_en timestamptz,
  creada_por text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  creada_en timestamptz NOT NULL DEFAULT now(),
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT pk_convocatoria PRIMARY KEY (id),
  CONSTRAINT uq_convocatoria_codigo UNIQUE (codigo),
  CONSTRAINT fk_convocatoria_0 FOREIGN KEY (creada_por) REFERENCES usuario (id),
  CONSTRAINT fk_convocatoria_1 FOREIGN KEY (rubrica_id) REFERENCES rubrica (id),
  CONSTRAINT ck_pg_convocatoria_0 CHECK (estado IN ('abierta', 'evaluacion', 'cerrada')),
  CONSTRAINT ck_pg_convocatoria_1 CHECK (fecha_fin >= fecha_inicio)
);

CREATE TABLE convocatoria_plaza (
  convocatoria_id text NOT NULL,
  plaza_id text NOT NULL,
  CONSTRAINT pk_convocatoria_plaza PRIMARY KEY (convocatoria_id, plaza_id),
  CONSTRAINT fk_convocatoria_plaza_0 FOREIGN KEY (plaza_id) REFERENCES plaza (id),
  CONSTRAINT fk_convocatoria_plaza_1 FOREIGN KEY (convocatoria_id) REFERENCES convocatoria (id)
);

CREATE TABLE comision_evaluadora (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  convocatoria_id text NOT NULL,
  facultad_id text,
  nombre text NOT NULL,
  resolucion_designacion text,
  CONSTRAINT pk_comision_evaluadora PRIMARY KEY (id),
  CONSTRAINT uq_comision_convocatoria_nombre UNIQUE (convocatoria_id, nombre),
  CONSTRAINT fk_comision_evaluadora_0 FOREIGN KEY (facultad_id) REFERENCES facultad (id),
  CONSTRAINT fk_comision_evaluadora_1 FOREIGN KEY (convocatoria_id) REFERENCES convocatoria (id)
);

CREATE TABLE miembro_comision (
  comision_id text NOT NULL,
  usuario_id text NOT NULL,
  cargo text NOT NULL DEFAULT 'miembro',
  CONSTRAINT pk_miembro_comision PRIMARY KEY (comision_id, usuario_id),
  CONSTRAINT fk_miembro_comision_0 FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT fk_miembro_comision_1 FOREIGN KEY (comision_id) REFERENCES comision_evaluadora (id),
  CONSTRAINT ck_pg_miembro_comision_0 CHECK (cargo IN ('presidente','secretario','miembro'))
);

CREATE TABLE solicitud_promocion (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  codigo text NOT NULL,
  docente_id text NOT NULL,
  convocatoria_id text NOT NULL,
  plaza_id text NOT NULL,
  categoria_origen_id integer NOT NULL,
  categoria_destino_id integer NOT NULL,
  estado text NOT NULL DEFAULT 'borrador',
  nota text,
  presentada_en timestamptz,
  version integer NOT NULL DEFAULT 1,
  creada_en timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now(),
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT pk_solicitud_promocion PRIMARY KEY (id),
  CONSTRAINT uq_solicitud_promocion_codigo UNIQUE (codigo),
  CONSTRAINT uq_solicitud_docente_convocatoria UNIQUE (docente_id, convocatoria_id),
  CONSTRAINT fk_solicitud_promocion_0 FOREIGN KEY (convocatoria_id, plaza_id) REFERENCES convocatoria_plaza (convocatoria_id, plaza_id),
  CONSTRAINT fk_solicitud_promocion_1 FOREIGN KEY (categoria_destino_id) REFERENCES categoria_docente (id),
  CONSTRAINT fk_solicitud_promocion_2 FOREIGN KEY (categoria_origen_id) REFERENCES categoria_docente (id),
  CONSTRAINT fk_solicitud_promocion_3 FOREIGN KEY (docente_id) REFERENCES docente (id),
  CONSTRAINT ck_pg_solicitud_promocion_0 CHECK (estado IN ('borrador', 'presentada', 'observada', 'evaluada', 'no_presentada', 'propuesta', 'en_facultad', 'en_consejo', 'aprobada', 'denegada')),
  CONSTRAINT ck_pg_solicitud_promocion_1 CHECK (estado = 'borrador' OR presentada_en IS NOT NULL OR estado = 'no_presentada'),
  CONSTRAINT ck_pg_solicitud_promocion_2 CHECK (categoria_destino_id <> categoria_origen_id)
);

CREATE TABLE expediente_item (
  solicitud_id text NOT NULL,
  merito_id text NOT NULL,
  documento_id text NOT NULL,
  incorporado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_expediente_item PRIMARY KEY (solicitud_id, merito_id),
  CONSTRAINT fk_expediente_item_0 FOREIGN KEY (documento_id) REFERENCES documento (id),
  CONSTRAINT fk_expediente_item_1 FOREIGN KEY (merito_id) REFERENCES merito (id),
  CONSTRAINT fk_expediente_item_2 FOREIGN KEY (solicitud_id) REFERENCES solicitud_promocion (id)
);

CREATE TABLE observacion_solicitud (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  solicitud_id text NOT NULL,
  autor_id text NOT NULL,
  texto text NOT NULL,
  creada_en timestamptz NOT NULL DEFAULT now(),
  subsanada_en timestamptz,
  CONSTRAINT pk_observacion_solicitud PRIMARY KEY (id),
  CONSTRAINT fk_observacion_solicitud_0 FOREIGN KEY (autor_id) REFERENCES usuario (id),
  CONSTRAINT fk_observacion_solicitud_1 FOREIGN KEY (solicitud_id) REFERENCES solicitud_promocion (id)
);

CREATE TABLE solicitud_historial_estado (
  id bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  solicitud_id text NOT NULL,
  estado_anterior text,
  estado_nuevo text NOT NULL,
  usuario_id text NOT NULL,
  motivo text,
  cambiado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_solicitud_historial_estado PRIMARY KEY (id),
  CONSTRAINT fk_solicitud_historial_estado_0 FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT fk_solicitud_historial_estado_1 FOREIGN KEY (solicitud_id) REFERENCES solicitud_promocion (id),
  CONSTRAINT ck_pg_solicitud_historial_estado_0 CHECK (estado_anterior IN ('borrador', 'presentada', 'observada', 'evaluada', 'no_presentada', 'propuesta', 'en_facultad', 'en_consejo', 'aprobada', 'denegada')),
  CONSTRAINT ck_pg_solicitud_historial_estado_1 CHECK (estado_nuevo IN ('borrador', 'presentada', 'observada', 'evaluada', 'no_presentada', 'propuesta', 'en_facultad', 'en_consejo', 'aprobada', 'denegada'))
);

CREATE TABLE evaluacion (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  solicitud_id text NOT NULL,
  rubrica_id text NOT NULL,
  comision_id text NOT NULL,
  evaluador_id text NOT NULL,
  puntaje_total numeric NOT NULL,
  umbral_aplicado numeric NOT NULL,
  plaza_disponible boolean NOT NULL,
  resultado text NOT NULL,
  fundamento text NOT NULL,
  clave_idempotencia text NOT NULL,
  instantanea_docente jsonb NOT NULL,
  instantanea_plaza jsonb,
  instantanea_convocatoria jsonb NOT NULL,
  cerrada_en timestamptz NOT NULL DEFAULT now(),
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT pk_evaluacion PRIMARY KEY (id),
  CONSTRAINT uq_evaluacion_solicitud_id UNIQUE (solicitud_id),
  CONSTRAINT uq_evaluacion_clave_idempotencia UNIQUE (clave_idempotencia),
  CONSTRAINT fk_evaluacion_0 FOREIGN KEY (evaluador_id) REFERENCES usuario (id),
  CONSTRAINT fk_evaluacion_1 FOREIGN KEY (comision_id) REFERENCES comision_evaluadora (id),
  CONSTRAINT fk_evaluacion_2 FOREIGN KEY (rubrica_id) REFERENCES rubrica (id),
  CONSTRAINT fk_evaluacion_3 FOREIGN KEY (solicitud_id) REFERENCES solicitud_promocion (id),
  CONSTRAINT ck_pg_evaluacion_1 CHECK (resultado IN ('apto', 'no_apto', 'sin_vacante')),
  CONSTRAINT ck_pg_evaluacion_5 CHECK (puntaje_total >= 0 AND puntaje_total <= 100),
  CONSTRAINT ck_pg_evaluacion_6 CHECK (resultado <> 'apto' OR plaza_disponible = true)
);

CREATE TABLE evaluacion_criterio (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  evaluacion_id text NOT NULL,
  rubrica_criterio_id text NOT NULL,
  etiqueta text NOT NULL,
  puntaje numeric NOT NULL,
  tope numeric NOT NULL,
  detalle text,
  CONSTRAINT pk_evaluacion_criterio PRIMARY KEY (id),
  CONSTRAINT fk_evaluacion_criterio_0 FOREIGN KEY (rubrica_criterio_id) REFERENCES rubrica_criterio (id),
  CONSTRAINT fk_evaluacion_criterio_1 FOREIGN KEY (evaluacion_id) REFERENCES evaluacion (id),
  CONSTRAINT ck_pg_evaluacion_criterio_0 CHECK (puntaje >= 0 AND puntaje <= tope)
);

CREATE TABLE evaluacion_requisito (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  evaluacion_id text NOT NULL,
  etiqueta text NOT NULL,
  cumple boolean NOT NULL,
  detalle text,
  CONSTRAINT pk_evaluacion_requisito PRIMARY KEY (id),
  CONSTRAINT fk_evaluacion_requisito_0 FOREIGN KEY (evaluacion_id) REFERENCES evaluacion (id)
);

CREATE TABLE evaluacion_evidencia (
  evaluacion_id text NOT NULL,
  merito_id text NOT NULL,
  documento_id text NOT NULL,
  hash_sha256 text NOT NULL,
  estado_revision text NOT NULL,
  CONSTRAINT pk_evaluacion_evidencia PRIMARY KEY (evaluacion_id, merito_id),
  CONSTRAINT fk_evaluacion_evidencia_0 FOREIGN KEY (documento_id) REFERENCES documento (id),
  CONSTRAINT fk_evaluacion_evidencia_1 FOREIGN KEY (merito_id) REFERENCES merito (id),
  CONSTRAINT fk_evaluacion_evidencia_2 FOREIGN KEY (evaluacion_id) REFERENCES evaluacion (id),
  CONSTRAINT ck_pg_evaluacion_evidencia_0 CHECK (estado_revision IN ('pendiente', 'verificado', 'observado'))
);

CREATE TABLE propuesta (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  solicitud_id text NOT NULL,
  evaluacion_id text NOT NULL,
  convocatoria_id text NOT NULL,
  plaza_id text NOT NULL,
  estado text NOT NULL DEFAULT 'decanato',
  informe text NOT NULL,
  creada_por text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  creada_en timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now(),
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT pk_propuesta PRIMARY KEY (id),
  CONSTRAINT uq_propuesta_solicitud_id UNIQUE (solicitud_id),
  CONSTRAINT uq_propuesta_evaluacion_id UNIQUE (evaluacion_id),
  CONSTRAINT fk_propuesta_0 FOREIGN KEY (convocatoria_id, plaza_id) REFERENCES convocatoria_plaza (convocatoria_id, plaza_id),
  CONSTRAINT fk_propuesta_1 FOREIGN KEY (creada_por) REFERENCES usuario (id),
  CONSTRAINT fk_propuesta_2 FOREIGN KEY (evaluacion_id) REFERENCES evaluacion (id),
  CONSTRAINT fk_propuesta_3 FOREIGN KEY (solicitud_id) REFERENCES solicitud_promocion (id),
  CONSTRAINT ck_pg_propuesta_0 CHECK (estado IN ('decanato', 'facultad', 'universitario', 'aprobada', 'denegada'))
);

CREATE TABLE propuesta_orden_merito (
  propuesta_id text NOT NULL,
  solicitud_id text NOT NULL,
  evaluacion_id text NOT NULL,
  docente_id text NOT NULL,
  nombre_docente text NOT NULL,
  puntaje numeric NOT NULL,
  resultado text NOT NULL,
  puesto integer,
  empate boolean NOT NULL DEFAULT false,
  CONSTRAINT pk_propuesta_orden_merito PRIMARY KEY (propuesta_id, solicitud_id),
  CONSTRAINT fk_propuesta_orden_merito_0 FOREIGN KEY (docente_id) REFERENCES docente (id),
  CONSTRAINT fk_propuesta_orden_merito_1 FOREIGN KEY (evaluacion_id) REFERENCES evaluacion (id),
  CONSTRAINT fk_propuesta_orden_merito_2 FOREIGN KEY (solicitud_id) REFERENCES solicitud_promocion (id),
  CONSTRAINT fk_propuesta_orden_merito_3 FOREIGN KEY (propuesta_id) REFERENCES propuesta (id),
  CONSTRAINT ck_pg_propuesta_orden_merito_0 CHECK (resultado IN ('apto', 'no_apto', 'sin_vacante'))
);

CREATE TABLE propuesta_evento (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  propuesta_id text NOT NULL,
  etapa text NOT NULL,
  usuario_id text NOT NULL,
  rol_id integer NOT NULL,
  referencia text NOT NULL,
  documento_id text,
  nota text,
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_propuesta_evento PRIMARY KEY (id),
  CONSTRAINT fk_propuesta_evento_0 FOREIGN KEY (documento_id) REFERENCES documento (id),
  CONSTRAINT fk_propuesta_evento_1 FOREIGN KEY (rol_id) REFERENCES rol (id),
  CONSTRAINT fk_propuesta_evento_2 FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT fk_propuesta_evento_3 FOREIGN KEY (propuesta_id) REFERENCES propuesta (id),
  CONSTRAINT ck_pg_propuesta_evento_0 CHECK (etapa IN ('decanato', 'facultad', 'universitario', 'aprobada', 'denegada'))
);

CREATE TABLE auditoria_evento (
  id bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  usuario_id text,
  rol_id integer,
  docente_id text,
  accion text NOT NULL,
  entidad text NOT NULL,
  mensaje text NOT NULL,
  motivo text,
  id_solicitud_http text,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  origen_id text NOT NULL,
  CONSTRAINT pk_auditoria_evento PRIMARY KEY (id),
  CONSTRAINT uq_auditoria_origen UNIQUE (origen_id),
  CONSTRAINT fk_auditoria_evento_0 FOREIGN KEY (docente_id) REFERENCES docente (id),
  CONSTRAINT fk_auditoria_evento_1 FOREIGN KEY (rol_id) REFERENCES rol (id),
  CONSTRAINT fk_auditoria_evento_2 FOREIGN KEY (usuario_id) REFERENCES usuario (id)
);

CREATE TABLE auditoria_cambio (
  id bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  auditoria_id bigint NOT NULL,
  entidad text NOT NULL,
  registro_id text NOT NULL,
  antes jsonb,
  despues jsonb,
  CONSTRAINT pk_auditoria_cambio PRIMARY KEY (id),
  CONSTRAINT fk_auditoria_cambio_0 FOREIGN KEY (auditoria_id) REFERENCES auditoria_evento (id)
);


CREATE INDEX ix_asignacion_usuario ON asignacion_rol (usuario_id);
CREATE INDEX ix_docente_departamento ON docente (departamento_id);
CREATE INDEX ix_docente_apellidos ON docente (apellidos, nombres);
CREATE INDEX ix_documento_legajo ON documento (legajo_id);
CREATE INDEX ix_documento_hash ON documento (hash_sha256);
CREATE INDEX ix_merito_legajo_estado ON merito (legajo_id, estado_revision);
CREATE INDEX ix_merito_tipo ON merito (tipo_merito_id);
CREATE INDEX ix_revision_merito ON revision_merito (merito_id, ocurrido_en);
CREATE INDEX ix_experiencia_legajo ON experiencia_laboral (legajo_id);
CREATE INDEX ix_plaza_ambito ON plaza (departamento_id, categoria_id, dedicacion_id);
CREATE INDEX ix_convocatoria_estado ON convocatoria (estado);
CREATE INDEX ix_solicitud_plaza_estado ON solicitud_promocion (convocatoria_id, plaza_id, estado);
CREATE INDEX ix_solicitud_docente ON solicitud_promocion (docente_id);
CREATE INDEX ix_observacion_solicitud ON observacion_solicitud (solicitud_id);
CREATE INDEX ix_hist_solicitud ON solicitud_historial_estado (solicitud_id, cambiado_en);
CREATE INDEX ix_evaluacion_rubrica ON evaluacion (rubrica_id);
CREATE INDEX ix_eval_criterio ON evaluacion_criterio (evaluacion_id);
CREATE INDEX ix_eval_requisito ON evaluacion_requisito (evaluacion_id);
CREATE UNIQUE INDEX ux_propuesta_plaza_activa ON propuesta (plaza_id) WHERE estado <> 'denegada';
CREATE INDEX ix_propuesta_evento ON propuesta_evento (propuesta_id, ocurrido_en);
CREATE INDEX ix_auditoria_fecha ON auditoria_evento (ocurrido_en);
CREATE INDEX ix_auditoria_docente ON auditoria_evento (docente_id, ocurrido_en);
CREATE INDEX ix_auditoria_cambio ON auditoria_cambio (auditoria_id);
CREATE UNIQUE INDEX ux_asignacion_rol_unidad ON asignacion_rol
  (usuario_id, rol_id, coalesce(facultad_id, ''), coalesce(departamento_id, ''), vigente_desde);




CREATE TABLE aplicacion_estado (
  id integer PRIMARY KEY CHECK(id=1), revision integer NOT NULL DEFAULT 0,
  schema_version integer NOT NULL DEFAULT 2, inicializada boolean NOT NULL DEFAULT false,
  rubrica_vigente_id text REFERENCES rubrica(id)
);
INSERT INTO aplicacion_estado(id) VALUES(1);
CREATE TABLE sesion (
  token_hash text PRIMARY KEY, usuario_id text NOT NULL REFERENCES usuario(id),
  creada_en timestamptz NOT NULL DEFAULT now(), expira_en timestamptz NOT NULL
);
CREATE INDEX ix_sesion_expira ON sesion(expira_en);
CREATE TABLE migracion_lote (
  id text PRIMARY KEY, huella text NOT NULL UNIQUE, creada_en timestamptz NOT NULL DEFAULT now(),
  usuario_id text NOT NULL REFERENCES usuario(id), informe jsonb NOT NULL
);
CREATE TABLE operacion_idempotente (
  clave text PRIMARY KEY, usuario_id text NOT NULL REFERENCES usuario(id), tipo text NOT NULL,
  huella text NOT NULL, resultado jsonb NOT NULL, creada_en timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE docente_codigo_seq;
CREATE SEQUENCE solicitud_codigo_seq;
CREATE SEQUENCE convocatoria_codigo_seq;
CREATE FUNCTION impedir_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'El registro histórico de % es inmutable.', TG_TABLE_NAME USING ERRCODE='23514'; END $$;


CREATE TRIGGER trg_evaluacion_inmutable BEFORE UPDATE OR DELETE ON evaluacion FOR EACH ROW EXECUTE FUNCTION impedir_cambio();

CREATE TRIGGER trg_evaluacion_criterio_inmutable BEFORE UPDATE OR DELETE ON evaluacion_criterio FOR EACH ROW EXECUTE FUNCTION impedir_cambio();

CREATE TRIGGER trg_evaluacion_requisito_inmutable BEFORE UPDATE OR DELETE ON evaluacion_requisito FOR EACH ROW EXECUTE FUNCTION impedir_cambio();

CREATE TRIGGER trg_evaluacion_evidencia_inmutable BEFORE UPDATE OR DELETE ON evaluacion_evidencia FOR EACH ROW EXECUTE FUNCTION impedir_cambio();

CREATE TRIGGER trg_revision_merito_inmutable BEFORE UPDATE OR DELETE ON revision_merito FOR EACH ROW EXECUTE FUNCTION impedir_cambio();

CREATE TRIGGER trg_auditoria_evento_inmutable BEFORE UPDATE OR DELETE ON auditoria_evento FOR EACH ROW EXECUTE FUNCTION impedir_cambio();

CREATE TRIGGER trg_auditoria_cambio_inmutable BEFORE UPDATE OR DELETE ON auditoria_cambio FOR EACH ROW EXECUTE FUNCTION impedir_cambio();

CREATE TRIGGER trg_propuesta_evento_inmutable BEFORE UPDATE OR DELETE ON propuesta_evento FOR EACH ROW EXECUTE FUNCTION impedir_cambio();

CREATE TRIGGER trg_propuesta_orden_merito_inmutable BEFORE UPDATE OR DELETE ON propuesta_orden_merito FOR EACH ROW EXECUTE FUNCTION impedir_cambio();

CREATE TRIGGER trg_documento_inmutable BEFORE UPDATE OR DELETE ON documento FOR EACH ROW EXECUTE FUNCTION impedir_cambio();

CREATE TRIGGER trg_migracion_lote_inmutable BEFORE UPDATE OR DELETE ON migracion_lote FOR EACH ROW EXECUTE FUNCTION impedir_cambio();


CREATE FUNCTION bloquear_rubrica() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.aprobada_en IS NOT NULL THEN RAISE EXCEPTION 'La rúbrica aprobada es inmutable.' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_rubrica_bloqueada BEFORE UPDATE OR DELETE ON rubrica FOR EACH ROW EXECUTE FUNCTION bloquear_rubrica();
CREATE FUNCTION bloquear_detalle_rubrica() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND EXISTS(SELECT 1 FROM rubrica WHERE id=OLD.rubrica_id AND aprobada_en IS NOT NULL) THEN
    RAISE EXCEPTION 'Los detalles de la rúbrica aprobada son inmutables.' USING ERRCODE='23514';
  END IF;
  IF TG_OP <> 'DELETE' AND EXISTS(SELECT 1 FROM rubrica WHERE id=NEW.rubrica_id AND aprobada_en IS NOT NULL) THEN
    RAISE EXCEPTION 'Los detalles de la rúbrica aprobada son inmutables.' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_rubrica_criterio_bloqueado BEFORE INSERT OR UPDATE OR DELETE ON rubrica_criterio FOR EACH ROW EXECUTE FUNCTION bloquear_detalle_rubrica();
CREATE TRIGGER trg_rubrica_requisito_bloqueado BEFORE INSERT OR UPDATE OR DELETE ON rubrica_requisito FOR EACH ROW EXECUTE FUNCTION bloquear_detalle_rubrica();
CREATE FUNCTION validar_categoria_solicitud() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT orden FROM categoria_docente WHERE id=NEW.categoria_destino_id) IS DISTINCT FROM
     (SELECT orden+1 FROM categoria_docente WHERE id=NEW.categoria_origen_id) THEN
    RAISE EXCEPTION 'La categoría destino debe ser la inmediata superior.' USING ERRCODE='23514';
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_solicitud_categoria BEFORE INSERT OR UPDATE ON solicitud_promocion FOR EACH ROW EXECUTE FUNCTION validar_categoria_solicitud();
CREATE FUNCTION validar_cierre_evaluacion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT estado FROM solicitud_promocion WHERE id=NEW.solicitud_id) IS DISTINCT FROM 'presentada' THEN
    RAISE EXCEPTION 'Solo se evalúa una solicitud presentada.' USING ERRCODE='23514';
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_evaluacion_presentada BEFORE INSERT ON evaluacion FOR EACH ROW EXECUTE FUNCTION validar_cierre_evaluacion();



INSERT INTO categoria_docente (id, nombre, orden) VALUES (1,'Auxiliar',1), (2,'Asociado',2), (3,'Principal',3);
INSERT INTO dedicacion (id, nombre) VALUES (1,'Tiempo completo'), (2,'Dedicación exclusiva');
INSERT INTO rol (id, codigo, nombre) VALUES
  (1,'docente','Docente'), (2,'legajos','Personal de legajos'), (3,'comision','Comisión evaluadora'),
  (4,'decanato','Decanato'), (5,'consejo_facultad','Consejo de Facultad'), (6,'consejo_universitario','Consejo Universitario');
INSERT INTO tipo_merito (id, codigo, nombre, grupo, puntua) VALUES
  (1,'experiencia','Constancia laboral','antecedente',false),
  (2,'titulo','Título profesional','grado',false),
  (3,'maestria','Grado de maestría','grado',true),
  (4,'doctorado','Grado de doctor','grado',true),
  (5,'investigacion','Investigación','actividad',true),
  (6,'ponencia','Ponencia','actividad',true),
  (7,'participacion','Participación académica','actividad',true),
  (8,'ratificacion','Ratificación','requisito',false);

