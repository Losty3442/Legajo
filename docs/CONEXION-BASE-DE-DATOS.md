> **Actualización · 10 de noviembre de 2026:** la migración PostgreSQL ya está implementada. Estado y comandos vigentes: [Operación local](OPERACION-POSTGRESQL.md), [API implementada](API-Y-ARQUITECTURA.md) y [diagrama PostgreSQL](diagramas/postgresql-legajos-unp.puml). El contenido siguiente describe la preparación anterior.

# Base de datos: estructura actual y cómo conectarla

> Guía técnica del Sistema de Legajo y Promoción Docente · UNP
> El prototipo **no usa base de datos**: funciona con IndexedDB. El modelo relacional
> **ya está escrito** en el repositorio y listo para activarse.

---

## 1. Estado actual: el prototipo (sin BD)

```
┌──────────────────────────────────────────────┐
│ Presentación (React)                         │
│  src/presentation/**                         │
└───────────────┬──────────────────────────────┘
                │ llama casos de uso
┌───────────────▼──────────────────────────────┐
│ Aplicación (casos de uso + puertos)          │
│  src/application/service.ts  → LegajoService │
│  src/application/ports.ts    → interfaces    │
│  src/application/migrations.ts                │
└───────────────┬──────────────────────────────┘
                │ implementa los puertos
┌───────────────▼──────────────────────────────┐
│ Infraestructura                             │
│  src/infrastructure/indexeddb.ts (actual)    │
│  src/infrastructure/seed.ts (datos demo)     │
└───────────────┬──────────────────────────────┘
                │ se inyecta en
        src/composition.ts   ← punto de IoC
```

### Almacenamiento real hoy: IndexedDB

Base `unp-legajos-demo`, versión 1, con dos almacenes (*object stores*):

| Almacén | Clave | Contenido |
|---|---|---|
| `workspace` | `"current"` | **Un único snapshot JSON** con todo el `Workspace`: `teachers[]`, `merits[]`, `experiences[]`, `requests[]`, `evaluations[]`, `calls[]`, `vacancies[]`, `rubrics[]`, `proposals[]`, `reviews[]`, `audit[]` y `revision` (número de revisión). |
| `documents` | `id` | Archivos binarios reales (PDF/PNG/JPG/WebP ≤ 10 MB) como `Blob`. |

Control de concurrencia: `commit()` compara `revision` (compare-and-swap). Si otra pestaña
cambió el workspace, la transacción se aborta y avisa *"Los datos cambiaron en otra pestaña"*.

> `docs/API-Y-ARQUITECTURA.md` advierte: **esta estructura no debe copiarse literalmente a
> producción** (no es "una tabla gigante"); en el servidor cada puerto se sirve por tablas
> normalizadas.

---

## 2. Lo que YA está preparado para la base real

| Archivo | Qué contiene | Estado |
|---|---|---|
| `db/schema.ts` | Esquema **Drizzle** (dialecto `sqlite` / Cloudflare D1) con las **35 tablas** de los módulos A–F, 7 tipos enumerados, claves foráneas, índices y `CHECK`s | Escrito, no invocado |
| `drizzle/0000_legajo_promocion_unp.sql` | **DDL completo**: tablas + 24 índices + **34 triggers** de integridad + catálogos (categorías, dedicaciones, roles, tipos de mérito) | Escrito, no aplicado |
| `db/index.ts` | `getDb()` → `drizzle(env.DB, { schema })` con el binding `DB` de Cloudflare D1 | Escrito, **sin binding declarado** |
| `drizzle.config.ts` | `drizzle-kit`: `out: ./drizzle`, `schema: ./db/schema.ts`, `dialect: "sqlite"` | Solo permite `generate` |
| `.openai/hosting.json` | `{"d1": null, "r2": null}` | **Deshabilitado a propósito** |

### Módulos del modelo relacional

| Módulo | Tablas |
|---|---|
| **A · Organización y seguridad** | `facultad`, `departamento_academico`, `categoria_docente`, `dedicacion`, `rol`, `usuario`, `asignacion_rol` |
| **B · Docente, legajo y evidencias** | `docente`, `legajo`, `tipo_merito`, `documento`, `merito`, `revision_merito`, `experiencia_laboral` |
| **C · Convocatoria, rúbrica y plazas** | `rubrica`, `rubrica_criterio`, `rubrica_requisito`, `plaza`, `convocatoria`, `convocatoria_plaza`, `comision_evaluadora`, `miembro_comision` |
| **D · Solicitud y evaluación** | `solicitud_promocion`, `expediente_item`, `observacion_solicitud`, `solicitud_historial_estado`, `evaluacion`, `evaluacion_criterio`, `evaluacion_requisito`, `evaluacion_evidencia` |
| **E · Propuesta y decisión** | `propuesta`, `propuesta_orden_merito`, `propuesta_evento` |
| **F · Auditoría** | `auditoria_evento`, `auditoria_cambio` |

