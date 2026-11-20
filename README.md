# Legajo UNP · PostgreSQL local

Aplicación académica de legajos y promoción docente de la Universidad Nacional de Piura. React/Vinext conserva la presentación y la integración de Sites; Express ejecuta las reglas y consulta PostgreSQL mediante `pg` y Drizzle. Funciona únicamente en esta PC.

## Iniciar y entrar

Requisitos: Node.js 22.13 o superior, PostgreSQL 18 encendido y las dependencias instaladas (`npm.cmd ci`). La preparación e importación inicial de esta PC ya están realizadas.

```powershell
npm.cmd run dev
```

Abre **http://localhost:5173**. El frontend interno usa el puerto 5174; la API y las páginas comparten el origen 5173. Para ejecutar la versión compilada:

```powershell
npm.cmd run build
npm.cmd start
```

`Ctrl+C` detiene ambos componentes. También puedes ejecutar `npm.cmd stop` desde esta carpeta. Detén la instancia anterior antes de cambiar entre desarrollo y versión compilada.

Las 13 cuentas iniciales y sus claves individuales están en **`.local/CREDENCIALES-LEGAJO.md`**, privado y excluido de Git. Son cuentas locales de prueba. El servidor verifica la contraseña con scrypt y conserva sesiones de ocho horas mediante cookies HttpOnly/SameSite. El alta de un docente crea su cuenta y muestra la clave inicial una sola vez al personal que lo registró.

## Datos conservados

Base `legajos_unp`, servidor PostgreSQL local, conexión **legajo** de pgAdmin. Si no aparece, actualiza el nodo Databases. Se conservaron 6 docentes, 24 méritos, 4 solicitudes y 24 documentos del perfil **The de Chrome**, origen `http://localhost:5173`.

Respaldo original: `.local/backups/chrome-legacy-20261110-162412/legajo-chrome-backup.zip`. La copia de los archivos de IndexedDB también está en esa carpeta. El origen permanece intacto. Los documentos activos están en `data/documents`, fuera de `public`, con propietario, versión, tamaño y SHA-256.

La rúbrica heredada no tenía una aprobación registrada: se conserva como borrador de simulación. Legajos puede revisarla y aprobarla desde **Rúbrica de ejemplo**. No se inventó una aprobación institucional. Las comisiones son de demostración local.

## Comandos

| Comando | Uso |
|---|---|
| `npm run dev` | API y frontend con recarga durante desarrollo |
| `npm run build` / `npm start` | Compilar / ejecutar ambos componentes localmente |
| `npm stop` | Solicitar el cierre conjunto de esta instancia |
| `npm run typecheck` | Comprobación de tipos |
| `npm test` | 27 pruebas originales de dominio e IndexedDB en memoria |
| `npm run test:postgres` | Integración y navegador sobre `legajos_unp_test`, puertos 5183/5184 |
| `npm run test:e2e` | Solo los recorridos de navegador de PostgreSQL |
| `npm run db:backup` | Respaldo consistente de la base y documentos, con manifiesto y ZIP portable |
| `npm run db:verify -- ruta.zip` | Comparar la base con el respaldo importado, sin modificarla |
| `npm run db:diagram` | Regenerar PlantUML desde el catálogo PostgreSQL real |
| `npm run db:setup` | Preparar roles/base y aplicar migraciones pendientes |
| `npm run db:accounts` | Crear solo las cuentas iniciales que falten |
| `npm run db:import -- ruta.zip` | Importación inicial controlada; no sobrescribe otra copia |

Las pruebas PostgreSQL reinician exclusivamente `legajos_unp_test` y comprueban el nombre antes de modificarla. Deben ejecutarse con la aplicación detenida: Vinext mantiene un bloqueo de desarrollo por proyecto. El directorio documental de pruebas es `.local/test-data`.

## Configuración y respaldo

`.env.local` contiene las conexiones privadas del propietario y de la aplicación; no se envía al cliente ni se incluye en Git. `legajo_owner` aplica migraciones y crea respaldos. `legajo_app` tiene permisos de datos, sin administración ni DDL. El usuario administrador de PostgreSQL solo se utilizó en la preparación. Las cuentas técnicas de pruebas son independientes.

`npm run db:backup` genera `data/backups/postgres-<fecha>/` con `database.dump`, `documents/`, `manifest.json` y `legajo-backup.zip`, usando una misma instantánea PostgreSQL. Conserva también `.env.local` y las credenciales privadas en tu copia de seguridad protegida. La restauración y sus comprobaciones están explicadas en [OPERACION-POSTGRESQL.md](docs/OPERACION-POSTGRESQL.md).

## Arquitectura y esquema

- [API implementada](docs/API-Y-ARQUITECTURA.md)
- [Resultados de validación PostgreSQL](docs/VALIDACION-POSTGRESQL.md)
- [Operación, preparación y recuperación](docs/OPERACION-POSTGRESQL.md)
- [Diagrama PostgreSQL completo · PlantUML](docs/diagramas/postgresql-legajos-unp.puml)
- [Diagrama renderizado · SVG](docs/diagramas/postgresql-legajos-unp.svg)
- `db/schema.pg.ts` y `drizzle-pg/0000_legajos.sql`: 35 tablas del dominio, cuatro auxiliares y control de migraciones.
- `db/schema.ts` y `drizzle/`: esquema SQLite/D1 conservado como referencia e integración de Sites; no se usa para la persistencia local activa.

Cada comando escribe solo las filas afectadas y su auditoría dentro de una transacción. PostgreSQL protege los históricos, las rúbricas aprobadas, la categoría inmediata superior y la unicidad de propuestas por plaza. Los conflictos de revisión devuelven HTTP 409 y los cierres admiten reintentos idempotentes.

Los datos, reglas y decisiones son una simulación académica; no conceden ascensos ni acreditan designaciones institucionales. No hay publicación en Internet ni integración institucional OIDC. El MCP PostgreSQL sigue siendo de solo lectura.
