"""Build the improved template from the catalog's decoded squishdoku document.

Keeps the boxes (type 301), the SudokuRules rows/columns (type 2003) and the
dashed border lines; replaces the five-region backend with backend.js; drops
the inert "To rowcol" constraint; declares digits 1..9 explicitly.

  python build_template.py original.json backend.js template.json
"""

import json
import sys
from pathlib import Path

src, backend, out = sys.argv[1:]
doc = json.loads(Path(src).read_text())
p = doc["puzzle"]
p["minDigit"], p["maxDigit"] = 1, 9
cons = [
    c for c in p["constraints"] if c.get("definition", {}).get("name") != "To rowcol"
]
for c in cons:
    if c.get("name", "").startswith("Known Extra Squishdoku Regions"):
        c["name"] = "Squishdoku implied houses (helps the solver)"
        c["definition"] = {
            "name": "Squishdoku implied houses",
            "input": [],
            "backend": {"type": "code", "code": Path(backend).read_text()},
            "components": [],
        }
        c["input"] = {}
p["constraints"] = cons
Path(out).write_text(json.dumps(doc))
