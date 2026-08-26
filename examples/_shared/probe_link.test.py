# empty_interior drops inner non-given values, keeps givens and the outer
# ring. empty_link_file wraps it as a file-to-file step (used by both this
# module's own CLI and examples/_shared/time_example.py).
#
#   uv run --with lzstring examples/_shared/probe_link.test.py

import pathlib
import tempfile

from link_codec import decode_puzzle
from probe_link import empty_interior, empty_link_file

HERE = pathlib.Path(__file__).parent
LINK_FILE = HERE.parent / "skyscraper" / "PUZZLE_LINK_6x6.txt"

if __name__ == "__main__":
    doc = decode_puzzle(LINK_FILE.read_text().rstrip("\n"))
    w, h = doc["puzzle"]["width"], doc["puzzle"]["height"]
    before = doc["puzzle"]["cells"]
    inner_filled = [
        i
        for i, c in enumerate(before)
        if 0 < i // w < h - 1 and 0 < i % w < w - 1 and not c.get("given")
    ]
    assert inner_filled, "fixture has no inner non-given cells to empty"

    empty_interior(doc)
    cells = doc["puzzle"]["cells"]

    for i in inner_filled:
        assert "value" not in cells[i], f"inner cell {i} kept its value"
    for i, c in enumerate(cells):
        if c.get("given"):
            assert "value" in c, f"given cell {i} lost its value"
        on_ring = i // w in (0, h - 1) or i % w in (0, w - 1)
        if on_ring and "value" in before[i]:
            assert "value" in c, f"outer-ring cell {i} lost its value"

    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "probe.txt"
        empty_link_file(LINK_FILE, out)
        via_file = decode_puzzle(out.read_text().rstrip("\n"))
        assert via_file == doc, "empty_link_file did not match empty_interior"

    print("ok")
