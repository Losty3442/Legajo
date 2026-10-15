import sys, docx
from docx.table import Table
from docx.text.paragraph import Paragraph

d = docx.Document(sys.argv[1])
out = []
for el in d.element.body.iterchildren():
    if el.tag.endswith('}p'):
        p = Paragraph(el, d)
        t = p.text.strip()
        has_img = 'graphic' in el.xml
        if t or has_img:
            out.append(f"[{p.style.name}] {t}" + (" <IMG>" if has_img else ""))
    elif el.tag.endswith('}tbl'):
        tb = Table(el, d)
        out.append("<TABLE>")
        for r in tb.rows:
            out.append(" | ".join(c.text.strip().replace("\n", " / ") for c in r.cells))
        out.append("</TABLE>")
open(sys.argv[2], "w", encoding="utf-8").write("\n".join(out))
print(len(out), "lines")
