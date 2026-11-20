# -*- coding: utf-8 -*-
"""Genera el informe Word (.docx) de pantallas + diagramas de colaboración.
Lee docs/informe/manifest.json producido por scripts/informe-capturas.mjs."""
import json
import struct
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parent.parent
INFO = ROOT / "docs" / "informe"
MANIFEST = json.loads((INFO / "manifest.json").read_text(encoding="utf-8"))
OUT = ROOT / "docs" / "Informe-pantallas-y-diagramas-colaboracion-UNP.docx"

TEAL = RGBColor(0x0F, 0x76, 0x6E)
GREY = RGBColor(0x5B, 0x72, 0x86)
DARK = RGBColor(0x16, 0x28, 0x3A)
MAX_W_CM = 16.6
MAX_H_CM = 21.5


def png_size(path):
    with open(path, "rb") as fh:
        head = fh.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return (1440, 1000)
    return struct.unpack(">II", head[16:24])


def add_picture_fit(doc, rel_path):
    path = INFO / rel_path
    w, h = png_size(path)
    width_cm = MAX_W_CM
    if width_cm * h / w > MAX_H_CM:
        width_cm = MAX_H_CM * w / h
    doc.add_picture(str(path), width=Cm(width_cm))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER


def caption(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text)
    r.italic = True
    r.font.size = Pt(9)
    r.font.color.rgb = GREY
    return p


def note(doc, text, color=GREY, size=9.5, space_after=6):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.font.size = Pt(size)
    r.font.color.rgb = color
    p.paragraph_format.space_after = Pt(space_after)
    return p


def add_page_number(paragraph):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar"); begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText"); instr.set(qn("xml:space"), "preserve"); instr.text = "PAGE"
    end = OxmlElement("w:fldChar"); end.set(qn("w:fldCharType"), "end")
    run._r.append(begin); run._r.append(instr); run._r.append(end)


def shade(cell, hex_fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:fill"), hex_fill)
    tcPr.append(shd)


def set_col_widths(table, widths_cm):
    for row in table.rows:
        for cell, w in zip(row.cells, widths_cm):
            cell.width = Cm(w)


def style_table(table, headers, widths):
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, txt in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = ""
        run = cell.paragraphs[0].add_run(txt)
        run.bold = True
        run.font.size = Pt(8.5)
        run.font.color.rgb = RGBColor(0x11, 0x5E, 0x59)
        shade(cell, "EAF3F2")
    for row in table.rows[1:]:
        for cell in row.cells:
            for p in cell.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(8.5)
    set_col_widths(table, widths)


doc = Document()

# — Estilos base —
normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(10.5)
normal.font.color.rgb = DARK
normal.paragraph_format.space_after = Pt(6)

for name, size, color in (("Heading 1", 17, TEAL), ("Heading 2", 13.5, TEAL), ("Heading 3", 11.5, DARK)):
    st = doc.styles[name]
    st.font.name = "Calibri"
    st.font.size = Pt(size)
    st.font.color.rgb = color
    st.font.bold = True

sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21), Cm(29.7)
sec.left_margin = sec.right_margin = Cm(2.2)
sec.top_margin = Cm(2.0)
sec.bottom_margin = Cm(1.8)

# Pie de página con numeración
footer = sec.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
fr = footer.add_run("Sistema de Legajo y Promoción Docente · UNP · Página ")
fr.font.size = Pt(8); fr.font.color.rgb = GREY
add_page_number(footer)
fr2 = footer.add_run(" de ")
fr2.font.size = Pt(8); fr2.font.color.rgb = GREY
run = footer.add_run()
b = OxmlElement("w:fldChar"); b.set(qn("w:fldCharType"), "begin")
i = OxmlElement("w:instrText"); i.set(qn("xml:space"), "preserve"); i.text = "NUMPAGES"
e = OxmlElement("w:fldChar"); e.set(qn("w:fldCharType"), "end")
run._r.append(b); run._r.append(i); run._r.append(e)
run.font.size = Pt(8); run.font.color.rgb = GREY

doc.core_properties.title = "Pantallas y diagramas de colaboración · Legajo y Promoción Docente UNP"
doc.core_properties.author = "Análisis y Diseño de Sistemas 2"