### Equivalencias de tipos (SQLite ↔ modelo del documento)

`uuid → text` · `boolean → integer (0/1)` · `timestamptz/date → text ISO 8601 UTC` ·
`numeric → real` · `jsonb → text` (validado con `json_valid`) · `enum → text + CHECK` ·
`PRAGMA foreign_keys = ON` en **cada** conexión.

### Mapa: colección del prototipo ↔ tabla(s) real(es)

| Colección `Workspace` | Tablas de destino |
|---|---|
| `teachers[]` | `docente` + `usuario` + `legajo` + `departamento_academico` + `facultad` + `categoria_docente` + `dedicacion` |
| `merits[]` | `merito` + `tipo_merito` + `documento` (+ `revision_merito`) |
| `experiences[]` | `experiencia_laboral` + `documento` |
| `requests[]` | `solicitud_promocion` + `expediente_item` + `observacion_solicitud` + `solicitud_historial_estado` |
| `evaluations[]` | `evaluacion` + `evaluacion_criterio` + `evaluacion_requisito` + `evaluacion_evidencia` + `rubrica*` |
| `calls[]` | `convocatoria` + `convocatoria_plaza` + `plaza` |
| `vacancies[]` | `plaza` |
| `rubric` / `rubrics[]` | `rubrica` + `rubrica_criterio` + `rubrica_requisito` |
| `proposals[]` | `propuesta` + `propuesta_orden_merito` + `propuesta_evento` |
| `reviews[]` | `revision_merito` |
| `audit[]` | `auditoria_evento` + `auditoria_cambio` |
| `documents` (blobs) | **R2** (bucket privado) + metadatos en `documento` (`clave_almacenenamiento`, `hash_sha256`, `version`) |
| sesión del actor | OIDC → `usuario` + `asignacion_rol` + `rol` |

---

## 3. Ruta A · Conectar Cloudflare D1 (la que el proyecto ya soporta)

El proyecto corre sobre **Cloudflare Workers + Vite plugin**, por eso `db/index.ts` usa
`env.DB`. Todo lo necesario ya está cableado; solo hay que "encender" el binding.

### Paso 1 · Declarar el binding D1

`.openai/hosting.json`:

```json
{
  "d1": "DB",
  "r2": "BUCKET"
}
```

`vite.config.ts` lee ese archivo y genera automáticamente el binding local de Miniflare
(`database_name: "site-creator-d1"`). Con `"d1": null` no hay binding y `getDb()` lanza
*"Cloudflare D1 binding `DB` is unavailable"*.

### Paso 2 · Aplicar el DDL

```bash
# Base local de desarrollo
npx wrangler d1 execute site-creator-d1 --local --file ./drizzle/0000_legajo_promocion_unp.sql

# Base real (producción / UNP)
npx wrangler d1 execute site-creator-d1 --remote --file ./drizzle/0000_legajo_promocion_unp.sql
```

Comprobar:

```bash
npx wrangler d1 execute site-creator-d1 --local --command "SELECT count(*) FROM sqlite_master WHERE type='table'"
# → 35 (más las tablas de control de D1)
```

> Alternativa con drizzle-kit (requiere añadir credenciales a `drizzle.config.ts`):
> ```ts
> export default defineConfig({
>   out: "./drizzle",
>   schema: "./db/schema.ts",
>   dialect: "sqlite",
>   dbCredentials: { url: "file:./local.db" },
> });
> ```
> `npm run db:generate` (ya existe) crea migraciones; `drizzle-kit migrate` las aplica.

### Paso 3 · Exponer la API (el navegador **nunca** habla con la BD)

Crear rutas en `app/api/v1/...` (patrón de referencia: `examples/d1/app/api/notes/route.ts`):

