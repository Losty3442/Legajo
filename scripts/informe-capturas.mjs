// Captura las pantallas del prototipo y genera un esquema (diagrama de colaboración)
// por caso de uso. Escribe docs/informe/manifest.json para el informe Word.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outDir = path.join(root, "docs", "informe");
const capDir = path.join(outDir, "capturas");
const diaDir = path.join(outDir, "diagramas");
mkdirSync(capDir, { recursive: true });
mkdirSync(diaDir, { recursive: true });

const BASE = process.env.APP_URL || "http://localhost:5173";
const CHANNEL = process.env.PDF_BROWSER || "msedge";

// ─────────────────────────────────────────────────────────────────────────────
// Metadatos de los diagramas de colaboración (uno por caso de uso)
// ─────────────────────────────────────────────────────────────────────────────
const E = (obj, tbl) => ({ obj, tbl });
export const DIAGRAMS = {
  CUS01: { dc: "DC_CUS01_GestionarDocente", name: "Registrar y editar ficha del docente", actor: ": Personal de legajos", iu: "IU: Gestionar Docente", route: "/docentes", cc: "CC_GestionarDocente", method: "saveTeacher()", entities: [E(":Docente", "docente"), E(":Facultad", "facultad"), E(":Departamento", "departamento"), E(":CategoriaDocente", "categoria_docente")], messages: ["1: registrarDocente() / editarFicha()", "2: validarCampos()", "3: verificarDuplicado() :Docente", "4: Grabar() :Docente", "5: auditar() :AuditoriaEvento"], returns: "VarDocente" },
  CUS02: { dc: "DC_CUS02_RegistrarMerito", name: "Registrar mérito y evidencia", actor: ": Docente · : Personal de legajos", iu: "IU: Registrar Mérito", route: "/legajos/:id (Méritos)", cc: "CC_RegistrarMerito", method: "saveMerit()", entities: [E(":Legajo", "legajo"), E(":Merito", "merito"), E(":TipoMerito", "tipo_merito"), E(":Documento", "documento")], messages: ["1: registrarMerito()", "2: validarDocumento()", "3: adjuntarEvidencia() :Documento", "4: Grabar() :Merito", "5: auditar() :AuditoriaEvento"], returns: "VarMerito" },
  CUS03: { dc: "DC_CUS03_RegistrarTrayectoria", name: "Registrar trayectoria laboral", actor: ": Docente · : Personal de legajos", iu: "IU: Registrar Trayectoria", route: "/legajos/:id (Grados y experiencia)", cc: "CC_RegistrarTrayectoria", method: "saveExperience()", entities: [E(":ExperienciaLaboral", "experiencia_laboral"), E(":Legajo", "legajo"), E(":Documento", "documento")], messages: ["1: registrarTrayectoria()", "2: validarPeriodo()", "3: vincularEvidencia() :Documento", "4: Grabar() :ExperienciaLaboral", "5: auditar() :AuditoriaEvento"], returns: "VarExperiencia" },
  CUS04: { dc: "DC_CUS04_VerificarMerito", name: "Verificar u observar mérito", actor: ": Personal de legajos · : Comisión", iu: "IU: Verificar Mérito", route: "/revision", cc: "CC_VerificarMerito", method: "review()", entities: [E(":Merito", "merito"), E(":RevisionMerito", "revision_merito"), E(":Documento", "documento")], messages: ["1: verificarMerito()", "2: consultarEvidencia() :Documento", "3: registrarResultado() :RevisionMerito", "4: Grabar() :Merito", "5: auditar() :AuditoriaEvento"], returns: "VarRevision" },
  CUS05: { dc: "DC_CUS05_CorregirMerito", name: "Corregir mérito observado", actor: ": Docente", iu: "IU: Corregir Mérito", route: "/legajos/:id (Méritos)", cc: "CC_CorregirMerito", method: "saveMerit(id)", entities: [E(":Merito", "merito"), E(":Documento", "documento"), E(":RevisionMerito", "revision_merito")], messages: ["1: corregirMerito()", "2: consultarObservacion() :RevisionMerito", "3: reemplazarDocumento() :Documento", "4: Grabar() :Merito", "5: auditar() :AuditoriaEvento"], returns: "VarMerito" },
  CUS06: { dc: "DC_CUS06_GestionarRubrica", name: "Gestionar rúbrica y requisitos", actor: ": Personal de legajos", iu: "IU: Gestionar Rúbrica", route: "/rubrica", cc: "CC_GestionarRubrica", method: "saveRubric() / approveRubric()", entities: [E(":Rubrica", "rubrica"), E(":RubricaCriterio", "rubrica_criterio"), E(":RubricaRequisito", "rubrica_requisito")], messages: ["1: crearVersion()", "2: definirCriterios() :RubricaCriterio", "3: definirRequisitos() :RubricaRequisito", "4: Grabar() :Rubrica", "5: aprobarRubrica()", "6: auditar() :AuditoriaEvento"], returns: "VarRubrica" },
  CUS07: { dc: "DC_CUS07_GestionarConvocatoria", name: "Gestionar convocatoria y plazas", actor: ": Personal de legajos", iu: "IU: Gestionar Convocatoria", route: "/convocatorias", cc: "CC_GestionarConvocatoria", method: "saveCall() / advanceCall()", entities: [E(":Convocatoria", "convocatoria"), E(":ConvocatoriaPlaza", "convocatoria_plaza"), E(":Plaza", "plaza"), E(":Rubrica", "rubrica")], messages: ["1: crearConvocatoria()", "2: asignarPlazas() :ConvocatoriaPlaza", "3: aplicarRubrica() :Rubrica", "4: Grabar() :Convocatoria", "5: auditar() :AuditoriaEvento"], returns: "VarConvocatoria" },
  CUS08: { dc: "DC_CUS08_DesignarComision", name: "Designar comisión evaluadora", actor: ": Personal de legajos", iu: "IU: Designar Comisión", route: "(sin pantalla)", cc: "CC_DesignarComision", method: "(pendiente)", entities: [E(":ComisionEvaluadora", "comision_evaluadora"), E(":MiembroComision", "miembro_comision")], messages: ["1: designarComision()", "2: seleccionarMiembros() :MiembroComision", "3: Grabar() :ComisionEvaluadora", "4: auditar() :AuditoriaEvento"], returns: "VarComision" },
  CUS09: { dc: "DC_CUS09_PresentarSolicitud", name: "Presentar solicitud de promoción", actor: ": Docente", iu: "IU: Presentar Solicitud", route: "/solicitudes", cc: "CC_PresentarSolicitud", method: "saveRequest() / submit()", entities: [E(":SolicitudPromocion", "solicitud_promocion"), E(":ExpedienteItem", "expediente_item"), E(":SolicitudHistorialEstado", "solicitud_historial_estado"), E(":Plaza", "plaza")], messages: ["1: presentarSolicitud()", "2: buscarLegajo() :Legajo", "3: verificarRequisitos() :Rubrica", "4: verificarPlaza() :Plaza", "5: registrarEstado() :SolicitudHistorialEstado", "6: Grabar() :SolicitudPromocion", "7: auditar() :AuditoriaEvento"], returns: "VarSolicitud" },
  CUS10: { dc: "DC_CUS10_ObservarSolicitud", name: "Observar y devolver solicitud", actor: ": Personal de legajos · : Comisión", iu: "IU: Observar Solicitud", route: "/solicitudes", cc: "CC_ObservarSolicitud", method: "observeRequest()", entities: [E(":SolicitudPromocion", "solicitud_promocion"), E(":ObservacionSolicitud", "observacion_solicitud"), E(":SolicitudHistorialEstado", "solicitud_historial_estado")], messages: ["1: observarSolicitud()", "2: registrarObservacion() :ObservacionSolicitud", "3: registrarEstado('observada') :SolicitudHistorialEstado", "4: Grabar() :SolicitudPromocion", "5: auditar() :AuditoriaEvento"], returns: "VarSolicitud" },
  CUS11: { dc: "DC_CUS11_EvaluarSolicitud", name: "Evaluar y cerrar evaluación", actor: ": Comisión evaluadora", iu: "IU: Evaluar Solicitud", route: "/evaluaciones/:id", cc: "CC_EvaluarSolicitud", method: "closeEvaluation()", entities: [E(":Evaluacion", "evaluacion"), E(":EvaluacionCriterio", "evaluacion_criterio"), E(":EvaluacionRequisito", "evaluacion_requisito"), E(":EvaluacionEvidencia", "evaluacion_evidencia"), E(":Rubrica", "rubrica")], messages: ["1: evaluarSolicitud()", "2: aplicarCriterios() :EvaluacionCriterio", "3: verificarRequisitos() :EvaluacionRequisito", "4: registrarEvidencias() :EvaluacionEvidencia", "5: calcularPuntaje() :Rubrica", "6: Grabar() :Evaluacion", "7: auditar() :AuditoriaEvento"], returns: "VarEvaluacion" },
  CUS12: { dc: "DC_CUS12_ConsultarOrdenMerito", name: "Consultar orden de mérito", actor: ": Comisión · : Decanato", iu: "IU: Consultar Orden de Mérito", route: "/orden-merito", cc: "CC_OrdenMerito", method: "ranking() (consulta)", entities: [E(":Evaluacion", "evaluacion"), E(":PropuestaOrdenMerito", "propuesta_orden_merito"), E(":Plaza", "plaza")], messages: ["1: consultarOrden()", "2: listarEvaluaciones() :Evaluacion", "3: ordenarPorPuntaje()", "4: mostrarCuadro()"], returns: "VarCuadro" },
  CUS13: { dc: "DC_CUS13_PrepararPropuesta", name: "Preparar propuesta", actor: ": Decanato", iu: "IU: Preparar Propuesta", route: "/orden-merito", cc: "CC_PrepararPropuesta", method: "createProposal()", entities: [E(":Propuesta", "propuesta"), E(":PropuestaOrdenMerito", "propuesta_orden_merito"), E(":Evaluacion", "evaluacion")], messages: ["1: prepararPropuesta()", "2: consultarOrden() :Evaluacion", "3: congelarCuadro() :PropuestaOrdenMerito", "4: Grabar() :Propuesta", "5: auditar() :AuditoriaEvento"], returns: "VarPropuesta" },
  CUS14: { dc: "DC_CUS14_RemitirPropuesta", name: "Remitir y elevar propuesta", actor: ": Decanato · : Consejo de Facultad", iu: "IU: Remitir Propuesta", route: "/propuestas", cc: "CC_RemitirPropuesta", method: 'advanceProposal("remitir" / "elevar")', entities: [E(":Propuesta", "propuesta"), E(":PropuestaEvento", "propuesta_evento")], messages: ["1: remitirPropuesta()", "2: registrarEvento() :PropuestaEvento", "3: Grabar() :Propuesta", "4: auditar() :AuditoriaEvento"], returns: "VarPropuesta" },
  CUS15: { dc: "DC_CUS15_RegistrarDecision", name: "Registrar decisión", actor: ": Consejo Universitario", iu: "IU: Registrar Decisión", route: "/propuestas", cc: "CC_RegistrarDecision", method: 'advanceProposal("aprobar" / "denegar")', entities: [E(":Propuesta", "propuesta"), E(":PropuestaEvento", "propuesta_evento")], messages: ["1: registrarDecision()", "2: registrarEvento() :PropuestaEvento", "3: Grabar() :Propuesta", "4: auditar() :AuditoriaEvento"], returns: "VarPropuesta" },
  CUS16: { dc: "DC_CUS16_ConsultarPropuestas", name: "Consultar propuestas y decisiones", actor: ": Docente · : Decanato · : Consejos", iu: "IU: Consultar Propuestas", route: "/propuestas · /", cc: "CC_ConsultarPropuestas", method: "snapshot() (consulta)", entities: [E(":Propuesta", "propuesta"), E(":PropuestaEvento", "propuesta_evento"), E(":Evaluacion", "evaluacion")], messages: ["1: consultarPropuestas()", "2: listarPropuestas() :Propuesta", "3: mostrarEventos() :PropuestaEvento", "4: mostrarResultado() :Evaluacion"], returns: "VarConsulta" },
  CUS17: { dc: "DC_CUS17_ConsultarHistorial", name: "Consultar historial y auditoría", actor: ": Docente (propio) · : Personal de legajos", iu: "IU: Consultar Historial", route: "/legajos/:id (Historial)", cc: "CC_ConsultarHistorial", method: "snapshot() / reviews (consulta)", entities: [E(":AuditoriaEvento", "auditoria_evento"), E(":AuditoriaCambio", "auditoria_cambio"), E(":RevisionMerito", "revision_merito")], messages: ["1: consultarHistorial()", "2: listarEventos() :AuditoriaEvento", "3: listarCambios() :AuditoriaCambio", "4: listarRevisiones() :RevisionMerito"], returns: "VarHistorial" },
  CUS18: { dc: "DC_CUS18_AdministrarUsuarios", name: "Administrar usuarios y roles", actor: ": Administrador del sistema", iu: "IU: Administrar Usuarios", route: "/login (sesión simulada)", cc: "CC_AdministrarUsuarios", method: "(pendiente)", entities: [E(":Usuario", "usuario"), E(":Rol", "rol"), E(":AsignacionRol", "asignacion_rol")], messages: ["1: administrarUsuarios()", "2: crearUsuario() :Usuario", "3: asignarRol() :AsignacionRol", "4: Grabar() :Usuario", "5: auditar() :AuditoriaEvento"], returns: "VarUsuario" }
};