# ───────────────────────────── Portada ─────────────────────────────
INTEGRANTES = [
    "Castro Herrera Fermín Aldahir",
    "Gómez Carnero Luis Alonso",
    "Rivas Gutiérrez David Eduardo",
]

for _ in range(2):
    doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("UNIVERSIDAD NACIONAL DE PIURA")
r.bold = True; r.font.size = Pt(14); r.font.color.rgb = TEAL
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Facultad de Ingeniería Industrial")
r.font.size = Pt(12); r.font.color.rgb = DARK
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Escuela Profesional de Ingeniería Informática")
r.font.size = Pt(12); r.font.color.rgb = DARK
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Asignatura: Análisis y Diseño de Sistemas 2")
r.font.size = Pt(11); r.font.color.rgb = GREY
doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Informe de pantallas\nLegajo y Promoción Docente")
r.bold = True; r.font.size = Pt(28); r.font.color.rgb = TEAL
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Capturas de cada pantalla, su descripción y los diagramas de colaboración involucrados")
r.font.size = Pt(12.5); r.font.color.rgb = DARK
doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Integrantes")
r.bold = True; r.font.size = Pt(11); r.font.color.rgb = GREY
for name in INTEGRANTES:
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(name)
    r.font.size = Pt(12); r.font.color.rgb = DARK
doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Ciclo VI")
r.bold = True; r.font.size = Pt(12); r.font.color.rgb = TEAL
doc.add_paragraph()
note(doc, "Prototipo académico · Sin base de datos conectada (IndexedDB) · Datos ficticios de demostración", size=10)
note(doc, "Referencia: Analisis_legajo_promocion_UNP_v2.pdf (CUS01–CUS18, §5) · Modelado en Rational Rose", size=10)
note(doc, f"Generado el {MANIFEST['generatedAt'][:10]} · Aplicación: {MANIFEST['app']}", size=9)
doc.add_page_break()

# ───────────────────────────── Índice ─────────────────────────────
doc.add_heading("Contenido", level=1)
idx = [("1. Propósito y alcance del informe", ""),
       ("2. Cómo se conectan los diagramas con las pantallas", ""),
       ("3. Ubicación de los diagramas en Rational Rose", ""),
       ("4. Resumen: pantallas, casos de uso y diagramas", "")]
for n, s in enumerate(MANIFEST["screens"], start=5):
    idx.append((f"{n}. Pantalla — {s['title']}  ({s['route']})", ""))
idx.append(("Anexo A. Casos de uso sin pantalla en el prototipo (fase institucional)", ""))
idx.append(("Anexo B. Verificación de trazabilidad en Rational Rose", ""))
for text, _ in idx:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(text)
    r.font.size = Pt(10.5)
doc.add_page_break()

# ───────────────────────────── 1. Propósito ─────────────────────────────
doc.add_heading("1. Propósito y alcance del informe", level=1)
doc.add_paragraph(
    "Este informe documenta, pantalla por pantalla, el prototipo del Sistema de Legajo y Promoción Docente "
    "de la Universidad Nacional de Piura. Para cada pantalla se incluye una captura tomada del sistema en "
    "ejecución, una descripción de lo que permite hacer y el detalle de los diagramas de colaboración "
    "involucrados (casos de uso, objetos de frontera, controladores y entidades), de modo que el modelado en "
    "Rational Rose y la interfaz del prototipo queden conectados de forma verificable."
)
doc.add_paragraph(
    "El prototipo se ejecuta sin base de datos conectada: toda la información se almacena en el navegador "
    "(IndexedDB) con datos ficticios de demostración. Las capturas se obtuvieron con el perfil interno "
    "indicado en cada sección. Los nombres de las tablas que aparecen junto a cada entidad corresponden al "
    "modelo relacional entregado (drizzle/0000_legajo_promocion_unp.sql), listo para una fase con servidor."
)
note(doc, "Leyenda de estados: ✔ recorrible en el prototipo · ◐ parcial · ⛔ declarado en el modelo, sin pantalla (fase institucional).")