```ts
// app/api/v1/teachers/route.ts
import { getDb } from "../../../../db";
import { docente } from "../../../../db/schema";
import { asc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const db = getDb();                       // solo dentro del runtime Worker
    const rows = await db.select().from(docente).orderBy(asc(docente.apellidos)).limit(100);
    return Response.json({ teachers: rows });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

Los contratos HTTP ya están definidos en `docs/API-Y-ARQUITECTURA.md`
(`GET /api/v1/teachers`, `POST /api/v1/teachers`, `POST /api/v1/teachers/:id/merits`,
`POST /api/v1/applications/:id/evaluations`, `GET /api/v1/calls/:id/ranking`, …).

### Paso 4 · Implementar el adaptador HTTP de los puertos

`src/application/ports.ts` define 6 interfaces. El adaptador habla HTTP en vez de IndexedDB:

```ts
// src/infrastructure/http.ts
import type { Repositories, Workspace } from "../application/ports";
import type { DocumentFile, Teacher } from "../domain/models";

const BASE = "/api/v1";

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? `HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const httpRepositories: Repositories = {
  workspace: {
    read: async () => (await json<Workspace | null>("/session/workspace")) ?? undefined,
    // el servidor devuelve 409 si la revisión no coincide (If-Match / expectedVersion)
    commit: async (next, expectedRevision, documents = []) => {
      await json("/session/workspace", {
        method: "PUT",
        body: JSON.stringify({ workspace: next, expectedRevision, documents }),
      });
    },
  },
  documents: { get: id => json<DocumentFile>(`/files/${id}`) },
  teachers:   { list: async () => (await json<Teacher[]>("/teachers")).teachers },
  dossiers:   { list: async () => (await json<Teacher[]>("/teachers")).merits },
  requests:   { list: async () => (await json<ApplicationRequest[]>("/applications")).applications },
  evaluations:{ list: async () => (await json<Evaluation[]>("/evaluations")).evaluations },
};
```

### Paso 5 · Inyectar el adaptador (IoC)

```ts
// src/composition.ts
import { LegajoService } from "./application/service";
// import { browserRepositories } from "./infrastructure/indexeddb";  // fase actual
import { httpRepositories } from "./infrastructure/http";             // fase con servidor
import { seed } from "./infrastructure/seed";

export const legajoService = new LegajoService(httpRepositories, seed);
```

> Regla de la arquitectura: **el dominio y los casos de uso no cambian**. Solo se cambia el
> adaptador que se inyecta en `composition.ts`. Por eso `db/` no altera el prototipo.

### Paso 6 · Verificar

```bash
npm run dev
curl http://localhost:5173/api/v1/teachers
npm test          # 27 pruebas unitarias/integración
npm run test:e2e  # 8 recorridos de navegador
```

---

## 4. Ruta B · SQLite local en Node (para desarrollo y pruebas)

Útil si se quiere levantar la BD sin Cloudflare (por ejemplo en un PC de la UNP).

```bash
npm i better-sqlite3 @types/better-sqlite3
```

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "sqlite",
  dbCredentials: { url: "file:./data/legajos.db" },
});
```

```bash
npx drizzle-kit push                       # crea las tablas desde db/schema.ts
npx wrangler d1 execute site-creator-d1 --local --file ./drizzle/0000_legajo_promocion_unp.sql  # triggers
```

Cliente:

```ts
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../db/schema";

