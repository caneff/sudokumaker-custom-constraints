# build_count_digits_demo.py (#568): the committed demo board is a valid, drawn,
# CP-SAT-unique board; its link carries BOTH count-digits constraints with
# exactly one switched off (the wire key is `disabled`, not `enabled`); the two
# differ only in the class their backend registers and the component code the
# GAC one ships, and that code is the annotated copy; and a rebuild reproduces
# the committed link byte for byte without touching it.
#
#   uv run examples/outside-sudoku/build_count_digits_demo.test.py

import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "_shared"))

from build_count_digits_demo import (
    BASELINE_NAME,
    CANDIDATE_NAME,
    COLOURS,
    COMPONENT,
    DEMO_DIR,
    GEN,
    SHIPPED,
    VARIANTS,
    backend_code,
    build,
    build_doc,
    cage_constraints,
    grow_region,
)
from build_sparse_count_digits import count_solutions, givens_of
from link_codec import decode_puzzle
from minify import minify_file

LINK = DEMO_DIR / "PUZZLE_LINK_demo.txt"
N = 9


def count(gen, group):
    """The group's own count in the solution grid: target cells holding a
    listed digit. The rule, restated here rather than imported."""
    return sum(
        1
        for r, c in (tuple(p) for p in group["cells"])
        if gen["grid"][r][c] in group["values"]
    )


def connected(cells):
    cells = {tuple(p) for p in cells}
    seen, todo = set(), [next(iter(cells))]
    while todo:
        r, c = todo.pop()
        if (r, c) in seen:
            continue
        seen.add((r, c))
        todo += [
            (r + dr, c + dc)
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
            if (r + dr, c + dc) in cells
        ]
    return seen == cells


def check_board(gen):
    groups = gen["groups"]
    used = []
    for g in groups:
        cells = [tuple(p) for p in g["cells"]]
        counter = tuple(g["counter"])
        assert len(set(cells)) == len(cells), f"{g['name']}: repeated target cell"
        assert connected(cells), (
            f"{g['name']}: not one connected region, so its cage would be hard to read"
        )
        assert counter not in set(cells), (
            f"{g['name']}: the counter is one of its targets"
        )
        assert gen["grid"][counter[0]][counter[1]] == count(gen, g), (
            f"{g['name']}: the solution's counter digit is not the count"
        )
        used += [*cells, counter]
    assert len(set(used)) == len(used), (
        "two groups share a cell, so the colours would overlap"
    )
    assert count_solutions(groups, givens_of(gen)) == 1, (
        "not unique under the CP-SAT model"
    )


def check_uniqueness_detects_a_wrong_count(gen):
    """The CP-SAT model states the rule: a group whose counter digit is not the
    count is infeasible with the whole solution as givens."""
    full = {(r, c): v for r, row in enumerate(gen["grid"]) for c, v in enumerate(row)}
    g = gen["groups"][0]
    assert count_solutions([g], full) == 1
    other = next(
        d
        for d in range(1, N + 1)
        if d not in g["values"]
        and count(gen, {**g, "values": g["values"] + [d]}) != count(gen, g)
    )
    assert count_solutions([{**g, "values": sorted(g["values"] + [other])}], full) == 0


def check_grow_region_is_connected_and_disjoint():
    """Every seed, with the left four columns taken: a region that ignored
    `taken` would land in them on most draws (a two-cell taken set never did)."""
    import random

    taken = {(r, c) for r in range(N) for c in range(4)}
    for seed in range(40):
        cells = grow_region(random.Random(seed), taken, 8)
        assert len(cells) == 8 and connected(cells), f"seed {seed}"
        assert not set(cells) & taken, f"seed {seed}: a region grew onto a taken cell"


def check_palette_guard(gen):
    """A redraw with more groups than colours refuses, rather than wrap the
    palette and give two groups one colour."""
    many = {**gen, "groups": [gen["groups"][0]] * (len(COLOURS) + 1)}
    try:
        cage_constraints(many)
    except ValueError:
        return
    raise AssertionError("more groups than colours was accepted")


def customs(doc):
    return [c for c in doc["puzzle"]["constraints"] if c.get("type") == 1000]


