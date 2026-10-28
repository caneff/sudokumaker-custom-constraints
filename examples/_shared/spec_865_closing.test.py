"""One end-to-end test for spec #865: fillomino, isofill and isofill-skyscraper
on any W x H board (slices #866-#869), then a readable fillomino for sharing
(#870).

Driven here, in the order the spec states them:

  1. the shared neighbour helper takes a width and a height, and on a board
     that is not square it names the same neighbours as the CP-SAT models'
     edges, both ways round;
  2. a rectangular fillomino: the committed 7 x 5 link rebuilds byte for byte
     from gen_15g.json, decodes as that board with its givens, offers the
     digits its rules text names, and is proven unique on the repo model at
     that range;
  3. a rectangular isofill, built the way a setter builds one: sampled and
     stripped by verify.py on a 4 x 6 board with 4 digits, its gen JSON read
     back, proven unique, and built and checked by build_link.py into a 4 x 6
     link whose rules text names 4 regions of 6;
  4. a rectangular-interior isofill-skyscraper: a 4 x 3 interior generated and
     proven unique on the shared model, built into a 6 x 5 ring board whose
     clues read back as recorded, and a main that hands the component the
     interior's width and height;
  5. the readable fillomino: the equivalence test against the frozen
     pre-rewrite component reports identical removals, and the annotated twin
     is the shipped board with comments kept, defines ISLAND and REGION once,
     and carries none of the repo's jargon.

WHAT A GREEN RUN DOES NOT COVER (this seam, `just check-full`, is blind to it):
  - the app: whether each link opens, renders and solves in sudokumaker.app
    (the 7 x 5 fillomino, a rectangular isofill and isofill-skyscraper built in
    .scratch/, and PUZZLE_LINK_annotated.txt), and solve time (`just time`).
    The closing check on #865 opens the real thing; the READMEs record the
    timing rows.
  - the shipped component solving the 7 x 5 board offline: pipeline.test.py
    (heavy) drives that.
  - the soundness and update-strength fuzz on rectangles: each example's
    soundness harness and update-strength test.

    uv run examples/_shared/spec_865_closing.test.py
"""

import importlib.util
import json
import pathlib
import re
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
EXAMPLES = HERE.parent
sys.path.insert(0, str(HERE))

from minify import minify_js
from sm_document import find_constraint
from sudoku_kit.link_codec import decode_puzzle


