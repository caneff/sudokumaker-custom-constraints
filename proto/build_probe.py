# Prototype for #322: does a group's `value` field carry a multi-digit rank
# through a SudokuMaker link, and does the component receive it?
#
# Takes the skyscraper 6x6 local board (a real, app-loadable link with drawn
# groups), throws away its custom components, and puts back a single probe
# component whose groups carry multi-digit values. The probe logs what it
# actually received to the browser console; app_probe.mjs reads it back.
#
#   uv run --with lzstring proto/build_probe.py proto/probe_link.txt

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "examples/_shared"))
from link_codec import decode_puzzle, encode_link  # noqa: E402

SRC = "examples/skyscraper/PUZZLE_LINK_6x6_local.txt"

# Values worth testing: a 1-digit rank, both 2-digit boundary ranks, the top of
# a 6x6 rank range, something past it, and the empty string a half-drawn group
# has. Leading zeros and whitespace are in there to see what survives verbatim.
PROBE_VALUES = ["1", "9", "13", "25", "64", "007", " 12 ", "", "abc"]

BACKEND_CODE = """\
//! Probe for #322. Logs the group values this component was handed.
console.log('QRPROBE ' + JSON.stringify(input.groups.map(g => ({
  value: g.value,
  type: typeof g.value,
  cells: g.cells.length
}))))
"""

# A custom constraint's `definition` is an object, not a code string: the
# declared `input` slots, a `backend` holding the main code, and the component
# classes. `input: [{id: "groups", params: {type: "raw"}}]` is the slot that
# makes the constraint's own `input.groups` reach the backend as `input.groups`.
DEFINITION = {
    "name": "Quad Rank Probe",
    "input": [{"id": "groups", "label": "Groups", "params": {"type": "raw"}}],
    "backend": {"type": "code", "code": BACKEND_CODE},
    "components": [],
}


def build(src, out):
    doc = decode_puzzle(pathlib.Path(src).read_text().strip())
    puzzle = doc["puzzle"]

    # Drop the skyscraper components; their classes are not in the probe.
    puzzle["constraints"] = [c for c in puzzle["constraints"] if c.get("type") != 1000]

    # One group per probe value. Cells are the interior of the 8x8 board, one
    # 2x2 window each -- the shape a real quad-rank clue would use.
    groups = []
    for i, value in enumerate(PROBE_VALUES):
        r, c = 1 + i // 3, 1 + 2 * (i % 3)
        tl = r * 8 + c
        groups.append({"cells": [tl, tl + 1, tl + 8, tl + 9], "value": value})

    puzzle["constraints"].append(
        {
            "name": "Quad Rank Probe",
            "type": 1000,
            "definition": DEFINITION,
            "input": {"groups": groups},
            "style": {},
        }
    )
    pathlib.Path(out).write_text(encode_link(doc))
    return groups


if __name__ == "__main__":
    written = build(SRC, sys.argv[1])
    print(f"wrote {sys.argv[1]} with {len(written)} groups")
    for g in written:
        print(f"  value={g['value']!r}")
