# Stripped (givens-only) links for the hard fixtures, so they can be opened
# and played in SudokuMaker as they are timed. Rebuilt by `just check`.
#   uv run --with lzstring examples/isofill/build_hard_links.py
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SHARED = HERE.parent / "_shared"
sys.path.insert(0, str(SHARED))
from link_codec import decode_puzzle

FIXTURES = ["puzzle-32.json", "puzzle-44.json"]

for name in FIXTURES:
    stem = name.removesuffix(".json")
    out = HERE / f"PUZZLE_LINK-{stem.split('-')[1]}.txt"
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
        [*uv, str(SHARED / "probe_link.py"), "strip", str(full), str(out)], check=True
    )
    full.unlink()
    # A hard-fixture link never ships the solution: every non-given cell is {}.
    doc = decode_puzzle(out.read_text().strip())
    bad = [c for c in doc["puzzle"]["cells"] if not c.get("given") and c]
    assert not bad, f"{out.name}: {len(bad)} non-given cells hold data"
    print(
        f"{out.name}: {sum(1 for c in doc['puzzle']['cells'] if c.get('given'))} givens, rest empty"
    )
