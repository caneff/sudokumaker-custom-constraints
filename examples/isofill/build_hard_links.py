# Stripped (givens-only) links for the hard fixtures, so they can be opened
# and played in SudokuMaker as they are timed. Run by hand after a fixture
# changes; examples/isofill/build_link.test.py guards that each committed
# link still matches what this script would produce.
#   uv run --with lzstring examples/isofill/build_hard_links.py
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SHARED = HERE.parent / "_shared"
sys.path.insert(0, str(SHARED))
from link_codec import decode_puzzle

FIXTURES = {
    "gen_30g.json": "PUZZLE_LINK_30g.txt",
    "gen_32g.json": "PUZZLE_LINK_32g.txt",
    "gen_35g_silent.json": "PUZZLE_LINK_35g_silent.txt",
    "gen_44g.json": "PUZZLE_LINK_44g.txt",
    "gen_9x9.json": "PUZZLE_LINK_9x9.txt",
}

if __name__ == "__main__":
    for name, out_name in FIXTURES.items():
        out = HERE / out_name
        full = out.with_suffix(".full.tmp")
        uv = ["uv", "run", "--with", "lzstring"]
        subprocess.run(
            [
                *uv,
                str(HERE / "build_link.py"),
                "--puzzle",
                str(HERE / name),
                "--out",
                str(full),
            ],
            check=True,
        )
        subprocess.run(
            [*uv, str(SHARED / "probe_link.py"), "strip", str(full), str(out)],
            check=True,
        )
        full.unlink()
        # A hard-fixture link never ships the solution: every non-given cell is {}.
        doc = decode_puzzle(out.read_text().strip())
        bad = [c for c in doc["puzzle"]["cells"] if not c.get("given") and c]
        assert not bad, f"{out.name}: {len(bad)} non-given cells hold data"
        print(
            f"{out.name}: {sum(1 for c in doc['puzzle']['cells'] if c.get('given'))} givens, rest empty"
        )
