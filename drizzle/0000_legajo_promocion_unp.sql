-- ============================================================================
-- Migración 0000 · Esquema de legajo y promoción docente · UNP
-- ----------------------------------------------------------------------------
-- DDL completo del modelo relacional de 35 tablas descrito en el capítulo 6 y
-- el anexo B del documento "Análisis del sistema de legajo y promoción docente
-- de la UNP v2.0" (módulos A–F, 7 tipos enumerados, 24 índices y 34 triggers de
-- integridad). Es la variante SQLite / Cloudflare D1, equivalente al esquema
-- PostgreSQL del mismo anexo.
--
-- La definición equivalente para el ORM está en db/schema.ts (Drizzle). Este
-- archivo añade lo que el ORM no expresa: triggers de inmutabilidad, validación
-- de categoría destino (RN01), rúbrica bloqueada (RN09) y datos de catálogo.
--
-- Aplicar (cuando se conecte una base real; hoy el prototipo usa IndexedDB):
--   npx wrangler d1 execute <base> --local  --file ./drizzle/0000_legajo_promocion_unp.sql
--   npx wrangler d1 execute <base> --remote --file ./drizzle/0000_legajo_promocion_unp.sql
-- o bien con drizzle-kit migrate una vez configuradas las credenciales de D1.
-- ============================================================================
-- Sistema de legajo y promoción docente · UNP
-- Variante SQLite / Cloudflare D1 (compatible con drizzle-kit dialect "sqlite").
-- Equivalencias: uuid→text, boolean→integer (0/1), timestamptz/date→text ISO 8601 UTC,
-- numeric→real, jsonb→text (validado con json_valid), enum→text + CHECK.
-- Ejecutar con PRAGMA foreign_keys = ON en cada conexión.
-- El código visible de solicitud (SOL-000001) lo genera la aplicación: SQLite no tiene secuencias.
-- ============================================================================
PRAGMA foreign_keys = ON;

-- facultad: Facultad de la universidad. Determina la adscripción y el ámbito de las instancias de trámite.
CREATE TABLE facultad (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  codigo text NOT NULL,  -- Código corto de la facultad.
  nombre text NOT NULL,  -- Nombre oficial.
  activo integer NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),  -- Permite retirar facultades sin borrar el historial.
  CONSTRAINT pk_facultad PRIMARY KEY (id),
  CONSTRAINT uq_facultad_codigo UNIQUE (codigo),
  CONSTRAINT uq_facultad_nombre UNIQUE (nombre)
);

-- departamento_academico: Departamento académico adscrito a una facultad (RN07).
CREATE TABLE departamento_academico (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  facultad_id text NOT NULL,  -- Facultad a la que pertenece.
  nombre text NOT NULL,  -- Nombre del departamento.
  activo integer NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),  -- Vigencia del departamento.
  CONSTRAINT pk_departamento_academico PRIMARY KEY (id),
  CONSTRAINT uq_departamento_facultad_nombre UNIQUE (facultad_id, nombre),
  CONSTRAINT fk_departamento_academico_facultad_id FOREIGN KEY (facultad_id) REFERENCES facultad (id)
);

-- categoria_docente: Categoría del docente ordinario. El campo «orden» define la categoría inmediata superior (RN01).
CREATE TABLE categoria_docente (
  id integer NOT NULL,  -- Identificador del catálogo.
  nombre text NOT NULL,  -- Auxiliar, Asociado o Principal.
  orden integer NOT NULL,  -- 1 = Auxiliar, 2 = Asociado, 3 = Principal.
  CONSTRAINT pk_categoria_docente PRIMARY KEY (id),
  CONSTRAINT uq_categoria_docente_nombre UNIQUE (nombre),
  CONSTRAINT uq_categoria_docente_orden UNIQUE (orden)
);

-- dedicacion: Modalidad o dedicación del docente (tiempo completo, dedicación exclusiva).
CREATE TABLE dedicacion (
  id integer NOT NULL,  -- Identificador del catálogo.
  nombre text NOT NULL,  -- Nombre de la dedicación.
  CONSTRAINT pk_dedicacion PRIMARY KEY (id),
  CONSTRAINT uq_dedicacion_nombre UNIQUE (nombre)
);

-- rol: Rol funcional del sistema (RNF01).
CREATE TABLE rol (
  id integer NOT NULL,  -- Identificador del catálogo.
  codigo text NOT NULL,  -- docente, legajos, comision, decanato, consejo_facultad, consejo_universitario.
  nombre text NOT NULL,  -- Nombre visible del rol.
  CONSTRAINT pk_rol PRIMARY KEY (id),
  CONSTRAINT uq_rol_codigo UNIQUE (codigo)
);

-- usuario: Identidad autenticada que opera el sistema. Proviene del proveedor institucional (OIDC).
CREATE TABLE usuario (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  sub_externo text NOT NULL,  -- Identificador del sujeto en el proveedor de identidad.
  nombre_completo text NOT NULL,  -- Nombre para mostrar en el historial.
  email text NOT NULL,  -- Correo institucional.
  activo integer NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),  -- Bloqueo lógico de la cuenta.
  ultimo_acceso text,  -- Último inicio de sesión.
  creado_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Fecha de alta.
  CONSTRAINT pk_usuario PRIMARY KEY (id),
  CONSTRAINT uq_usuario_sub_externo UNIQUE (sub_externo),
  CONSTRAINT uq_usuario_email UNIQUE (email)
);

