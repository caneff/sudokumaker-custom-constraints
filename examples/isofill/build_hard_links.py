# Stripped (givens-only) links for the hard fixtures, so they can be opened
# and played in SudokuMaker as they are timed. Run by hand after a fixture
# changes; examples/isofill/build_link.test.py guards that each committed
# link still matches what this script would produce.
#   uv run examples/isofill/build_hard_links.py
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))
from build_link import build, check
from link_codec import encode_link
from probe_link import check_stripped, strip_to_givens

FIXTURES = {
    "gen_30g.json": "PUZZLE_LINK_30g.txt",
    "gen_32g.json": "PUZZLE_LINK_32g.txt",
    "gen_35g_silent.json": "PUZZLE_LINK_35g_silent.txt",
    "gen_44g.json": "PUZZLE_LINK_44g.txt",
    "gen_9x9.json": "PUZZLE_LINK_9x9.txt",
    "gen_28g.json": "PUZZLE_LINK_28g.txt",
    "gen_24g.json": "PUZZLE_LINK_24g.txt",
    "gen_25g.json": "PUZZLE_LINK_25g.txt",
    "gen_26g.json": "PUZZLE_LINK_26g.txt",
}


def write_links(out_dir=HERE):
    """Build each fixture's link, strip it to its givens, write it to out_dir."""
    for name, out_name in FIXTURES.items():
        link, doc, n_clues = build(HERE / "IsofillComponent.js", HERE / name)
        check(link, doc, n_clues)
        # A hard-fixture link never ships the solution: every non-given cell is {}.
        stripped = strip_to_givens(doc)
        check_stripped(stripped)
        (Path(out_dir) / out_name).write_text(encode_link(stripped))
        print(f"{out_name}: {n_clues} givens, rest empty")


if __name__ == "__main__":
    write_links()