// ─────────────────────────────────────────────────────────────────────────────
// Descripción de cada pantalla y casos de uso involucrados
// ─────────────────────────────────────────────────────────────────────────────
const SCREENS = [
  { id: "login", title: "Portal de acceso y sesión", route: "/login", component: "LoginView", actors: "Todos los actores", cus: ["CUS18"],
    description: "Puerta de entrada del prototipo. Permite iniciar sesión con credenciales institucionales de demostración (correo UNP y contraseña de prueba), con tarjetas de acceso rápido por perfil o mediante el botón OIDC simulado. Al elegir un perfil, la aplicación fija el rol activo —Docente, Personal de legajos, Comisión evaluadora, Decanato, Consejo de Facultad o Consejo Universitario— y muestra en cada tarjeta los casos de uso habilitados para ese rol (en verde los disponibles, en gris los de fase institucional). Corresponde a la sesión por actor (RNF01) y anticipa el CUS18 «Administrar usuarios y roles», que aún no tiene pantalla propia en el prototipo.",
    shots: [ { file: "capturas/01-login.png", caption: "Portal de acceso: credenciales, cuentas oficiales de prueba y acceso rápido por perfil." } ] },
  { id: "panel", title: "Panel de gestión", route: "/", component: "Dashboard", actors: "Todos los actores internos", cus: ["CUS16", "CUS17"],
    description: "Tablero inicial del rol activo. Resume los indicadores del legajo y del trámite: evidencias por atender, estado documental del legajo, solicitudes recientes y accesos directos a las bandejas de trabajo. Es el punto de entrada de los actores internos y la vista de consulta del docente, donde se reflejan las propuestas y decisiones (CUS16) y el historial reciente (CUS17).",
    shots: [ { file: "capturas/02-panel.png", caption: "Panel de gestión con indicadores, bandeja «Por atender» y solicitudes recientes." } ] },
  { id: "docentes", title: "Docentes y legajos", route: "/docentes", component: "Teachers", actors: "Personal de legajos", cus: ["CUS01"],
    description: "Directorio de docentes. Permite buscar y filtrar fichas por facultad, registrar un docente nuevo y abrir su legajo. Es la pantalla del CUS01 «Registrar y editar ficha del docente»: el personal de legajos da de alta la ficha y edita sus datos de adscripción y categoría.",
    shots: [ { file: "capturas/03-docentes.png", caption: "Directorio docente con buscador, filtro por facultad y acción «Registrar docente»." } ] },
  { id: "legajo", title: "Legajo del docente", route: "/legajos/:id", component: "Dossier", actors: "Docente (propio) · Personal de legajos · Comisión", cus: ["CUS02", "CUS03", "CUS05", "CUS17"],
    description: "Expediente del docente organizado en pestañas. El Resumen muestra la trayectoria y el estado documental; «Grados y experiencia» reúne títulos, grados y la trayectoria laboral (CUS03); «Méritos» concentra todas las evidencias y permite registrar un mérito nuevo (CUS02) o corregir uno observado (CUS05); «Documentos» es el archivo documental con vista previa; e «Historial» conserva revisiones, correcciones y el registro de auditoría del legajo (CUS17).",
    shots: [
      { file: "capturas/04-legajo-resumen.png", caption: "Pestaña «Resumen»: trayectoria académica, ratificación documental y próximo paso." },
      { file: "capturas/05-legajo-grados.png", caption: "Pestaña «Grados y experiencia»: grados acreditados y trayectoria laboral (CUS03)." },
      { file: "capturas/06-legajo-meritos.png", caption: "Pestaña «Méritos»: evidencias con estado y acciones «Ver», «Corregir» y «Revisar» (CUS02/CUS05)." },
      { file: "capturas/07-legajo-documentos.png", caption: "Pestaña «Documentos»: archivo documental con apertura de cada evidencia." },
      { file: "capturas/08-legajo-historial.png", caption: "Pestaña «Historial»: revisiones conservadas y línea de tiempo de auditoría (CUS17)." }
    ] },
  { id: "revision", title: "Revisión documental", route: "/revision", component: "Review", actors: "Personal de legajos · Comisión", cus: ["CUS04"],
    description: "Bandeja de verificación documental. El revisor filtra por estado, revisa la evidencia y registra el resultado: verifica el mérito o lo observa solicitando una corrección justificada. Corresponde al CUS04 «Verificar u observar mérito» (RF: revisión documental con trazabilidad).",
    shots: [ { file: "capturas/09-revision.png", caption: "Bandeja de revisión con filtros por estado y acción «Revisar» por evidencia." } ] },
  { id: "solicitudes", title: "Solicitudes de promoción", route: "/solicitudes", component: "Requests", actors: "Docente · Personal de legajos · Comisión", cus: ["CUS09", "CUS10"],
    description: "Expedientes de promoción. El docente crea el borrador de su solicitud, elige la plaza y la presenta (CUS09); la oficina de legajos o la comisión puede observarla y devolverla para corrección (CUS10). La tabla muestra el estado de cada solicitud y las acciones disponibles según el rol.",
    shots: [ { file: "capturas/10-solicitudes.png", caption: "Listado de solicitudes con estado, plaza y acciones (presentar / observar)." } ] },
  { id: "evaluaciones", title: "Evaluaciones", route: "/evaluaciones · /evaluaciones/:id", component: "EvaluationView", actors: "Comisión evaluadora", cus: ["CUS11"],
    description: "Evaluación de las solicitudes por la comisión. La lista muestra las solicitudes a evaluar; el detalle calcula, con la rúbrica vigente, el cumplimiento de requisitos, la plaza disponible y el desglose del puntaje, y permite cerrar la evaluación dejando el fundamento. Corresponde al CUS11 «Evaluar y cerrar evaluación».",
    shots: [
      { file: "capturas/11-evaluaciones.png", caption: "Lista de solicitudes a evaluar, con acceso al detalle por expediente." },
      { file: "capturas/12-evaluacion-detalle.png", caption: "Detalle: requisitos, desglose del puntaje, evidencias consideradas y resultado." }
    ] },
  { id: "convocatorias", title: "Convocatorias", route: "/convocatorias", component: "Calls", actors: "Personal de legajos", cus: ["CUS07"],
    description: "Convocatorias de promoción. Permite crear una convocatoria con su periodo de presentación, asociar las plazas, aplicar la rúbrica aprobada y controlar su estado (abierta, en evaluación, cerrada). Corresponde al CUS07 «Gestionar convocatoria y plazas».",
    shots: [ { file: "capturas/13-convocatorias.png", caption: "Convocatoria con periodo, plazas asociadas, rúbrica aplicada y estado." } ] },
  { id: "orden-merito", title: "Orden de mérito", route: "/orden-merito", component: "MeritOrder", actors: "Comisión · Decanato", cus: ["CUS12", "CUS13"],
    description: "Cuadro comparativo de postulantes por convocatoria y plaza. Ordena por puntaje, señala empates y resultados, y avisa si el cuadro está incompleto. El decanato puede preparar la propuesta del primer puesto apto, conservando el orden de mérito. Corresponde a los CUS12 «Consultar orden de mérito» y CUS13 «Preparar propuesta».",
    shots: [ { file: "capturas/14-orden-merito.png", caption: "Orden de mérito: puesto, puntaje, resultado y acción «Preparar propuesta»." } ] },
  { id: "propuestas", title: "Propuestas y decisiones", route: "/propuestas", component: "Proposals", actors: "Decanato · Consejo de Facultad · Consejo Universitario · Docente", cus: ["CUS14", "CUS15", "CUS16"],
    description: "Trámite institucional de la propuesta. Sigue el informe del decanato, el acuerdo del Consejo de Facultad y la decisión del Consejo Universitario, con una línea de tiempo por etapa y referencia ficticia. El docente consulta sus propias propuestas y el estado del trámite. Corresponde a los CUS14 «Remitir y elevar propuesta», CUS15 «Registrar decisión» y CUS16 «Consultar propuestas y decisiones».",
    shots: [ { file: "capturas/15-propuestas.png", caption: "Propuesta con informe del decanato, orden de mérito conservado y seguimiento del trámite." } ] },
  { id: "rubrica", title: "Rúbricas y requisitos", route: "/rubrica", component: "Rubric", actors: "Personal de legajos", cus: ["CUS06"],
    description: "Criterios de evaluación. El personal de legajos crea versiones de la rúbrica con sus criterios y requisitos por categoría y las aprueba; una vez aprobada, la versión no puede editarse ni eliminarse (RN09), y solo puede usarse si está aprobada. Corresponde al CUS06 «Gestionar rúbrica y requisitos» (RF10).",
    shots: [ { file: "capturas/16-rubrica.png", caption: "Rúbrica vigente con criterios, condiciones por categoría y estado de aprobación." } ] }
];