-- asignacion_rol: Rol de un usuario limitado a una unidad (facultad o departamento) y a un periodo de vigencia (RNF01).
CREATE TABLE asignacion_rol (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  usuario_id text NOT NULL,  -- Usuario que recibe el rol.
  rol_id integer NOT NULL,  -- Rol asignado.
  facultad_id text,  -- Facultad autorizada; vacío = alcance institucional.
  departamento_id text,  -- Departamento autorizado, si aplica.
  vigente_desde text NOT NULL DEFAULT (date('now')),  -- Inicio de la vigencia.
  vigente_hasta text,  -- Fin de la vigencia; vacío = indefinida.
  CONSTRAINT pk_asignacion_rol PRIMARY KEY (id),
  CONSTRAINT fk_asignacion_rol_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT fk_asignacion_rol_rol_id FOREIGN KEY (rol_id) REFERENCES rol (id),
  CONSTRAINT fk_asignacion_rol_facultad_id FOREIGN KEY (facultad_id) REFERENCES facultad (id),
  CONSTRAINT fk_asignacion_rol_departamento_id FOREIGN KEY (departamento_id) REFERENCES departamento_academico (id),
  CONSTRAINT ck_asignacion_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

-- docente: Docente ordinario cuyo legajo se administra (RF01). La facultad se obtiene del departamento.
CREATE TABLE docente (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  usuario_id text,  -- Cuenta de acceso del docente, si existe.
  codigo text NOT NULL,  -- Código institucional del docente.
  nombres text NOT NULL,  -- Nombres.
  apellidos text NOT NULL,  -- Apellidos.
  email text NOT NULL,  -- Correo de contacto.
  departamento_id text NOT NULL,  -- Departamento de adscripción.
  categoria_id integer NOT NULL,  -- Categoría vigente.
  dedicacion_id integer NOT NULL,  -- Dedicación vigente.
  fecha_categoria text NOT NULL,  -- Fecha desde la que ostenta la categoría actual (antigüedad en categoría).
  especialidad text,  -- Especialidad académica.
  activo integer NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),  -- Docente en actividad.
  version integer NOT NULL DEFAULT 1,  -- Control de concurrencia optimista (If-Match).
  creado_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Fecha de alta.
  actualizado_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Última modificación.
  CONSTRAINT pk_docente PRIMARY KEY (id),
  CONSTRAINT uq_docente_usuario_id UNIQUE (usuario_id),
  CONSTRAINT uq_docente_codigo UNIQUE (codigo),
  CONSTRAINT uq_docente_email UNIQUE (email),
  CONSTRAINT fk_docente_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT fk_docente_departamento_id FOREIGN KEY (departamento_id) REFERENCES departamento_academico (id),
  CONSTRAINT fk_docente_categoria_id FOREIGN KEY (categoria_id) REFERENCES categoria_docente (id),
  CONSTRAINT fk_docente_dedicacion_id FOREIGN KEY (dedicacion_id) REFERENCES dedicacion (id)
);

-- legajo: Legajo del docente: conjunto de antecedentes y evidencias. Relación 1:1 con el docente.
CREATE TABLE legajo (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  docente_id text NOT NULL,  -- Docente propietario del legajo.
  fecha_apertura text NOT NULL DEFAULT (date('now')),  -- Fecha de apertura del legajo.
  observaciones text,  -- Notas de custodia del legajo.
  creado_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Fecha de alta.
  CONSTRAINT pk_legajo PRIMARY KEY (id),
  CONSTRAINT uq_legajo_docente_id UNIQUE (docente_id),
  CONSTRAINT fk_legajo_docente_id FOREIGN KEY (docente_id) REFERENCES docente (id)
);

-- tipo_merito: Catálogo de tipos de mérito o antecedente que admite el legajo (RF02).
CREATE TABLE tipo_merito (
  id integer NOT NULL,  -- Identificador del catálogo.
  codigo text NOT NULL,  -- experiencia, titulo, maestria, doctorado, investigacion, ponencia, participacion, ratificacion.
  nombre text NOT NULL,  -- Nombre visible.
  grupo text NOT NULL,  -- grado, actividad, antecedente o requisito.
  puntua integer NOT NULL DEFAULT 0 CHECK (puntua IN (0, 1)),  -- Si puede recibir puntaje según la rúbrica (RN06).
  CONSTRAINT pk_tipo_merito PRIMARY KEY (id),
  CONSTRAINT uq_tipo_merito_codigo UNIQUE (codigo),
  CONSTRAINT ck_tipo_merito_grupo CHECK (grupo IN ('grado','actividad','antecedente','requisito'))
);

-- documento: Metadatos de un archivo de evidencia. El binario se guarda en almacenamiento privado (RNF03).
CREATE TABLE documento (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  legajo_id text NOT NULL,  -- Legajo propietario del archivo.
  subido_por text NOT NULL,  -- Usuario que cargó el archivo.
  nombre_original text NOT NULL,  -- Nombre con el que se cargó.
  tipo_mime text NOT NULL,  -- Tipo detectado por el servidor.
  tamano_bytes integer NOT NULL,  -- Tamaño en bytes.
  hash_sha256 text NOT NULL,  -- Huella para comprobar integridad.
  clave_almacenamiento text NOT NULL,  -- Clave del objeto en almacenamiento privado.
  version integer NOT NULL DEFAULT 1,  -- Número de versión del documento.
  reemplaza_a text,  -- Versión anterior que sustituye; nunca se sobrescribe.
  retener_hasta text,  -- Fin del plazo de retención institucional.
  subido_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Fecha de carga.
  CONSTRAINT pk_documento PRIMARY KEY (id),
  CONSTRAINT uq_documento_clave_almacenamiento UNIQUE (clave_almacenamiento),
  CONSTRAINT fk_documento_legajo_id FOREIGN KEY (legajo_id) REFERENCES legajo (id),
  CONSTRAINT fk_documento_subido_por FOREIGN KEY (subido_por) REFERENCES usuario (id),
  CONSTRAINT fk_documento_reemplaza_a FOREIGN KEY (reemplaza_a) REFERENCES documento (id),
  CONSTRAINT ck_documento_tamano CHECK (tamano_bytes > 0),
  CONSTRAINT ck_documento_hash CHECK (length(hash_sha256) = 64 AND hash_sha256 NOT GLOB '*[^0-9a-f]*')
);

-- merito: Mérito del legajo (grado, actividad, ratificación, etc.) con su documento vigente y estado de verificación (RF02, RF03).
CREATE TABLE merito (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  legajo_id text NOT NULL,  -- Legajo al que pertenece.
  tipo_merito_id integer NOT NULL,  -- Tipo de mérito.
  titulo text NOT NULL,  -- Título o denominación del mérito.
  institucion text NOT NULL,  -- Institución emisora u organizadora.
  fecha_merito text NOT NULL,  -- Fecha del grado, ponencia o actividad.
  documento_id text NOT NULL,  -- Documento vigente que sustenta el mérito.
  estado_revision text NOT NULL DEFAULT 'pendiente' CHECK (estado_revision IN ('pendiente', 'verificado', 'observado')),  -- Estado de verificación.
  observacion text,  -- Observación vigente del revisor.
  revisado_por text,  -- Último revisor.
  revisado_en text,  -- Fecha de la última revisión.
  version integer NOT NULL DEFAULT 1,  -- Control de concurrencia optimista.
  creado_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Fecha de alta.
  actualizado_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Última modificación.
  CONSTRAINT pk_merito PRIMARY KEY (id),
  CONSTRAINT fk_merito_legajo_id FOREIGN KEY (legajo_id) REFERENCES legajo (id),
  CONSTRAINT fk_merito_tipo_merito_id FOREIGN KEY (tipo_merito_id) REFERENCES tipo_merito (id),
  CONSTRAINT fk_merito_documento_id FOREIGN KEY (documento_id) REFERENCES documento (id),
  CONSTRAINT fk_merito_revisado_por FOREIGN KEY (revisado_por) REFERENCES usuario (id),
  CONSTRAINT ck_merito_observado CHECK (estado_revision <> 'observado' OR length(trim(coalesce(observacion,''))) > 0),
  CONSTRAINT ck_merito_revisor CHECK (estado_revision = 'pendiente' OR revisado_por IS NOT NULL)
);