def check_link(gen):
    shipped = LINK.read_bytes()
    doc = decode_puzzle(shipped.decode().strip())
    p = doc["puzzle"]
    assert p["type"] == "sudoku"
    assert p["comment"].startswith("Normal sudoku rules apply")
    # `entered: 0`: every non-given cell is empty
    givens = givens_of(gen)
    for i, cell in enumerate(p["cells"]):
        assert bool(cell.get("given")) == ((i // N, i % N) in givens), f"cell {i}"
        if not cell.get("given"):
            assert cell == {}, f"cell {i} carries a value or mark"

    cs = customs(doc)
    assert [c["name"] for c in cs] == [VARIANTS[v][0] for v in VARIANTS]
    off = [c["name"] for c in cs if c.get("disabled")]
    assert off == [VARIANTS["builtin"][0]] and SHIPPED == "gac", (
        f"exactly the built-in should ship disabled, got {off}"
    )
    assert all("enabled" not in c for c in cs), (
        "`enabled` is not the wire key; the app reads `disabled`"
    )

    by_name = {c["name"]: c["definition"] for c in cs}
    gac = by_name[VARIANTS["gac"][0]]
    base = by_name[VARIANTS["builtin"][0]]
    assert CANDIDATE_NAME in gac["backend"]["code"] and BASELINE_NAME not in gac[
        "backend"
    ]["code"].replace(CANDIDATE_NAME, "")
    assert (
        BASELINE_NAME in base["backend"]["code"]
        and CANDIDATE_NAME not in base["backend"]["code"]
    )
    assert base["components"] == [], (
        "the built-in registers the app's own class: no code to ship"
    )
    assert [c["name"] for c in gac["components"]] == [CANDIDATE_NAME]
    # the annotated copy: the committed file's own comments, kept
    assert gac["components"][0]["code"] == minify_file(COMPONENT, keep_comments=True)
    for phrase in (
        "HIT",
        "puzzle.stop",
        "removeCandidatesFromCell",
        "bit d is set",
        "ARRAY is refused",
    ):
        assert phrase in gac["components"][0]["code"], f"annotation lost: {phrase}"
    assert (
        gac["backend"]["code"].replace(CANDIDATE_NAME, BASELINE_NAME)
        == base["backend"]["code"]
    )

    # both variants drawn: one cage element per group, group cage + counter cage
    cages = [c for c in p["constraints"] if c.get("type") == 2001]
    assert len(cages) == len(gen["groups"])
    for c, g in zip(cages, gen["groups"], strict=True):
        group_cage, counter_cage = c["cages"]
        assert sorted(group_cage["cells"]) == sorted(
            r * N + col for r, col in g["cells"]
        )
        assert counter_cage["cells"] == [g["counter"][0] * N + g["counter"][1]]
        # the drawing is the board's payload: the label lists this group's
        # digits, the counter is marked #, both in the group's own colour
        assert group_cage["value"] == " ".join(map(str, g["values"]))
        assert counter_cage["value"] == "#"
        assert c["style"]["cage"]["color"] == c["style"]["text"]["color"]

    colours = [c["style"]["cage"]["color"] for c in cages]
    assert len(set(colours)) == len(colours), "two groups share a colour"

    # the shipped link reproduces, and the rebuild leaves the committed file
    # alone -- into a directory that does not exist yet, too
    mtime = LINK.stat().st_mtime_ns
    with tempfile.TemporaryDirectory() as tmp:
        out = build(pathlib.Path(tmp) / "not" / "yet")
        assert out.read_bytes() == shipped, "the link does not reproduce"
    assert LINK.stat().st_mtime_ns == mtime, "--out touched the committed link"

    # flipping which one is on swaps the disabled flag and nothing else
    flipped = build_doc(gen, "builtin")
    was = build_doc(gen, "gac")
    for a, b in zip(customs(was), customs(flipped), strict=True):
        assert ("disabled" in a) != ("disabled" in b)
        assert {k: v for k, v in a.items() if k != "disabled"} == {
            k: v for k, v in b.items() if k != "disabled"
        }
    assert backend_code(gen, CANDIDATE_NAME) != backend_code(gen, BASELINE_NAME)


if __name__ == "__main__":
    gen = json.loads(GEN.read_text())
    check_board(gen)
    check_board(json.loads((DEMO_DIR / "gen_5x8.json").read_text()))
    check_uniqueness_detects_a_wrong_count(gen)
    check_grow_region_is_connected_and_disjoint()
    check_palette_guard(gen)
    check_link(gen)
    print("ok")