const WITHOUT_SCREEN = ["CUS08", "CUS18"];

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades del navegador
// ─────────────────────────────────────────────────────────────────────────────
async function waitServer(page, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 5000 }); if (r) return; } catch { /* retry */ }
    await page.waitForTimeout(2000);
  }
  throw new Error("El servidor de desarrollo no respondió en " + BASE);
}

async function setProfile(page, name) {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const combo = page.getByRole("combobox", { name: "Perfil de demostración", exact: true });
  await combo.waitFor({ state: "visible", timeout: 20000 });
  await combo.click();
  await page.getByRole("option", { name, exact: true }).click();
  await page.waitForURL(/\/$/, { timeout: 20000 });
  await page.waitForTimeout(600);
}

async function shot(page, file, caption) {
  const target = path.join(outDir, file);
  mkdirSync(path.dirname(target), { recursive: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: target, fullPage: true });
  console.log("  captura:", file, "·", caption);
}

// ─────────────────────────────────────────────────────────────────────────────
// Render del esquema de colaboración
// ─────────────────────────────────────────────────────────────────────────────
function diagramHtml(d) {
  const parts = [];
  const obj = (cls, stereo, name, sub) => `<div class="obj ${cls}"><small>${stereo}</small><b>${name}</b>${sub ? `<em>${sub}</em>` : ""}</div>`;
  const link = n => `<div class="link"><span class="num">${n}</span><span class="dash"></span></div>`;
  parts.push(obj("actor", "«actor»", d.actor, ""));
  parts.push(link(1));
  parts.push(obj("iu", "«boundary»", d.iu, d.route));
  parts.push(link(2));
  parts.push(obj("ctrl", "«control»", d.cc, d.method));
  d.entities.forEach((e, i) => { parts.push(link(3 + i)); parts.push(obj("ent", "«entity»", e.obj, e.tbl)); });
  parts.push(link(3 + d.entities.length));
  parts.push(obj("aud", "«entity»", ":AuditoriaEvento", "auditoria_evento"));
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}
    body{margin:0;font-family:"Segoe UI",Arial,sans-serif;background:#fff;}
    #fig{width:1080px;padding:20px 22px;}
    .head{display:flex;align-items:baseline;gap:14px;border-bottom:2px solid #0f766e;padding-bottom:7px;margin-bottom:16px;}
    .head .dc{font-family:Consolas,monospace;font-weight:700;color:#0f766e;font-size:16px;}
    .head .nm{color:#334155;font-size:13px;}
    .chain{display:flex;flex-wrap:wrap;align-items:center;gap:2px;}
    .obj{border:1.5px solid #0e7490;border-radius:9px;padding:7px 11px;min-width:128px;background:#f0f9ff;}
    .obj small{display:block;font-size:8.5px;color:#64748b;text-transform:uppercase;letter-spacing:.6px;}
    .obj b{display:block;font-size:12px;color:#0f172a;font-weight:600;}
    .obj em{display:block;font-size:10px;color:#475569;font-style:normal;font-family:Consolas,monospace;}
    .obj.actor{border-color:#0f766e;background:#ecfdf5;}
    .obj.ctrl{border-color:#7c3aed;background:#f5f3ff;}
    .obj.ent{border-color:#b45309;background:#fffbeb;}
    .obj.aud{border-color:#b91c1c;background:#fef2f2;}
    .link{display:flex;flex-direction:column;align-items:center;width:40px;color:#94a3b8;}
    .link .num{font-weight:700;color:#0f766e;font-size:10px;}
    .link .dash{width:100%;border-top:2px solid #94a3b8;position:relative;margin-top:2px;}
    .link .dash::after{content:"";position:absolute;right:-1px;top:-4px;border-left:7px solid #94a3b8;border-top:4px solid transparent;border-bottom:4px solid transparent;}
    .msgs{margin:16px 0 2px;padding-left:18px;columns:2;column-gap:26px;}
    .msgs li{font-family:Consolas,monospace;font-size:10.5px;color:#334155;margin:1.5px 0;break-inside:avoid;}
    .ret{margin-top:10px;font-size:11px;color:#475569;}
    .ret b{color:#0f766e;}
  </style></head><body><div id="fig">
    <div class="head"><span class="dc">${d.dc}</span><span class="nm">${d.name}</span></div>
    <div class="chain">${parts.join("")}</div>
    <ol class="msgs">${d.messages.map(m => `<li>${m}</li>`).join("")}</ol>
    <div class="ret">Retorno esperado: <b>${d.returns}</b> · Al pulsar <b>F5</b> en Rational Rose se genera el diagrama de secuencia <b>${d.dc}_SD</b>.</div>
  </div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ejecución
// ─────────────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ channel: CHANNEL });
const context = await browser.newContext({ viewport: { width: 1440, height: 1040 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on("pageerror", e => console.log("  [pageerror]", e.message));

console.log("Esperando al servidor…");
await waitServer(page);
console.log("Servidor listo. Preparando datos de demostración…");

// — Flujo previo: evaluar, cerrar recepción, preparar propuesta y tramitarla —
await setProfile(page, "Comisión evaluadora");
// s2 (Gabriel Torres) no tiene evidencias pendientes: puede cerrarse directamente.
{
  await page.goto(BASE + "/evaluaciones/s2", { waitUntil: "networkidle" });
  await page.getByLabel("Fundamento del resultado").fill("Cumple los requisitos de la convocatoria y cuenta con plaza correspondiente.");
  await page.getByRole("button", { name: "Cerrar evaluación", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.waitForTimeout(600);
}
await setProfile(page, "Personal de legajos");
await page.goto(BASE + "/convocatorias", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Cerrar recepción", exact: true }).click();
await page.getByRole("button", { name: "Confirmar", exact: true }).click();
await page.waitForTimeout(600);
await setProfile(page, "Decanato");
await page.goto(BASE + "/orden-merito", { waitUntil: "networkidle" });
await page.getByRole("combobox", { name: "Plaza del orden de mérito", exact: true }).click();
await page.getByRole("option", { name: /PL-002/ }).click();
await page.getByRole("button", { name: "Preparar propuesta", exact: true }).click();
await page.getByLabel("Informe del decanato").fill("El docente ocupa el primer puesto del cuadro y cumple las condiciones para la propuesta.");
await page.getByRole("button", { name: "Guardar propuesta", exact: true }).click();
await page.waitForTimeout(700);
async function tramite(btnName, reference) {
  await page.getByRole("button", { name: btnName, exact: true }).click();
  await page.getByLabel("Oficio, acuerdo o resolución de ejemplo").fill(reference);
  await page.getByLabel("Fundamento del trámite").fill("Se registra el fundamento académico de esta etapa de demostración.");
  await page.getByRole("button", { name: "Confirmar trámite", exact: true }).click();
  await page.waitForTimeout(700);
}
await page.goto(BASE + "/propuestas", { waitUntil: "networkidle" });
await tramite("Remitir a Facultad", "OF-DEMO-2026");
await setProfile(page, "Consejo de Facultad");
await page.goto(BASE + "/propuestas", { waitUntil: "networkidle" });
await tramite("Elevar al Consejo Universitario", "AC-DEMO-2026");
await setProfile(page, "Consejo Universitario");
await page.goto(BASE + "/propuestas", { waitUntil: "networkidle" });
await tramite("Registrar aprobación", "RES-DEMO-2026");
console.log("Datos de demostración listos.");

// — Capturas —
console.log("Capturando pantallas…");
await page.goto(BASE + "/login", { waitUntil: "networkidle" });
await shot(page, "capturas/01-login.png", "Portal de acceso");

await setProfile(page, "Personal de legajos");
await shot(page, "capturas/02-panel.png", "Panel de gestión");
await page.goto(BASE + "/docentes", { waitUntil: "networkidle" });
await shot(page, "capturas/03-docentes.png", "Docentes");

await page.goto(BASE + "/legajos/t1", { waitUntil: "networkidle" });
await shot(page, "capturas/04-legajo-resumen.png", "Legajo · Resumen");
for (const [tab, file, cap] of [["Grados y experiencia", "capturas/05-legajo-grados.png", "Legajo · Grados y experiencia"], ["Méritos", "capturas/06-legajo-meritos.png", "Legajo · Méritos"], ["Documentos", "capturas/07-legajo-documentos.png", "Legajo · Documentos"], ["Historial", "capturas/08-legajo-historial.png", "Legajo · Historial"]]) {
  await page.getByRole("tab", { name: tab, exact: true }).click();
  await shot(page, file, cap);
}

await page.goto(BASE + "/revision", { waitUntil: "networkidle" });
await shot(page, "capturas/09-revision.png", "Revisión documental");
await page.goto(BASE + "/solicitudes", { waitUntil: "networkidle" });
await shot(page, "capturas/10-solicitudes.png", "Solicitudes");

await setProfile(page, "Comisión evaluadora");
await page.goto(BASE + "/evaluaciones", { waitUntil: "networkidle" });
await shot(page, "capturas/11-evaluaciones.png", "Evaluaciones (lista)");
await page.goto(BASE + "/evaluaciones/s2", { waitUntil: "networkidle" });
await shot(page, "capturas/12-evaluacion-detalle.png", "Evaluación (detalle)");

await setProfile(page, "Personal de legajos");
await page.goto(BASE + "/convocatorias", { waitUntil: "networkidle" });
await shot(page, "capturas/13-convocatorias.png", "Convocatorias");

await setProfile(page, "Decanato");
await page.goto(BASE + "/orden-merito", { waitUntil: "networkidle" });
await page.getByRole("combobox", { name: "Plaza del orden de mérito", exact: true }).click();
await page.getByRole("option", { name: /PL-002/ }).click();
await shot(page, "capturas/14-orden-merito.png", "Orden de mérito");

await setProfile(page, "Consejo Universitario");
await page.goto(BASE + "/propuestas", { waitUntil: "networkidle" });
await shot(page, "capturas/15-propuestas.png", "Propuestas y decisiones");

await setProfile(page, "Personal de legajos");
await page.goto(BASE + "/rubrica", { waitUntil: "networkidle" });
await shot(page, "capturas/16-rubrica.png", "Rúbricas y requisitos");

// — Diagramas —
console.log("Renderizando diagramas de colaboración…");
const diaPage = await context.newPage();
for (const cus of Object.keys(DIAGRAMS)) {
  const d = DIAGRAMS[cus];
  await diaPage.setContent(diagramHtml(d), { waitUntil: "load" });
  const target = path.join(diaDir, d.dc + ".png");
  await diaPage.locator("#fig").screenshot({ path: target });
  console.log("  diagrama:", d.dc);
}

// — Manifiesto —
const manifest = {
  generatedAt: new Date().toISOString(),
  app: BASE,
  diagrams: Object.fromEntries(Object.entries(DIAGRAMS).map(([cus, d]) => [cus, { ...d, file: "diagramas/" + d.dc + ".png" }])),
  screens: SCREENS,
  withoutScreen: WITHOUT_SCREEN
};
writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log("Manifiesto:", path.join(outDir, "manifest.json"));

await browser.close();
console.log("Listo.");