-- revision_merito: Historial inmutable de revisiones y correcciones de un mérito, con copias antes/después (RF03, RNF02).
CREATE TABLE revision_merito (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  merito_id text NOT NULL,  -- Mérito revisado.
  revisor_id text NOT NULL,  -- Identidad real de quien actuó.
  rol_id integer NOT NULL,  -- Rol con el que actuó.
  accion text NOT NULL CHECK (accion IN ('revision', 'correccion', 'migracion')),  -- Revisión, corrección o migración.
  estado_anterior text CHECK (estado_anterior IN ('pendiente', 'verificado', 'observado')),  -- Estado antes del evento.
  estado_posterior text NOT NULL CHECK (estado_posterior IN ('pendiente', 'verificado', 'observado')),  -- Estado después del evento.
  documento_anterior_id text,  -- Documento antes del evento.
  documento_posterior_id text,  -- Documento después del evento.
  nota text,  -- Observación o motivo.
  copia_antes text CHECK (copia_antes IS NULL OR json_valid(copia_antes)),  -- Instantánea del mérito antes (desnormalización deliberada).
  copia_despues text CHECK (copia_despues IS NULL OR json_valid(copia_despues)),  -- Instantánea del mérito después (desnormalización deliberada).
  ocurrido_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Marca de tiempo del servidor.
  CONSTRAINT pk_revision_merito PRIMARY KEY (id),
  CONSTRAINT fk_revision_merito_merito_id FOREIGN KEY (merito_id) REFERENCES merito (id),
  CONSTRAINT fk_revision_merito_revisor_id FOREIGN KEY (revisor_id) REFERENCES usuario (id),
  CONSTRAINT fk_revision_merito_rol_id FOREIGN KEY (rol_id) REFERENCES rol (id),
  CONSTRAINT fk_revision_merito_documento_anterior_id FOREIGN KEY (documento_anterior_id) REFERENCES documento (id),
  CONSTRAINT fk_revision_merito_documento_posterior_id FOREIGN KEY (documento_posterior_id) REFERENCES documento (id)
);

