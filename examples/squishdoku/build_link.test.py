# build_link.py rebuilds every squishdoku link from the files in the tree: the
# template (PUZZLE_LINK.txt) is the committed one with the backend swapped for
# main.js, and each puzzle link is that template plus its gen JSON's givens.
# These cases pin that the committed links are what the builder makes, that the
# templates carry no clues, and that each shipped puzzle has exactly one
# solution.
#
#   uv run examples/squishdoku/build_link.test.py

import json
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import BOARDS, build_puzzle, build_template, gen_files, link_path
from link_swap import blanked
from sm_document import find_constraint
from squish_board import has_one_solution
from sudoku_kit.link_codec import decode_puzzle

if __name__ == "__main__":
    for spec in BOARDS:
        committed = (spec.dir / "PUZZLE_LINK.txt").read_text().strip()
        base = decode_puzzle(committed)

        # the template is reproduced by its own backend file
        assert build_template(spec) == committed, f"{spec.name}: stale template"
        assert not any(c.get("given") for c in base["puzzle"]["cells"]), (
            f"{spec.name}: the empty template ships a given"
        )
        backend = find_constraint(base, spec.constraint)["definition"]["backend"]
        assert backend["code"].count("HouseComponent") >= 1
        assert base["puzzle"]["width"] == spec.board.width

        # a rules text that opens on the board, not on the sudoku sentence
        assert not base["puzzle"]["comment"].startswith("Normal sudoku rules")

        links = gen_files(spec)
        assert links, f"{spec.name} ships no generated puzzle"
        for gen_path in links:
            gen = json.loads(gen_path.read_text())
            n = len(gen["givens"])
            link_file = link_path(gen_path)
            assert link_file.name == f"PUZZLE_LINK_{n}g.txt", (gen_path.name, n)

            # the committed puzzle link is what the gen JSON builds
            link = build_puzzle(spec, gen)
            assert link == link_file.read_text().strip(), f"{link_file}: stale"

            # same board as the template, plus the givens and nothing else
            doc = decode_puzzle(link)
            cleared = json.loads(json.dumps(doc))
            for cell in cleared["puzzle"]["cells"]:
                cell.clear()
            assert blanked(cleared, spec.constraint) == blanked(
                base, spec.constraint
            ), f"{link_file}: differs from the template beyond its givens"
            cells = doc["puzzle"]["cells"]
            assert {i for i, c in enumerate(cells) if c.get("given")} == {
                int(i) for i in gen["givens"]
            }
            assert all(
                "value" not in c for i, c in enumerate(cells) if not c.get("given")
            ), f"{link_file}: a non-given cell holds a value"

            # exactly one solution
            assert has_one_solution(
                spec.board, {int(i): d for i, d in gen["givens"].items()}
            )

    # a gen JSON whose givens are not unique is refused by the builder
    spec = BOARDS[0]
    try:
        build_puzzle(spec, {"givens": {"0": 1}})
    except ValueError as e:
        assert "unique" in str(e), e
    else:
        raise AssertionError("a non-unique puzzle was built")

    print("ok")
