import json
from pathlib import Path
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "Credenciales-demostracion-UNP.docx"

# Datos extraídos de src/domain/models.ts (INSTITUTIONAL_ACCOUNTS)
accounts = [
    {"id":"legajos-ana","name":"Dra. Ana Salas Paredes","email":"asalas@unp.edu.pe","role":"Personal de legajos","dept":"Oficina Central de Legajos y Escalafón","faculty":"Rectorado / URH"},
    {"id":"legajos-luis","name":"Mg. Luis Pérez Gómez","email":"lperez@unp.edu.pe","role":"Personal de legajos","dept":"Oficina Central de Legajos y Escalafón","faculty":"Rectorado / URH"},
    {"id":"comision-rosa","name":"Dra. Rosa Medina Alvites","email":"rmedina@unp.edu.pe","role":"Comisión evaluadora","dept":"Comisión Evaluadora de Promoción","faculty":"Comisión Central UNP"},
    {"id":"comision-pablo","name":"Dr. Pablo León Seminario","email":"pleon@unp.edu.pe","role":"Comisión evaluadora","dept":"Comisión Evaluadora de Promoción","faculty":"Comisión Central UNP"},
    {"id":"decanato-elena","name":"Dra. Elena Soto Carrillo","email":"esoto@unp.edu.pe","role":"Decanato","dept":"Decanato de Facultad","faculty":"Ciencias · Demo"},
    {"id":"facultad-carlos","name":"Dr. Carlos Vera Mogollón","email":"cvera@unp.edu.pe","role":"Consejo de Facultad","dept":"Consejo de Facultad","faculty":"Ciencias · Demo"},
    {"id":"consejo-irene","name":"Dra. Irene Díaz Montenegro","email":"idiaz@unp.edu.pe","role":"Consejo Universitario","dept":"Consejo Universitario","faculty":"Gobierno Central UNP"},
    {"id":"t1","name":"María Valeria Ríos","email":"mvrios@unp.edu.pe","role":"Docente (Auxiliar)","dept":"Informática · Demo","faculty":"Ingeniería · Demo","category":"Auxiliar"},
    {"id":"t2","name":"Gabriel Torres Salazar","email":"gtorres@unp.edu.pe","role":"Docente (Asociado)","dept":"Matemática · Demo","faculty":"Ciencias · Demo","category":"Asociado"},
    {"id":"t3","name":"Lucía Fernández Vega","email":"lfernandez@unp.edu.pe","role":"Docente (Auxiliar)","dept":"Economía · Demo","faculty":"Economía · Demo","category":"Auxiliar"},
    {"id":"t4","name":"Diego Mendoza Ruiz","email":"dmendoza@unp.edu.pe","role":"Docente (Asociado)","dept":"Industrial · Demo","faculty":"Ingeniería · Demo","category":"Asociado"},
    {"id":"t5","name":"Elena Castro Paredes","email":"ecastro@unp.edu.pe","role":"Docente (Principal)","dept":"Biología · Demo","faculty":"Ciencias · Demo","category":"Principal"},
    {"id":"t6","name":"Andrés Navarro León","email":"anavarro@unp.edu.pe","role":"Docente (Auxiliar)","dept":"Informática · Demo","faculty":"Ingeniería · Demo","category":"Auxiliar"},
]

PASSWORD = "unp2026"
OIDC_USER = "mvrios@unp.edu.pe (t1 - María Valeria Ríos)"

doc = Document()
style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(10.5)

section = doc.sections[0]
section.page_width = Cm(21)
section.page_height = Cm(29.7)
section.left_margin = section.right_margin = Cm(2.2)
section.top_margin = Cm(2.0)
section.bottom_margin = Cm(1.8)

def add_heading(text, level=1, color=RGBColor(15,118,110)):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.color.rgb = color
    return h

add_heading("UNIVERSIDAD NACIONAL DE PIURA", level=1)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Facultad de Ingeniería Industrial")
r.font.size = Pt(12)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Escuela Profesional de Ingeniería Informática - Ciclo VI")
r.font.size = Pt(12)
doc.add_paragraph()

add_heading("Credenciales de demostración - Sistema Legajo y Promoción Docente", level=1)

doc.add_paragraph(
    "Prototipo académico sin base de datos conectada. Toda la información se guarda en IndexedDB del navegador con datos ficticios. "
    "Las credenciales sirven únicamente para probar los flujos de los casos de uso del análisis v2.0."
)

doc.add_paragraph("Instrucciones de acceso:", style="List Bullet")
doc.add_paragraph("Acceso por credenciales institucionales (pestaña \"Institucional\"): usar el correo listado y la contraseña demo.", style="List Bullet")
doc.add_paragraph(f"Contraseña para todas las cuentas: {PASSWORD} (no validada, fija para la demo).", style="List Bullet")
doc.add_paragraph("Acceso rápido por rol (pestaña \"Acceso Rápido\"): hacer clic en la tarjeta del usuario para iniciar sesión inmediata sin escribir contraseña.", style="List Bullet")
doc.add_paragraph(f"OIDC simulado: al usar el botón OIDC el sistema inicia sesión como {OIDC_USER}.", style="List Bullet")

doc.add_heading("Cuentas institucionales y docentes de demostración", level=2)

table = doc.add_table(rows=1, cols=5)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
hdr = table.rows[0].cells
headers = ["Rol", "Nombre", "Correo", "Unidad", "Contraseña"]
for i, h in enumerate(headers):
    hdr[i].text = h
    for run in hdr[i].paragraphs[0].runs:
        run.bold = True
        run.font.size = Pt(9)

for acc in accounts:
    row = table.add_row().cells
    row[0].text = acc["role"]
    row[1].text = acc["name"]
    row[2].text = acc["email"]
    unidad = f"{acc.get('faculty','')} / {acc.get('dept','')}".strip(" /")
    row[3].text = unidad
    row[4].text = PASSWORD
    for cell in row:
        for p in cell.paragraphs:
            p.paragraph_format.space_after = Pt(2)
            for run in p.runs:
                run.font.size = Pt(9)

doc.add_paragraph()
add_heading("Notas de uso", level=2)
notes = [
    "Los correos son ficticios (@unp.edu.pe) y se usan solo para identificar la cuenta en el prototipo.",
    "La contraseña está fijada a unp2026 para todas las cuentas institucionales y docentes. No hay validación real.",
    "El acceso rápido incrusta el perfil sin verificación; es equivalente a una sesión pre-autorizada para demostración.",
    "OIDC simulado siempre inicia como María Valeria Ríos (t1).",
    "No realizar operaciones que impliquen datos personales reales. El sistema no está conectado a ningún servicio institucional.",
]
for n in notes:
    doc.add_paragraph(n, style="List Bullet")

doc.add_paragraph()
p = doc.add_paragraph("Documento generado para guía académica. Integrantes: Castro Herrera Fermín Aldahir, Gómez Carnero Luis Alonso, Rivas Gutiérrez David Eduardo.")
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
for run in p.runs:
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(100,116,139)

doc.save(str(OUT))
print("Generado:", OUT)
