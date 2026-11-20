# Operación local de Legajo UNP

## Estado de esta PC

La base `legajos_unp` está creada en PostgreSQL 18 (`localhost:5432`) y disponible bajo **legajo** en pgAdmin. La conexión conserva `postgres` como base de mantenimiento y su archivo de contraseñas admite también `legajos_unp`. Actualiza Databases si el árbol estaba abierto.

Se importó el respaldo de **Chrome / The / http://localhost:5173**: 6 docentes, 24 méritos, 4 solicitudes, 24 documentos y 0 evaluaciones cerradas en el origen. Se conservaron observaciones, revisiones, trayectoria y auditoría existentes. El respaldo y los archivos originales de IndexedDB permanecen intactos.

La rúbrica heredada carecía de aprobación registrada; se conserva como borrador de simulación. Esa advertencia no significa pérdida de datos. Legajos puede revisar y aprobar la versión para usarla en nuevas convocatorias. Las comisiones locales están identificadas como demostración académica, sin resolución institucional real.

## Uso diario

1. Mantén el servicio PostgreSQL encendido.
2. Desde la carpeta del proyecto ejecuta `npm.cmd run dev`, o `npm.cmd start` después de `npm.cmd run build`.
3. Abre `http://localhost:5173` en Chrome o Edge y usa una cuenta de `.local/CREDENCIALES-LEGAJO.md`.
4. Para detener ambos componentes, usa Ctrl+C o `npm.cmd stop`.

Si otro proyecto ocupa 5173, puedes iniciar Legajo en puertos libres sin detenerlo. Por ejemplo, en PowerShell:

```powershell
$env:PORT = '5175'
$env:FRONTEND_PORT = '5176'
npm.cmd start
```

Abre `http://localhost:5175` e inicia sesión. Se usa la misma base PostgreSQL; no hace falta importar otra vez. Para volver al puerto original, ejecuta `npm.cmd stop`, libera 5173/5174 y vuelve a iniciar desde una terminal nueva. El asistente de migración del navegador sí requiere el origen original `http://localhost:5173` y el perfil que contiene los datos antiguos.

Las altas de docentes crean una cuenta vinculada y muestran la contraseña una sola vez en un diálogo. Entrégala al docente antes de cerrarlo. El archivo privado de credenciales iniciales contiene las 13 cuentas de preparación; no es un registro de las contraseñas de todas las altas posteriores.

## Archivos privados

| Ruta | Contenido |
|---|---|
| `.env.local` | URLs y contraseñas de roles técnicos; excluido de Git |
| `.local/CREDENCIALES-LEGAJO.md` | Accesos iniciales a la aplicación |
| `.local/credenciales-cuentas.json` | Mismos accesos en formato estructurado |
| `.local/backups/chrome-legacy-20261110-162412/` | Copia original de LevelDB/blobs y ZIP portable |
| `data/documents/` | Versiones documentales privadas, nombres derivados de los IDs |
| `data/backups/<huella>.zip` | Paquete original conservado al importar |
| `data/backups/postgres-<fecha>/` | Respaldos completos de PostgreSQL y archivos |

No guardes estas carpetas en Git ni en `public`. La aplicación y el frontend de desarrollo bloquean sus rutas HTTP. Las descargas autorizadas usan `/api/v1/files/:id` y verifican SHA-256. Se conserva cada versión anterior usada en una revisión o evaluación.

## Crear y comprobar un respaldo

```powershell
npm.cmd run db:backup
```

El comando usa `pg_dump` de PostgreSQL 18 (ruta configurable con `PG_DUMP`). Exporta una instantánea consistente compartida con la lectura de documentos. Cada carpeta contiene:

- `database.dump`: formato custom de PostgreSQL, sin propietarios ni grants.
- `documents/`: archivos binarios con sus claves originales.
- `manifest.json`: base, fecha, revisión, versiones, tamaños y SHA-256.
- `legajo-backup.zip`: estado del dominio y documentos en el formato portable del asistente.

Copia la carpeta completa a tu medio de respaldo y conserva separadamente una copia protegida de `.env.local` y las credenciales iniciales. El dump conserva las cuentas con hashes y los datos relacionales. El ZIP portable no exporta contraseñas ni sesiones.

