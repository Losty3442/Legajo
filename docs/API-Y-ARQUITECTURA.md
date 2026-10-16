# Preparación de API, autenticación y persistencia

## Límite entre cliente y servidor

En la primera versión, el servicio de aplicación ejecuta las operaciones localmente e inyecta repositorios IndexedDB. En la versión con servidor, los casos de uso autoritativos vivirán en el backend. El navegador enviará comandos mediante un adaptador HTTP; el servidor validará tanto los datos como la identidad y recalculará resultados.

Las comprobaciones de perfil en el cliente sirven para la demostración. Un usuario puede modificar su navegador y sus datos locales; por eso no constituyen una frontera de seguridad.

Los puertos `TeacherRepository`, `DossierRepository`, `RequestRepository`, `EvaluationRepository` y `DocumentRepository` definen lecturas. `WorkspaceRepository.commit` es una unidad de trabajo local con control de revisión. En el servidor se reemplazará por transacciones de comandos sobre repositorios especializados, sin sustituir una base de datos completa en cada petición.

## Contratos HTTP propuestos

Estos endpoints están documentados para la siguiente etapa; **todavía no hay una API implementada**.

| Método y recurso | Responsabilidad |
|---|---|
| GET /api/v1/session | Identidad, perfiles y unidades autorizadas |
| GET /api/v1/teachers?search=&faculty=&department=&cursor= | Directorio paginado y limitado por permisos |
| POST /api/v1/teachers | Registrar docente |
| PATCH /api/v1/teachers/:id | Editar ficha con versión esperada |
| GET /api/v1/teachers/:id/dossier | Ficha, grados, méritos y estados |
| POST /api/v1/teachers/:id/merits | Registrar mérito y vincular archivo cargado |
| PATCH /api/v1/merits/:id | Corregir un mérito pendiente u observado |
| POST /api/v1/merits/:id/reviews | Verificar u observar evidencia |
| POST /api/v1/files | Carga multipart a almacenamiento privado |
| GET /api/v1/files/:id | Descarga autorizada o URL temporal firmada |
| POST /api/v1/applications | Preparar solicitud a la categoría inmediata superior |
| POST /api/v1/applications/:id/submissions | Presentar o reenviar |
| POST /api/v1/applications/:id/observations | Devolver con observación |
| GET /api/v1/applications/:id/evaluation-preview | Calcular una vista previa en servidor |
| POST /api/v1/applications/:id/evaluations | Cerrar y guardar una evaluación inmutable |
| GET /api/v1/evaluations/:id | Resultado y evidencias que sustentaron el cierre |
| GET /api/v1/rubrics/:version | Rúbrica versionada y aprobada |
| GET /api/v1/vacancies?faculty=&department=&category= | Plazas de una convocatoria |
| GET /api/v1/teachers/:id/history | Auditoría autorizada |
| GET/POST /api/v1/calls | Consultar/crear convocatoria con rúbrica y plazas |
| PATCH /api/v1/calls/:id | Cambiar configuración antes de la primera solicitud |
| POST /api/v1/calls/:id/phase | Cerrar recepción o proceso con restricciones de estado |
| GET /api/v1/calls/:id/ranking?vacancyId= | Cuadro de mérito para las instancias autorizadas |
| GET/POST/PATCH /api/v1/teachers/:id/experiences | Trayectoria con documento de respaldo |
| GET /api/v1/merits/:id/reviews | Historial inmutable y versiones documentales autorizadas |
| POST /api/v1/proposals | Preparar propuesta y congelar orden de mérito |
| POST /api/v1/proposals/:id/referrals | Remitir al Consejo de Facultad |
| POST /api/v1/proposals/:id/escalations | Elevar al Consejo Universitario |
| POST /api/v1/proposals/:id/decisions | Registrar decisión terminal y documento de referencia |

Identificadores UUID estables, fechas de calendario `YYYY-MM-DD` y marcas UTC ISO 8601. Separar el día académico de la zona horaria utilizada en auditoría. Los códigos visibles de expediente deben tener una secuencia generada por el servidor, independiente del identificador.

Las escrituras usarán `If-Match` o una `expectedVersion`. Responder 409 al detectar conflictos. El cierre debe admitir una clave de idempotencia y una restricción que impida dos evaluaciones para la misma presentación. Los errores tendrán forma:

```json
{
  "code": "EVIDENCE_PENDING",
  "message": "Hay evidencias pendientes de revisión.",
  "fieldErrors": {},
  "requestId": "identificador-de-traza"
}
```

Usar 400/422 para validación, 401 para sesión ausente, 403 para permisos, 404 para recursos no disponibles, 409 para conflictos y 413 para tamaño excesivo. No devolver SQL, secretos ni trazas internas al navegador.

