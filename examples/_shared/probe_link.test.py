# empty_interior drops inner non-given values, keeps givens and the outer
# ring. empty_link_file wraps it as a file-to-file step (used by both this
# module's own CLI and examples/_shared/time_example.py).
#
#   uv run --with lzstring examples/_shared/probe_link.test.py

import pathlib
import tempfile

from link_codec import decode_puzzle, encode_link
from probe_link import check_stripped, empty_interior, empty_link_file, strip_to_givens

HERE = pathlib.Path(__file__).parent
SRC = HERE.parent / "skyscraper" / "PUZZLE_LINK_6x6.txt"
ISO_SRC = HERE.parent / "isofill" / "PUZZLE_LINK.txt"


def dirty(src, out):
    """Write `src` back with a value in every non-given cell.

    Every shipped link is given-only — check_layout.py enforces it — so a probe
    step has nothing to strip from one. These fixtures put the entered values
    back, which is the board shape the probe steps exist to clean up.
    """
    doc = decode_puzzle(src.read_text().rstrip("\n"))
    for i, c in enumerate(doc["puzzle"]["cells"]):
        if not c.get("given"):
            c["value"] = i % 9 + 1
    out.write_text(encode_link(doc))
    return out


if __name__ == "__main__":
    fixtures = tempfile.TemporaryDirectory()
    LINK_FILE = dirty(SRC, pathlib.Path(fixtures.name) / "link.txt")
    ISO = dirty(ISO_SRC, pathlib.Path(fixtures.name) / "iso.txt")

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

    # strip keeps only given cells; every other cell is empty
    doc2 = decode_puzzle(LINK_FILE.read_text().rstrip("\n"))
    strip_to_givens(doc2)
    for i, c in enumerate(doc2["puzzle"]["cells"]):
        if c.get("given"):
            assert "value" in c, f"strip: given cell {i} lost its value"
        else:
            assert c == {}, f"strip: non-given cell {i} not empty: {c}"
    assert any(c.get("given") for c in doc2["puzzle"]["cells"]), (
        "strip removed all givens"
    )

    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "probe.txt"
        empty_link_file(LINK_FILE, out)
        via_file = decode_puzzle(out.read_text().rstrip("\n"))
        assert via_file == doc, "empty_link_file did not match empty_interior"

    # check_stripped: the enforcement. A shipped link (solution entered) is
    # refused; a stripped one passes; ring values pass only with ring_clues.
    shipped = decode_puzzle(ISO.read_text().rstrip("\n"))
    try:
        check_stripped(shipped)
        raise AssertionError("check_stripped accepted a link with entered values")
    except ValueError as e:
        assert "65 non-given cells" in str(e), str(e)
    check_stripped(strip_to_givens(decode_puzzle(ISO.read_text().rstrip("\n"))))
    ring_kept = empty_interior(decode_puzzle(ISO.read_text().rstrip("\n")))
    try:
        check_stripped(ring_kept)
        raise AssertionError("check_stripped accepted ring values without ring_clues")
    except ValueError:
        pass
    check_stripped(ring_kept, ring_clues=True)

    # empty clears pencil marks from inner cells, not just values
    marked = decode_puzzle(LINK_FILE.read_text().rstrip("\n"))
    inner = next(i for i in inner_filled)
    marked["puzzle"]["cells"][inner]["pencilMarks"] = [1, 2]
    empty_interior(marked)
    assert marked["puzzle"]["cells"][inner] == {}, "empty left pencil marks"

    # empty_link_file refuses to write a probe that is not stripped
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "probe.txt"
        empty_link_file(ISO, out, "strip")
        assert check_stripped(decode_puzzle(out.read_text())) is None

    print("ok")
