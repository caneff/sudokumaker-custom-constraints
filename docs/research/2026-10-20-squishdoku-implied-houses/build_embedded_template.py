"""Embedded squishdoku template: 9x9 Latin square, squishdoku boxes on r2c2-r8c8,
and every house the rules force, grouped into the symmetry classes A-O.

  python build_embedded_template.py original.json embedded-houses.json \
      embedded-backend.js embedded-template.json
"""

import copy
import json
import sys
from pathlib import Path

W = 9
RULES = (
    "Embedded Squishdoku: Place the digits 1 to 9 once each in every row and column "
    "of the 9x9 grid. The 7x7 area from r2c2 to r8c8 is a squishdoku: each of its "
    "nine overlapping 3x3 boxes contains the digits 1 to 9 once each. Cells on box "
    "borders (dashed lines) belong to more than one box."
)


def sym(h, k):
    out = set()
    for i in h:
        r, c = divmod(i, W)
        for _ in range(k % 4):
            r, c = c, W - 1 - r
        if k >= 4:
            c = W - 1 - c
        out.add(r * W + c)
    return frozenset(out)


def classes(houses):
    """Symmetry classes, inner-7x7 classes first, largest first; letters A, B, ..."""
    inner = lambda h: all(1 <= i // W <= 7 and 1 <= i % W <= 7 for i in h)
    orbits, seen = [], set()
    for h in map(frozenset, houses):
        if h not in seen:
            orb = {sym(h, k) for k in range(8)}
            seen |= orb
            orbits.append(orb)
    orbits.sort(key=lambda o: (not inner(next(iter(o))), -len(o)))
    out = {}
    for k, o in enumerate(orbits):
        rep = min(o, key=sorted)
        out[chr(65 + k)] = [sorted(rep), *sorted(sorted(m) for m in o if m != rep)]
    return out


def backend(by_class):
    rows = [
        "// Embedded squishdoku: the rules force 43 extra 9-cell houses beyond rows,",
        "// columns and the nine boxes. Together they cover every pair of cells the",
        "// rules force to differ (CP-SAT over every pair; see",
        "// docs/research/2026-10-20-squishdoku-implied-houses/). Classes A-D lie",
        "// inside the squish area and are plain squishdoku's 13; E-O reach the ring.",
        "// Registering them gives the solver hidden singles it cannot see otherwise.",
        "const HOUSES = {",
    ]
    for cls, hs in by_class.items():
        body = ",\n".join("    [" + ", ".join(map(str, h)) + "]" for h in hs)
        rows.append(f"  {cls}: [\n{body}\n  ],")
    rows[-1] = rows[-1].rstrip(",")
    rows += [
        "}",
        "for (const [cls, houses] of Object.entries(HOUSES)) {",
        "  houses.forEach((cells, k) => puzzle.addConstraintComponent(",
        "    new HouseComponent(`extra region ${cls}${k + 1}`, cells)))",
        "}",
    ]
    return "\n".join(rows) + "\n"


def main(src, houses_path, backend_out, out):
    seven = json.loads(Path(src).read_text())
    by_class = classes(json.loads(Path(houses_path).read_text())["houses"])
    code = backend(by_class)
    Path(backend_out).write_text(code)
    d = copy.deepcopy(seven)
    p = d["puzzle"]
    p.update(
        name="Embedded Squishdoku",
        comment=RULES,
        width=W,
        height=W,
        minDigit=1,
        maxDigit=9,
        cells=[{} for _ in range(W * W)],
    )
    shift = lambda i: (i // 7 + 1) * W + i % 7 + 1
    cons = []
    for c in p["constraints"]:
        if c.get("definition", {}).get("name") == "To rowcol":
            continue
        if c["type"] == 2000:
            c["lines"] = [
                [{"x": q["x"] + 1, "y": q["y"] + 1} for q in ln] for ln in c["lines"]
            ]
            # The squish area's edge, in examples/_shared/frame.py's border style.
            corners = [(1, 1), (8, 1), (8, 8), (1, 8), (1, 1)]
            cons.append(
                {
                    "name": "Squish Area Border",
                    "type": 2000,
                    "lines": [[{"x": x, "y": y} for x, y in corners]],
                    "style": {"thickness": 0.07, "color": "#000000ff"},
                }
            )
        elif c["type"] == 301:
            for cage in c["cages"]:
                cage["cells"] = [shift(i) for i in cage["cells"]]
        elif c["type"] == 1000:
            c["name"] = "Embedded squishdoku extra regions (helps the solver)"
            c["definition"] = {
                "name": "Embedded squishdoku extra regions",
                "input": [],
                "backend": {"type": "code", "code": code},
                "components": [],
            }
            c["input"] = {}
        cons.append(c)
    p["constraints"] = cons
    Path(out).write_text(json.dumps(d))


if __name__ == "__main__":
    main(*sys.argv[1:])