def _load(example, name):
    """`examples/<example>/<name>.py` as its own module: three examples share
    file names (build_link.py, verify.py), so none is imported by name."""
    directory = EXAMPLES / example
    sys.path.insert(0, str(directory))
    spec = importlib.util.spec_from_file_location(
        f"{example.replace('-', '_')}_{name}", directory / f"{name}.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    sys.path.remove(str(directory))
    return module


def _js_neighbours(width, height):
    src = (HERE / "dominator.js").read_text()
    script = (
        f"{src}\nconsole.log(JSON.stringify(Array.from("
        f"{{ length: {width * height} }}, (_, i) => neighbours(i, {width}, {height}))))"
    )
    out = subprocess.run(
        ["node", "-e", script], capture_output=True, text=True, check=True
    )
    return [sorted(n) for n in json.loads(out.stdout)]


def the_neighbour_helper_reads_width_and_height():
    generate = _load("fillomino", "generate")
    for width, height in [(7, 5), (5, 7)]:
        board = generate.Board.of(width, height)
        model = [[] for _ in range(width * height)]
        for p, q in board.edges:
            model[board.idx(p)].append(board.idx(q))
        assert _js_neighbours(width, height) == [sorted(n) for n in model], (
            f"{width}x{height}: the helper and the model disagree on a neighbour"
        )


def a_rectangular_fillomino_ships_and_proves():
    fillomino = EXAMPLES / "fillomino"
    build_link = _load("fillomino", "build_link")
    generate = _load("fillomino", "generate")
    gen = json.loads((fillomino / "gen_15g.json").read_text())
    link, doc, n_clues = build_link.build(
        fillomino / "FillominoComponent.js", fillomino / "gen_15g.json"
    )
    build_link.check(link, doc, n_clues)
    assert link == (fillomino / "PUZZLE_LINK_15g.txt").read_text().strip(), (
        "PUZZLE_LINK_15g.txt is not what build_link.py writes from gen_15g.json"
    )
    p = decode_puzzle(link)["puzzle"]
    assert (p["width"], p["height"]) == (7, 5)
    assert (p["minDigit"], p["maxDigit"]) == (1, 7)
    assert "from 1-7" in p["comment"], p["comment"][:80]
    givens = {
        divmod(i, 7): c["value"] for i, c in enumerate(p["cells"]) if c.get("given")
    }
    assert givens == {(r, c): gen["grid"][r][c] for r, c in gen["clues"]}
    board = generate.Board.of_doc(gen)
    assert (board.width, board.height, board.cap) == (7, 5, 7)
    assert generate.unique(board, board.givens(gen)) is True


def a_rectangular_isofill_builds_from_the_setter_s_tools():
    verify = _load("isofill", "verify")
    build_link = _load("isofill", "build_link")
    board = verify.Board.of(4, 6, lo=1, digits=4)
    grid = verify.sample(board, seed=3)
    clues = verify.strip(board, grid, seed=3)
    with tempfile.TemporaryDirectory() as tmp:
        path = pathlib.Path(tmp) / "gen.json"
        path.write_text(json.dumps(verify.gen_doc(board, grid, clues)))
        doc = json.loads(path.read_text())
        again = verify.Board.of_doc(doc)
        assert again == board, "the written gen does not read back as its board"
        assert verify.unique(again, again.givens(doc)) is True
        link, built, n_clues = build_link.build(
            EXAMPLES / "isofill" / "IsofillComponent.js", path
        )
        build_link.check(link, built, n_clues)
    p = built["puzzle"]
    assert (p["width"], p["height"], p["minDigit"], p["maxDigit"]) == (4, 6, 1, 4)
    assert "4 regions, each with 6" in p["comment"], p["comment"][:80]


def a_rectangular_isofill_skyscraper_builds_and_proves():
    build_size = _load("isofill-skyscraper", "build_size")
    from framebuild import RingGlobal, generate, unique
    from ring_link import mismatches
    from sudoku_kit import link_codec

    spec = build_size.SPEC
    board = generate(spec, 4, 1, 4, range(101, 104), shape={"height": 3, "digits": 3})
    assert (board.n, board.height, board.digits) == (4, 3, 3)
    assert unique(spec.cp_sat_clue_fn, board, spec.model_fn) is True
    lane = RingGlobal(spec)
    doc = lane.build_doc(board)
    lane.check(link_codec.encode_link(doc), doc, board)
    p = doc["puzzle"]
    assert (p["width"], p["height"], p["maxDigit"]) == (6, 5, 3)
    shown = {k: board.clue[k] for k in board.active}
    assert mismatches(p, board.givens, shown) == []
    main = (EXAMPLES / "isofill-skyscraper" / "main-global.js").read_text()
    assert "new IsofillComponent('ISOFILL', interior, nw, nh)" in main


def the_readable_fillomino_matches_and_reads():
    fillomino = EXAMPLES / "fillomino"
    out = subprocess.run(
        ["node", str(fillomino / "equivalence.test.mjs")],
        capture_output=True,
        text=True,
    )
    assert out.returncode == 0, out.stderr[-2000:]
    assert re.search(r"all identical to \w+", out.stdout), out.stdout[-500:]

    plain = decode_puzzle((fillomino / "PUZZLE_LINK.txt").read_text().strip())
    twin = decode_puzzle((fillomino / "PUZZLE_LINK_annotated.txt").read_text().strip())
    assert {**twin["puzzle"], "constraints": None} == {
        **plain["puzzle"],
        "constraints": None,
    }, "the annotated twin is not the shipped board"
    name = _load("fillomino", "build_link").CONSTRAINT_NAME
    kept = find_constraint(twin, name)["definition"]
    bare = find_constraint(plain, name)["definition"]
    pairs = [(kept["backend"]["code"], bare["backend"]["code"])] + [
        (k["code"], b["code"])
        for k, b in zip(kept["components"], bare["components"], strict=True)
    ]
    for code, shipped in pairs:
        assert minify_js(code) == shipped, "the twin's code is not the shipped code"
        for jargon in ("door", "starve", "seal", "stamp", "eslint"):
            assert jargon not in code.lower(), f"the twin names {jargon!r}"
    component = kept["components"][0]["code"]
    for word in ("ISLAND", "REGION"):
        assert component.count(f"  {word}  ") == 1, f"{word} is not defined once"


if __name__ == "__main__":
    the_neighbour_helper_reads_width_and_height()
    a_rectangular_fillomino_ships_and_proves()
    a_rectangular_isofill_builds_from_the_setter_s_tools()
    a_rectangular_isofill_skyscraper_builds_and_proves()
    the_readable_fillomino_matches_and_reads()
    print("spec_865_closing.test.py: ok")