# ───────────────────────────── 2. Conexión ─────────────────────────────
doc.add_heading("2. Cómo se conectan los diagramas con las pantallas", level=1)
doc.add_paragraph(
    "Cada caso de uso tiene un diagrama de colaboración en Rational Rose. Ese diagrama y su pantalla "
    "comparten la misma cadena de responsabilidades:"
)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Actor  →  IU: (pantalla)  →  CC_ (método del servicio)  →  entidades «entity»  →  :AuditoriaEvento")
r.bold = True; r.font.size = Pt(11); r.font.color.rgb = TEAL
doc.add_paragraph(
    "Donde el actor entra por la sesión, la frontera IU: es la pantalla o pestaña del prototipo, el "
    "coordinador CC_ corresponde a un método del servicio de la aplicación (o a una consulta de solo "
    "lectura) y las entidades «entity» son las colecciones del prototipo y las tablas del modelo relacional. "
    "Toda operación que modifica datos termina en una entrada de auditoría."
)
doc.add_heading("Reglas de trazabilidad", level=2)
for t in [
    "Un caso de uso implica un diagrama de colaboración, nombrado DC_CUSxx_NombreCorto.",
    "Al pulsar F5 en Rational Rose se genera el diagrama de secuencia DC_CUSxx_NombreCorto_SD.",
    "La frontera IU: corresponde a una pantalla o pestaña del prototipo (una ruta).",
    "El coordinador CC_ corresponde a un método del servicio (o a una consulta de solo lectura).",
    "Toda operación que modifica datos registra una entrada en :AuditoriaEvento.",
]:
    doc.add_paragraph(t, style="List Bullet")

# ───────────────────────────── 3. Rational Rose ─────────────────────────────
doc.add_page_break()
doc.add_heading("3. Ubicación de los diagramas en Rational Rose", level=1)
doc.add_paragraph(
    "Los diagramas de colaboración ya están construidos en el modelo de Rational Rose. El modelo se "
    "denomina SISTEMA_DE_LEGAJOS_COMPLETO y, dentro de Use Case View, el paquete «Diagramas de "
    "Colaboración» reúne los 18 casos de uso del sistema. Cada caso de uso tiene dos diagramas: el de "
    "colaboración (DC_CUSxx_NombreCorto) y el de secuencia (DC_CUSxx_NombreCorto_SD), que se obtiene "
    "al pulsar F5. Los diagramas de colaboración están disponibles en ese paquete para su revisión."
)
add_picture_fit(doc, "arbol-rational-rose.png")
caption(doc, "Figura. Árbol del explorador de Rational Rose: ubicación de los diagramas de colaboración y de sus secuencias.")
doc.add_heading("Cómo recorrerlos", level=2)
for t in [
    "Abrir Rational Rose y cargar el modelo SISTEMA_DE_LEGAJOS_COMPLETO.",
    "En el explorador, desplegar Use Case View → Diagramas de Colaboración.",
    "Cada entrada DC_CUSxx_NombreCorto es un diagrama de colaboración (objetos y mensajes numerados).",
    "La entrada DC_CUSxx_NombreCorto_SD es su diagrama de secuencia, generado con F5 (mismos objetos y mensajes).",
    "Las carpetas «Actores» y «Elementos» contienen los actores y las clases empleadas por los diagramas.",
]:
    doc.add_paragraph(t, style="List Bullet")
note(doc, "Los mismos pares de diagramas se representan, uno por uno, en las secciones de cada pantalla de este informe.")

# ───────────────────────────── 4. Resumen ─────────────────────────────
doc.add_page_break()
doc.add_heading("4. Resumen: pantallas, casos de uso y diagramas", level=1)
doc.add_paragraph(
    "Cuadro general que relaciona cada pantalla del prototipo con su ruta, sus casos de uso y los "
    "diagramas de colaboración que la respaldan."
)
t = doc.add_table(rows=1 + len(MANIFEST["screens"]), cols=4)
rows = [("Pantalla", "Ruta", "Casos de uso", "Diagramas de colaboración")]
for s in MANIFEST["screens"]:
    dcs = ", ".join(MANIFEST["diagrams"][c]["dc"] for c in s["cus"])
    rows.append((s["title"], s["route"], ", ".join(s["cus"]), dcs))
for i, r4 in enumerate(rows):
    for j, val in enumerate(r4):
        t.rows[i].cells[j].text = val
style_table(t, list(rows[0]), [3.6, 3.1, 2.6, 7.3])
doc.add_page_break()

