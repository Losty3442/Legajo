# API y arquitectura implementadas · PostgreSQL local

## Ejecución e identidad

El navegador usa `src/infrastructure/http.ts`. Express (`server/app.ts`) ejecuta `LegajoService` con un repositorio transaccional PostgreSQL (`server/store.ts`). El frontend conserva Vinext y Sites. La dirección pública local es `http://localhost:5173`; el proxy sirve páginas y WebSocket de desarrollo desde 5174. Ambos procesos escuchan únicamente en loopback.

Las contraseñas se almacenan con hash scrypt y sal individual. La sesión usa un token aleatorio de 256 bits; PostgreSQL guarda su SHA-256. Cookie `legajo_session`, HttpOnly, SameSite=Strict, expiración de ocho horas. Las escrituras comprueban el origen local. El servidor resuelve identidad, rol vigente y docente vinculado; ignora identidades enviadas en el JSON. No se utiliza sessionStorage para autenticar ni hay selectores para asumir otro rol.

El docente recibe solo sus registros, archivos e historial. Las cuentas del personal comparten el ámbito de la demostración académica local. La comisión debe tener una referencia en `miembro_comision` para cerrar una evaluación. Las nuevas convocatorias reciben una comisión identificada expresamente como demostración, sin designación institucional.

## Contratos HTTP

Todos los recursos siguientes usan `/api/v1`. Las lecturas requieren sesión salvo health y session; login/logout admiten sesión ausente.

| Método y recurso | Responsabilidad |
|---|---|
| GET /health | Disponibilidad de PostgreSQL y estado de inicialización |
| POST /auth/login | JSON email/password; iniciar sesión |
| POST /auth/logout | Revocar token y borrar cookie |
| GET /session | Cuenta autenticada o null y estado de importación |
| GET /workspace | DTO agregado con revisión, filtrado por permisos |
| GET /teachers?search=&faculty=&department=&cursor=&limit= | Directorio; máximo 100 por página, nextCursor y total autorizado |
| POST /teachers | Registrar docente y devolver su cuenta y clave inicial una vez |
| PATCH /teachers/:id | Editar ficha |
| GET /teachers/:id/dossier | Ficha, méritos y experiencias |
| POST /teachers/:id/merits | Multipart: payload JSON y file; mérito y archivo atómicos |
| PATCH /merits/:id | Corregir mérito, con archivo nuevo opcional |
| POST /files | Variante atómica de carga: payload incluye teacherId y los campos del mérito; devuelve el ID del mérito creado |
| GET /files/:id | Documento privado autorizado; verifica SHA-256 antes de enviarlo |
| GET/POST /merits/:id/reviews | Consultar / verificar u observar; conserva versiones anteriores |
| GET /applications | Solicitudes autorizadas |
| POST /applications | Preparar solicitud: teacherId, vacancyId, callId |
| PATCH /applications/:id | Editar borrador u observación según reglas |
| POST /applications/:id/submissions | Presentar o reenviar |
| POST /applications/:id/observations | Devolver con note |
| GET /applications/:id/evaluation-preview | Calcular requisitos y puntajes en el servidor |
| POST /applications/:id/evaluations | Cierre inmutable, note e Idempotency-Key obligatorios |
| GET /evaluations y /evaluations/:id | Resultados e instantáneas conservadas |
| GET /rubrics/:version | Versión autorizada |
| POST /rubrics y PATCH /rubrics/:id | Crear / editar borrador |
| POST /rubrics/:id/approvals | Aprobar e inmovilizar versión |
| GET /vacancies?faculty=&department=&category= | Plazas autorizadas con filtros |
| GET/POST /calls y PATCH /calls/:id | Consultar, crear y configurar convocatoria |
| POST /calls/:id/phase | Cerrar recepción o proceso |
| GET /calls/:id/ranking?vacancyId= | Orden de mérito para personal autorizado |
| GET/POST /teachers/:id/experiences | Consultar / registrar trayectoria con evidencia del legajo |
| PATCH /teachers/:id/experiences/:experienceId | Corregir trayectoria |
| GET /teachers/:id/history | Auditoría autorizada |
| GET/POST /proposals | Consultar / preparar y congelar el orden de mérito |
| POST /proposals/:id/referrals | Remitir a Facultad; reference y note |
| POST /proposals/:id/escalations | Elevar al Consejo Universitario |
| POST /proposals/:id/decisions | Decisión terminal; action aprobar/denegar, reference y note |
| GET /migrations | Estado e informe de la última importación, solo Legajos |
| POST /migrations/preview | Multipart backup: validar ZIP sin importarlo |
| POST /migrations | Importación inicial transaccional e idempotente por huella |

