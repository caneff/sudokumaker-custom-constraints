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
    OUTSIDE_GEN,
    OUTSIDE_LINK_NAME,
    SHIPPED,
    VARIANTS,
    backend_code,
    build,
    build_doc,
    cage_constraints,
    grow_region,
    is_selfcount,
)
from build_sparse_count_digits import count_solutions, givens_of
from link_codec import decode_puzzle
from minify import minify_file

LINK = DEMO_DIR / "PUZZLE_LINK_demo.txt"
OUTSIDE_LINK = DEMO_DIR / OUTSIDE_LINK_NAME
N = 9


def count(gen, group):
    """The group's own count in the solution grid: cells holding a listed
    digit. The rule, restated here rather than imported. `cells` is the whole
    target list, the counter included on a self-counting board."""
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


def check_board(gen, selfcount):
    """`selfcount`: the board the demo ships, every counter its own first
    target. Not selfcount: the counter-outside case, kept as the older draw."""
    assert is_selfcount(gen) == selfcount
    groups = gen["groups"]
    used = []
    for g in groups:
        cells = [tuple(p) for p in g["cells"]]
        counter = tuple(g["counter"])
        assert len(set(cells)) == len(cells), f"{g['name']}: repeated target cell"
        assert connected(cells), (
            f"{g['name']}: not one connected region, so its cage would be hard to read"
        )
        if selfcount:
            assert cells[0] == counter, f"{g['name']}: the counter is not first"
        else:
            assert counter not in set(cells), (
                f"{g['name']}: the counter is one of its targets"
            )
        assert gen["grid"][counter[0]][counter[1]] == count(gen, g), (
            f"{g['name']}: the solution's counter digit is not the count"
        )
        used += [*cells, counter]
        used = list(dict.fromkeys(used)) if selfcount else used
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


def check_link(gen, link, selfcount):
    shipped = link.read_bytes()
    doc = decode_puzzle(shipped.decode().strip())
    p = doc["puzzle"]
    assert p["type"] == "sudoku"
    assert p["comment"].startswith("Normal sudoku rules apply")
    # the rules text tells the reader which shape this is, and how to toggle
    assert ("one of its own cells" in p["comment"]) == selfcount
    assert "Disable / Enable" in p["comment"]
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

    # the groups reach the solver through `input.groups`, and both constraints
    # carry the SAME list: were they to differ, the link would time two
    # different puzzles and call the gap an algorithm
    groups = [c["input"]["groups"] for c in cs]
    assert groups[0] == groups[1], "the two constraints carry different groups"
    assert len(groups[0]) == len(gen["groups"])
    for drawn, g in zip(groups[0], gen["groups"], strict=True):
        counter, *targets = drawn["cells"]
        assert (counter // N, counter % N) == tuple(g["counter"]), (
            "the counter is not the first cell"
        )
        assert targets == [r * N + col for r, col in g["cells"]], (
            "targets differ from gen.json, or lost their order"
        )
        assert drawn["value"] == " ".join(map(str, g["values"]))
    for c in cs:
        assert c["definition"]["input"] == [
            {"id": "groups", "label": "Groups", "params": {"type": "raw"}}
        ]
        code = c["definition"]["backend"]["code"]
        assert "input.groups" in code and "GROUPS" not in code, (
            "the backend still reads a baked table"
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
        "the whole of arc consistency",
        "validateDuringSolve",
    ):
        assert phrase in gac["components"][0]["code"], f"annotation lost: {phrase}"
    assert (
        gac["backend"]["code"].replace(CANDIDATE_NAME, BASELINE_NAME)
        == base["backend"]["code"]
    )

    # both variants drawn: one cage element per group, group cage + counter cage
    cages = [c for c in p["constraints"] if c.get("type") == 2001]
    assert len(cages) == len(gen["groups"])
    for c, g, drawn in zip(cages, gen["groups"], groups[0], strict=True):
        group_cage, counter_cage = c["cages"]
        # the cages are cosmetic (the solver never reads them), so they are
        # pinned to the groups the solver does read
        assert group_cage["cells"] == drawn["cells"][1:], (
            "a cage is not its group's targets"
        )
        assert counter_cage["cells"] == drawn["cells"][:1], (
            "a # cage is not its group's counter"
        )
        assert group_cage["value"] == drawn["value"], (
            "a cage label is not its group's digits"
        )
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
    mtime = link.stat().st_mtime_ns
    with tempfile.TemporaryDirectory() as tmp:
        out = build(
            pathlib.Path(tmp) / "not" / "yet",
            GEN if selfcount else OUTSIDE_GEN,
            name=link.name,
        )
        assert out.read_bytes() == shipped, "the link does not reproduce"
    assert link.stat().st_mtime_ns == mtime, "--out touched the committed link"

    # flipping which one is on swaps the disabled flag and nothing else
    flipped = build_doc(gen, "builtin")
    was = build_doc(gen, "gac")
    for a, b in zip(customs(was), customs(flipped), strict=True):
        assert ("disabled" in a) != ("disabled" in b)
        assert {k: v for k, v in a.items() if k != "disabled"} == {
            k: v for k, v in b.items() if k != "disabled"
        }
    assert backend_code(CANDIDATE_NAME) != backend_code(BASELINE_NAME)


if __name__ == "__main__":
    gen = json.loads(GEN.read_text())
    outside = json.loads(OUTSIDE_GEN.read_text())
    check_board(gen, selfcount=True)
    check_board(outside, selfcount=False)
    check_board(json.loads((DEMO_DIR / "gen_4x10.json").read_text()), selfcount=False)
    check_uniqueness_detects_a_wrong_count(outside)
    check_grow_region_is_connected_and_disjoint()
    check_palette_guard(gen)
    check_link(gen, LINK, selfcount=True)
    check_link(outside, OUTSIDE_LINK, selfcount=False)
    print("ok")
