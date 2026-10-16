import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { demoPdf } from "../src/infrastructure/seed";
async function profile(page: Page, name: string) {
  await page.getByRole("combobox", {
    name: "Perfil de demostración",
    exact: true
  }).click();
  await page.getByRole("option", {
    name,
    exact: true
  }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: name === "Docente" ? "Tu trayectoria, en un solo lugar" : "Panel de gestión", exact: true })).toBeVisible();
}
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
  await page.getByRole("combobox", { name: "Docente de demostración", exact: true }).click();
  await page.getByRole("option", { name: "Gabriel Torres Salazar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tu trayectoria, en un solo lugar", exact: true })).toBeVisible();
  await navigate(page, "Propuestas y decisiones");
  await page.reload();
  await expect(page.getByText("RES-DEMO-2026", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar aprobación", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/proposal-mobile.png", fullPage: true });
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
test.beforeEach(async ({
  page
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", {
    name: "Panel de gestión",
    exact: true
  })).toBeVisible();
});
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
test("registro, edición, búsqueda y filtros de docentes", async ({
  page
}) => {
  await navigate(page, "Docentes y legajos");
  await page.getByRole("button", {
    name: "Registrar docente",
    exact: true
  }).click();
  await page.getByLabel("Nombres y apellidos", {
    exact: true
  }).fill("Docente Prueba Persistente");
  await page.getByLabel("Correo electrónico", {
    exact: true
  }).fill("prueba@ejemplo.test");
  await page.getByLabel("Especialidad", {
    exact: true
  }).fill("Análisis de sistemas");
  await page.getByLabel("Inicio en la categoría actual", {
    exact: true
  }).fill("2020-01-01");
  await page.getByRole("button", {
    name: "Guardar docente",
    exact: true
  }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("textbox", {
    name: "Buscar docentes"
  }).fill("Docente Prueba");
  const row = page.getByRole("row").filter({
    hasText: "Docente Prueba Persistente"
  });
  await row.getByRole("link", {
    name: "Ver legajo"
  }).click();
  await page.getByRole("button", {
    name: "Editar ficha",
    exact: true
  }).click();
  await page.getByLabel("Especialidad", {
    exact: true
  }).fill("Arquitectura por capas");
  await page.getByRole("button", {
    name: "Guardar docente",
    exact: true
  }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Arquitectura por capas", {
    exact: true
  })).toBeVisible();
});
test("perfil docente limita las fichas y comisión puede cerrar sin vacante", async ({
  page
}) => {
  await profile(page, "Docente");
  await page.goto("/legajos/t2");
  await expect(page.getByText("Legajo no disponible", { exact: true })).toBeVisible();
  await navigate(page, "Mi legajo");
  await expect(page.getByRole("heading", {
    name: "María Valeria Ríos",
    exact: true
  })).toBeVisible();
  await expect(page.getByRole("button", {
    name: "Editar ficha",
    exact: true
  })).toHaveCount(0);
  await expect(page.getByRole("link", {
    name: "Revisión documental",
    exact: true
  })).toHaveCount(0);
  await profile(page, "Comisión evaluadora");
  await navigate(page, "Evaluaciones");
  await page.getByRole("row").filter({
    hasText: "Diego Mendoza Ruiz"
  }).getByRole("link", {
    name: "Evaluar",
    exact: true
  }).click();
  await expect(page.getByText("Cumple, pero no hay plaza disponible", {
    exact: true
  })).toBeVisible();
  await page.getByLabel("Fundamento del resultado").fill("Cumple puntaje y requisitos, pero no cuenta con vacante.");
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
  await expect(page.getByText("Sin vacante", {
    exact: true
  })).toBeVisible();
});
test("teclado, diálogo con cambios, menú móvil y ausencia de desbordamiento", async ({
  page
}) => {
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", {
    name: "Saltar al contenido",
    exact: true
  })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#workspace")).toBeFocused();
  await navigate(page, "Docentes y legajos");
  await page.getByRole("button", {
    name: "Registrar docente",
    exact: true
  }).click();
  await page.getByLabel("Nombres y apellidos", {
    exact: true
  }).fill("Cambios sin guardar");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", {
    name: "Cancelar",
    exact: true
  }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByLabel("Nombres y apellidos", {
    exact: true
  })).toHaveValue("Cambios sin guardar");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", {
    name: "Confirmar",
    exact: true
  }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({
    width: 390,
    height: 844
  });
  await page.goto("/");
  await expect(page.getByRole("heading", {
    name: "Panel de gestión",
    exact: true
  })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true
  });
  await page.getByRole("button", {
    name: "Abrir navegación",
    exact: true
  }).click();
  await page.getByRole("dialog").getByRole("link", {
    name: "Docentes y legajos",
    exact: true
  }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", {
    name: "Docentes",
    exact: true
  })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({
    path: "test-results/directory-mobile.png",
    fullPage: true
  });
});
test("imagen PNG, nuevo borrador y evaluación con puntaje insuficiente", async ({
  page
}) => {
  await profile(page, "Docente");
  await page.getByRole("combobox", {
    name: "Docente de demostración",
    exact: true
  }).click();
  await page.getByRole("option", {
    name: "Andrés Navarro León",
    exact: true
  }).click();
  await navigate(page, "Mi legajo");
  await page.getByRole("button", {
    name: "Agregar mérito",
    exact: true
  }).click();
  await page.getByRole("combobox", {
    name: "Tipo de mérito",
    exact: true
  }).click();
  await page.getByRole("option", {
    name: "Participación académica",
    exact: true
  }).click();
  await page.getByLabel("Nombre del mérito", {
    exact: true
  }).fill("Participación con imagen PNG");
  await page.getByLabel("Institución emisora", {
    exact: true
  }).fill("Institución de prueba");
  await page.getByLabel("Fecha del documento o actividad", {
    exact: true
  }).fill("2026-08-01");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  await page.locator('input[type="file"]').setInputFiles({
    name: "ejemplo.png",
    mimeType: "image/png",
    buffer: png
  });
  await page.getByRole("button", {
    name: "Guardar mérito",
    exact: true
  }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await navigate(page, "Solicitudes");
  await page.getByRole("button", {
    name: "Nueva solicitud",
    exact: true
  }).click();
  await page.getByRole("combobox", {
    name: "Plaza correspondiente",
    exact: true
  }).click();
  await page.getByRole("option", {
    name: /PL-001/
  }).click();
  await page.getByRole("button", {
    name: "Guardar borrador",
    exact: true
  }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("row").filter({
    hasText: "Andrés Navarro León"
  })).toContainText("Borrador");
  await page.getByRole("button", {
    name: "Presentar",
    exact: true
  }).click();
  await page.getByRole("button", {
    name: "Confirmar",
    exact: true
  }).click();
  await expect(page.getByRole("row").filter({
    hasText: "Andrés Navarro León"
  })).toContainText("Presentada");
  await profile(page, "Personal de legajos");
  await review(page, "Participación con imagen PNG");
  await review(page, "Congreso de ingeniería de software");
  await profile(page, "Comisión evaluadora");
  await navigate(page, "Evaluaciones");
  await page.getByRole("row").filter({
    hasText: "Andrés Navarro León"
  }).getByRole("link", {
    name: "Evaluar",
    exact: true
  }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "52");
  await page.getByLabel("Fundamento del resultado").fill("Tiene 52 puntos, menos que el umbral de referencia.");
  await page.getByRole("button", {
    name: "Cerrar evaluación",
    exact: true
  }).click();
  await page.getByRole("button", {
    name: "Confirmar",
    exact: true
  }).click();
  await expect(page.getByText("No apto", {
    exact: true
  })).toBeVisible();
  await page.getByRole("row").filter({
    hasText: "Participación con imagen PNG"
  }).getByRole("button", {
    name: "Abrir",
    exact: true
  }).click();
  await expect(page.getByRole("img", {
    name: "ejemplo.png",
    exact: true
  })).toBeVisible();
  expect(await page.getByRole("img", {
    name: "ejemplo.png",
    exact: true
  }).evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1);
});

test("portal de inicio de sesión: credenciales UNP, acceso rápido y cierre de sesión", async ({ page }) => {
  // Ir al portal de login directamente
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sistema Integrado de Legajo y Promoción Docente", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Universidad Nacional de Piura", exact: true })).toBeVisible();

  // Cambiar a la pestaña de cuentas rápidas
  await page.getByRole("tab", { name: "Cuentas Oficiales de Prueba" }).click();
  await expect(page.getByRole("tabpanel").getByText("María Valeria Ríos", { exact: true })).toBeVisible();
  await expect(page.getByRole("tabpanel").getByText("Dra. Ana Salas Paredes", { exact: true })).toBeVisible();

  // Iniciar sesión con un clic como Dra. Ana Salas (Legajos)
  await page.getByRole("tabpanel").getByText("Dra. Ana Salas Paredes", { exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Panel de gestión", exact: true })).toBeVisible();
  await expect(page.getByText("Dra. Ana Salas", { exact: false }).first()).toBeVisible();

  // Probar cierre de sesión
  await page.getByRole("button", { name: "Cerrar sesión" }).first().click();
  await expect(page.getByRole("heading", { name: "Sistema Integrado de Legajo y Promoción Docente", exact: true })).toBeVisible();

  // Iniciar sesión con credenciales institucionales de docente
  await page.getByLabel("Correo Electrónico Institucional UNP").fill("mvrios@unp.edu.pe");
  await page.getByLabel("Contraseña / Código de Acceso").fill("unp2026");
  await page.getByRole("button", { name: "Iniciar Sesión Institucional" }).click();

  // Confirmar que entra al panel de docente
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Tu trayectoria, en un solo lugar", exact: true })).toBeVisible();
});
