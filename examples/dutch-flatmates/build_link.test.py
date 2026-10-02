# build_link.py: the committed PUZZLE_LINK.txt is exactly what the builder
# writes from gen.json, decodes to the board the README describes (ringless 9x9,
# gen.json's givens, the rules text, exactly one whole-grid flatmate component),
# survives a component swap unchanged, and the builder refuses a board that is
# not uniquely solvable. Also runs verify.py's proof of the shipped board.
#
#   uv run --with lzstring examples/dutch-flatmates/build_link.test.py

import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import CONSTRAINT_NAME, RULE, TIMED_COMPONENT, build, check
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
    print("PASS")
