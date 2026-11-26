# Guía de sustentación del prototipo

## Preparar la laptop

Si no hay internet, lleva el paquete descrito en la [guía de instalación desde USB](INSTALACION-SIN-INTERNET.md). Ensaya con la copia del USB y verifica que el respaldo incluya la convocatoria, la plaza y la solicitud que vas a presentar.

## Qué explicar primero

“El sistema organiza el legajo docente y apoya la evaluación y el trámite de promoción. Cada mérito tiene respaldo documental. El puntaje, los requisitos y la vacante se comprueban por separado. El resultado no concede el ascenso: existe un trámite posterior por las instancias correspondientes.”

Usa cuentas y documentos de demostración autorizados. La rúbrica basada en la tabla de provisión de plazas usa 55 puntos como umbral de simulación.

## Recorrido corto hasta la decisión

1. Personal de Legajos → Convocatorias. Mostrar el periodo, la plaza y la versión de rúbrica de la convocatoria de prueba.
2. Comisión evaluadora → Evaluaciones. Abrir la solicitud presentada. Mostrar los requisitos, la plaza y las fuentes de la rúbrica. Si se usa la tabla UNP, registrar la calificación y el sustento de los criterios antes de cerrar.
3. Personal de legajos → Convocatorias → Cerrar recepción. Explicar que los borradores no enviados quedan como no presentados. No usar esta acción si se desea seguir presentando solicitudes en esa convocatoria.
4. Decanato → Orden de mérito → plaza de la demostración. Mostrar que el primer puesto está respaldado por una evaluación cerrada. Preparar el informe.
5. Propuestas y decisiones → Remitir a Facultad. Registrar un oficio ficticio y fundamento.
6. Consejo de Facultad → Propuestas y decisiones → Elevar al Consejo Universitario. Registrar un acuerdo ficticio.
7. Consejo Universitario → Registrar aprobación o denegación. Usar una referencia claramente de ejemplo, como RES-DEMO-001.
8. Docente → Propuestas y decisiones. Mostrar la decisión, los responsables, las referencias y las fechas. Recargar para demostrar persistencia. El legajo conserva la categoría docente durante la simulación.

## Recorrido de trazabilidad documental

Antes de cerrar la recepción, incorpora una ponencia con PDF en el legajo de prueba. Obsérvala como personal de Legajos, corrígela como docente y verifícala desde Legajos. En Historial, abre los detalles de cada evento para mostrar el responsable, la observación y la versión del documento. La evaluación usa evidencias verificadas.

En Grados y experiencia se puede agregar título profesional y antecedentes laborales con respaldo. Esos registros no reciben automáticamente puntos adicionales.

## Cómo defender la arquitectura

- Dominio: conceptos y cálculos puros; no depende de React ni de IndexedDB.
- Aplicación: casos de uso, estados, validaciones, responsables e historial.
- Infraestructura. Express atiende la API y guarda registros en PostgreSQL y documentos en el directorio privado.
- Presentación. React/Vinext consulta la API local. El backend controla el acceso mediante sesiones y roles.

## Preguntas frecuentes

**¿55 puntos aseguran la promoción?** No. También se consideran requisitos, vacante, orden de mérito y trámite. Los valores actuales son didácticos.

**¿Qué pasa con un empate?** Se muestra un puesto compartido y se bloquea la preparación de propuesta hasta contar con una regla institucional validada.

**¿Puede cambiar una evaluación cerrada?** La aplicación no ofrece editarla. Conserva ficha, evidencias, plaza, rúbrica y convocatoria consideradas.

**¿Quién revisó el documento?** El historial registra la identidad y el rol de la cuenta autenticada que realizó la revisión.

**¿Se guardan los datos?** Sí. PostgreSQL conserva los registros y el directorio privado guarda sus documentos. El respaldo incluye ambos.

**¿Qué falta para usarlo institucionalmente?** Validación del procedimiento con las oficinas responsables, integración con identidades institucionales y aprobación de políticas de acceso y tratamiento documental.