Las cargas de documentos se vinculan a un mérito dentro de la misma transacción; no hay cargas huérfanas públicas. Se permiten PDF, PNG, JPEG y WebP, con firma y MIME compatibles, hasta 10 MiB. Los ZIP de importación admiten hasta 128 MiB comprimidos, 512 MiB descomprimidos y 16 MiB para workspace.json.

## Transacciones, errores e históricos

Las escrituras requieren `If-Match: <revision>`. La fila `aplicacion_estado` serializa comandos y compara la revisión antes de guardar. Se actualizan únicamente entidades modificadas, relaciones nuevas y auditoría. Respuesta: `{result,revision,accounts}`; accounts contiene contraseñas solo en el alta inicial de un docente y nunca se guarda en auditoría ni en la respuesta idempotente persistida.

Los cierres requieren `Idempotency-Key`; repetir la misma clave, usuario, ruta y contenido devuelve el resultado anterior incluso con If-Match antiguo. Una clave con contenido distinto produce 409. La evaluación se calcula en el servidor y congela docente, convocatoria, rúbrica y evidencias. Las lecturas agregadas usan una transacción de solo lectura y una instantánea consistente.

Errores: `{code,message,requestId}`. Estados: 401 sesión ausente, 403 permisos/origen, 404 recurso no disponible, 409 revisión/duplicado/idempotencia, 413 tamaño, 422 datos/reglas, 428 cabeceras requeridas y 5xx indisponibilidad o fallo interno. Los errores PostgreSQL no exponen consultas ni secretos. El navegador permite reintentar y nunca vuelve silenciosamente a IndexedDB.

IDs existentes se conservan como texto; registros nuevos usan UUID. Fechas académicas DATE, instantes TIMESTAMPTZ, puntajes NUMERIC, indicadores BOOLEAN e instantáneas JSONB. Cada entidad conserva una proyección DTO JSONB junto a sus columnas relacionales y tablas hijas; no se guarda un workspace completo en una tabla.

PostgreSQL impide modificar o borrar evaluaciones, detalles, evidencia documental, revisiones, auditoría, eventos y cuadros congelados. Inmoviliza las rúbricas aprobadas y sus detalles, exige promoción inmediata y aplica el índice único parcial para propuestas activas o aprobadas por plaza. La decisión sigue siendo una simulación y no cambia la categoría docente.

## Importación y respaldo

El asistente `/migracion` lee IndexedDB mediante transacciones readonly y descarga el respaldo antes de importar. El servidor valida IDs, referencias, archivos y SHA-256; conserva el ZIP, reconstruye dependencias sin desactivar triggers y registra la huella de importación. Repetir un paquete devuelve el informe anterior; otro paquete no sobrescribe la base inicializada.

Antes del commit se comparan todas las proyecciones de las colecciones y cada archivo contra el respaldo. Cualquier error revierte la transacción y retira solo los archivos creados por ese intento. Las identidades históricas ausentes se representan con usuarios técnicos inactivos, identificados como importación y sin acceso al sistema. No se atribuye una aprobación inexistente a una persona real.

El respaldo original de Chrome de esta PC fue importado conservando 6 docentes, 24 méritos, 4 solicitudes y 24 archivos. La aprobación de la rúbrica heredada no constaba: permanece como borrador de simulación.

## Componentes y pruebas

`db/schema.pg.ts` describe el esquema Drizzle; `drizzle-pg/0000_legajos.sql` es la migración versionada y verificada por SHA-256. `scripts/setup-postgres.mjs` usa el administrador solo al preparar roles y bases; la aplicación utiliza `legajo_app` y los scripts de migración/respaldo el propietario.

Las 27 pruebas originales siguen disponibles. La suite PostgreSQL usa exclusivamente `legajos_unp_test`, puertos 5183/5184 y `.local/test-data`, con credenciales independientes. Cubre cuentas, sesiones, permisos manipulados, concurrencia, archivos, correcciones, evaluación, propuestas por cada instancia, rúbricas, importación y reversión. Los recorridos de navegador usan Edge y verifican lectura compartida desde Chrome.
