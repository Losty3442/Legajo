import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const htmlPath = process.argv[2] ?? path.join(root, "docs", "conexion-diagramas-colaboracion-pantallas.html");
const pdfPath = process.argv[3] ?? path.join(root, "docs", "Conexion-diagramas-colaboracion-pantallas.pdf");

mkdirSync(path.dirname(pdfPath), { recursive: true });

const browser = await chromium.launch({ channel: process.env.PDF_BROWSER || "msedge" });
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
await page.emulateMedia({ media: "print" });
await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate:
    '<div style="width:100%;font-size:8px;color:#5b7286;padding:0 12mm;display:flex;justify-content:space-between;">' +
    "<span>Legajo y Promoción Docente · UNP — Diagramas de colaboración ↔ pantallas</span>" +
    '<span>Página <span class="pageNumber"></span> / <span class="totalPages"></span></span>' +
    "</div>",
  margin: { top: "14mm", bottom: "16mm", left: "12mm", right: "12mm" },
});

await browser.close();
console.log("PDF generado:", pdfPath);
