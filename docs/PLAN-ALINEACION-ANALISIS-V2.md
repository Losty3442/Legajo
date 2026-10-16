# Plan de alineación con el Análisis del Sistema v2.0

Documento de trabajo · Sistema de Legajo y Promoción Docente · UNP

Referencia: `Analisis_legajo_promocion_UNP_v2.pdf` (análisis del sistema, versión 2.0 ampliada con
modelado de la base de datos). Este plan compara ese documento con el prototipo del proyecto y
define cómo alinearlos **sin conectar ninguna base de datos**, dejando el proyecto listo para
conectarse.

---

## 1. Veredicto de concordancia

**El proyecto concuerda con el documento a nivel de negocio y de proceso, pero no todavía a nivel
de modelo de datos.** No es una contradicción: el propio documento v2 se elaboró *a partir de este
prototipo* (lo cita en §6.10 y §10.2) y en su matriz de trazabilidad §7.3 ya describe el estado del
prototipo ("Sí", "Parcial", "No"). El proyecto es el **prototipo de demostración**; el documento es
el **análisis completo con el modelo relacional de 35 tablas**.

Resumen por área:

| Área | Estado | Comentario |
|---|---|---|
| Actores, roles y responsabilidades (§1.7–1.8) | ✅ Concordante | Los 6 roles y sus operaciones coinciden con `src/domain/models.ts` y la navegación por perfil. |
| Reglas de negocio y decisión (§3) | 🟡 Parcial | RN01, RN03–RN14, RN17–RN19, RN24 se cumplen en `src/application/service.ts`; RN20 y RN21 parciales; RN23 solo conceptual. |
| Casos de uso del negocio CUN01–CUN06 (§4) | ✅ Concordante | Los seis objetivos tienen recorrido en la aplicación. |
| Casos de uso del sistema CUS01–CUS18 (§5) | 🟡 Parcial | CUS06 (rúbrica versionada y aprobada) ya implementado; faltan CUS08 (comisión) y CUS18 (usuarios/roles); CUS17 es parcial. Ver §7.3 del documento ("No"). |
| Requisitos funcionales RF01–RF19 (§2.1) | 🟡 Parcial | RF01–RF10 y RF12–RF15 implementados (RF10 se cerró en esta iteración); RF11, RF17 y RF19 sin implementar; RF16 y RF18 parciales. |
| Requisitos no funcionales RNF01–RNF16 (§2.2) | 🟡 Parcial | RNF02, RNF04 y RNF12 bien cubiertos; RNF05 y RNF15 parciales; el resto depende de la fase de servidor (declarada fuera de alcance). |
| Dominio conceptual y de análisis (§4.6, §5.5) | ✅ Concordante | Los conceptos nuevos (convocatoria, rúbrica, comisión, revisión, trayectoria, propuesta, orden de mérito) existen como tipos. |
| Arquitectura lógica (§5.6) | ✅ Concordante | Clean Architecture con dominio puro, puertos y adaptador de persistencia (`src/composition.ts`). |
| Mapa de pantallas (§5.7) | ✅ Concordante | Las rutas `/docentes`, `/legajos/:id`, `/revision`, `/solicitudes`, `/evaluaciones`, `/convocatorias`, `/orden-merito`, `/propuestas`, `/rubrica` existen. |
| **Modelo de base de datos (§6, anexos A y B)** | 🔴 **No concordante** | El proyecto guardaba todo en un único *workspace* de IndexedDB; `db/schema.ts` estaba vacío. **Ya se corrigió en esta iteración** (ver §3). |

**Conclusión.** Falta sobre todo la **capa de datos** (el modelo relacional) y **dos funciones**
(CUS08 y CUS18 junto con RF11 y RF17, más RF19). CUS06/RF10 se cerró en esta iteración. Todo lo
demás o concuerda o depende de la fase de servidor que tanto el documento como
`docs/API-Y-ARQUITECTURA.md` difieren de forma explícita.

---

## 2. Brechas identificadas

Prioridad: **P1** imprescindible para "concordar"; **P2** importante; **P3** mejora.

### 2.1 Modelo de datos

