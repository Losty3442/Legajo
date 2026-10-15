# Correspondencia con el análisis inicial

Actualizado el 16/09/2026. Esta matriz distingue el proceso implementado para demostración de su futura operación institucional. Los PDF y diagramas originales se conservan como documentos de análisis.

| Requisito / caso de uso | Implementación actual | Evidencia |
|---|---|---|
| RF01 · Datos y trayectoria docente | Directorio, adscripción, categoría, dedicación y antecedentes laborales con evidencia | teachers.tsx, trajectory.tsx, saveTeacher/saveExperience |
| RF02 / CUN01 · Mantener legajo | Título profesional, grados, ratificación, méritos, constancias laborales y archivos | dossier.tsx, saveMerit |
| RF03 / CUN03 · Verificar expediente | Revisión nominal con fecha, observación y copias antes/después; documentos anteriores consultables | ReviewEvent, review, Historial |
| RF04 / CUN02 · Solicitar promoción | Categoría inmediata, convocatoria, plaza, borrador, presentación y corrección | RequestForm, saveRequest, submit |
| RF05 / CUN04 · Comprobar requisitos | Requisitos configurados en la rúbrica de la convocatoria y conservados en el cierre | Rubric.requirements, evaluate |
| RF06 / CUN04 · Calificar | Desglose, topes, umbral de referencia y procedencia de cada criterio; valores expresamente ficticios | Rubric.sources, Evaluation |
| RF07 · Vacante pertinente | Compara facultad, departamento, categoría y dedicación; plaza vinculada a convocatoria | evaluate, PromotionCall.vacancyIds |
| RN05 · Orden de mérito | Cuadro por convocatoria y plaza, puestos compartidos en empate; solo primer puesto apto sin empate inicia propuesta | ranking, createProposal |
| RF08 / CUN05 · Elaborar resultado | Conclusión de comisión, copias históricas, impresión y evidencia considerada | EvaluationView, closeEvaluation |
| RF08 / CUN06 · Tramitar propuesta | Informe de decanato → oficio a Facultad → acuerdo elevado al Consejo Universitario → decisión motivada | Proposal, createProposal, advanceProposal |
| RNF01 · Acceso por roles | Responsabilidades demostrables por perfil; docente consulta solo su expediente mediante los servicios | snapshot, comprobaciones de rol |
| RNF02 · Trazabilidad | Identidad ficticia estable, historial de revisión y auditoría con versiones antes/después | Identity, ReviewEvent, AuditEntry.changes |
| RNF03 · Conservación | IndexedDB y blobs persistentes, transacciones con revisión esperada, migración sin reset | indexeddb.ts, migrations.ts |
| RNF04 · Fuente y versión | Fuente didáctica declarada por criterio, requisitos y versión conservados por convocatoria/evaluación | Rubric.sources, callSnapshot |

## Relación con los diagramas

- Casos de uso: los seis objetivos tienen recorrido en la aplicación. Decanato, Consejo de Facultad y Consejo Universitario disponen de perfiles diferenciados.
- Objetos del negocio: docente, personal de legajos, comisión, decanato, legajo, expediente, evidencia y resultado se representan mediante datos y servicios. Un objeto conceptual no exige una clase o tabla homónima.
- Dominio: se mantienen facultad, departamento, categoría, legajo, grados, actividad, evidencia, evaluación y plaza. Se explicitan además Convocatoria, Revisión, Experiencia, Propuesta y Decisión (evento de propuesta).
- Colaboración de incorporación: registrar evidencia → revisar → observar/corregir o verificar → consultar legajo e historial.
- Colaboración de promoción: presentar → comprobar expediente/plaza → evaluar → elaborar resultado → tramitar por las instancias → docente consulta la decisión conservada.

## Decisiones de esta versión

1. Una solicitud por docente y convocatoria. Otra convocatoria admite una nueva solicitud y conserva las evaluaciones anteriores.
2. Crear una convocatoria copia la rúbrica completa. Su periodo y plazas solo se editan mientras no haya solicitudes.
3. Recepción abierta permite presentar dentro del periodo. Cerrar recepción marca los borradores como no presentados; no se permite mientras existan solicitudes observadas. La evaluación puede avanzar durante recepción, pero el orden de mérito sigue siendo preliminar.
4. Preparar propuesta exige recepción cerrada, todas las solicitudes de esa plaza evaluadas, primer puesto apto sin empate y plaza disponible.
5. Los empates bloquean la propuesta. No se inventa un desempate normativo. La prioridad se calcula por puntaje exclusivamente para la simulación.
6. Se impide preparar otra propuesta activa o aprobada para la misma plaza. No es una adjudicación oficial ni un control presupuestal.
7. Decanato prepara y remite; Facultad eleva; Consejo Universitario registra aprobación o denegación con referencia y fundamento. La decisión es terminal. El docente la consulta en Propuestas y decisiones.
8. La decisión simulada no cambia automáticamente la categoría de la ficha. El proceso real requerirá resolución válida e integración con personal.
9. Título y constancias laborales forman parte del legajo, sin puntos nuevos. La rúbrica solo puntúa antigüedad en categoría. Se permiten periodos laborales superpuestos porque pueden existir cargos simultáneos.
10. Las revisiones anteriores a esta actualización no tienen identidad recuperable: la migración lo indica explícitamente. No inventa observaciones eliminadas en versiones anteriores ni altera evaluaciones cerradas.

## Pendientes institucionales

Las fuentes de puntaje son supuestos didácticos, no artículos oficiales. Se mantiene pendiente validar el reglamento y anexo aplicables, el alcance de cada autoridad, plazos de subsanación, desempates, vacantes y presupuesto. No se implementan recursos, apelaciones, devolución del Consejo de Facultad ni propuesta del siguiente puesto tras una denegación: deben definirse antes del uso real.

La restricción de perfiles local no sustituye autenticación/autorización del servidor. Tampoco IndexedDB constituye respaldo institucional: se requieren cuentas reales, permisos por unidad, almacenamiento privado y políticas de recuperación. Estas limitaciones pertenecen a la fase de servidor aprobada para después.

## Pruebas relacionadas

- tests/rules.spec.ts: reglas de puntaje, evidencias, revisión/corrección, archivos e históricos.
- tests/workflow.spec.ts: responsables, convocatorias, fuentes, orden de mérito, empates, permisos, propuestas, decisión, trayectoria y migración.
- tests/browser.spec.ts: recorridos de interfaz, recarga, archivos, móvil y trámite completo.

Si la versión anterior contiene varias solicitudes de una misma persona, la migración separa las anteriores en convocatorias técnicas cerradas de archivo. Esa agrupación no afirma que hayan existido convocatorias institucionales distintas y evita comparar a una persona consigo misma. Las evaluaciones originales permanecen intactas.
