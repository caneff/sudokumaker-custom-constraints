# build_link.py: the committed PUZZLE_LINK.txt is exactly what the builder
# writes from gen.json, decodes to the board the README describes (ringless 9x9,
# gen.json's givens, the rules text, exactly one whole-grid flatmate component),
# survives a component swap unchanged, and the builder refuses a board that is
# not uniquely solvable. Also runs verify.py's proof of the shipped board, and
# the same checks on Flinty's Counting Circles board (gen_0g.json).
#
#   uv run examples/dutch-flatmates/build_link.test.py

import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import (
    CONSTRAINT_NAME,
    NO_FIVE_COMPONENT,
    NO_FIVE_NAME,
    RULE,
    TIMED_COMPONENT,
    build,
    check,
)
from framebuild import GRID_BACKEND, NO_RING_RULES_PREFIX
from link_codec import decode_puzzle
from link_swap import swap_build
from verify import verify

if __name__ == "__main__":
    committed = (HERE / "PUZZLE_LINK.txt").read_text().strip()

    # the committed link is exactly what the builder writes from gen.json
    link, doc, n_givens = build()
    check(link, doc, n_givens)
    assert link == committed, "PUZZLE_LINK.txt is not what build_link.py writes"

    # the decoded board: ringless 9x9, gen.json's givens, the rules text, the
    # one whole-grid component and the shared whole-grid rows-and-columns backend
    p = decode_puzzle(committed)["puzzle"]
    gen = json.loads((HERE / "gen.json").read_text())
    assert (p["type"], p["width"], p["height"]) == ("custom", 9, 9)
    assert p["comment"] == NO_RING_RULES_PREFIX + RULE
    assert p["comment"].startswith("Normal sudoku rules apply. Dutch Flatmates")
    given = {
        divmod(i, 9): c["value"] for i, c in enumerate(p["cells"]) if c.get("given")
    }
    assert given == {(r, c): int(gen["grid"][r][c]) for r, c in gen["clues"]}
    assert all(c.get("given") or c == {} for c in p["cells"]), (
        "the link opens with entered digits"
    )
    constraints = [c for c in p["constraints"] if c["type"] == 1000]
    assert [c["definition"]["name"] for c in constraints] == [
        GRID_BACKEND[1],
        CONSTRAINT_NAME,
    ]
    mine = constraints[1]["definition"]
    assert mine["input"] == []
    assert [c["name"] for c in mine["components"]] == [TIMED_COMPONENT]

    # swapping the committed component back into the committed board changes nothing
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "board.txt"
        assert (
            swap_build(HERE / "PUZZLE_LINK.txt", HERE / f"{TIMED_COMPONENT}.js", out)
            == committed
        )

        # a board that is not uniquely solvable is refused: drop half the givens
        loose = dict(gen, clues=gen["clues"][len(gen["clues"]) // 2 :])
        loose_path = pathlib.Path(tmp) / "loose.json"
        loose_path.write_text(json.dumps(loose))
        try:
            build(puzzle_path=loose_path)
        except AssertionError as e:
            assert "not uniquely solvable" in str(e), e
        else:
            raise AssertionError("build accepted a board with half its givens removed")

        # a grid that is not the board's solution is refused: change the digit
        # of one non-given cell
        r, c = next(
            (r, c) for r in range(9) for c in range(9) if [r, c] not in gen["clues"]
        )
        row = gen["grid"][r]
        other = str(int(row[c]) % 9 + 1)
        wrong = dict(
            gen,
            grid=[
                *gen["grid"][:r],
                row[:c] + other + row[c + 1 :],
                *gen["grid"][r + 1 :],
            ],
        )
        wrong_path = pathlib.Path(tmp) / "wrong.json"
        wrong_path.write_text(json.dumps(wrong))
        try:
            build(puzzle_path=wrong_path)
        except AssertionError as e:
            assert "not the board's solution" in str(e), e
        else:
            raise AssertionError(
                "build accepted a gen JSON whose grid is not the solution"
            )

    forced = verify()
    print(
        f"link matches the builder; verify.py: unique, {len(forced)} rule-forced flatmate(s)"
    )

    # ---- the Counting Circles board (gen_0g.json -> PUZZLE_LINK_0g.txt) ----
    committed_0g = (HERE / "PUZZLE_LINK_0g.txt").read_text().strip()
    link_0g, doc_0g, n_0g = build(puzzle_path=HERE / "gen_0g.json")
    check(link_0g, doc_0g, n_0g)
    assert n_0g == 0
    assert link_0g == committed_0g, (
        "PUZZLE_LINK_0g.txt is not what build_link.py writes"
    )

    p0 = decode_puzzle(committed_0g)["puzzle"]
    gen0 = json.loads((HERE / "gen_0g.json").read_text())
    assert p0["comment"].startswith("Normal sudoku rules apply. ")
    for rule in (
        "diagonals",
        "Dutch Flatmates",
        "Counting Circles",
        "No 5 in a circle",
    ):
        assert rule in p0["comment"], f"rules text does not name {rule!r}"
    assert "Flinty" in p0["comment"] and gen0["source"] in p0["comment"]
    assert all(c == {} for c in p0["cells"]), "the 0-given board opens with digits"
    by_type = {c["type"]: c for c in p0["constraints"] if c["type"] != 1000}
    assert by_type[306]["cells"] == gen0["circles"] and len(gen0["circles"]) == 28
    assert {10, 11} <= by_type.keys()
    names = [c["definition"]["name"] for c in p0["constraints"] if c["type"] == 1000]
    assert names == [GRID_BACKEND[1], CONSTRAINT_NAME, NO_FIVE_NAME], names
    no_five = p0["constraints"][-1]["definition"]
    assert [c["name"] for c in no_five["components"]] == [NO_FIVE_COMPONENT]
    assert json.dumps(gen0["circles"]) in no_five["backend"]["code"]

    # the recorded grid, against an independent statement of every rule
    g = [[int(ch) for ch in row] for row in gen0["grid"]]
    assert all(sorted(row) == list(range(1, 10)) for row in g)
    assert all(sorted(col) == list(range(1, 10)) for col in zip(*g, strict=True))
    assert len({g[i][i] for i in range(9)}) == 9
    assert len({g[i][8 - i] for i in range(9)}) == 9
    held = [g[i // 9][i % 9] for i in gen0["circles"]]
    assert all(held.count(v) == v for v in held), "a circle digit miscounts"
    assert 5 not in held
    assert all(
        (r > 0 and g[r - 1][c] == 1) or (r < 8 and g[r + 1][c] == 9)
        for r in range(9)
        for c in range(9)
        if g[r][c] == 5
    ), "a 5 has no flatmate"

    # the circle board swaps like the plain one, and only the flatmate code moves
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "board.txt"
        assert (
            swap_build(HERE / "PUZZLE_LINK_0g.txt", HERE / f"{TIMED_COMPONENT}.js", out)
            == committed_0g
        )

    forced0 = verify(HERE / "gen_0g.json", HERE / "PUZZLE_LINK_0g.txt")
    print(f"Counting Circles board: unique, {len(forced0)} rule-forced flatmate(s)")
    print("PASS")
