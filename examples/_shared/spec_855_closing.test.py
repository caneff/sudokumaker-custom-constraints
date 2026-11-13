"""One end-to-end test for spec #855: a 9x9 ISOFILL inside an interactive
Skyscrapers ring (slices #857, #858, #859).

The shipped board is taken through the shared layer, in the order a reader
meets it:

  1. the link decodes to an 11x11 custom document with digits 1-9, no box
     regions and no row/column houses, its corners pinned by frame-corners,
     and rules text that opens on the ISOFILL rule (no sudoku sentence) and
     says a tie is hidden;
  2. the link is the board gen.json records, its givens all in the ring
     (spec ruling 2), at least half its ring blank, and the recorded grid solves
     it under the shared ISOFILL model and the clue rule;
  3. the manifest names the combined rule, times IsofillComponent, and
     declares no sudoku prefix and no houses, and the layout gate accepts
     the example;
  4. the backend registers one IsofillComponent and one one-sided skyscraper
     component per clue, and the link ships both components with ties hidden;
  5. the frame builder's interior hook left unset still builds every sudoku ring
     board: skyscraper's committed 9x9 link rebuilds byte for byte.

WHAT A GREEN RUN DOES NOT COVER (this seam is blind to it):
  - the app: whether the link opens, reads [unique] and solves in
    sudokumaker.app, and `just time isofill-skyscraper`'s cold and
    after-logical rows. The closing check on #855 opens the real thing for
    both; the README records the rows.
  - the uniqueness proof itself: verify.py runs it in the seam (about 5 s a
    board); step 2 checks the board is the one that proof ran on.
  - the ring-only search: carve.test.py drives it on toy interiors; the
    shipped board's search ran once, on 200 seeds, and its result is in the
    README, not re-run here.

Left to their own suites, not driven here: the combined soundness fuzz
(isofill-skyscraper/soundness-harness.mjs), the clue rule against skyscraper's
`sky` (isofill-skyscraper/build_size.test.py), every other ring example's
rebuild (size_builders.test.py), and the ISOFILL example's own proofs
(`just verify-isofill`).

    uv run examples/_shared/spec_855_closing.test.py
"""

import importlib.util
import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
EXAMPLES = HERE.parent
EXAMPLE = EXAMPLES / "isofill-skyscraper"
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(EXAMPLE))

from board import load_board
from build_size import SPEC
from check_layout import check_example
from document import FRAME_BACKENDS, RULES_PREFIX
from lanes import RingGlobal
from manifest import load_manifest
from ring_link import mismatches
from sudoku_kit.link_codec import decode_puzzle
from verify import grid_problems, house_problems


def _shipped():
    link_path, gen_path = RingGlobal(SPEC).files(9)
    return decode_puzzle(link_path.read_text().strip())["puzzle"], load_board(gen_path)


def the_link_is_an_isofill_ring_board():
    doc, _ = _shipped()
    assert (doc["type"], doc["width"], doc["height"]) == ("custom", 11, 11)
    assert (doc["minDigit"], doc["maxDigit"]) == (1, 9)
    assert house_problems(doc) == [], house_problems(doc)
    names = [c.get("definition", {}).get("name") for c in doc["constraints"]]
    assert dict(FRAME_BACKENDS)["frame-corners"] in names, "the corners are pinned"
    comment = doc["comment"]
    assert comment.startswith("ISOFILL"), comment[:60]
    assert not comment.startswith(RULES_PREFIX.strip())
    assert "strictly taller" in comment, "the rules text says a tie is hidden"


def the_link_is_the_ring_only_board_gen_records():
    doc, board = _shipped()
    assert not board.givens, f"{len(board.givens)} interior givens"
    shown = {k: board.clue[k] for k in board.active}
    assert mismatches(doc, board.givens, shown) == []
    assert grid_problems(board) == [], grid_problems(board)
    blank = len(board.lines) - len(board.active)
    assert blank * 2 >= len(board.lines), f"{blank} of {len(board.lines)} blank"


def the_manifest_and_the_layout_gate_accept_it():
    manifest = load_manifest(EXAMPLE)
    assert manifest.constraint_name == "ISOFILL Skyscrapers"
    assert manifest.timed_component == "IsofillComponent"
    assert (manifest.rules_prefix, manifest.houses) == ("none", False)
    assert check_example(EXAMPLE) == [], check_example(EXAMPLE)


def the_backend_registers_both_components_with_ties_hidden():
    # Run the assembled backend on an 11x11 board, the way the app does: one
    # IsofillComponent over the 9x9 interior, one one-sided skyscraper per
    # ring clue (4 sides x 9 lines).
    probe = f"""
    import {{ assembleSource }} from {(HERE / "include.mjs").as_uri()!r}
    import {{ mockBoard, runBackend }} from {(HERE / "backend-runner.mjs").as_uri()!r}
    const src = assembleSource({str(EXAMPLE / "main-global.js")!r})
    const puzzle = mockBoard({{ width: 11, height: 11 }})
    const helpers = {{ naming: {{ getCellName: c => `c${{c}}` }} }}
    runBackend(src, {{ puzzle, helpers }})
    const by = ctor => puzzle.registered.filter(c => c.ctor === ctor)
    console.log(JSON.stringify({{
      isofill: by('IsofillComponent').map(c => [c.args[2], c.args[3], c.args[1].length]),
      sky: by('SkyscraperOneSidedComponent').length,
      other: puzzle.registered.length - by('IsofillComponent').length - by('SkyscraperOneSidedComponent').length
    }}))
    """
    out = subprocess.run(
        ["node", "--input-type=module", "-e", probe],
        capture_output=True,
        text=True,
    )
    assert out.returncode == 0, out.stderr
    got = json.loads(out.stdout)
    assert got == {"isofill": [[9, 9, 81]], "sky": 36, "other": 0}, got
    sky = (EXAMPLE / "SkyscraperOneSidedComponent.js").read_text()
    assert "const ALLOW_TIES = false" in sky
    # That each shipped copy is the current file is check_layout's stale-code
    # check, run in step 3; here the link ships the two by name.
    doc, _ = _shipped()
    rule = next(c for c in doc["constraints"] if c.get("name") == SPEC.constraint_name)
    shipped = [k["name"] for k in rule["definition"]["components"]]
    assert shipped == ["IsofillComponent", "SkyscraperOneSidedComponent"], shipped


def a_sudoku_ring_board_builds_as_it_did():
    builder = EXAMPLES / "skyscraper" / "build_size.py"
    module_spec = importlib.util.spec_from_file_location(
        "build_size_skyscraper", builder
    )
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    spec = module.SPEC
    assert (spec.grid_fn, spec.model_fn, spec.rules_prefix) == (None, None, None)
    lane = RingGlobal(spec)
    link, _ = lane.files(9)
    assert lane.rebuild(9) + "\n" == link.read_text(), (
        f"{link.name} rebuilt differently"
    )


if __name__ == "__main__":
    the_link_is_an_isofill_ring_board()
    the_link_is_the_ring_only_board_gen_records()
    the_manifest_and_the_layout_gate_accept_it()
    the_backend_registers_both_components_with_ties_hidden()
    a_sudoku_ring_board_builds_as_it_did()
    print("spec_855_closing.test.py: ok")
