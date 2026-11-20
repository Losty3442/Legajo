// Genera una figura con el árbol del explorador de Rational Rose, para guiar
// al docente: indica dónde están los diagramas de colaboración y sus secuencias.
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const info = path.join(root, "docs", "informe");
mkdirSync(info, { recursive: true });

const manifest = JSON.parse(readFileSync(path.join(info, "manifest.json"), "utf8"));
const cus = Object.keys(manifest.diagrams).sort();
const row = (dc, tag, cls) =>
  `<div class="row leaf"><span class="bullet">▪</span><span class="dc">${dc}</span><span class="tag ${cls}">${tag}</span></div>`;
const leaves = cus.map(c => {
  const dc = manifest.diagrams[c].dc;
  return row(dc, "Colaboración", "col") + row(dc + "_SD", "Secuencia", "seq");
}).join("");

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}
  body{margin:0;font-family:"Segoe UI",Arial,sans-serif;background:#fff;}
  #fig{width:1020px;padding:22px 26px;background:#fff;}
  .cap{display:flex;align-items:baseline;gap:12px;border-bottom:2px solid #0f766e;padding-bottom:7px;margin-bottom:14px;}
  .cap b{font-family:Consolas,monospace;color:#0f766e;font-size:16px;}
  .cap span{color:#334155;font-size:12.5px;}
  .tree{font-size:14px;color:#0f172a;}
  .lvl1{margin-left:0} .lvl2{margin-left:22px} .lvl3{margin-left:44px} .lvl4{margin-left:66px}
  .branch{border-left:1px solid #cbd5e1;padding-left:0;}
  .row{display:flex;align-items:center;gap:8px;padding:1.5px 0;line-height:1.5;}
  .root{font-weight:700;color:#0f766e;font-size:15px;}
  .folder{font-weight:600;color:#1e293b;}
  .toggle{color:#64748b;font-size:11px;width:12px;display:inline-block;}
  .bullet{color:#0ea5e9;font-size:11px;width:12px;display:inline-block;}
  .dc{font-family:Consolas,monospace;font-size:12.5px;color:#0f766e;}
  .tag{margin-left:auto;font-size:9.5px;font-weight:700;padding:1px 8px;border-radius:9px;border:1px solid;}
  .tag.col{background:#e8f6f1;color:#0b6b52;border-color:#9dd9c6;}
  .tag.seq{background:#eef2f7;color:#475569;border-color:#cbd5e1;}
  .banner{margin-top:14px;background:#f2f7f9;border-left:4px solid #0f766e;border-radius:0 6px 6px 0;padding:9px 12px;font-size:12px;color:#334155;}
  .banner b{color:#0f766e;}
</style></head><body><div id="fig">
  <div class="cap"><b>Rational Rose — explorador del modelo</b><span>Ubicación de los diagramas de colaboración</span></div>
  <div class="tree">
    <div class="row lvl1"><span class="toggle">▼</span><span class="root">SISTEMA_DE_LEGAJOS_COMPLETO</span></div>
    <div class="lvl2">
      <div class="row"><span class="toggle">▼</span><span class="folder">Use Case View</span></div>
      <div class="lvl3">
        <div class="row"><span class="toggle">▶</span><span class="folder">Business Use-Case Model</span></div>
        <div class="row"><span class="toggle">▼</span><span class="folder">Diagramas de Colaboración</span></div>
        <div class="lvl4">
          <div class="row"><span class="toggle">▶</span><span class="folder">Actores</span></div>
          <div class="row"><span class="toggle">▶</span><span class="folder">Elementos</span></div>
          ${leaves}
        </div>
      </div>
    </div>
  </div>
  <div class="banner"><b>Aquí están los diagramas de colaboración.</b> El paquete «Diagramas de Colaboración» reúne los 18 casos de uso: cada uno tiene su diagrama de colaboración (<b>DC_CUSxx_NombreCorto</b>) y su diagrama de secuencia (<b>DC_CUSxx_NombreCorto_SD</b>), generado al pulsar <b>F5</b>.</div>
</div></body></html>`;

const browser = await chromium.launch({ channel: process.env.PDF_BROWSER || "msedge" });
const page = await browser.newPage({ viewport: { width: 1080, height: 1400 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "load" });
const target = path.join(info, "arbol-rational-rose.png");
await page.locator("#fig").screenshot({ path: target });
await browser.close();
console.log("Figura generada:", target);
