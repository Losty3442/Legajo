# Validación de PostgreSQL · 10 de noviembre de 2026

## Datos reales conservados

Origen: Chrome, perfil The, `http://localhost:5173`. Huella del paquete original:

`25e6faa35ae687c183e39e9b94056edd938610104652eddc37fc4212968e5297`

| Colección | Origen / PostgreSQL |
|---|---:|
| Docentes | 6 / 6 |
| Méritos | 24 / 24 |
| Solicitudes | 4 / 4 |
| Evaluaciones cerradas | 0 / 0 |
| Documentos | 24 / 24 |
| Bytes documentales | 18 800 / 18 800 |

`npm run db:verify` comparó las colecciones completas, incluidos revisiones, observaciones, trayectoria, rúbricas, convocatorias y auditoría, además de los nombres, tipos y SHA-256 de todos los documentos. Coinciden con el paquete importado. El origen y su copia se conservaron sin cambios.

La rúbrica no contenía aprobación comprobable y permanece como borrador. Los responsables ausentes se representan mediante referencias técnicas inactivas; las comisiones están rotuladas como demostración.

## Pruebas

- **27/27 originales**: reglas, rúbricas, históricos, promoción, archivos e IndexedDB en memoria.
- **8/8 API PostgreSQL**: autenticación y logout; identidad manipulada y legajo ajeno; recuperación de conexión interrumpida; revisión y filas afectadas; alta con cuenta; concurrencia; documentos y versiones; evaluación idempotente y propuestas por cada instancia; rúbricas inmutables; respaldo repetido, referencias, importación v1 sin aprobaciones inventadas y rollback sin datos parciales.
- **5/5 navegador**: trámite completo de propuesta; nueva convocatoria y trayectoria; evidencia observada/corregida/verificada, solicitud y evaluación; alta y lectura desde otro navegador; error recuperable sin retorno a IndexedDB.
- **TypeScript**: comprobación sin errores.
- **Compilación**: frontend Vinext/Sites y backend Node completados.

Integración: `legajos_unp_test`, puertos 5183/5184, `.local/test-data` y credenciales independientes. La suite comprueba el nombre de la base antes de reiniciar su esquema. Edge ejecutó los recorridos y Chrome verificó la persistencia compartida. No se utilizó el perfil real de Chrome.

La interrupción de conexión se probó terminando solo conexiones inactivas del mismo usuario técnico en la base de pruebas, sin detener PostgreSQL ni afectar otras bases. El backend siguió atendiendo y volvió a consultar los datos correctamente.

## Operación y artefactos

- `npm start`: página y login con HTTP 200; API conectada a `legajos_unp`, conteos 6/24/4.
- `npm stop`: cierre confirmado de los puertos 5173 y 5174.
- Reinicio posterior en 5175/5176 porque 5173 estaba ocupado por otro proyecto: página y acceso HTTP 200, misma base `legajos_unp` y coincidencia con el respaldo original de los registros y los 24 documentos.
- `db:setup`: segunda ejecución conservó la base, los roles y el checksum de la migración.
- `db:backup`: dump consistente y 24 documentos con hashes comprobados, manifiesto y ZIP portable.
- 13 contraseñas iniciales diferentes, archivos privados excluidos de Git y ausencia de esos secretos en la compilación del frontend.
- Rutas privadas `.env.local`, `.local` y `data` bloqueadas por HTTP.
- PlantUML generado del catálogo real: **40 tablas y 82 claves foráneas**, incluidas 35 tablas del dominio; SVG renderizado y validado.

Instrucciones: [OPERACION-POSTGRESQL.md](OPERACION-POSTGRESQL.md). Contratos: [API-Y-ARQUITECTURA.md](API-Y-ARQUITECTURA.md).

## Actualización v4 · 25 de noviembre de 2026

- PostgreSQL registró las cuatro migraciones, de `0000` a `0003`. El PlantUML y el SVG se regeneraron con el catálogo actualizado.
- Pasaron las 27 pruebas de dominio e IndexedDB, las 9 de API PostgreSQL y las 6 de navegador. La suite de PostgreSQL usó `legajos_unp_test` y cubrió el alta de plazas, la rúbrica UNP y la persistencia de evidencias.
- La comprobación de tipos y la compilación de Vinext y Express terminaron correctamente.
- `db:backup` generó un respaldo local de 85 docentes, 340 méritos y 340 documentos. `db:verify` confirmó que los registros y archivos coinciden, incluidos sus SHA-256. La copia contiene cero solicitudes y evaluaciones.
