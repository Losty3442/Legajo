# Legajo UNP · PostgreSQL local

Aplicación académica de legajos y promoción docente de la Universidad Nacional de Piura. React/Vinext sirve la interfaz y Express ejecuta las reglas sobre PostgreSQL mediante `pg` y Drizzle. La aplicación escucha en localhost y se puede replicar en otra PC [mediante un USB](docs/INSTALACION-SIN-INTERNET.md).

## Iniciar y entrar

Requisitos: Node.js 22.13 o superior, PostgreSQL 18 y las dependencias instaladas (`npm.cmd ci`). Para una instalación nueva o para aplicar las migraciones de una actualización, sigue la [guía de operación de PostgreSQL](docs/OPERACION-POSTGRESQL.md).

```powershell
npm.cmd run dev
```

Abre **http://localhost:5173**. El frontend interno usa el puerto 5174; la API y las páginas comparten el origen 5173. Para ejecutar la versión compilada:

```powershell
npm.cmd run build
npm.cmd start
```

`Ctrl+C` detiene ambos componentes. También puedes ejecutar `npm.cmd stop` desde esta carpeta. Detén la instancia anterior antes de cambiar entre desarrollo y versión compilada.

El comando `npm.cmd run db:accounts` genera las cuentas iniciales que falten y sus claves en **`.local/CREDENCIALES-LEGAJO.md`**, excluido de Git. Son cuentas locales de prueba. El servidor verifica la contraseña con scrypt y conserva sesiones de ocho horas mediante cookies HttpOnly/SameSite. El alta de un docente crea su cuenta y muestra la clave inicial una sola vez al personal que lo registró.

## Legajo y evaluación

- La ficha docente admite la categoría B, las dedicaciones B1/B2 y las clasificaciones pendientes. Los antecedentes de SIGED conservan su procedencia y pueden consultarse desde el legajo.
- Personal de Legajos registra plazas y las asocia a una convocatoria. Cada convocatoria conserva la versión aprobada de su rúbrica.
- La rúbrica de simulación `UNP-0210-CU-2015-SIM-v1` toma como referencia la tabla de provisión de plazas docentes. El sistema calcula el mayor grado verificado y la comisión registra y sustenta las calificaciones por criterio. Los cierres conservan la rúbrica, el puntaje y la evidencia utilizada.

## Datos y migraciones

PostgreSQL guarda los datos en `legajos_unp`. Los documentos activos se almacenan en `data/documents` con propietario, versión, tamaño y SHA-256. El respaldo del navegador y la validación de la importación inicial están descritos en [Validación de PostgreSQL](docs/VALIDACION-POSTGRESQL.md).

Las migraciones `0001` a `0003` incorporan la clasificación docente, los antecedentes de SIGED y los tipos de evidencia de la rúbrica. Aplica las migraciones pendientes con `npm.cmd run db:setup`. El repositorio incluye el esquema y sus migraciones. Cada instalación conserva sus datos, adjuntos y credenciales en archivos locales.

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
- [Instalación sin internet desde un USB](docs/INSTALACION-SIN-INTERNET.md)
- [Guía de sustentación](docs/GUIA-SUSTENTACION-ACTUALIZADA.md)
- [Análisis del sistema v4](docs/Analisis_legajo_promocion_UNP_v4.pdf)
- [Modelo v4 de Rational Rose](docs/SISTEMA_DE_LEGAJOS_COMPLETO_ORDENADO_v4.mdl)
- [Diagrama PostgreSQL completo · PlantUML](docs/diagramas/postgresql-legajos-unp.puml)
- [Diagrama renderizado · SVG](docs/diagramas/postgresql-legajos-unp.svg)
- [Vistas relacionales v4 · PlantUML](docs/diagramas/postgresql-legajos-unp-v4.puml)
- `db/schema.pg.ts` y `drizzle-pg/` describen 35 tablas del dominio, cuatro auxiliares y el control de migraciones.
- `db/schema.ts` y `drizzle/`: esquema SQLite/D1 conservado como referencia e integración de Sites; no se usa para la persistencia local activa.

Cada comando escribe solo las filas afectadas y su auditoría dentro de una transacción. PostgreSQL protege los históricos, las rúbricas aprobadas, la categoría inmediata superior y la unicidad de propuestas por plaza. Los conflictos de revisión devuelven HTTP 409 y los cierres admiten reintentos idempotentes.

Los datos, reglas y decisiones corresponden a una simulación académica. El despliegue y la autenticación funcionan de forma local. El MCP PostgreSQL tiene acceso de solo lectura.