| # | Brecha | P | Ubicación |
|---|---|---|---|
| D1 | No existía el modelo relacional (35 tablas, 7 enums, 78 relaciones, índices y triggers). | P1 | `db/schema.ts` (antes vacío) → **resuelto** |
| D2 | Toda la información vivía en un único agregado `Workspace` (una sola clave de IndexedDB) en lugar de tablas normalizadas. | P1 | `src/domain/models.ts` (`Workspace`), `src/infrastructure/indexeddb.ts` |
| D3 | No existen entidades `legajo`, `documento` (metadatos), `comision_evaluadora`/`miembro_comision`, `expediente_item`, `observacion_solicitud` ni `solicitud_historial_estado`. | P1 | `src/domain/models.ts` |
| D4 | `documento` no guarda `hash_sha256`, `version`, `reemplaza_a`, `clave_almacenamiento` ni `retener_hasta` (RNF03, RNF14). | P2 | `src/domain/models.ts` (`DocumentFile`), `service.ts` (validación solo por firma) |
| D5 | Los catálogos `facultad`, `departamento_academico`, `categoria_docente` (con `orden`), `dedicacion`, `rol`, `usuario` y `asignacion_rol` son texto/constantes en el cliente, no tablas con vigencia. | P2 | `src/domain/models.ts` (`catalog`, `demoUsers`) |
| D6 | `rubrica`, `rubrica_criterio` y `rubrica_requisito` van embebidas en un objeto y se copian por convocatoria; no hay versionado ni aprobación (`aprobada_en`) ni `estado_fuente` oficial. | P2 | `src/domain/models.ts` (`Rubric`), `service.ts` (`saveCall`) → **resuelto en el prototipo (RF10/CUS06)** |
| D7 | Convocatoria y plazas se relacionan con `vacancyIds: string[]` en lugar de la tabla N:M `convocatoria_plaza`. | P3 | `src/domain/models.ts` (`PromotionCall`) |

### 2.2 Aplicación y reglas

| # | Brecha | P | Ubicación |
|---|---|---|---|
| A1 | Concurrencia optimista a nivel de todo el *workspace* (un solo `revision`), no por entidad (`version`/`If-Match`) como pide RNF05. | P2 | `service.ts` (`change`), `indexeddb.ts` (`commit`) |
| A2 | El cierre de evaluación no es idempotente (no hay `clave_idempotencia`); RNF06/RN13 dependen de comprobaciones de estado. | P2 | `service.ts` (`closeEvaluation`) |
| A3 | La identidad del actor sale de un selector de perfil en el cliente, no de la sesión del servidor (RN23/RNF01). | P2 | `workspace.tsx`, `service.ts` (`identity`) |
| A4 | `estado_fuente` solo admitía `"simulacion"`; no existía el flujo de rúbrica aprobada (RF10/CUS06). | P1 | `models.ts` (`Rubric.sources`, `Workspace.rubrics`), `service.ts` (`saveRubric`/`approveRubric`) → **resuelto** |
| A5 | No hay designación de comisión ni comprobación de que el evaluador sea integrante (RN21/RF11/CUS08). | P1 | `service.ts` (`closeEvaluation`) |
| A6 | No hay administración de usuarios, roles ni unidades (RF17/CUS18). | P1 | — |
| A7 | No hay notificaciones al docente (RF19). | P3 | `presentation/provider.tsx` (solo *toasts* locales) |
| A8 | El historial de estados de la solicitud se deduce de la auditoría, no de una tabla `solicitud_historial_estado`. | P2 | `service.ts` (`change`) |
| A9 | Errores sin forma uniforme (`code`, `message`, `requestId`); RNF16 es de servidor. | P3 | `service.ts` (usa `throw new Error`) |
| A10 | Falta vista previa del cálculo en "servidor" y recálculo ignorando el puntaje del navegador (CUS11 §3). Hoy todo se calcula en el cliente. | P2 | `service.ts`, `domain/evaluation.ts` |

### 2.3 Lo que **no** es una brecha (alcance diferido, declarado en ambos documentos)

Proveedor de identidad OIDC, API `/api/v1`, almacenamiento de objetos privado (R2) con URL firmada,
análisis antimalware, respaldo y recuperación, y política de retención. Aparecen como "fuera de
alcance / fase de servidor" en el documento v2 (§1.5, §5.6, §6.9) y en `docs/API-Y-ARQUITECTURA.md`.

---

## 3. Hecho en esta iteración (proyecto "listo para conectarse")

Sin conectar ninguna base de datos y sin cambiar el funcionamiento actual (sigue con IndexedDB):

1. **`db/schema.ts`** — esquema Drizzle (dialecto `sqlite`/D1) con las **35 tablas** de los módulos
   A–F, sus claves, índices (incluido el índice único parcial `ux_propuesta_plaza_activa`) y las
   comprobaciones expresables en el ORM. Los tipos enumerados de §6.5 se exportan como uniones
   TypeScript.
2. **`drizzle/0000_legajo_promocion_unp.sql`** — DDL completo y probado del anexo B (variante
   SQLite/D1): 35 tablas, 24 índices, **34 triggers** de integridad (inmutabilidad, categoría
   destino RN01, rúbrica bloqueada RN09, evaluación solo sobre `presentada`) y los datos de
   catálogo (categorías, dedicaciones, roles, tipos de mérito).
