# Build the CountDigits demo board (#568): a small, drawn sudoku carrying a few
# count-digits groups, with BOTH components in the one link -- the app's
# built-in CountDigits and CountDigitsGacComponent -- as two custom
# constraints identical but for the class their backend registers. One ships
# enabled, the other disabled; a reader flips them in the Elements panel
# (per-element menu -> Disable / Enable) and re-solves to feel the difference.
#
# The rule, stated once for both sides: the digit in a group's counter cell
# equals the number of the group's cells holding one of the group's listed
# digits. `model()` (imported from build_sparse_count_digits) is the CP-SAT
# side; CountDigitsGacComponent.js is the JS side.
#
# The groups reach the solver the way an author's would, through `input.groups`
# (the local lane, docs/example-layout.md): `value` is the digit list, the first
# cell is the counter and the rest are the targets. Both constraints carry the
# same list, emitted once from gen.json (`groups_input`). The app draws nothing
# for those groups outside the constraint's own editor, so each group also gets
# a cosmetic cage round its connected cells, its digit list as the cage's label,
# and a one-cell cage of the same colour on the counter cell labelled "#"; the
# test pins the cages to `input.groups`.
#
# Wire note: the app saves a disabled constraint as `"disabled": true`
# (`enabled` is the in-memory name, `Ec.save` in the app's main bundle);
# writing `"enabled": false` is silently ignored.
#
#   uv run examples/outside-sudoku/build_count_digits_demo.py
#       rebuild the shipped link from the committed gen.json
#   uv run examples/outside-sudoku/build_count_digits_demo.py --search SEED
#       draw a fresh board into --gen (one-shot: the grid comes from CP-SAT's
#       portfolio search, which the seed does not reproduce)
#   ... --enabled builtin --out DIR
#       the same board with the other component switched on, for timing
#
# Lives here, not in docs/research/, because that gate refuses a new .py there
# (check_research_python, #469).

import argparse
import json
import pathlib
import random
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from build_sparse_count_digits import count_solutions, givens_of, model
from build_sparse_required_digits import box, write
from cpsat import SOLVED, solver
from minify import minify_file, minify_js

HERE = pathlib.Path(__file__).parent
DEMO_DIR = HERE.parent.parent / "docs" / "research" / "count-digits-gac" / "demo"
GEN = DEMO_DIR / "gen.json"
BACKEND = DEMO_DIR / "main-demo.js"
COMPONENT = (
    HERE.parent.parent / "docs/research/count-digits-gac/CountDigitsGacComponent.js"
)
CANDIDATE_NAME = "CountDigitsGacComponent"
BASELINE_NAME = "CountDigitsComponent"
# name -> (constraint title, class its backend registers)
VARIANTS = {
    "builtin": ("CountDigits (built-in)", BASELINE_NAME),
    "gac": ("CountDigits (GAC)", CANDIDATE_NAME),
}
SHIPPED = "gac"
COLOURS = ["#d0342c", "#1a6fd1", "#1f9d55", "#c77800", "#8a3ffc", "#0f8b8d"]
N = 9


RULES = (
    "Normal sudoku rules apply. Each coloured region lists digits in its "
    "corner. The cell marked # in the same colour is that region's "
    "counter: its digit equals how many cells of the region hold one of "
    "the listed digits. Two CountDigits elements carry the same rule -- "
    "the app's built-in and a pruning one; exactly one is enabled. Flip "
    "them in the Elements panel (the three-dot menu, Disable / Enable) "
    "and solve again to compare."
)


def grow_region(rng, taken, size):
    """A connected set of `size` free cells, grown from a random seed cell."""
    free = [(r, c) for r in range(N) for c in range(N) if (r, c) not in taken]
    cells = [rng.choice(free)]
    while len(cells) < size:
        edge = [
            (r + dr, c + dc)
            for r, c in cells
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
            if 0 <= r + dr < N
            and 0 <= c + dc < N
            and (r + dr, c + dc) not in taken
            and (r + dr, c + dc) not in cells
        ]
        if not edge:
            return None
        cells.append(rng.choice(edge))
    return cells


def draw_group(rng, grid, taken, index, n_targets, n_digits):
    """One drawn group over the solution `grid`: a connected region disjoint
    from `taken`, a digit set, and a counter cell outside every group whose
    solution digit is the count. None when this draw has no counter to offer."""
    cells = grow_region(rng, taken, n_targets)
    if cells is None:
        return None
    values = sorted(rng.sample(range(1, N + 1), n_digits))
    count = sum(1 for r, c in cells if grid[r][c] in values)
    if not 1 <= count <= N:
        return None
    blocked = taken | set(cells)
    outside = [
        (r, c)
        for r in range(N)
        for c in range(N)
        if grid[r][c] == count and (r, c) not in blocked
    ]
    if not outside:
        return None
    return {
        "name": f"group {index + 1}",
        "values": values,
        "counter": list(rng.choice(outside)),
        "cells": [list(p) for p in cells],
    }


