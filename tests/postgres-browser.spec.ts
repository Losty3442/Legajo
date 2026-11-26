import {expect,chromium,type Page} from "@playwright/test";
import {test,resetTestDatabase,credential,mutation} from "./postgres-fixture";
import type {Role} from "../src/domain/models";
import {demoPdf} from "../src/infrastructure/seed";
import {readFile} from "node:fs/promises";
const roles:Record<string,Role>={"Docente":"docente","Personal de legajos":"legajos","Comisión evaluadora":"comision","Decanato":"decanato","Consejo de Facultad":"consejo_facultad","Consejo Universitario":"consejo_universitario"};
async function profile(page:Page,name:string,teacherId?:string){
  const logout=page.locator('button[title="Cerrar sesión"]').first();
  if(await logout.count()){await logout.click();await expect(page.getByLabel("Correo de acceso")).toBeVisible();}
  else await page.goto("/");
  const c=await credential(roles[name],roles[name]==="docente"?(teacherId??"t1"):undefined);
  await page.getByLabel("Correo de acceso").fill(c.email);await page.getByLabel("Contraseña",{exact:true}).fill(c.password);await page.getByRole("button",{name:"Ingresar",exact:true}).click();
  await expect(page.getByRole("heading",{name:name==="Docente"?"Tu trayectoria, en un solo lugar":"Panel de gestión",exact:true})).toBeVisible();
}
test.beforeEach(async({page})=>{await resetTestDatabase();await profile(page,"Personal de legajos");});
async function navigate(page: Page, name: string) {
  const link = page.getByRole("link", {
    name,
    exact: true
  }).first();
  const href = await link.getAttribute("href");
  await link.click();
  await expect(page).toHaveURL(new URL(href!, page.url()).href);
}
test("trámite completo hasta decisión institucional, visible al docente tras recargar", async ({ page }) => {
  await profile(page, "Comisión evaluadora");
  await page.goto("/evaluaciones/s2");
  await page.getByLabel("Fundamento del resultado").fill("Cumple los requisitos de la convocatoria y obtiene 84 puntos.");
  await page.getByRole("button", { name: "Cerrar evaluación", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resultado de evaluación", exact: true })).toBeVisible();
  await profile(page, "Personal de legajos");
  await navigate(page, "Convocatorias");
  await page.getByRole("button", { name: "Cerrar recepción", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText("En evaluación y trámite", { exact: true })).toBeVisible();
  await profile(page, "Decanato");
  await navigate(page, "Orden de mérito");
  await page.getByRole("combobox", { name: "Plaza del orden de mérito", exact: true }).click();
  await page.getByRole("option", { name: /PL-002/ }).click();
  await page.getByRole("button", { name: "Preparar propuesta", exact: true }).click();
  await page.getByLabel("Informe del decanato").fill("El docente ocupa el primer puesto y cumple las condiciones para propuesta.");
  await page.getByRole("button", { name: "Guardar propuesta", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await navigate(page, "Propuestas y decisiones");
  async function step(button: string, reference: string) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await page.getByLabel("Oficio, acuerdo o resolución de ejemplo").fill(reference);
    await page.getByLabel("Fundamento del trámite").fill("Se registra el fundamento académico de esta etapa de demostración.");
    await page.getByRole("button", { name: "Confirmar trámite", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await step("Remitir a Facultad", "OF-DEMO-2026");
  await profile(page, "Consejo de Facultad");
  await navigate(page, "Propuestas y decisiones");
  await step("Elevar al Consejo Universitario", "AC-DEMO-2026");
  await profile(page, "Consejo Universitario");
  await navigate(page, "Propuestas y decisiones");
  await step("Registrar aprobación", "RES-DEMO-2026");
  await expect(page.getByText("RES-DEMO-2026", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/proposal-desktop.png", fullPage: true });
  await profile(page, "Docente");
  await profile(page, "Docente", "t2");
  await expect(page.getByRole("heading", { name: "Tu trayectoria, en un solo lugar", exact: true })).toBeVisible();
  await navigate(page, "Propuestas y decisiones");
  await page.reload();
  await expect(page.getByText("RES-DEMO-2026", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar aprobación", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/proposal-mobile.png", fullPage: true });
});

test("Legajos registra una plaza y la incorpora a una convocatoria", async ({ page }) => {
  await navigate(page, "Convocatorias");
  await page.getByRole("button", { name: "Registrar plaza", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Registrar plaza" });
  await dialog.getByLabel("Código de la plaza").fill(" conc-101 ");
  await expect(dialog.getByRole("combobox", { name: "Departamento académico" })).toBeDisabled();
  for (const [field, option] of [
    ["Facultad", "Ingeniería · Demo"],
    ["Departamento académico", "Informática · Demo"],
    ["Categoría de destino", "Asociado"],
    ["Dedicación", "Tiempo completo"]
  ]) {
    await dialog.getByRole("combobox", { name: field, exact: true }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  }
  await dialog.getByRole("button", { name: "Guardar plaza", exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole("button", { name: "Nueva convocatoria", exact: true }).click();
  await page.getByLabel("Nombre de la convocatoria").fill("Convocatoria con plaza recién registrada");
  await page.getByLabel("Inicio de presentación").fill("2026-01-01");
  await page.getByLabel("Fin de presentación").fill("2026-12-31");
  await page.getByRole("checkbox", { name: /CONC-101/ }).check();
  await page.getByRole("button", { name: "Guardar convocatoria", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  const call = page.locator("section").filter({ has: page.getByRole("heading", { name: "Convocatoria con plaza recién registrada" }) });
  await expect(call.getByText("CONC-101 · Informática · Demo · Asociado · Tiempo completo")).toBeVisible();

  await profile(page, "Comisión evaluadora");
  const response = await mutation(page.request, "/vacancies", {
    code: "CONC-102", faculty: "Ingeniería · Demo", department: "Informática · Demo",
    category: "Asociado", dedication: "Tiempo completo"
  });
  expect(response.status()).toBe(403);
});

test("crea convocatoria y registra título y experiencia con persistencia", async ({ page }) => {
  await navigate(page, "Convocatorias");
  await page.getByRole("button", { name: "Nueva convocatoria", exact: true }).click();
  await page.getByLabel("Nombre de la convocatoria").fill("Convocatoria adicional E2E");
  await page.getByLabel("Inicio de presentación").fill("2026-09-01");
  await page.getByLabel("Fin de presentación").fill("2026-12-31");
  await page.getByRole("checkbox", { name: /PL-001/ }).check();
  await page.getByRole("button", { name: "Guardar convocatoria", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Convocatoria adicional E2E", exact: true })).toBeVisible();
  await profile(page, "Docente");
  await navigate(page, "Mi legajo");
  await page.getByRole("button", { name: "Agregar mérito", exact: true }).click();
  await page.getByRole("combobox", { name: "Tipo de mérito", exact: true }).click();
  await page.getByRole("option", { name: "Título profesional", exact: true }).click();
  await page.getByLabel("Nombre del mérito", { exact: true }).fill("Título profesional E2E");
  await page.getByLabel("Institución emisora", { exact: true }).fill("Universidad de demostración");
  await page.getByLabel("Fecha del documento o actividad", { exact: true }).fill("2016-01-01");
  await page.locator('input[type="file"]').setInputFiles({ name: "titulo.pdf", mimeType: "application/pdf", buffer: Buffer.from(await demoPdf("Título").arrayBuffer()) });
  await page.getByRole("button", { name: "Guardar mérito", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("tab", { name: "Grados y experiencia", exact: true }).click();
  await expect(page.getByText("Título profesional E2E", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Agregar experiencia", exact: true }).click();
  await page.getByLabel("Institución o empleador").fill("Instituto de ejemplo");
  await page.getByLabel("Cargo o función").fill("Docente investigador");
  await page.getByLabel("Inicio de experiencia").fill("2018-01-01");
  await page.getByRole("combobox", { name: "Evidencia de experiencia", exact: true }).click();
  await page.getByRole("option", { name: "Título profesional E2E", exact: true }).click();
  await page.getByRole("button", { name: "Guardar experiencia", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("tab", { name: "Grados y experiencia", exact: true }).click();
  await expect(page.getByText("Docente investigador · Instituto de ejemplo", { exact: true })).toBeVisible();
});
async function review(page: Page, title: string, observe = false) {
  await navigate(page, "Revisión documental");
  await page.getByRole("row").filter({
    hasText: title
  }).getByRole("button", {
    name: "Revisar",
    exact: true
  }).click();
  if (observe) {
    await page.getByRole("combobox", {
      name: "Resultado de revisión"
    }).click();
    await page.getByRole("option", {
      name: "Observar y solicitar corrección",
      exact: true
    }).click();
    await page.getByLabel("Justificación (obligatoria)").fill("El documento necesita una fecha legible.");
  }
  await page.getByRole("button", {
    name: "Registrar revisión",
    exact: true
  }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
test("recorrido completo con PDF, corrección, solicitud y resultado persistente", async ({
  page
}) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const pdf = Buffer.from(await demoPdf("Ponencia E2E corregida").arrayBuffer());
  await profile(page, "Docente");
  await navigate(page, "Mi legajo");
  await page.getByRole("button", {
    name: "Agregar mérito",
    exact: true
  }).click();
  await page.getByLabel("Nombre del mérito", {
    exact: true
  }).fill("Ponencia E2E");
  await page.getByLabel("Institución emisora", {
    exact: true
  }).fill("Universidad de ejemplo");
  await page.getByLabel("Fecha del documento o actividad", {
    exact: true
  }).fill("2026-08-01");
  await page.locator('input[type="file"]').setInputFiles({
    name: "ponencia.pdf",
    mimeType: "application/pdf",
    buffer: pdf
  });
  await page.getByRole("button", {
    name: "Guardar mérito",
    exact: true
  }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await profile(page, "Personal de legajos");
  await review(page, "Ponencia E2E", true);
  await profile(page, "Docente");
  await navigate(page, "Mi legajo");
  await page.getByRole("tab", {
    name: "Méritos",
    exact: true
  }).click();
  const row = page.getByRole("row").filter({
    hasText: "Ponencia E2E"
  });
  await expect(row).toContainText("Observado");
  await row.getByRole("button", {
    name: "Corregir",
    exact: true
  }).click();
  await page.getByLabel("Nombre del mérito", {
    exact: true
  }).fill("Ponencia E2E corregida");
  await page.locator('input[type="file"]').setInputFiles({
    name: "corregida.pdf",
    mimeType: "application/pdf",
    buffer: pdf
  });
  await page.getByRole("button", {
    name: "Reenviar evidencia",
    exact: true
  }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("tab", {
    name: "Méritos",
    exact: true
  }).click();
  await page.getByRole("row").filter({
    hasText: "Ponencia E2E corregida"
  }).getByRole("button", {
    name: "Ver",
    exact: true
  }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", {
    name: "Descargar documento"
  }).click();
  const file = await downloaded;
  expect(await readFile((await file.path())!)).toEqual(pdf);
  await page.keyboard.press("Escape");
  await profile(page, "Personal de legajos");
  await review(page, "Ponencia E2E corregida");
  await review(page, "Transformación digital en la universidad");
  await navigate(page, "Solicitudes");
  await page.getByRole("row").filter({
    hasText: "María Valeria Ríos"
  }).getByRole("button", {
    name: "Observar",
    exact: true
  }).click();
  await page.getByLabel("Observación", {
    exact: true
  }).fill("Confirma el documento corregido antes de reenviar.");
  await page.getByRole("button", {
    name: "Enviar observación",
    exact: true
  }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await profile(page, "Docente");
  await navigate(page, "Solicitudes");
  await page.getByRole("button", {
    name: "Reenviar",
    exact: true
  }).click();
  await page.getByRole("button", {
    name: "Confirmar",
    exact: true
  }).click();
  await expect(page.getByRole("row").filter({
    hasText: "María Valeria Ríos"
  })).toContainText("Presentada");
  await profile(page, "Comisión evaluadora");
  await navigate(page, "Evaluaciones");
  await page.getByRole("row").filter({
    hasText: "María Valeria Ríos"
  }).getByRole("link", {
    name: "Evaluar",
    exact: true
  }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "59");
  await page.getByLabel("Fundamento del resultado").fill("Cumple requisitos, tiene 59 puntos y plaza correspondiente.");
  await page.getByRole("button", {
    name: "Cerrar evaluación",
    exact: true
  }).click();
  await page.getByRole("button", {
    name: "Confirmar",
    exact: true
  }).click();
  await expect(page.getByRole("heading", {
    name: "Resultado de evaluación",
    exact: true
  })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", {
    name: "Resultado de evaluación",
    exact: true
  })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "59");
  await expect(page.getByText("Cumple requisitos, tiene 59 puntos y plaza correspondiente.", {
    exact: true
  })).toBeVisible();
  await page.screenshot({
    path: "test-results/result-desktop.png",
    fullPage: true
  });
  expect(errors).toEqual([]);
});

test("cuenta nueva y datos compartidos desde otro navegador",async({page})=>{
  await navigate(page,"Docentes y legajos");await page.getByRole("button",{name:"Registrar docente",exact:true}).click();
  await page.getByLabel("Nombres y apellidos",{exact:true}).fill("Docente Persistente Navegador");await page.getByLabel("Correo electrónico",{exact:true}).fill("persistente@example.test");await page.getByLabel("Especialidad",{exact:true}).fill("Persistencia PostgreSQL");await page.getByLabel("Inicio en la categoría actual",{exact:true}).fill("2020-01-01");
  await page.getByRole("button",{name:"Guardar docente",exact:true}).click();await expect(page.getByRole("heading",{name:"Cuenta docente creada"})).toBeVisible();await page.keyboard.press("Escape");
  const other=await chromium.launch({channel:"chrome",headless:true});try{const second=await other.newPage();await second.goto("http://localhost:5183");await profile(second,"Personal de legajos");await navigate(second,"Docentes y legajos");await second.getByRole("textbox",{name:"Buscar docentes"}).fill("Docente Persistente Navegador");await expect(second.getByRole("row").filter({hasText:"Docente Persistente Navegador"})).toBeVisible();}finally{await other.close();}
  await expect(page.getByRole("combobox",{name:"Perfil de demostración"})).toHaveCount(0);await expect(page.getByRole("button",{name:/Restaurar/})).toHaveCount(0);
});
test("error recuperable sin volver a IndexedDB",async({page})=>{
  await page.route("**/api/v1/workspace",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({code:"DATABASE_UNAVAILABLE",message:"PostgreSQL temporalmente no disponible."})}));
  await page.reload();await expect(page.getByText("No pudimos cargar los datos",{exact:true})).toBeVisible();await page.unroute("**/api/v1/workspace");await page.getByRole("button",{name:"Volver a intentar"}).click();await expect(page.getByRole("heading",{name:"Panel de gestión",exact:true})).toBeVisible();expect(await page.evaluate(async()=>(await indexedDB.databases()).some(d=>d.name==="unp-legajos-demo"))).toBe(false);
});