3. **`drizzle/meta/_journal.json`** — migración encadenada, lista para `drizzle-kit migrate` o para
   `wrangler d1 execute --file`.
4. **RF10 / CUS06 · prototipo** — rúbrica versionada sobre IndexedDB: catálogo `Workspace.rubrics`,
   borrador editable, **aprobación** (que fija la versión vigente y la bloquea, RN09), `estado_fuente`
   `simulacion|oficial`, fuente por criterio y requisitos por categoría destino. La convocatoria solo
   puede aplicarse a una rúbrica **aprobada** y guarda su copia congelada. Archivos:
   `src/domain/models.ts`, `src/application/service.ts` (`saveRubric`, `approveRubric`, `saveCall`),
   `src/presentation/features/rubric.tsx`, `tests/rubric.spec.ts`.

Con esto, el proyecto **ya refleja el modelo de datos del documento** y conectar una base es un paso
de configuración, no de rediseño.

---

## 4. Plan de alineación

> Regla de la iteración: **sin base de datos conectada**. `src/composition.ts` sigue inyectando el
> adaptador IndexedDB y `db/index.ts` (`getDb`) no se invoca. Solo al final (§Fase 5) se conecta.

### Fase 1 · Documentar la concordancia (P1) — *recomendada primero*
- Ampliar `docs/TRAZABILIDAD.md` con el mapeo **RF → CUS → regla → tabla(s) → escenario**, igual que
  §7.3 del documento, y una columna "Estado" con la brecha cuando exista.
- Añadir a `docs/API-Y-ARQUITECTURA.md` una nota de que `db/schema.ts` y la migración ya existen y
  que sustituyen el plan original de "crear el esquema".
- **Aceptación:** cada RF/RNF del documento aparece una vez con su estado y su ubicación.

### Fase 2 · Completar el dominio para el modelo relacional (P1)
- Introducir en `src/domain/models.ts` (sin romper la migración de IndexedDB, `schemaVersion` 3):
  `legajo` 1:1 con docente, metadatos de `documento` (hash, versión, `reemplaza_a`, clave,
  retención), catálogos `facultad`/`departamento`/`categoria` (con `orden`), `comision`/`miembro`,
  `expediente_item`, `observacion_solicitud` y `solicitud_historial_estado`.
- **Aceptación:** los nombres y campos coinciden con `db/schema.ts`; migración de datos existente sin
  pérdida (reutilizar el patrón de `src/application/migrations.ts`).

### Fase 3 · Funciones faltantes (P1)
- **CUS06 / RF10 ✅ hecho:** edición y **aprobación de rúbricas** versionadas; al aprobar se bloquean
  los cambios (espeja el trigger `fn_rubrica_bloqueada`), se admite `estado_fuente = oficial` y la
  convocatoria solo aplica versiones aprobadas.
- **CUS08 / RF11:** designar comisión evaluadora por convocatoria y exigir pertenencia al cerrar
  evaluación (RN21).
- **CUS18 / RF17:** administrar usuarios, roles y unidades con vigencia (RF17).
- **RF19:** notificaciones al docente (observación subsanable, resultado, decisión); puede empezar
  como avisos en la interfaz.
- **Aceptación:** los escenarios E19 (rúbrica aprobada) y E19/E22 del documento se pueden recorrer en
  el prototipo (E19 cubierto por `tests/rubric.spec.ts`); E22 (evaluador no integrante) y E21 (acceso
  ajeno) quedan para CUS08/CUS18.

### Fase 4 · Endurecer reglas y trazabilidad (P2)
- Concurrencia: `version` por entidad + versión esperada → conflicto 409 (RNF05, E24).
- Idempotencia del cierre de evaluación con `clave_idempotencia` (RNF06, E15).
- Auditoría con antes/después por colección (ya casi) y **historial de estados** explícito (A8).
- Validar categoría destino como "inmediata superior" también al editar (RN01, E12).
- **Aceptación:** los escenarios E15, E16, E17, E18, E19, E20 y E24 quedan cubiertos por pruebas
  (`tests/rules.spec.ts`, `tests/workflow.spec.ts`).

### Fase 5 · Puertos y adaptadores de servidor (P2, opcional ahora)
- Definir repositorios por agregado en `src/application/ports.ts` que mapeen 1:1 a las tablas.
- Añadir `src/infrastructure/d1/` con la implementación sobre `getDb()` **sin conectarla**; la
  fachada se elige en `composition.ts`.
- **Aceptación:** cambiar a D1 es cambiar una línea de `composition.ts`; el prototipo sigue andando
  con IndexedDB por defecto.

