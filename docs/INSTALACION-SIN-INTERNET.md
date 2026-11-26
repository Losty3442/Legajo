# Instalación sin internet desde un USB

Prepara el paquete en una PC Windows x64. La laptop de destino debe poder ejecutar los binarios x64 y tener un navegador. El sistema ejecuta la interfaz, la API y PostgreSQL en la misma laptop. Los enlaces externos, como SIGED y el reglamento en línea, requieren internet.

## Compilar y respaldar

En la PC con la base que se va a replicar, instala las dependencias con `npm.cmd ci` si hace falta. Ejecuta estos comandos desde el proyecto y comprueba que terminen correctamente.

```powershell
npm.cmd run build
npm.cmd run db:backup
```

Organiza una carpeta nueva llamada `LegajoUSB` fuera del proyecto. Conserva las rutas indicadas dentro de `app`.

| Carpeta | Contenido |
| --- | --- |
| `app` | `package.json`, `node_modules`, `dist`, `scripts`, `server\config.ts` y `.local\server\main.mjs` |
| `node` | ZIP de Node.js 22 x64 descomprimido, con `node.exe` y `npm.cmd` en su raíz |
| `postgres` | ZIP de PostgreSQL 18 x64 descomprimido, con `bin\pg_ctl.exe`, `lib` y `share` |
| `respaldo` | Contenido del respaldo recién generado en `data\backups\postgres-<fecha>` |

Usa los ZIP oficiales de [Node.js 22](https://nodejs.org/download/release/latest-v22.x/) y [PostgreSQL 18](https://www.enterprisedb.com/download-postgresql-binaries). Guarda aparte las credenciales de las cuentas de demostración. Prepara los legajos y solicitudes que utilizarás en la sustentación antes de generar el respaldo.

## Restaurar PostgreSQL en la carpeta portable

En PowerShell, desde `LegajoUSB`, inicializa una instancia en `pgdata` y asígnale una contraseña nueva de administración. Esta instancia usa el puerto 55432.

```powershell
$pg = "$PWD\postgres\bin"
& "$pg\initdb.exe" -D pgdata -U postgres -A scram-sha-256 -E UTF8 --locale=C -W
& "$pg\pg_ctl.exe" -D pgdata -l postgres.log -o "-h 127.0.0.1 -p 55432" -w start
& "$pg\psql.exe" -h 127.0.0.1 -p 55432 -U postgres -d postgres -v ON_ERROR_STOP=1
```

En `psql`, crea los dos roles con contraseñas distintas de letras y números. El siguiente comando de base reproduce la configuración regional de la instalación original de Windows.

```sql
CREATE ROLE legajo_owner LOGIN;
\password legajo_owner
CREATE ROLE legajo_app LOGIN;
\password legajo_app
CREATE DATABASE legajos_unp WITH OWNER = legajo_owner TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'Spanish_Peru.1252';
\q
```

Restaura el respaldo sobre la base vacía y abre la conexión del propietario.

```powershell
& "$pg\pg_restore.exe" -h 127.0.0.1 -p 55432 -U legajo_owner -d legajos_unp --no-owner --no-acl --exit-on-error --single-transaction .\respaldo\database.dump
& "$pg\psql.exe" -h 127.0.0.1 -p 55432 -U legajo_owner -d legajos_unp -v ON_ERROR_STOP=1
```

Aplica los permisos que necesita la aplicación en `psql`.

```sql
GRANT USAGE ON SCHEMA public TO legajo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO legajo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legajo_app;
GRANT UPDATE ON SEQUENCE docente_codigo_seq TO legajo_app;
REVOKE ALL ON migracion_esquema FROM legajo_app;
\q
```

Copia los archivos del respaldo y crea `app\.env.local`.

```powershell
New-Item -ItemType Directory -Path .\app\data -Force | Out-Null
Copy-Item -LiteralPath .\respaldo\documents -Destination .\app\data -Recurse
```

Sustituye `CLAVE_APP` y `CLAVE_OWNER` por las claves de la instancia portable.

```dotenv
DATABASE_URL=postgresql://legajo_app:CLAVE_APP@127.0.0.1:55432/legajos_unp
DATABASE_OWNER_URL=postgresql://legajo_owner:CLAVE_OWNER@127.0.0.1:55432/legajos_unp
```

## Arrancar y probar

Crea `INICIAR.bat` en la raíz de `LegajoUSB`.

```bat
@echo off
setlocal
cd /d "%~dp0"
set "PATH=%CD%\node;%PATH%"
"postgres\bin\pg_ctl.exe" -D pgdata -l postgres.log -o "-h 127.0.0.1 -p 55432" -w start
if errorlevel 1 exit /b 1
cd app
call npm.cmd start
```

1. Detén PostgreSQL con `.\postgres\bin\pg_ctl.exe -D pgdata -m fast -w stop` y copia `LegajoUSB` al USB.
2. En otra PC con el Wi-Fi apagado, copia `LegajoUSB` del USB al disco y ejecuta `INICIAR.bat`.
3. Entra en `http://localhost:5173` con una cuenta de demostración. Abre un legajo y descarga un adjunto. Haz un cambio reversible y comprueba que se conserve tras reiniciar.
4. En la consola de la aplicación pulsa `Ctrl+C`. Desde la raíz de `LegajoUSB`, ejecuta el comando de parada de PostgreSQL del paso 1.

Conserva el paquete con los datos y las credenciales técnicas en un medio de acceso controlado. El código y las migraciones se pueden versionar en GitHub. El respaldo, los adjuntos y `.env.local` se guardan localmente.