# ───────────────────────────── Pantallas ─────────────────────────────
for n, s in enumerate(MANIFEST["screens"], start=5):
    doc.add_heading(f"{n}. Pantalla — {s['title']}", level=1)
    note(doc, f"Ruta: {s['route']}   ·   Componente: {s['component']}   ·   Actores: {s['actors']}", size=9.5)
    doc.add_paragraph(s["description"])

    for sh in s["shots"]:
        add_picture_fit(doc, sh["file"])
        caption(doc, "Figura. " + sh["caption"])

    doc.add_heading("Diagramas de colaboración involucrados", level=2)
    if s["cus"]:
        tb = doc.add_table(rows=1 + len(s["cus"]), cols=5)
        head = ["CUS", "Diagrama de colaboración", "Frontera (IU)", "Coordinador → método", "Entidades «entity» → tabla"]
        for k, cus in enumerate(s["cus"], start=1):
            d = MANIFEST["diagrams"][cus]
            ents = " · ".join(f"{e['obj']} → {e['tbl']}" for e in d["entities"])
            vals = [cus, d["dc"], d["iu"], f"{d['cc']}\n{d['method']}", ents]
            for j, v in enumerate(vals):
                tb.rows[k].cells[j].text = v
        style_table(tb, head, [1.3, 3.6, 2.9, 3.4, 5.4])
        for cus in s["cus"]:
            d = MANIFEST["diagrams"][cus]
            add_picture_fit(doc, d["file"])
            caption(doc, f"Figura. {d['dc']} — {d['name']}.")
    else:
        note(doc, "Esta pantalla no está asociada a un caso de uso propio.")
    if n < 4 + len(MANIFEST["screens"]):
        doc.add_page_break()

# ───────────────────────────── Anexo A ─────────────────────────────
doc.add_heading("Anexo A. Casos de uso sin pantalla en el prototipo (fase institucional)", level=1)
doc.add_paragraph(
    "Los siguientes casos de uso cuentan con diagrama de colaboración, pero el prototipo no les da una "
    "pantalla propia porque dependen de usuarios/roles reales y de la designación formal de comisiones. "
    "Se mantienen declarados para la fase con servidor (OIDC, API /api/v1 y base de datos)."
)
annex = [
    ("CUS08", "El personal de legajos designa la comisión evaluadora y sus miembros. Requiere el registro de "
              "comisiones y la asignación de docentes; se implementará junto con los usuarios y roles institucionales."),
    ("CUS18", "El administrador del sistema crea usuarios, asigna roles y unidades orgánicas. En el prototipo se "
              "simula mediante el portal de acceso (/login), que fija el rol activo de cada sesión de demostración."),
]
for cus, desc in annex:
    d = MANIFEST["diagrams"][cus]
    doc.add_heading(f"{cus} · {d['name']}", level=2)
    doc.add_paragraph(desc)
    add_picture_fit(doc, d["file"])
    caption(doc, f"Figura. {d['dc']} — {d['name']}.")
doc.add_page_break()

# ───────────────────────────── Anexo B ─────────────────────────────
doc.add_heading("Anexo B. Verificación de trazabilidad en Rational Rose", level=1)
doc.add_paragraph("Lista de verificación para la entrega del modelado:")
for t in [
    "Los 18 diagramas de colaboración y sus secuencias están en el paquete «Diagramas de Colaboración» "
    "del modelo SISTEMA_DE_LEGAJOS_COMPLETO (Use Case View).",
    "Existe un diagrama DC_CUSxx_NombreCorto por cada caso de uso CUS01–CUS18.",
    "El nombre de la frontera IU: coincide con la pantalla indicada en cada sección de este informe.",
    "Cada diagrama incluye actor → IU → CC_ → entidades → :AuditoriaEvento.",
    "Los mensajes están numerados del 1 en adelante y los retornos están etiquetados (VarX).",
    "Se pulsó F5 y existe el diagrama de secuencia DC_CUSxx_NombreCorto_SD.",
    "Los casos de uso sin pantalla (CUS08 y CUS18) quedan marcados como fase institucional.",
]:
    doc.add_paragraph(t, style="List Bullet")
doc.add_paragraph()
note(doc, "Documento de trabajo para la sustentación del curso. La rúbrica y los datos son de demostración; "
          "el prototipo no constituye un trámite institucional vinculante.")

doc.save(str(OUT))
print("DOCX generado:", OUT)
