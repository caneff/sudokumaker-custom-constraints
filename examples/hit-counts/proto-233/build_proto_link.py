# Build the #233 prototype links off the committed PUZZLE_LINK.txt. The board,
# givens and clues stay exactly as shipped; only the constraint's code changes.
#
#   uv run --with lzstring examples/hit-counts/proto-233/build_proto_link.py \
#     --variant C --out /tmp/c.txt
#
# --variant A swaps HitCountsComponent for the early-reject copy. --variant C
# adds the SideHitMatchingComponent and the backend that registers it (a backend
# change, which `just time` cannot see -- #151 -- so it is swapped by hand here).
# --variant L is C with the lean component: no clue-candidate filtering, and a
# signature check that skips the solve on an unchanged side. --variant LP is L
# with HitCountsPairComponent dropped from the wiring. A and C combine as AC
# and AL.

import argparse
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent.parent / "_shared"))
from link_codec import decode_puzzle
from link_swap import (
    check_and_write,
    find_constraint,
    replace_constraint_code,
)
from minify import minify_js

CONSTRAINT_NAME = "Hit Counts Lines"


def build(variant, out_path):
    base = decode_puzzle((HERE.parent / "PUZZLE_LINK.txt").read_text().strip())
    defn = find_constraint(base, CONSTRAINT_NAME)["definition"]
    components = [dict(c) for c in defn["components"]]
    if "P" in variant:
        components = [c for c in components if c["name"] != "HitCountsPairComponent"]
    backend = None
    if "A" in variant:
        code = minify_js((HERE / "HitCountsComponent.earlyreject.js").read_text())
        for c in components:
            if c["name"] == "HitCountsComponent":
                c["code"] = code
    if "C" in variant or "L" in variant or "F" in variant:
        source = "SideHitMatchingComponent.js"
        if "L" in variant:
            source = "SideHitMatchingComponent.lean.js"
        if "F" in variant:
            source = "SideHitMatchingComponent.fast.js"
        components.append(
            {
                "type": "code",
                "name": "SideHitMatchingComponent",
                "code": minify_js((HERE / source).read_text()),
            }
        )
        backend_file = "main.C.nopair.js" if "P" in variant else "main.C.js"
        backend = minify_js((HERE / backend_file).read_text())
    doc = replace_constraint_code(
        base, CONSTRAINT_NAME, backend_code=backend, components=components
    )
    return check_and_write(base, doc, CONSTRAINT_NAME, out_path)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument(
        "--variant", required=True, choices=["A", "C", "AC", "L", "AL", "LP", "F", "FP"]
    )
    p.add_argument("--out", required=True)
    args = p.parse_args()
    link = build(args.variant, args.out)
    print(f"wrote {args.out} ({len(link)} chars)")
