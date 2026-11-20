> **Actualización · 10 de noviembre de 2026:** la migración PostgreSQL ya está implementada. Estado y comandos vigentes: [Operación local](OPERACION-POSTGRESQL.md), [API implementada](API-Y-ARQUITECTURA.md) y [diagrama PostgreSQL](diagramas/postgresql-legajos-unp.puml). El contenido siguiente describe la preparación anterior.

# Migración del sistema de legajos UNP a una base de datos de servidor

## Recomendación para este proyecto

Recomiendo **PostgreSQL** para continuar el sistema de legajos y promoción docente. El proyecto tiene datos relacionados, rúbricas versionadas, evaluaciones inmutables, auditoría y operaciones que deben guardarse juntas. PostgreSQL ofrece los tipos, restricciones y transacciones necesarios, además de índices parciales útiles para la regla de una propuesta activa por plaza. Esta es una recomendación para este proyecto; los tres motores pueden resolver su carga académica.

| Opción | Cuándo elegirla | Valoración para tu proyecto |
|---|---|---|
| PostgreSQL | Quieres continuar con React/TypeScript, un modelo relacional con reglas e historial y despliegue independiente. | Mi primera opción. Es libre y de código abierto; admite JSONB, tipos nativos e índices parciales. |
| MariaDB/MySQL | Prefieres aprovechar XAMPP y phpMyAdmin y ya manejas ese entorno. | Alternativa válida. Necesita adaptar el esquema SQLite, los triggers y el índice de propuestas activas al motor y versión elegidos. Puedes conectarlo desde Node; no exige reescribir la aplicación en PHP. |
| SQL Server | Tu docente o institución lo exige, o trabajarás con herramientas Microsoft. | También válido. Debes adaptar tipos y T-SQL y revisar la edición: Developer es para desarrollo/pruebas; Express es gratuita y tiene límites que dependen de la versión. |

**Dos aclaraciones:** XAMPP distribuye MariaDB desde hace años, aunque su panel conserve el nombre «MySQL». `psql` es el cliente de terminal de PostgreSQL; tener ese cliente no confirma por sí solo que el servicio de base de datos esté instalado y encendido.

## Qué existe ahora

- `src/infrastructure/indexeddb.ts` abre la base local `unp-legajos-demo`. `workspace["current"]` contiene el estado JSON y `documents` contiene archivos como `Blob`.
- `src/composition.ts` inyecta `browserRepositories` en `LegajoService`; las operaciones siguen ejecutándose en el navegador.
- `db/schema.ts` define **35 tablas** con `drizzle-orm/sqlite-core`.
- `drizzle/0000_legajo_promocion_unp.sql` contiene el esquema de **SQLite / Cloudflare D1**, sus índices, triggers y catálogos. No puede ejecutarse directamente en PostgreSQL, MariaDB/MySQL o SQL Server.
- `db/index.ts` espera un binding de Cloudflare D1 (`env.DB`). No es un cliente PostgreSQL.
- `docs/API-Y-ARQUITECTURA.md` describe los endpoints futuros; el proyecto todavía no implementa esa API.
- La ejecución actual incluye Vinext y Cloudflare Workers. Instalar `pg` o cambiar `drizzle.config.ts` no completa la conexión de la aplicación.

**Resultado buscado:** navegador React → API con sesión y reglas de negocio → PostgreSQL. Los documentos se guardan en almacenamiento privado; la tabla `documento` conserva sus metadatos y la clave de almacenamiento.

## Ruta recomendada

### 1. Respaldar la información del navegador

Abrir la aplicación en el mismo origen y perfil donde se usó: por ejemplo, `http://localhost:5173`. Exportar el registro `workspace["current"]` de IndexedDB y todos los registros de `documents`, conservando su ID, nombre, tipo y contenido binario.

No basta con aplicar `JSON.stringify` al workspace: los `Blob` no se convierten en archivos recuperables mediante esa operación. Una exportación adecuada es un ZIP con `workspace.json`, un manifiesto y los archivos binarios. Si existen datos en varios navegadores u orígenes, cada almacenamiento necesita su propia exportación y conciliación.