-- experiencia_laboral: Trayectoria laboral del docente con constancia de respaldo. Se permiten periodos superpuestos.
CREATE TABLE experiencia_laboral (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  legajo_id text NOT NULL,  -- Legajo al que pertenece.
  institucion text NOT NULL,  -- Institución empleadora.
  cargo text NOT NULL,  -- Cargo desempeñado.
  fecha_inicio text NOT NULL,  -- Inicio del periodo.
  fecha_fin text,  -- Fin del periodo; vacío = vigente.
  documento_id text NOT NULL,  -- Constancia de respaldo.
  actualizado_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Última modificación.
  CONSTRAINT pk_experiencia_laboral PRIMARY KEY (id),
  CONSTRAINT fk_experiencia_laboral_legajo_id FOREIGN KEY (legajo_id) REFERENCES legajo (id),
  CONSTRAINT fk_experiencia_laboral_documento_id FOREIGN KEY (documento_id) REFERENCES documento (id),
  CONSTRAINT ck_experiencia_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

-- rubrica: Rúbrica versionada. Una vez aprobada no se modifica; cada evaluación conserva su versión (RF06, RNF04).
CREATE TABLE rubrica (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  version text NOT NULL,  -- Versión visible, por ejemplo DEMO-2026.2.
  nombre text NOT NULL,  -- Nombre de la rúbrica.
  umbral real NOT NULL DEFAULT 55,  -- Puntaje mínimo de referencia (55 según art. 18 de 2016, sin redondear).
  puntaje_maximo real NOT NULL DEFAULT 100,  -- Puntaje máximo posible.
  estado_fuente text NOT NULL DEFAULT 'simulacion' CHECK (estado_fuente IN ('simulacion', 'oficial')),  -- Si la rúbrica es supuesto didáctico u oficial.
  fuente_normativa text,  -- Norma o anexo del que procede.
  aprobada_en text,  -- Fecha de aprobación; vacío = borrador editable.
  creada_por text NOT NULL,  -- Responsable del alta.
  creada_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Fecha de alta.
  CONSTRAINT pk_rubrica PRIMARY KEY (id),
  CONSTRAINT uq_rubrica_version UNIQUE (version),
  CONSTRAINT fk_rubrica_creada_por FOREIGN KEY (creada_por) REFERENCES usuario (id),
  CONSTRAINT ck_rubrica_umbral CHECK (umbral >= 0 AND umbral <= puntaje_maximo)
);

-- rubrica_criterio: Criterio puntuable de una rúbrica, con unidad, tope y fuente (RF06).
CREATE TABLE rubrica_criterio (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  rubrica_id text NOT NULL,  -- Rúbrica propietaria.
  codigo text NOT NULL,  -- grado_maestria, grado_doctorado, antiguedad, investigacion, ponencia, participacion.
  nombre text NOT NULL,  -- Nombre visible.
  tipo_merito_id integer,  -- Tipo de mérito que alimenta el criterio.
  puntos_por_unidad real NOT NULL,  -- Puntos por cada unidad (año, ponencia, etc.).
  tope real NOT NULL,  -- Máximo que puede aportar el criterio.
  fuente_referencia text NOT NULL,  -- Artículo, anexo o supuesto del que procede.
  estado_fuente text NOT NULL DEFAULT 'simulacion' CHECK (estado_fuente IN ('simulacion', 'oficial')),  -- Origen de la regla.
  CONSTRAINT pk_rubrica_criterio PRIMARY KEY (id),
  CONSTRAINT uq_criterio_rubrica_codigo UNIQUE (rubrica_id, codigo),
  CONSTRAINT fk_rubrica_criterio_rubrica_id FOREIGN KEY (rubrica_id) REFERENCES rubrica (id),
  CONSTRAINT fk_rubrica_criterio_tipo_merito_id FOREIGN KEY (tipo_merito_id) REFERENCES tipo_merito (id),
  CONSTRAINT ck_criterio_puntos CHECK (puntos_por_unidad >= 0 AND tope >= 0)
);

-- rubrica_requisito: Requisitos de grado, antigüedad, investigación y ratificación por categoría destino (RF05, RN04).
CREATE TABLE rubrica_requisito (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  rubrica_id text NOT NULL,  -- Rúbrica propietaria.
  categoria_destino_id integer NOT NULL,  -- Categoría a la que se aspira.
  grado_minimo_id integer NOT NULL,  -- Grado mínimo exigido (maestría o doctorado).
  anios_minimos integer NOT NULL,  -- Años mínimos en la categoría de origen.
  investigaciones_minimas integer NOT NULL,  -- Investigaciones verificadas mínimas.
  exige_ratificacion integer NOT NULL DEFAULT 1 CHECK (exige_ratificacion IN (0, 1)),  -- Exige ratificación previa vigente (RN02).
  fuente_referencia text NOT NULL,  -- Artículo o supuesto del que procede.
  CONSTRAINT pk_rubrica_requisito PRIMARY KEY (id),
  CONSTRAINT uq_requisito_rubrica_categoria UNIQUE (rubrica_id, categoria_destino_id),
  CONSTRAINT fk_rubrica_requisito_rubrica_id FOREIGN KEY (rubrica_id) REFERENCES rubrica (id),
  CONSTRAINT fk_rubrica_requisito_categoria_destino_id FOREIGN KEY (categoria_destino_id) REFERENCES categoria_docente (id),
  CONSTRAINT fk_rubrica_requisito_grado_minimo_id FOREIGN KEY (grado_minimo_id) REFERENCES tipo_merito (id),
  CONSTRAINT ck_requisito_valores CHECK (anios_minimos >= 0 AND investigaciones_minimas >= 0)
);

-- plaza: Plaza vacante para una categoría, dedicación y departamento (RF07, RN05).
CREATE TABLE plaza (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  codigo text NOT NULL,  -- Código de la plaza, por ejemplo PL-002.
  etiqueta text NOT NULL,  -- Descripción visible.
  departamento_id text NOT NULL,  -- Departamento de la plaza.
  categoria_id integer NOT NULL,  -- Categoría de la plaza.
  dedicacion_id integer NOT NULL,  -- Dedicación de la plaza.
  habilitada integer NOT NULL DEFAULT 1 CHECK (habilitada IN (0, 1)),  -- Plaza disponible; se desactiva al aprobarse una propuesta.
  creada_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Fecha de alta.
  CONSTRAINT pk_plaza PRIMARY KEY (id),
  CONSTRAINT uq_plaza_codigo UNIQUE (codigo),
  CONSTRAINT fk_plaza_departamento_id FOREIGN KEY (departamento_id) REFERENCES departamento_academico (id),
  CONSTRAINT fk_plaza_categoria_id FOREIGN KEY (categoria_id) REFERENCES categoria_docente (id),
  CONSTRAINT fk_plaza_dedicacion_id FOREIGN KEY (dedicacion_id) REFERENCES dedicacion (id)
);

-- convocatoria: Convocatoria o proceso de promoción con periodo, fase y rúbrica aplicable (RF04, RNF04).
CREATE TABLE convocatoria (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  codigo text NOT NULL,  -- Código de la convocatoria.
  nombre text NOT NULL,  -- Nombre visible.
  fecha_inicio text NOT NULL,  -- Inicio de la recepción.
  fecha_fin text NOT NULL,  -- Fin de la recepción.
  estado text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'evaluacion', 'cerrada')),  -- Fase actual.
  rubrica_id text NOT NULL,  -- Rúbrica aprobada aplicable.
  resolucion_referencia text,  -- Resolución que autoriza la convocatoria.
  recepcion_cerrada_en text,  -- Cierre de recepción.
  creada_por text NOT NULL,  -- Responsable del alta.
  version integer NOT NULL DEFAULT 1,  -- Control de concurrencia optimista.
  creada_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Fecha de alta.
  CONSTRAINT pk_convocatoria PRIMARY KEY (id),
  CONSTRAINT uq_convocatoria_codigo UNIQUE (codigo),
  CONSTRAINT fk_convocatoria_rubrica_id FOREIGN KEY (rubrica_id) REFERENCES rubrica (id),
  CONSTRAINT fk_convocatoria_creada_por FOREIGN KEY (creada_por) REFERENCES usuario (id),
  CONSTRAINT ck_convocatoria_fechas CHECK (fecha_fin >= fecha_inicio)
);

-- convocatoria_plaza: Plazas ofrecidas por cada convocatoria (relación N:M).
CREATE TABLE convocatoria_plaza (
  convocatoria_id text NOT NULL,  -- Convocatoria.
  plaza_id text NOT NULL,  -- Plaza ofrecida.
  CONSTRAINT pk_convocatoria_plaza PRIMARY KEY (convocatoria_id, plaza_id),
  CONSTRAINT fk_convocatoria_plaza_convocatoria_id FOREIGN KEY (convocatoria_id) REFERENCES convocatoria (id),
  CONSTRAINT fk_convocatoria_plaza_plaza_id FOREIGN KEY (plaza_id) REFERENCES plaza (id)
);

-- comision_evaluadora: Comisión designada para una convocatoria y, opcionalmente, una facultad.
CREATE TABLE comision_evaluadora (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  convocatoria_id text NOT NULL,  -- Convocatoria evaluada.
  facultad_id text,  -- Facultad atendida; vacío = todas.
  nombre text NOT NULL,  -- Nombre de la comisión.
  resolucion_designacion text,  -- Resolución que la designa.
  CONSTRAINT pk_comision_evaluadora PRIMARY KEY (id),
  CONSTRAINT uq_comision_convocatoria_nombre UNIQUE (convocatoria_id, nombre),
  CONSTRAINT fk_comision_evaluadora_convocatoria_id FOREIGN KEY (convocatoria_id) REFERENCES convocatoria (id),
  CONSTRAINT fk_comision_evaluadora_facultad_id FOREIGN KEY (facultad_id) REFERENCES facultad (id)
);

-- miembro_comision: Integrantes de una comisión evaluadora (relación N:M con usuario).
CREATE TABLE miembro_comision (
  comision_id text NOT NULL,  -- Comisión.
  usuario_id text NOT NULL,  -- Integrante.
  cargo text NOT NULL DEFAULT 'miembro',  -- presidente, secretario o miembro.
  CONSTRAINT pk_miembro_comision PRIMARY KEY (comision_id, usuario_id),
  CONSTRAINT fk_miembro_comision_comision_id FOREIGN KEY (comision_id) REFERENCES comision_evaluadora (id),
  CONSTRAINT fk_miembro_comision_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT ck_miembro_cargo CHECK (cargo IN ('presidente','secretario','miembro'))
);