const sqlite = new Database("data/legajos.db");
sqlite.pragma("foreign_keys = ON");
export const db = drizzle(sqlite, { schema });
```

> `db/index.ts` importa `cloudflare:workers`, así que **solo** funciona en el runtime de
> Workers. En Node hay que usar el cliente de arriba (o `@libsql/client` para Turso/libSQL).

## 5. Ruta C · PostgreSQL (si la UNP lo exige)

El anexo B del análisis ya define la variante PostgreSQL. El trabajo es:

1. Crear `db/schema.pg.ts` con `drizzle-orm/pg-core` (mismas 35 tablas, tipos nativos:
   `uuid`, `boolean`, `timestamptz`, `date`, `numeric`, `jsonb`, `enum`).
2. Portar los triggers a funciones PL/pgSQL (`CREATE FUNCTION ... RETURNS trigger`).
3. Cambiar `drizzle.config.ts` a `dialect: "postgresql"` y `db:generate` / `db:migrate`.
4. Cambiar el cliente en `db/index.ts` a `drizzle-orm/node-postgres` o `postgres-js`.

El resto de la aplicación (dominio, casos de uso, UI) **no cambia**.

---

## 6. Qué protege la base y el navegador no

Estos triggers del DDL son la diferencia real entre la demo y el sistema institucional:

| Regla | Implementación en SQL |
|---|---|
| **RN09** Rúbrica aprobada es inmutable | `trg_rubrica_no_update` / `trg_rubrica_no_delete` (`WHEN OLD.aprobada_en IS NOT NULL`) |
| Evaluación cerrada es inmutable | `trg_evaluacion_no_update/no_delete` + tablas `evaluacion_criterio`, `evaluacion_requisito`, `evaluacion_evidencia` |
| Auditoría inmutable | `trg_auditoria_evento_no_update/no_delete`, `trg_auditoria_cambio_no_update/no_delete` |
| Historial inmutable | `trg_revision_merito_no_update/no_delete`, `trg_propuesta_evento_no_update/no_delete`, `trg_propuesta_orden_merito_no_update/no_delete` |
| **RN01** Solo se promueve a la categoría inmediata superior | `trg_solicitud_categoria_ins` / `trg_solicitud_categoria_upd` |
| Solo se evalúa una solicitud presentada | `trg_evaluacion_solo_presentada` |
| **RN18** Una plaza no admite dos propuestas activas | índice parcial `ux_propuesta_plaza_activa` (`WHERE estado <> 'denegada'`) |
| Concurrencia optimista | triggers `trg_*_tocar` que exigen cambiar `actualizado_en`/`actualizada_en` |
| Idempotencia de cierre | `evaluacion.clave_idempotencia` UNIQUE |
| Integridad referencial | FKs + `PRAGMA foreign_keys = ON` en cada conexión |

En el navegador estas reglas se comprueban en TypeScript (`src/application/service.ts`),
por lo que **un usuario puede manipular sus datos locales**. Solo el servidor es frontera
de seguridad.

---

## 7. Archivos (R2) y sesiones (OIDC)

| Necesidad | Solución | Estado |
|---|---|---|
| Archivos privados | binding R2 (`"r2": "BUCKET"` en `.openai/hosting.json`) + metadatos en `documento` (`clave_almacenenamiento`, `hash_sha256`, `version`, `reemplaza_a`) | Fuera de alcance del prototipo |
| Identidad real | OIDC institucional → `usuario.sub_externo` + `asignacion_rol` + `rol` | Fuera de alcance (hoy simulado con `t1`) |
| Autorización | Permisos por rol **y** unidad (`asignacion_rol.facultad_id`, `departamento_id`) | Solo validaciones de perfil en cliente |

---

## 8. Orden de trabajo sugerido (si se decide la fase con servidor)

1. **Activar el binding** (`.openai/hosting.json` → `"d1": "DB"`) y aplicar el DDL.
2. **Crear la API de lectura** `GET /api/v1/teachers`, `/legajos/:id`, `/evaluations` con Drizzle.
3. **Escribir el adaptador HTTP** que implemente `Repositories` (`src/infrastructure/http.ts`).
4. **Cambiar `composition.ts`** y validar que las pantallas siguen igual (el dominio no se toca).
5. **Migrar las escrituras** una a una (méritos → solicitudes → evaluaciones → propuestas),
   respetando `expectedRevision`/`If-Match` → **409** en conflicto.
6. **Activar R2 + OIDC** y mover la verificación al servidor.
7. **Adaptar las pruebas**: las unitarias siguen igual (el dominio no cambia); las E2E pasan a
   usar cuentas de prueba reales.

---

## 9. Comandos útiles

```bash
npm run dev             # desarrollo (localhost:5173)
npm run db:generate     # genera migraciones Drizzle desde db/schema.ts
npm test                # 27 pruebas unitarias/integración (fake-indexeddb)
npm run test:e2e        # 8 recorridos Playwright
npm run typecheck       # TypeScript sin emitir
npm run build           # compila (copia drizzle/ a dist/.openai/drizzle para el despliegue)
```

### Referencias

- `docs/API-Y-ARQUITECTURA.md` — contratos HTTP, autenticación, permisos, cierre de evaluación.
- `docs/PLAN-ALINEACION-ANALISIS-V2.md` — plan de alineación con el Análisis v2.0.
- `docs/TRAZABILIDAD.md` — RF/CUS ↔ módulos ↔ tablas.
- `drizzle/0000_legajo_promocion_unp.sql` — DDL con triggers y catálogos.
- `db/schema.ts` — esquema Drizzle de las 35 tablas.