### 2. Comprobar PostgreSQL y crear una base vacía

Desde SQL Shell (`psql`) o, si está en el PATH, PowerShell:

```powershell
psql -h localhost -U postgres -d postgres
```

Dentro de `psql`:

```sql
SELECT version();
CREATE ROLE legajo_owner LOGIN;
\password legajo_owner
CREATE DATABASE legajos_unp OWNER legajo_owner ENCODING 'UTF8';
\q
```

`\password` es un comando de `psql` que solicita la contraseña. Para comprobar la nueva base:

```powershell
psql -h localhost -U legajo_owner -d legajos_unp -c "SELECT current_database();"
```

Si `psql` no se reconoce, se puede abrir SQL Shell desde el menú Inicio o usar el ejecutable de la carpeta `bin` de la instalación. Si no conecta, comprobar el servicio, host, puerto y credenciales. No se necesita iniciar Apache ni XAMPP para PostgreSQL.

### 3. Convertir las 35 tablas a PostgreSQL

Crear `db/schema.pg.ts` con `drizzle-orm/pg-core`, manteniendo las relaciones del diagrama. Conservar la variante SQLite y usar otra carpeta de migraciones, por ejemplo `drizzle-pg/`.

| Dato | En el esquema actual SQLite | En la variante PostgreSQL |
|---|---|---|
| ID de entidades | `text` | `uuid`; requiere convertir IDs demo como `t1`, `v1` y `s1` |
| ID de catálogos | `integer` | `integer` |
| Secuencias de historial y auditoría | `integer PRIMARY KEY AUTOINCREMENT` | `bigint GENERATED ... AS IDENTITY` |
| Valores lógicos | `integer` 0/1 | `boolean` |
| Fecha de calendario | `text` | `date` |
| Fecha y hora de un evento | `text` ISO | `timestamptz` |
| Puntajes | `real` | `numeric`, con precisión/escala definidas por las reglas; evitar redondear resultados históricos al importar |
| Instantáneas y cambios antes/después | `text` con `json_valid` | `jsonb` |
| Estados y categorías de texto | `text` con `CHECK` | `text` con `CHECK` o enums definidos en PostgreSQL |
| Otros textos | `text` | `text` o `varchar` según límites de negocio |

Reescribir `strftime`, `randomblob`, `json_valid`, `GLOB`, `RAISE(ABORT, ...)` y los triggers SQLite. Los triggers PostgreSQL necesitan funciones apropiadas, normalmente en PL/pgSQL. Conservar el bloqueo de rúbricas aprobadas, la inmutabilidad de las evaluaciones y auditoría, la promoción a la categoría inmediata y la idempotencia del cierre.

La regla de propuesta activa puede conservar un índice parcial equivalente:

```sql
CREATE UNIQUE INDEX ux_propuesta_plaza_activa
ON propuesta (plaza_id)
WHERE estado <> 'denegada';
```

El esquema fuente permite **una evaluación por solicitud** mediante `UNIQUE (solicitud_id)`. Si se desea permitir varios cierres para distintas presentaciones, primero debe diseñarse la entidad de presentación y su clave; el diagrama entregado conserva la restricción actual.

### 4. Implementar el servidor y sus migraciones

Para aprovechar el frontend actual, una opción concreta es añadir una **API Node.js independiente** con Drizzle y `pg`. Así el proceso Node mantiene las conexiones PostgreSQL y el frontend consume sus endpoints. Si se prefiere usar las rutas del servidor actual sobre Workers, hay que diseñar y probar la conexión compatible con ese runtime; no basta con pegar un cliente Node en `db/index.ts`.

Los siguientes comandos son para el paquete del backend que se cree, no una migración ya incorporada al repositorio:

```powershell
npm.cmd install drizzle-orm pg
npm.cmd install -D drizzle-kit @types/pg
```

Configurar `DATABASE_URL` en el entorno privado de ese backend, por ejemplo con el formato:

```text
postgresql://legajo_owner:CONTRASENA_CODIFICADA@localhost:5432/legajos_unp
```

No usar un prefijo `NEXT_PUBLIC_`. El proceso servidor y Drizzle Kit deben cargar la variable; un archivo `.env` no se carga automáticamente en todos los procesos. Para la aplicación desplegada, usar un usuario de ejecución con los permisos necesarios y reservar el propietario para migraciones.

Crear una configuración separada como `drizzle.pg.config.ts` con:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.pg.ts",
  out: "./drizzle-pg",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Cuando existan el esquema y la variable cargada, generar las migraciones con `npx.cmd drizzle-kit generate --config=drizzle.pg.config.ts`, revisar el SQL e incorporar las funciones/triggers mediante migraciones personalizadas. Aplicarlas con `npx.cmd drizzle-kit migrate --config=drizzle.pg.config.ts`.

El script actual `npm run db:generate` usa la configuración SQLite existente; no se convierte en PostgreSQL con solo instalar el driver.

Implementar primero sesión y lectura de docentes/legajos; después registro y revisión de méritos, convocatorias, solicitudes, cierre de evaluación y propuestas. Los contratos propuestos ya están en `docs/API-Y-ARQUITECTURA.md`.

Las validaciones, permisos y cálculo autoritativo deben ejecutarse en el servidor. El cierre de evaluación y el trámite de propuesta necesitan transacciones; las actualizaciones deben comprobar una versión esperada y devolver conflicto cuando otro usuario se adelantó. Cambiar una fecha de actualización no sustituye el control de concurrencia.

### 5. Importar los datos existentes

Crear un importador que transforme las colecciones del workspace en filas, sin guardar todo como un único JSON mutable:

| Origen | Destino principal |
|---|---|
| Facultad/departamento de docentes y plazas | `facultad`, `departamento_academico` |
| Cuentas y roles autorizados | `usuario`, `rol`, `asignacion_rol` |
| `teachers` | `docente`, `legajo`, catálogos de categoría y dedicación |
| `documents` | Archivos privados y metadatos en `documento` |
| `merits` y `reviews` | `merito`, `revision_merito`, `tipo_merito` |
| `experiences` | `experiencia_laboral` |
| `rubrics` y rúbricas de instantáneas | `rubrica`, `rubrica_criterio`, `rubrica_requisito` |
| `vacancies` y `calls` | `plaza`, `convocatoria`, `convocatoria_plaza` |
| `requests` | `solicitud_promocion`, `expediente_item`, observaciones/historial que puedan reconstruirse |
| `evaluations` | `evaluacion`, detalles por criterio/requisito/evidencia e instantáneas históricas |
| `proposals` | `propuesta`, `propuesta_orden_merito`, `propuesta_evento` |
| `audit` | `auditoria_evento`, `auditoria_cambio` |

Mantener un mapa estable `tipo + ID antiguo → ID nuevo` para actualizar todas las FKs y reconocer las referencias que aparezcan en instantáneas. Conservar el mapa y la exportación original como evidencia de la importación. Los roles simulados y el usuario `seed` no equivalen a identidades institucionales verificadas.

El prototipo no contiene todos los datos obligatorios del servidor: por ejemplo, la comisión que cerró una evaluación, el usuario que subió un archivo o determinados códigos de convocatoria y plaza. El importador debe producir un informe de faltantes y aplicar una política explícita para datos demo o legados; no inventar autores ni aprobaciones oficiales. Importar solo rúbricas que existan en su versión histórica y preservar los puntajes cerrados.

Orden general: organización y catálogos → usuarios/roles → docentes/legajos → documentos → méritos/experiencias y revisiones → rúbricas/criterios/requisitos → plazas/convocatorias/comisiones → solicitudes/expedientes → evaluaciones/detalles → propuestas/eventos → auditoría. Ajustar el orden por las FKs, las cadenas de reemplazo documental y los triggers. No desactivar indiscriminadamente las reglas para forzar datos inválidos.