-- solicitud_promocion: Solicitud de un docente a la categoría inmediata superior en una convocatoria y plaza (RF04, RN01).
CREATE TABLE solicitud_promocion (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  codigo text NOT NULL,  -- Código visible generado por secuencia del servidor.
  docente_id text NOT NULL,  -- Docente solicitante.
  convocatoria_id text NOT NULL,  -- Convocatoria.
  plaza_id text NOT NULL,  -- Plaza a la que postula.
  categoria_origen_id integer NOT NULL,  -- Categoría al presentar.
  categoria_destino_id integer NOT NULL,  -- Categoría inmediata superior (RN01).
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'presentada', 'observada', 'evaluada', 'no_presentada', 'propuesta', 'en_facultad', 'en_consejo', 'aprobada', 'denegada')),  -- Estado actual.
  nota text,  -- Nota del docente.
  presentada_en text,  -- Fecha de presentación.
  version integer NOT NULL DEFAULT 1,  -- Control de concurrencia optimista.
  creada_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Fecha de alta.
  actualizada_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Última modificación.
  CONSTRAINT pk_solicitud_promocion PRIMARY KEY (id),
  CONSTRAINT uq_solicitud_promocion_codigo UNIQUE (codigo),
  CONSTRAINT uq_solicitud_docente_convocatoria UNIQUE (docente_id, convocatoria_id),
  CONSTRAINT fk_solicitud_promocion_docente_id FOREIGN KEY (docente_id) REFERENCES docente (id),
  CONSTRAINT fk_solicitud_promocion_categoria_origen_id FOREIGN KEY (categoria_origen_id) REFERENCES categoria_docente (id),
  CONSTRAINT fk_solicitud_promocion_categoria_destino_id FOREIGN KEY (categoria_destino_id) REFERENCES categoria_docente (id),
  CONSTRAINT fk_solicitud_convocatoria_plaza FOREIGN KEY (convocatoria_id, plaza_id) REFERENCES convocatoria_plaza (convocatoria_id, plaza_id),
  CONSTRAINT ck_solicitud_presentada CHECK (estado = 'borrador' OR presentada_en IS NOT NULL OR estado = 'no_presentada'),
  CONSTRAINT ck_solicitud_categorias CHECK (categoria_destino_id <> categoria_origen_id)
);

-- expediente_item: Méritos y versiones documentales reunidos en el expediente al presentar la solicitud (RF04).
CREATE TABLE expediente_item (
  solicitud_id text NOT NULL,  -- Solicitud.
  merito_id text NOT NULL,  -- Mérito incorporado.
  documento_id text NOT NULL,  -- Versión del documento en el momento de la presentación.
  incorporado_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Fecha de incorporación.
  CONSTRAINT pk_expediente_item PRIMARY KEY (solicitud_id, merito_id),
  CONSTRAINT fk_expediente_item_solicitud_id FOREIGN KEY (solicitud_id) REFERENCES solicitud_promocion (id),
  CONSTRAINT fk_expediente_item_merito_id FOREIGN KEY (merito_id) REFERENCES merito (id),
  CONSTRAINT fk_expediente_item_documento_id FOREIGN KEY (documento_id) REFERENCES documento (id)
);

-- observacion_solicitud: Observaciones que devuelven la solicitud al docente y su subsanación (CUN03).
CREATE TABLE observacion_solicitud (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  solicitud_id text NOT NULL,  -- Solicitud observada.
  autor_id text NOT NULL,  -- Quien observa.
  texto text NOT NULL,  -- Contenido de la observación.
  creada_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Fecha de la observación.
  subsanada_en text,  -- Fecha de subsanación.
  CONSTRAINT pk_observacion_solicitud PRIMARY KEY (id),
  CONSTRAINT fk_observacion_solicitud_solicitud_id FOREIGN KEY (solicitud_id) REFERENCES solicitud_promocion (id),
  CONSTRAINT fk_observacion_solicitud_autor_id FOREIGN KEY (autor_id) REFERENCES usuario (id)
);

-- solicitud_historial_estado: Cada transición de estado de la solicitud, con responsable y motivo (RNF02).
CREATE TABLE solicitud_historial_estado (
  id integer PRIMARY KEY AUTOINCREMENT,  -- Identificador secuencial (identity).
  solicitud_id text NOT NULL,  -- Solicitud.
  estado_anterior text CHECK (estado_anterior IN ('borrador', 'presentada', 'observada', 'evaluada', 'no_presentada', 'propuesta', 'en_facultad', 'en_consejo', 'aprobada', 'denegada')),  -- Estado previo; vacío en la creación.
  estado_nuevo text NOT NULL CHECK (estado_nuevo IN ('borrador', 'presentada', 'observada', 'evaluada', 'no_presentada', 'propuesta', 'en_facultad', 'en_consejo', 'aprobada', 'denegada')),  -- Estado resultante.
  usuario_id text NOT NULL,  -- Responsable de la transición.
  motivo text,  -- Motivo o comentario.
  cambiado_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Marca de tiempo del servidor.
  CONSTRAINT fk_solicitud_historial_estado_solicitud_id FOREIGN KEY (solicitud_id) REFERENCES solicitud_promocion (id),
  CONSTRAINT fk_solicitud_historial_estado_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuario (id)
);

