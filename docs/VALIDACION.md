# Comprobación de la entrega

Fecha: 15/09/2026. Entorno local de Windows, Node.js 22.17.1 y navegador Microsoft Edge.

| Comprobación | Resultado |
|---|---|
| TypeScript estricto | Sin errores |
| ESLint de aplicación y pruebas | Sin errores |
| Compilación de la aplicación | Correcta |
| Reglas y persistencia | 12 pruebas aprobadas |
| Recorridos con navegador real | 5 pruebas aprobadas |
| Recorridos sobre la versión compilada con npm start | 5 pruebas aprobadas |

## Reglas y aplicación

Las 12 pruebas comprueban: límites de 54/55/56 puntos; exclusión de evidencia ajena, pendiente, observada o futura; topes y grado más alto; requisitos independientes del puntaje; ausencia de plaza; condiciones adicionales para principal; aniversarios completos; registro/observación/corrección; reenvío y cierre; validación de perfiles, duplicados y archivos; persistencia de registros/binarios y revisión concurrente; restauración de ejemplos.

El caso de conservación cierra dos evaluaciones y comprueba que la primera conserva exactamente su ficha, resultado y evidencias después de editar la ficha actual.

## Recorridos de interfaz

1. Incorporar un PDF como docente, observarlo como personal de legajos, corregir y verificar; observar/reingresar la solicitud y cerrar como comisión. Descargar el PDF después de recargar y comparar sus bytes con el original.
2. Registrar un docente, buscarlo, editar su especialidad y comprobar persistencia tras recargar.
3. Mantener el perfil al recargar, limitar la ficha consultable y cerrar un caso sin vacante.
4. Usar el enlace para saltar al contenido con teclado, conservar cambios al cancelar el descarte y navegar con el menú móvil a 390 px sin desbordamiento de la página.
5. Incorporar una imagen PNG, crear un nuevo borrador, presentarlo, verificar documentos, cerrar con puntaje insuficiente y visualizar la imagen almacenada.

Capturas generadas por las pruebas:

- [Resultado de evaluación en escritorio](../test-results/result-desktop.png).
- [Panel en móvil](../test-results/dashboard-mobile.png).
- [Directorio en móvil](../test-results/directory-mobile.png).

Las tablas amplias tienen desplazamiento horizontal y un aviso visible en móvil. Se revisaron contraste de textos, formularios etiquetados y foco de los controles. Esto es una revisión básica de accesibilidad; no una certificación.

## Incidencia resuelta del proyecto base

La compilación original eliminaba exportaciones que la navegación de Vinext carga dinámicamente. Se configuró `preserveEntrySignatures: "strict"` en el entorno de cliente de Vite. Después se repitieron los cinco recorridos completos sobre el servidor compilado, sin errores de ejecución en el recorrido principal.

## Límites conocidos

Los perfiles, docentes, plazas y criterios son de demostración. El almacenamiento permanece en el navegador. No hay autenticación real, sincronización entre equipos, adjudicación de plazas ni aprobación institucional del ascenso. La rúbrica oficial debe verificarse antes de implementar un proceso real.