Para comparar una base recién importada con su paquete, sin modificarla:

```powershell
npm.cmd run db:verify -- .local/backups/chrome-legacy-20261110-162412/legajo-chrome-backup.zip
```

Si después agregas o editas registros, usa el ZIP del respaldo más reciente; compararlo con el paquete original mostrará esas diferencias esperadas.

## Recuperación

Prueba primero sobre una base nueva de recuperación. Detén la aplicación antes de restaurar sobre la base activa y conserva un respaldo del estado actual. La restauración sobre una base existente es una operación administrativa distinta de la importación inicial del asistente.

En pgAdmin puedes crear una base vacía de recuperación con propietario `legajo_owner`, abrir **Restore**, elegir `database.dump` y activar **No owner / No privileges**. Alternativamente usa `pg_restore --no-owner --no-acl --dbname=<base-vacía> <database.dump>` con los parámetros de conexión del propietario en variables de entorno, sin poner contraseñas en la línea de comandos.

Copia la carpeta `documents` del respaldo al directorio privado configurado mediante `DATA_DIR`; compara sus hashes con `manifest.json`. Al recuperar la base activa, vuelve a aplicar con el propietario los permisos del rol de aplicación. `npm run db:setup` aplica los grants y verifica las migraciones sin borrar datos; requiere la conexión administrativa solo para comprobar/preparar roles y base. Después verifica el ZIP del mismo respaldo y reinicia la aplicación. No se ejecuta una restauración destructiva automáticamente.

## Preparación en otra instalación local

Instala dependencias con `npm.cmd ci`. Configura temporalmente `PGPASSFILE` con una cuenta administradora local, o `DATABASE_ADMIN_URL` en el entorno; nunca lo añadas al frontend. Ejecuta:

```powershell
npm.cmd run db:setup
npm.cmd run db:accounts
```

`db:setup` crea `legajo_owner`, `legajo_app`, la base y `.env.local` con claves técnicas aleatorias. No cambia contraseñas de roles existentes sin la configuración previa guardada. La aplicación utiliza solo el usuario limitado. Las migraciones aplicadas llevan SHA-256: crea otra migración al evolucionar el esquema y no modifiques el archivo ya aplicado.

Abre `/migracion` con una cuenta de Legajos desde el navegador de origen. Descarga primero el respaldo, revisa el resumen e importa. Si faltan archivos, hashes o referencias, se detiene la operación. Una importación fallida revierte sus filas y archivos nuevos; el respaldo y el origen se mantienen. Una repetición del mismo paquete devuelve su informe anterior. Una copia diferente nunca sobrescribe automáticamente una base inicializada.

## Pruebas

`npm test` conserva las 27 pruebas de dominio. Para preparar la base independiente de integración, define temporalmente `SETUP_DATABASE=legajos_unp_test` al ejecutar `npm run db:setup`; elimina esa variable después. Sus URLs quedan en `.env.local` bajo `TEST_DATABASE_URL` y `TEST_DATABASE_OWNER_URL`.

Con la aplicación detenida, ejecuta `npm run test:postgres`. La suite comprueba el nombre de la base antes de reiniciar su esquema, usa los puertos 5183/5184, documentos en `.local/test-data` y contraseñas de pruebas en `.local/test-accounts`. Nunca reutiliza el perfil Chrome The ni su IndexedDB. La suite requiere Edge y Chrome instalados.

La disponibilidad o el fallo de PostgreSQL se presenta como un error recuperable. No se reinician ejemplos ni se cambia de nuevo a IndexedDB. El uso normal ya no incluye la opción de restaurar/eliminar la demostración.

## Diagrama

`docs/diagramas/postgresql-legajos-unp.puml` se genera desde el catálogo real: 40 tablas y 82 relaciones, incluidas las 35 tablas del dominio. Su SVG está en la misma carpeta. Las fechas, booleanos, puntajes y JSON usan tipos nativos de PostgreSQL. Los diagramas `base-datos-unp-*` anteriores se conservan como referencia del diseño SQLite/D1.