-- evaluacion: Evaluación cerrada e inmutable de una solicitud presentada (RF06, RF08, RNF04).
CREATE TABLE evaluacion (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  solicitud_id text NOT NULL,  -- Solicitud evaluada; una evaluación por presentación.
  rubrica_id text NOT NULL,  -- Versión de rúbrica aplicada.
  comision_id text NOT NULL,  -- Comisión designada.
  evaluador_id text NOT NULL,  -- Integrante que cerró la evaluación.
  puntaje_total real NOT NULL,  -- Suma de criterios, sin redondeo.
  umbral_aplicado real NOT NULL,  -- Umbral vigente al evaluar.
  plaza_disponible integer NOT NULL CHECK (plaza_disponible IN (0, 1)),  -- Resultado de la comprobación de vacante.
  resultado text NOT NULL CHECK (resultado IN ('apto', 'no_apto', 'sin_vacante')),  -- apto, no_apto o sin_vacante.
  fundamento text NOT NULL,  -- Conclusión motivada de la comisión.
  clave_idempotencia text NOT NULL,  -- Evita doble cierre ante reintentos.
  instantanea_docente text NOT NULL CHECK (instantanea_docente IS NULL OR json_valid(instantanea_docente)),  -- Ficha del docente al evaluar.
  instantanea_plaza text CHECK (instantanea_plaza IS NULL OR json_valid(instantanea_plaza)),  -- Plaza al evaluar.
  instantanea_convocatoria text NOT NULL CHECK (instantanea_convocatoria IS NULL OR json_valid(instantanea_convocatoria)),  -- Convocatoria al evaluar.
  cerrada_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Marca de tiempo del servidor.
  CONSTRAINT pk_evaluacion PRIMARY KEY (id),
  CONSTRAINT uq_evaluacion_solicitud_id UNIQUE (solicitud_id),
  CONSTRAINT uq_evaluacion_clave_idempotencia UNIQUE (clave_idempotencia),
  CONSTRAINT fk_evaluacion_solicitud_id FOREIGN KEY (solicitud_id) REFERENCES solicitud_promocion (id),
  CONSTRAINT fk_evaluacion_rubrica_id FOREIGN KEY (rubrica_id) REFERENCES rubrica (id),
  CONSTRAINT fk_evaluacion_comision_id FOREIGN KEY (comision_id) REFERENCES comision_evaluadora (id),
  CONSTRAINT fk_evaluacion_evaluador_id FOREIGN KEY (evaluador_id) REFERENCES usuario (id),
  CONSTRAINT ck_evaluacion_puntaje CHECK (puntaje_total >= 0 AND puntaje_total <= 100),
  CONSTRAINT ck_evaluacion_sin_vacante CHECK (resultado <> 'apto' OR plaza_disponible = 1)
);

-- evaluacion_criterio: Desglose del puntaje por criterio (RF06).
CREATE TABLE evaluacion_criterio (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  evaluacion_id text NOT NULL,  -- Evaluación.
  rubrica_criterio_id text NOT NULL,  -- Criterio aplicado.
  etiqueta text NOT NULL,  -- Nombre visible al evaluar.
  puntaje real NOT NULL,  -- Puntos otorgados.
  tope real NOT NULL,  -- Tope aplicado.
  detalle text,  -- Explicación del cálculo.
  CONSTRAINT pk_evaluacion_criterio PRIMARY KEY (id),
  CONSTRAINT fk_evaluacion_criterio_evaluacion_id FOREIGN KEY (evaluacion_id) REFERENCES evaluacion (id),
  CONSTRAINT fk_evaluacion_criterio_rubrica_criterio_id FOREIGN KEY (rubrica_criterio_id) REFERENCES rubrica_criterio (id),
  CONSTRAINT ck_eval_criterio_tope CHECK (puntaje >= 0 AND puntaje <= tope)
);

-- evaluacion_requisito: Resultado de cada requisito comprobado (RF05).
CREATE TABLE evaluacion_requisito (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  evaluacion_id text NOT NULL,  -- Evaluación.
  etiqueta text NOT NULL,  -- Requisito comprobado.
  cumple integer NOT NULL CHECK (cumple IN (0, 1)),  -- Si se cumple.
  detalle text,  -- Detalle de la comprobación.
  CONSTRAINT pk_evaluacion_requisito PRIMARY KEY (id),
  CONSTRAINT fk_evaluacion_requisito_evaluacion_id FOREIGN KEY (evaluacion_id) REFERENCES evaluacion (id)
);

-- evaluacion_evidencia: Evidencias verificadas que sustentaron el cierre; solo méritos verificados puntúan (RN06, RF08).
CREATE TABLE evaluacion_evidencia (
  evaluacion_id text NOT NULL,  -- Evaluación.
  merito_id text NOT NULL,  -- Mérito considerado.
  documento_id text NOT NULL,  -- Versión del documento considerada.
  hash_sha256 text NOT NULL,  -- Huella del documento al cierre.
  estado_revision text NOT NULL CHECK (estado_revision IN ('pendiente', 'verificado', 'observado')),  -- Estado del mérito al cierre.
  CONSTRAINT pk_evaluacion_evidencia PRIMARY KEY (evaluacion_id, merito_id),
  CONSTRAINT fk_evaluacion_evidencia_evaluacion_id FOREIGN KEY (evaluacion_id) REFERENCES evaluacion (id),
  CONSTRAINT fk_evaluacion_evidencia_merito_id FOREIGN KEY (merito_id) REFERENCES merito (id),
  CONSTRAINT fk_evaluacion_evidencia_documento_id FOREIGN KEY (documento_id) REFERENCES documento (id)
);

-- propuesta: Propuesta tramitada por decanato, facultad y Consejo Universitario; no declara el ascenso (RF08, CUN06).
CREATE TABLE propuesta (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  solicitud_id text NOT NULL,  -- Solicitud propuesta.
  evaluacion_id text NOT NULL,  -- Evaluación cerrada que la respalda.
  convocatoria_id text NOT NULL,  -- Convocatoria.
  plaza_id text NOT NULL,  -- Plaza propuesta.
  estado text NOT NULL DEFAULT 'decanato' CHECK (estado IN ('decanato', 'facultad', 'universitario', 'aprobada', 'denegada')),  -- Instancia actual; aprobada/denegada son terminales.
  informe text NOT NULL,  -- Informe de decanato.
  creada_por text NOT NULL,  -- Responsable de decanato.
  version integer NOT NULL DEFAULT 1,  -- Control de concurrencia optimista.
  creada_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Fecha de alta.
  actualizada_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Última modificación.
  CONSTRAINT pk_propuesta PRIMARY KEY (id),
  CONSTRAINT uq_propuesta_solicitud_id UNIQUE (solicitud_id),
  CONSTRAINT uq_propuesta_evaluacion_id UNIQUE (evaluacion_id),
  CONSTRAINT fk_propuesta_solicitud_id FOREIGN KEY (solicitud_id) REFERENCES solicitud_promocion (id),
  CONSTRAINT fk_propuesta_evaluacion_id FOREIGN KEY (evaluacion_id) REFERENCES evaluacion (id),
  CONSTRAINT fk_propuesta_creada_por FOREIGN KEY (creada_por) REFERENCES usuario (id),
  CONSTRAINT fk_propuesta_convocatoria_plaza FOREIGN KEY (convocatoria_id, plaza_id) REFERENCES convocatoria_plaza (convocatoria_id, plaza_id)
);