Verificar hash SHA-256, tamaño y presencia de cada archivo antes de referenciarlo. Los binarios pueden guardarse en una carpeta privada del servidor para la demostración o en un almacén de objetos para el despliegue. No colocarlos en `public/` si requieren autorización.

### 6. Cambiar el frontend a la API

Mover los casos de uso autoritativos de `LegajoService` al backend y crear una fachada HTTP compatible con las operaciones que consumen las pantallas. Adaptar `src/composition.ts` y el proveedor de presentación para usarla y obtener la sesión real.

`WorkspaceRepository.commit` actual sustituye el snapshot completo. En servidor debe convertirse en comandos y transacciones por operación; no conviene enviar toda la base del navegador para sobrescribir la base compartida. Subir documentos mediante `multipart/form-data` u otro protocolo binario; serializar `Blob` dentro de JSON no implementa la carga.

Para conservar URLs `/api/v1/...`, configurar un proxy al backend o publicar frontend y API bajo el mismo origen. Si se usan orígenes distintos, definir CORS y el manejo de la sesión expresamente.

### 7. Validar antes de cambiar de almacenamiento

- Comparar conteos por entidad, relaciones y hashes de archivos con la exportación.
- Probar registrar docente, subir evidencia, observar/corregir/verificar, presentar solicitud, cerrar evaluación y tramitar propuesta.
- Confirmar que una evaluación cerrada y una rúbrica aprobada no se modifican y que dos cierres/propuestas concurrentes respetan las restricciones.
- Abrir la aplicación desde otro navegador con la misma cuenta y comprobar que consulta los datos del servidor.
- Mantener el respaldo original hasta terminar la validación de la importación.

## Diagramas PlantUML entregados

- [Modelo completo en PlantUML](diagramas/base-datos-unp-completo.puml): **35 tablas, 266 columnas y 78 FKs**, agrupadas en seis módulos. Incluye PK, FK, campos obligatorios y unicidad individual.
- [Modelo completo en SVG](diagramas/base-datos-unp-completo.svg): imagen vectorial para ampliar.
- [Vista resumida en PlantUML](diagramas/base-datos-unp-resumen.puml): 14 tablas del flujo principal, con campos y relaciones seleccionados.
- [Vista resumida en SVG](diagramas/base-datos-unp-resumen.svg).

Los nombres, tipos y relaciones corresponden al **SQL SQLite/D1 existente**, no a una migración PostgreSQL ya aplicada. Para PostgreSQL se conserva el modelo lógico y se convierten los tipos y reglas según esta guía. Los diagramas no sustituyen el DDL: no detallan todos los `CHECK`, índices, unicidades compuestas ni triggers.

Las cardinalidades muestran lo que permiten FK, nulabilidad y claves únicas. Por ejemplo, cada legajo pertenece a un docente y un docente puede tener cero o un legajo desde el punto de vista de las restricciones; crearlo siempre junto con el docente es una regla de la operación de alta. Las relaciones muchos-a-muchos usan tablas intermedias como `convocatoria_plaza` y `expediente_item`.

Se verificó la sintaxis con PlantUML y se contrastó el diagrama completo con las tablas/columnas/FKs del SQL ejecutado en SQLite en memoria. No se ha cambiado la persistencia de la aplicación ni se ha conectado a una instancia PostgreSQL.

## Fuentes oficiales

- [PostgreSQL: descripción y características](https://www.postgresql.org/about/).
- [PostgreSQL: índices parciales](https://www.postgresql.org/docs/current/indexes-partial.html).
- [PostgreSQL: cliente psql](https://www.postgresql.org/docs/current/app-psql.html).
- [XAMPP: MariaDB en lugar de MySQL](https://www.apachefriends.org/es/faq_windows.html).
- [SQL Server: ediciones y características](https://learn.microsoft.com/en-us/sql/sql-server/editions-and-components-of-sql-server-latest?view=sql-server-ver15).
- [Drizzle: conexión PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql).
- [PlantUML: diagramas de ingeniería de información](https://plantuml.com/ie-diagram).
