# minify_js: what survives into a shipped link and what does not.
#
#   uv run examples/_shared/minify.test.py

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from minify import minify_js


def test_keeps_marked_comments_and_drops_ordinary_ones():
    got = minify_js(
        "// ordinary, dropped\n"
        "  //! kept note\n"
        "const x = 1        // inline note, dropped\n"
        "\n"
        "  const u = 'http://a/b'\n"
    )
    assert got == "  // kept note\nconst x = 1\n  const u = 'http://a/b'\n", repr(got)


def test_keeps_the_spacing_a_marked_comment_lays_out():
    # These headers put rules in columns; flattening them costs the shipped
    # copy its shape.
    got = minify_js("//! Seal:     a finished region\n//!           loses k.\n")
    assert got == "// Seal:     a finished region\n//           loses k.\n", repr(got)


def test_drops_a_block_comment():
    # The one block comment every component carries is its linter directive,
    # which means nothing to a recipient who runs no linter.
    got = minify_js(
        "/* eslint-disable no-unused-vars -- the component API */\n"
        "//! Kept.\n"
        "function update () {}\n"
    )
    assert got == "// Kept.\nfunction update () {}\n", repr(got)


def test_drops_a_block_comment_sharing_a_line_with_code():
    # The gap a mid-line comment leaves behind is not closed up. No shipped
    # file has one, and closing it would mean touching spacing inside strings.
    got = minify_js("const n = 3 /* the side */\nconst m = /* two */ 2\n")
    assert got == "const n = 3\nconst m =  2\n", repr(got)


def test_keeps_block_comments_when_asked_to():
    # Vendored code has to round-trip byte-for-byte, type annotations included.
    src = "function* update (i) /* : Generator<Change> */ {\n"
    assert minify_js(src, drop_blocks=False) == src, repr(minify_js(src, False))
    assert "/*" not in minify_js(src)


def test_refuses_an_unpaired_block_marker_rather_than_guessing():
    # This is a regex strip, not a scanner, so anything it cannot pair on one
    # line -- a block spanning lines, or a "/*" living inside a string -- is
    # refused rather than half-cut. No shipped file has either today.
    unpaired = [
        "/* opens\n and closes */\nconst x = 1\n",  # a multi-line block
        "const x = 1 /* opens\n",  # a block with no end at all
        "const s = 'a /* b'\n",  # a marker inside a string
    ]
    for src in unpaired:
        try:
            minify_js(src)
        except AssertionError:
            continue
        raise AssertionError(f"expected a refusal for {src!r}")


if __name__ == "__main__":
    test_keeps_marked_comments_and_drops_ordinary_ones()
    test_keeps_the_spacing_a_marked_comment_lays_out()
    test_drops_a_block_comment()
    test_keeps_block_comments_when_asked_to()
    test_drops_a_block_comment_sharing_a_line_with_code()
    test_refuses_an_unpaired_block_marker_rather_than_guessing()
    print("ok")