-- propuesta_orden_merito: Cuadro de mérito congelado al preparar la propuesta (RN05).
CREATE TABLE propuesta_orden_merito (
  propuesta_id text NOT NULL,  -- Propuesta.
  solicitud_id text NOT NULL,  -- Solicitud del postulante.
  evaluacion_id text NOT NULL,  -- Evaluación del postulante.
  docente_id text NOT NULL,  -- Docente postulante.
  nombre_docente text NOT NULL,  -- Nombre al momento del cuadro.
  puntaje real NOT NULL,  -- Puntaje obtenido.
  resultado text NOT NULL CHECK (resultado IN ('apto', 'no_apto', 'sin_vacante')),  -- Resultado de la evaluación.
  puesto integer,  -- Puesto; vacío si no es apto. Los empates comparten puesto.
  empate integer NOT NULL DEFAULT 0 CHECK (empate IN (0, 1)),  -- Indica empate; bloquea la propuesta.
  CONSTRAINT pk_propuesta_orden_merito PRIMARY KEY (propuesta_id, solicitud_id),
  CONSTRAINT fk_propuesta_orden_merito_propuesta_id FOREIGN KEY (propuesta_id) REFERENCES propuesta (id),
  CONSTRAINT fk_propuesta_orden_merito_solicitud_id FOREIGN KEY (solicitud_id) REFERENCES solicitud_promocion (id),
  CONSTRAINT fk_propuesta_orden_merito_evaluacion_id FOREIGN KEY (evaluacion_id) REFERENCES evaluacion (id),
  CONSTRAINT fk_propuesta_orden_merito_docente_id FOREIGN KEY (docente_id) REFERENCES docente (id)
);

-- propuesta_evento: Eventos de la propuesta por instancia, con referencia documental (RF08).
CREATE TABLE propuesta_evento (
  id text NOT NULL DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))),  -- Identificador.
  propuesta_id text NOT NULL,  -- Propuesta.
  etapa text NOT NULL CHECK (etapa IN ('decanato', 'facultad', 'universitario', 'aprobada', 'denegada')),  -- Etapa que registra el evento.
  usuario_id text NOT NULL,  -- Responsable.
  rol_id integer NOT NULL,  -- Rol con el que actuó.
  referencia text NOT NULL,  -- Oficio, acuerdo o resolución.
  documento_id text,  -- Documento institucional archivado.
  nota text,  -- Fundamento.
  ocurrido_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Marca de tiempo del servidor.
  CONSTRAINT pk_propuesta_evento PRIMARY KEY (id),
  CONSTRAINT fk_propuesta_evento_propuesta_id FOREIGN KEY (propuesta_id) REFERENCES propuesta (id),
  CONSTRAINT fk_propuesta_evento_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT fk_propuesta_evento_rol_id FOREIGN KEY (rol_id) REFERENCES rol (id),
  CONSTRAINT fk_propuesta_evento_documento_id FOREIGN KEY (documento_id) REFERENCES documento (id)
);

-- auditoria_evento: Bitácora de altas, correcciones, verificaciones y evaluaciones (RNF02).
CREATE TABLE auditoria_evento (
  id integer PRIMARY KEY AUTOINCREMENT,  -- Identificador secuencial (identity).
  ocurrido_en text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- Fecha del servidor.
  usuario_id text,  -- Usuario real que actuó.
  rol_id integer,  -- Rol con el que actuó.
  docente_id text,  -- Docente afectado, si aplica.
  accion text NOT NULL,  -- Acción registrada.
  entidad text NOT NULL,  -- Entidad principal afectada.
  mensaje text NOT NULL,  -- Descripción legible.
  motivo text,  -- Motivo declarado.
  id_solicitud_http text,  -- Identificador de traza (requestId).
  CONSTRAINT fk_auditoria_evento_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT fk_auditoria_evento_rol_id FOREIGN KEY (rol_id) REFERENCES rol (id),
  CONSTRAINT fk_auditoria_evento_docente_id FOREIGN KEY (docente_id) REFERENCES docente (id)
);

-- auditoria_cambio: Cambios antes/después asociados a un evento de auditoría.
CREATE TABLE auditoria_cambio (
  id integer PRIMARY KEY AUTOINCREMENT,  -- Identificador secuencial (identity).
  auditoria_id integer NOT NULL,  -- Evento al que pertenece.
  entidad text NOT NULL,  -- Tabla o colección modificada.
  registro_id text NOT NULL,  -- Identificador del registro modificado.
  antes text CHECK (antes IS NULL OR json_valid(antes)),  -- Valor previo.
  despues text CHECK (despues IS NULL OR json_valid(despues)),  -- Valor posterior.
  CONSTRAINT fk_auditoria_cambio_auditoria_id FOREIGN KEY (auditoria_id) REFERENCES auditoria_evento (id)
);

-- Índices
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

-- Reglas de integridad (equivalentes a los triggers de PostgreSQL)

CREATE TRIGGER trg_evaluacion_no_update BEFORE UPDATE ON evaluacion
BEGIN SELECT RAISE(ABORT, 'La tabla evaluacion es de solo inserción.'); END;
CREATE TRIGGER trg_evaluacion_no_delete BEFORE DELETE ON evaluacion
BEGIN SELECT RAISE(ABORT, 'La tabla evaluacion es de solo inserción.'); END;
CREATE TRIGGER trg_evaluacion_criterio_no_update BEFORE UPDATE ON evaluacion_criterio
BEGIN SELECT RAISE(ABORT, 'La tabla evaluacion_criterio es de solo inserción.'); END;
CREATE TRIGGER trg_evaluacion_criterio_no_delete BEFORE DELETE ON evaluacion_criterio
BEGIN SELECT RAISE(ABORT, 'La tabla evaluacion_criterio es de solo inserción.'); END;
CREATE TRIGGER trg_evaluacion_requisito_no_update BEFORE UPDATE ON evaluacion_requisito
BEGIN SELECT RAISE(ABORT, 'La tabla evaluacion_requisito es de solo inserción.'); END;
CREATE TRIGGER trg_evaluacion_requisito_no_delete BEFORE DELETE ON evaluacion_requisito
BEGIN SELECT RAISE(ABORT, 'La tabla evaluacion_requisito es de solo inserción.'); END;
CREATE TRIGGER trg_evaluacion_evidencia_no_update BEFORE UPDATE ON evaluacion_evidencia
BEGIN SELECT RAISE(ABORT, 'La tabla evaluacion_evidencia es de solo inserción.'); END;
CREATE TRIGGER trg_evaluacion_evidencia_no_delete BEFORE DELETE ON evaluacion_evidencia
BEGIN SELECT RAISE(ABORT, 'La tabla evaluacion_evidencia es de solo inserción.'); END;
CREATE TRIGGER trg_revision_merito_no_update BEFORE UPDATE ON revision_merito
BEGIN SELECT RAISE(ABORT, 'La tabla revision_merito es de solo inserción.'); END;
CREATE TRIGGER trg_revision_merito_no_delete BEFORE DELETE ON revision_merito
BEGIN SELECT RAISE(ABORT, 'La tabla revision_merito es de solo inserción.'); END;
CREATE TRIGGER trg_propuesta_evento_no_update BEFORE UPDATE ON propuesta_evento
BEGIN SELECT RAISE(ABORT, 'La tabla propuesta_evento es de solo inserción.'); END;
CREATE TRIGGER trg_propuesta_evento_no_delete BEFORE DELETE ON propuesta_evento
BEGIN SELECT RAISE(ABORT, 'La tabla propuesta_evento es de solo inserción.'); END;
CREATE TRIGGER trg_propuesta_orden_merito_no_update BEFORE UPDATE ON propuesta_orden_merito
BEGIN SELECT RAISE(ABORT, 'La tabla propuesta_orden_merito es de solo inserción.'); END;
CREATE TRIGGER trg_propuesta_orden_merito_no_delete BEFORE DELETE ON propuesta_orden_merito
BEGIN SELECT RAISE(ABORT, 'La tabla propuesta_orden_merito es de solo inserción.'); END;
CREATE TRIGGER trg_auditoria_evento_no_update BEFORE UPDATE ON auditoria_evento
BEGIN SELECT RAISE(ABORT, 'La tabla auditoria_evento es de solo inserción.'); END;
CREATE TRIGGER trg_auditoria_evento_no_delete BEFORE DELETE ON auditoria_evento
BEGIN SELECT RAISE(ABORT, 'La tabla auditoria_evento es de solo inserción.'); END;
CREATE TRIGGER trg_auditoria_cambio_no_update BEFORE UPDATE ON auditoria_cambio
BEGIN SELECT RAISE(ABORT, 'La tabla auditoria_cambio es de solo inserción.'); END;
CREATE TRIGGER trg_auditoria_cambio_no_delete BEFORE DELETE ON auditoria_cambio
BEGIN SELECT RAISE(ABORT, 'La tabla auditoria_cambio es de solo inserción.'); END;

