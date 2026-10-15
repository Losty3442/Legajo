# Sistema de Gestión de Legajos Docentes y Promoción · UNP

[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.2-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite)](https://vitejs.dev/)
[![Playwright](https://img.shields.io/badge/Tested_with-Playwright-2EAD33?logo=playwright)](https://playwright.dev/)

Aplicación web académica desarrollada para el registro de legajos docentes, verificación de evidencias y simulación del proceso de evaluación de solicitudes de promoción docente en la **Universidad Nacional de Piura (UNP)**. 

El sistema incluye datos de prueba, seis perfiles de demostración según la línea de responsabilidad institucional y persistencia local de documentos mediante IndexedDB.

> [!NOTE]  
> La rúbrica utilizada (`DEMO-2026.2`) contiene valores ilustrativos para fines de sustentación académica del curso de Análisis y Diseño de Sistemas 2. El resultado de la simulación no concede un ascenso real ni constituye un trámite institucional vinculante.

---

## 🚀 Requisitos y Puesta en Marcha

### Requisitos previos
- **Node.js**: Versión `22.13.0` o superior.
- **npm**: Incluido con Node.js.
- Navegador moderno (Microsoft Edge, Google Chrome, Firefox o Safari).

### Instalación y Ejecución

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/Losty3442/Legajo.git
   cd Legajo
   ```

2. **Instalar dependencias:**
   ```bash
   npm run install:ci
   ```

3. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   *(En Windows PowerShell, si las políticas de ejecución restringen scripts, puedes ejecutar `npm.cmd run dev`)*.

4. **Acceder a la aplicación:**
   Abre tu navegador en [http://localhost:5173](http://localhost:5173).

5. **Para detener el servidor:** Presiona `Ctrl + C` en la terminal.

---

## 📋 Comandos del Proyecto

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el entorno de desarrollo en [http://localhost:5173](http://localhost:5173). |
| `npm run build` | Compila la aplicación para producción. |
| `npm start` | Ejecuta la versión compilada en el puerto 5173 manteniendo el mismo origen. |
| `npm run typecheck` | Valida tipos de TypeScript sin emitir archivos. |
| `npm run lint` | Ejecuta ESLint sobre el código fuente, componentes y pruebas. |
| `npm test` | Ejecuta pruebas unitarias y de integración sobre IndexedDB en memoria (`fake-indexeddb`). |
| `npm run test:e2e` | Ejecuta pruebas de extremo a extremo (E2E) con Playwright en Microsoft Edge/Chrome. |

---

## 👥 Perfiles y Responsabilidades del Sistema

El selector de perfil en la cabecera permite alternar entre roles operativos para validar los flujos de trabajo sin requerir credenciales externas en esta fase prototipo:

| Perfil | Operaciones Principales |
|---|---|
| **Docente** | Consultar legajo, adjuntar/corregir evidencias documentales, preparar y presentar solicitudes de promoción. |
| **Personal de Legajos** | Registrar y editar docentes, administrar legajos, revisar/observar documentos y solicitudes, gestionar convocatorias y restaurar datos de prueba. |
| **Comisión Evaluadora** | Revisar expedientes, verificar cumplimiento de requisitos mínimos, validar puntajes por criterio y cerrar evaluaciones. |
| **Decanato** | Consultar orden de mérito por plaza convocada, estructurar la propuesta de promoción y remitir a Consejo de Facultad. |
| **Consejo de Facultad** | Revisar la propuesta, registrar acuerdo de aprobación y elevar al Consejo Universitario. |
| **Consejo Universitario** | Emitir la resolución/decisión motivada final (aprobatoria o denegatoria). |

---

## 🧪 Guion de Demostración para Sustentación

Sigue este flujo guiado para demostrar el ciclo de vida completo de un expediente:

1. **Inicio como Docente**:
   - Selecciona el perfil **Docente** y abre el legajo de **María Valeria Ríos** (puntaje inicial verificado: 53 pts).
2. **Subida de evidencia**:
   - Añade una ponencia adjuntando un archivo PDF o imagen de prueba. Su estado inicial será `Por revisar` y no sumará puntaje inmediatamente.
3. **Revisión documental**:
   - Cambia al perfil **Personal de legajos**. En la pestaña *Revisión documental*, observa la evidencia indicando el motivo de corrección.
4. **Subsanación**:
   - Regresa al perfil **Docente**, entra a *Méritos*, corrige el documento y vuelve a enviarlo.
5. **Aprobación de evidencia**:
   - Como **Personal de legajos**, verifica la evidencia subsanada y aprueba la ponencia inicial.
6. **Revisión de solicitud**:
   - En *Solicitudes*, comprueba el expediente completo preparado para postulación.
7. **Evaluación y Cierre**:
   - Ingresa como **Comisión evaluadora**, abre la solicitud, evalúa requisitos, puntaje y plaza; añade las conclusiones y presiona **Cerrar evaluación**.
8. **Consulta de resultados**:
   - Recarga la página: los documentos y la evaluación final permanecen inmutables.
9. **Flujo jerárquico**:
   - Pasa por **Decanato** (propuesta), **Consejo de Facultad** (elevación) y **Consejo Universitario** (decisión final).
   
Consulta la [Guía de Sustentación Actualizada](docs/GUIA-SUSTENTACION-ACTUALIZADA.md) y la [Matriz de Trazabilidad](docs/TRAZABILIDAD.md) para más detalles.

---

## 🏗️ Arquitectura de Software

El proyecto implementa los principios de **Clean Architecture** (Arquitectura Limpia) con separación estricta de capas:

```text
app/                         Rutas y layout compatibles con Next.js App Router
src/
  domain/                    Entidades puras, reglas de negocio y cálculo de puntajes
  application/               Casos de uso, validaciones y contratos de repositorios
  infrastructure/            Persistencia en IndexedDB, transacciones y gestión de blobs
  presentation/
    components/              Formularios y componentes reutilizables
    features/                Módulos funcionales (Panel, Directorio, Legajo, Revisión, Convocatorias)
    provider.tsx             Estado global de presentación, mensajes y contexto
    workspace.tsx            Navegación principal, selector de perfiles y vistas
  composition.ts             Contenedor de inyección de dependencias (IoC local)
components/ui/               Primitivas de interfaz accesibles (Radix UI / shadcn)
tests/                       Pruebas unitarias, de integración y escenarios E2E
docs/                        Documentación técnica de arquitectura, contratos y validación
```

### Flujo de Dependencias
- **Presentación → Aplicación → Dominio**.
- La capa de Infraestructura implementa las interfaces definidas en Aplicación.
- El núcleo del dominio es agnóstico: no tiene dependencias de React, APIs del navegador ni bibliotecas externas de interfaz.

---

## 💾 Persistencia y Almacenamiento Local

- **IndexedDB**: Base de datos local `unp-legajos-demo` (versión 1).
  - Almacén `workspace`: Estructuras de datos, catálogos, convocatorias, auditoría y evaluaciones cerradas.
  - Almacén `documents`: Archivos binarios reales (PDF, PNG, JPG, WebP de hasta 10 MB) con validación de tipo MIME y firma.
- **Transacciones atómicas**: Control de concurrencia mediante números de revisión secuencial para prevenir colisiones de edición.
- **Inmutabilidad histórica**: Al corregir una evidencia se genera un identificador nuevo; los documentos históricos y evaluaciones cerradas no se sobrescriben.

> [!IMPORTANT]
> Los datos persisten en el origen exacto del navegador (`http://localhost:5173`). Usar otra dirección IP, otro puerto, otro perfil de navegador o navegar en modo incógnito utilizará un almacenamiento aislado.

---

## 📚 Documentación Técnica Adicional

- [API y Arquitectura Futura](docs/API-Y-ARQUITECTURA.md): Plan de migración hacia servicios backend distribuidos, base de datos relacional y autenticación JWT/OAuth.
- [Guía de Sustentación](docs/GUIA-SUSTENTACION-ACTUALIZADA.md): Secuencia y casos de prueba preparados para evaluación académica.
- [Matriz de Trazabilidad](docs/TRAZABILIDAD.md): Mapeo entre requisitos funcionales, casos de uso y módulos implementados.
- [Informe de Validación y Pruebas](docs/VALIDACION.md): Resultados de las pruebas de regresión, integración y accesibilidad.

---

## 📄 Licencia

Este proyecto fue desarrollado con fines estrictamente académicos para la carrera de Ingeniería Informática de la **Universidad Nacional de Piura (UNP)**.
