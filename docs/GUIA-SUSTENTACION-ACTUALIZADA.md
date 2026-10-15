# Guía de sustentación del prototipo

## Qué explicar primero

“El sistema organiza el legajo docente y apoya la evaluación y el trámite de promoción. Cada mérito tiene respaldo documental. El puntaje, los requisitos y la vacante se comprueban por separado. El resultado no concede el ascenso: existe un trámite posterior por las instancias correspondientes.”

La demostración usa nombres, documentos y reglas ficticios. El umbral 55 es una referencia de simulación; las equivalencias de puntos y requisitos no se presentan como normativa UNP validada.

## Recorrido corto hasta la decisión

1. Personal de legajos → Convocatorias. Mostrar periodo, plazas y versión de rúbrica del ejemplo 2026.
2. Comisión evaluadora → Evaluaciones → Gabriel Torres. Mostrar 84 puntos, requisitos, plaza y fuentes de simulación. Redactar el fundamento y cerrar.
3. Personal de legajos → Convocatorias → Cerrar recepción. Explicar que los borradores no enviados quedan como no presentados. No usar esta acción si se desea seguir presentando solicitudes en esa convocatoria.
4. Decanato → Orden de mérito → plaza PL-002 de Matemática. Mostrar que el primer puesto está respaldado por una evaluación cerrada. Preparar el informe.
5. Propuestas y decisiones → Remitir a Facultad. Registrar un oficio ficticio y fundamento.
6. Consejo de Facultad → Propuestas y decisiones → Elevar al Consejo Universitario. Registrar un acuerdo ficticio.
7. Consejo Universitario → Registrar aprobación o denegación. Usar una referencia claramente de ejemplo, como RES-DEMO-001.
8. Docente → Gabriel Torres → Propuestas y decisiones. Mostrar decisión, responsables, referencias y fechas. Recargar para demostrar persistencia. Mostrar que el legajo conserva su categoría: el prototipo registra una decisión simulada, no ejecuta un ascenso oficial.

## Recorrido de trazabilidad documental

Antes de cerrar la recepción, usar María Valeria Ríos. Incorporar una ponencia con PDF, observarla como Ana Salas, corregirla como docente y verificarla como Luis Pérez. En Historial abrir los detalles de cada evento: quedan el responsable, observación y documento de esa versión. La evaluación solo utiliza documentos verificados.

En Grados y experiencia se puede agregar título profesional y antecedentes laborales con respaldo. Esos registros no reciben automáticamente puntos adicionales.

## Cómo defender la arquitectura

- Dominio: conceptos y cálculos puros; no depende de React ni de IndexedDB.
- Aplicación: casos de uso, estados, validaciones, responsables e historial.
- Infraestructura: implementa contratos de repositorio y conserva registros/archivos en IndexedDB.
- Presentación: componentes y formularios consumen servicios. La composición inyecta el adaptador local.

La siguiente fase introduce una API que ejecutará las reglas en servidor, sesiones reales y persistencia compartida. No se conectará directamente el navegador a una base de datos.

## Preguntas frecuentes

**¿55 puntos aseguran la promoción?** No. También se consideran requisitos, vacante, orden de mérito y trámite. Los valores actuales son didácticos.

**¿Qué pasa con un empate?** Se muestra un puesto compartido y se bloquea la preparación de propuesta hasta contar con una regla institucional validada.

**¿Puede cambiar una evaluación cerrada?** La aplicación no ofrece editarla. Conserva ficha, evidencias, plaza, rúbrica y convocatoria consideradas.

**¿Quién revisó el documento?** El historial registra una identidad ficticia estable y su perfil. En producción esa identidad procederá de una sesión autenticada.

**¿Se guardan los datos?** Sí, en ese navegador y origen. No se sincronizan ni respaldan por estar el código en OneDrive.

**¿Qué falta para usarlo realmente?** Validación normativa y del procedimiento con las oficinas responsables, identidades y permisos reales, API, persistencia compartida, respaldo, políticas documentales y tratamiento institucional de excepciones.