CREATE TRIGGER trg_solicitud_categoria_ins BEFORE INSERT ON solicitud_promocion
WHEN (SELECT orden FROM categoria_docente WHERE id = NEW.categoria_destino_id)
     IS NOT (SELECT orden FROM categoria_docente WHERE id = NEW.categoria_origen_id) + 1
BEGIN SELECT RAISE(ABORT, 'La categoría destino debe ser la inmediata superior (RN01).'); END;
CREATE TRIGGER trg_solicitud_categoria_upd BEFORE UPDATE OF categoria_origen_id, categoria_destino_id ON solicitud_promocion
WHEN (SELECT orden FROM categoria_docente WHERE id = NEW.categoria_destino_id)
     IS NOT (SELECT orden FROM categoria_docente WHERE id = NEW.categoria_origen_id) + 1
BEGIN SELECT RAISE(ABORT, 'La categoría destino debe ser la inmediata superior (RN01).'); END;

CREATE TRIGGER trg_rubrica_no_update BEFORE UPDATE ON rubrica WHEN OLD.aprobada_en IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'La rúbrica está aprobada y no puede modificarse.'); END;
CREATE TRIGGER trg_rubrica_no_delete BEFORE DELETE ON rubrica WHEN OLD.aprobada_en IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'La rúbrica está aprobada y no puede eliminarse.'); END;

CREATE TRIGGER trg_rubrica_criterio_ins BEFORE INSERT ON rubrica_criterio
WHEN (SELECT aprobada_en FROM rubrica WHERE id = NEW.rubrica_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'La rúbrica ya fue aprobada; sus criterios y requisitos son inmutables.'); END;
CREATE TRIGGER trg_rubrica_criterio_upd BEFORE UPDATE ON rubrica_criterio
WHEN (SELECT aprobada_en FROM rubrica WHERE id = OLD.rubrica_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'La rúbrica ya fue aprobada; sus criterios y requisitos son inmutables.'); END;
CREATE TRIGGER trg_rubrica_criterio_del BEFORE DELETE ON rubrica_criterio
WHEN (SELECT aprobada_en FROM rubrica WHERE id = OLD.rubrica_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'La rúbrica ya fue aprobada; sus criterios y requisitos son inmutables.'); END;

CREATE TRIGGER trg_rubrica_requisito_ins BEFORE INSERT ON rubrica_requisito
WHEN (SELECT aprobada_en FROM rubrica WHERE id = NEW.rubrica_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'La rúbrica ya fue aprobada; sus criterios y requisitos son inmutables.'); END;
CREATE TRIGGER trg_rubrica_requisito_upd BEFORE UPDATE ON rubrica_requisito
WHEN (SELECT aprobada_en FROM rubrica WHERE id = OLD.rubrica_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'La rúbrica ya fue aprobada; sus criterios y requisitos son inmutables.'); END;
CREATE TRIGGER trg_rubrica_requisito_del BEFORE DELETE ON rubrica_requisito
WHEN (SELECT aprobada_en FROM rubrica WHERE id = OLD.rubrica_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'La rúbrica ya fue aprobada; sus criterios y requisitos son inmutables.'); END;

CREATE TRIGGER trg_evaluacion_solo_presentada BEFORE INSERT ON evaluacion
WHEN (SELECT estado FROM solicitud_promocion WHERE id = NEW.solicitud_id) IS NOT 'presentada'
BEGIN SELECT RAISE(ABORT, 'Solo se puede evaluar una solicitud en estado presentada.'); END;

CREATE TRIGGER trg_docente_tocar AFTER UPDATE ON docente WHEN NEW.actualizado_en = OLD.actualizado_en
BEGIN UPDATE docente SET actualizado_en = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = NEW.id; END;
CREATE TRIGGER trg_merito_tocar AFTER UPDATE ON merito WHEN NEW.actualizado_en = OLD.actualizado_en
BEGIN UPDATE merito SET actualizado_en = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = NEW.id; END;
CREATE TRIGGER trg_experiencia_laboral_tocar AFTER UPDATE ON experiencia_laboral WHEN NEW.actualizado_en = OLD.actualizado_en
BEGIN UPDATE experiencia_laboral SET actualizado_en = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = NEW.id; END;
CREATE TRIGGER trg_solicitud_promocion_tocar AFTER UPDATE ON solicitud_promocion WHEN NEW.actualizada_en = OLD.actualizada_en
BEGIN UPDATE solicitud_promocion SET actualizada_en = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = NEW.id; END;
CREATE TRIGGER trg_propuesta_tocar AFTER UPDATE ON propuesta WHEN NEW.actualizada_en = OLD.actualizada_en
BEGIN UPDATE propuesta SET actualizada_en = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = NEW.id; END;

-- Datos de catálogo
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