## Autenticación y permisos

Resolver `Actor` desde la sesión del servidor, nunca desde un campo enviado por el cliente. Integrar el proveedor institucional mediante OIDC cuando se defina. Preferir cookie de sesión HttpOnly/Secure/SameSite, expiración y protección CSRF apropiada.

Permisos efectivos por acción y unidad: docente solo sobre sus registros; personal de legajos sobre las unidades asignadas; comisión solo en convocatorias y expedientes designados. Auditoría con usuario real, fecha del servidor y motivo. El catálogo global de personas que facilita el selector de demostración debe desaparecer del cliente de un docente real.

## Cierre de evaluación

Dentro de una transacción:

1. Bloquear o comprobar la versión de la solicitud.
2. Verificar estado presentado y permiso de comisión.
3. Consultar evidencias verificadas, requisitos y versión de rúbrica aplicable a la convocatoria.
4. Calcular en servidor; ignorar el puntaje enviado por el navegador.
5. Conservar instantáneas o referencias inmutables a todas las entradas.
6. Guardar el resultado, auditoría y transición de estado de manera atómica.

El prototipo comprueba disponibilidad y bloquea propuestas activas o aprobadas duplicadas para la misma plaza, mediante la misma transacción local. Registra una decisión de simulación y no altera la categoría docente. Antes de una operación real debe definirse adjudicación, desempates, presupuesto, aprobación y reserva concurrente de plazas. No debe interpretarse «Apto para propuesta» como adjudicación.

## Archivos

Almacenamiento de objetos privado separado de los metadatos. Conservar nombre original, tipo detectado, tamaño, hash, propietario y versión. Comprobar límites y contenido en el servidor; la firma básica local no sustituye validación estructural ni análisis antimalware.

No sobrescribir archivos que respalden evaluaciones. Definir política de retención y eliminación institucional. Autorizar cada descarga, mantener auditoría y usar URLs temporales. Las cargas incompletas deben expirar sin dejar referencias rotas. Probar fallos de red, cuotas y reintentos.

## Adaptación progresiva

1. Reutilizar tipos y funciones puras de `src/domain` en un paquete compartido.
2. Añadir una fachada de casos de uso al cliente HTTP con las operaciones de `LegajoService`.
3. Cambiar `src/composition.ts` para inyectar esa fachada y resolver la sesión real.
4. Sustituir la inicialización de ejemplos por la lectura autorizada.
5. Añadir repositorios del servidor, migraciones, respaldos y pruebas de integración.
6. Mantener pruebas de dominio y adaptar los recorridos de navegador a cuentas de prueba.

El esquema relacional, la normalización y las migraciones se definirán en la etapa de diseño de persistencia. La estructura de IndexedDB no debe copiarse literalmente como una tabla única en producción.

> [!NOTE]
> El modelado de la persistencia **ya está disponible** y no altera el prototipo: `db/schema.ts`
> contiene el esquema Drizzle de las 35 tablas y `drizzle/0000_legajo_promocion_unp.sql` el DDL
> completo (tablas, índices, triggers y catálogos) del anexo B del Análisis del Sistema v2.0.
> Aplicarlo es un paso de configuración cuando se conecte la base; hoy `getDb()` no se invoca y el
> prototipo sigue con IndexedDB. Detalle en [PLAN-ALINEACION-ANALISIS-V2.md](PLAN-ALINEACION-ANALISIS-V2.md).

## Nuevos contratos del dominio

PromotionCall conserva periodo, estado, vacancyIds y rúbrica completa. ApplicationRequest exige callId. La rúbrica incluye requisitos por categoría y fuentes por criterio; Evaluation incorpora callSnapshot.

ReviewEvent conserva identidad, marca temporal, motivo, estado anterior/posterior y referencias a ambos archivos. Proposal conserva evaluationId, rankingSnapshot y eventos por instancia. La última decisión es terminal. AuditEntry añade actorId, actorName y cambios antes/después. La vista docente excluye cambios de auditoría que puedan contener datos de otros postulantes y limita el cuadro conservado a su propia fila.

En servidor, obtener actorId desde la sesión. Aplicar restricciones por facultad y convocatoria a decanato y consejos, además de los roles. Las referencias a oficios/resoluciones son texto de ejemplo en esta versión; producción requerirá validar y archivar el documento institucional, su firma y procedencia.

Los comandos de propuesta deben comprobar recepción cerrada, evaluaciones completas, orden de mérito, empate, plaza y unicidad dentro de una transacción. Todas las instancias comparten el control de revisión; sustituirlo por bloqueos/restricciones de base de datos y claves de idempotencia. No confiar en puntajes, puestos, instantáneas o identidades enviados por el cliente.