### Fase 6 · Conexión real (fuera de esta iteración)
Cuando exista decisión institucional y credenciales:
1. Aprovisionar la base D1 y declarar el binding en `.openai/hosting.json`:
   ```json
   { "d1": "DB", "r2": null }
   ```
2. Aplicar el esquema:
   ```bash
   npx wrangler d1 execute <base> --local  --file ./drizzle/0000_legajo_promocion_unp.sql
   npx wrangler d1 execute <base> --remote --file ./drizzle/0000_legajo_promocion_unp.sql
   ```
   (alternativa: `npx drizzle-kit migrate` con credenciales de D1).
3. Implementar OIDC, API `/api/v1` y almacenamiento privado de archivos (R2) según
   `docs/API-Y-ARQUITECTURA.md`.

---

## 5. Cómo se cumple "sin BD pero listo para conectarse"

| Requisito | Cómo se garantiza |
|---|---|
| El prototipo no usa base de datos | `src/composition.ts` inyecta `browserRepositories` (IndexedDB). `getDb()` no se llama en ninguna ruta. |
| El modelo ya existe | `db/schema.ts` (35 tablas) + `drizzle/0000_legajo_promocion_unp.sql` (DDL + triggers + catálogos). |
| Conectar es configuración | Fase 6: declarar el binding `DB`, aplicar la migración y elegir el adaptador. Sin rediseño. |
| Nada se rompe | `npx tsc --noEmit` pasa; `drizzle.config.ts` ya apunta a `db/schema.ts` y `./drizzle`. |

---

## 6. Matriz de trazabilidad resumida

| RF | Estado | Brecha / acción |
|---|---|---|
| RF01 datos y trayectoria | ✅ | — |
| RF02/RF03 legajo y verificación | 🟡 | Fase 2: `legajo` y metadatos de `documento` explícitos. |
| RF04 solicitud | ✅ | — |
| RF05/RF06 requisitos y puntaje | ✅ | — |
| RF07 vacante | ✅ | — |
| RF08 evaluación y propuesta | 🟡 | Fases 2 y 4: normalizar `evaluacion_*`, exposición de estados. |
| RF09 convocatoria | ✅ | — |
| RF10 rúbrica versionada | ✅ | CUS06 implementado: borrador, aprobación, RN09 y `estado_fuente`. |
| RF11 comisión | ❌ | **Fase 3 (CUS08)**. |
| RF12 trayectoria | ✅ | — |
| RF13 orden de mérito | ✅ | — |
| RF14 propuesta | ✅ | — |
| RF15 observación | ✅ | Fase 2: `observacion_solicitud`. |
| RF16 auditoría | 🟡 | Fase 4: historial de estados explícito. |
| RF17 usuarios/roles | ❌ | **Fase 3 (CUS18)**. |
| RF18 exportar | 🟡 | Impresión existente; falta exportación formal. |
| RF19 notificar | ❌ | **Fase 3**. |

| RNF | Estado | Nota |
|---|---|---|
| RNF02 trazabilidad, RNF04 fuente/versión, RNF12 mantenibilidad | ✅ | Bien cubiertos. |
| RNF03 conservación | 🟡 | Fase 2: hash SHA-256 y versionado de documento. |
| RNF05 concurrencia | 🟡 | Fase 4: versión por entidad. |
| RNF06 idempotencia | ❌ | Fase 4. |
| RNF01, RNF07, RNF08, RNF10, RNF13, RNF14, RNF16 | ⏳ | Fase de servidor (§2.3). |
| RNF09, RNF11, RNF15 | 🟡 | Metas de servidor; RNF15 parcial en el cliente. |

---

## 7. Riesgos del plan

- **Rúbrica de simulación (R01):** el prototipo usa `DEMO-2026.2`; no operar con ella. La Fase 3 debe
  mantener `estado_fuente` y exigir `oficial` antes de un piloto.
- **Empates (R05):** seguir sin inventar desempate (RN17); bloquear y explicar.
- **Migración de datos (R08):** al pasar de un `Workspace` a tablas, conservar evaluaciones cerradas
  y documentos sin sobrescribir; probar con `migrations.ts`.
- **Alcance creciente (R09):** recursos, apelaciones e integración con personal quedan fuera hasta
  decisión institucional.

---

## 8. Próximo paso sugerido

La **Fase 1** (documentar) y la **Fase 3, primera tarea (CUS06/RF10)** ya están hechas. El siguiente
paso natural es **CUS08/RF11 (comisión evaluadora y RN21)**, que comparte el patrón de permisos y de
"estado aprobado" que se acaba de introducir con las rúbricas.