def search(seed, n_groups, n_targets, n_digits):
    """Draw a board: a solution grid, `n_groups` disjoint drawn groups over it,
    and givens carved (in seeded random order) while the board stays unique."""
    rng = random.Random(seed)
    m, x = model([], {})
    for cell in x:
        m.AddHint(x[cell], rng.randrange(1, N + 1))
    sv = solver(30, reproducible=False, seed=seed, randomize=True)
    assert sv.Solve(m) in SOLVED
    grid = [[sv.Value(x[r, c]) for c in range(N)] for r in range(N)]

    groups, taken = [], set()
    for _attempt in range(5000):
        if len(groups) == n_groups:
            break
        g = draw_group(rng, grid, taken, len(groups), n_targets, n_digits)
        if g is not None:
            groups.append(g)
            taken |= {tuple(p) for p in g["cells"]} | {tuple(g["counter"])}
    if len(groups) != n_groups:
        raise RuntimeError(f"only drew {len(groups)} of {n_groups} groups")

    givens = {(r, c): grid[r][c] for r in range(N) for c in range(N)}
    order = list(givens)
    rng.shuffle(order)
    carve_order = []
    for cell in order:
        trial = {k: v for k, v in givens.items() if k != cell}
        try:
            unique = count_solutions(groups, trial) == 1
        except TimeoutError:
            unique = False  # no verdict: keep the given, lose nothing
        if unique:
            givens = trial
            carve_order.append(cell)
    return {
        "grid": grid,
        "groups": groups,
        "carve_order": [list(p) for p in carve_order],
        "carved": len(carve_order),
    }


def backend_code(class_name):
    src = BACKEND.read_text().replace(CANDIDATE_NAME, class_name)
    return minify_js(src, base_dir=BACKEND.parent, keep_comments=True)


def groups_input(gen):
    """The drawn groups, in the document's own shape: cell ids on the 9-wide
    grid, `value` the group's digit list, and the counter cell FIRST, then the
    targets -- the convention the backend reads (main-demo.js). Both
    constraints carry this same list, emitted here once."""
    return [
        {
            "cells": [r * N + c for r, c in [g["counter"], *g["cells"]]],
            "value": " ".join(map(str, g["values"])),
        }
        for g in gen["groups"]
    ]


def cage_constraints(gen):
    """One cosmetic-cage element per group: the group's cage labelled with its
    digit list, and a one-cell cage on its counter labelled "#"."""
    if len(gen["groups"]) > len(COLOURS):
        # colour is what ties a # counter to its region: a wrapped palette
        # would give two groups one colour
        raise ValueError(f"{len(gen['groups'])} groups, {len(COLOURS)} colours")
    out = []
    for i, g in enumerate(gen["groups"]):
        colour = COLOURS[i]
        digits = " ".join(map(str, g["values"]))
        out.append(
            {
                "type": 2001,
                "name": f"Group {i + 1}: count of {digits}",
                "cages": [
                    {"value": digits, "cells": [r * N + c for r, c in g["cells"]]},
                    {"value": "#", "cells": [g["counter"][0] * N + g["counter"][1]]},
                ],
                "style": {"text": {"color": colour}, "cage": {"color": colour}},
            }
        )
    return out


def custom_constraint(gen, variant, enabled):
    title, class_name = VARIANTS[variant]
    components = (
        [
            {
                "type": "code",
                "name": CANDIDATE_NAME,
                "code": minify_file(COMPONENT, keep_comments=True),
            }
        ]
        if class_name == CANDIDATE_NAME
        else []
    )
    c = {
        "name": title,
        "type": 1000,
        "definition": {
            "name": title,
            "input": [{"id": "groups", "label": "Groups", "params": {"type": "raw"}}],
            "backend": {"type": "code", "code": backend_code(class_name)},
            "components": components,
        },
        "input": {"groups": groups_input(gen)},
        "style": {},
    }
    if not enabled:
        c["disabled"] = True
    return c


def build_doc(gen, enabled=SHIPPED):
    """The board's document: both components as custom constraints, `enabled`
    (a VARIANTS key) switched on and the other left `disabled`."""
    givens = givens_of(gen)
    cells = [
        {"value": gen["grid"][r][c], "given": True} if (r, c) in givens else {}
        for r in range(N)
        for c in range(N)
    ]
    regions = [box(r, c) for r in range(N) for c in range(N)]
    return {
        "formatVersion": "1.6.0",
        "puzzle": {
            "name": "CountDigits demo",
            "author": "",
            "type": "sudoku",
            "width": N,
            "height": N,
            "comment": RULES,
            "cells": cells,
            "constraints": [
                {"type": 0},
                {"type": 1, "regions": regions},
                *cage_constraints(gen),
                *(custom_constraint(gen, v, v == enabled) for v in VARIANTS),
            ],
        },
    }


def build(out_dir=DEMO_DIR, gen_path=GEN, enabled=SHIPPED):
    gen = json.loads(pathlib.Path(gen_path).read_text())
    name = (
        "PUZZLE_LINK_demo.txt"
        if enabled == SHIPPED
        else f"PUZZLE_LINK_demo_{enabled}.txt"
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    write(build_doc(gen, enabled), out_dir / name)
    return out_dir / name


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--search", type=int, metavar="SEED")
    p.add_argument("--gen", default=GEN)
    p.add_argument("--groups", type=int, default=3)
    p.add_argument("--targets", type=int, default=10)
    p.add_argument("--digits", type=int, default=3)
    p.add_argument("--enabled", choices=sorted(VARIANTS), default=SHIPPED)
    p.add_argument("--out")
    args = p.parse_args()
    if args.search is not None:
        pathlib.Path(args.gen).write_text(
            json.dumps(search(args.search, args.groups, args.targets, args.digits))
            + "\n"
        )
        print(f"wrote {args.gen}")
    else:
        out = build(
            pathlib.Path(args.out) if args.out else DEMO_DIR, args.gen, args.enabled
        )
        print(f"wrote {out}")
