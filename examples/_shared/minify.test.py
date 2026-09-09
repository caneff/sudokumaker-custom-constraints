# minify_js: what survives into a shipped link and what does not.
#
#   uv run examples/_shared/minify.test.py

import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from minify import minify_file, minify_js


def test_drops_every_comment_including_the_marked_ones():
    # A "//!" block is commentary for the source file, not for the link: the
    # shipped copy carries no comments at all (#385).
    got = minify_js(
        "// ordinary, dropped\n"
        "  //! marked, dropped too\n"
        "const x = 1        // inline note, dropped\n"
        "\n"
        "  const u = 'http://a/b'\n"
    )
    assert got == "const x = 1\n  const u = 'http://a/b'\n", repr(got)


def test_drops_a_marked_comment_that_trails_code():
    # The marker is not special anywhere: a "//!" after code goes the same way
    # an ordinary trailing comment does.
    got = minify_js("const x = 1  //! marked, dropped\n")
    assert got == "const x = 1\n", repr(got)


def test_drops_a_block_comment():
    # The one block comment every component carries is its linter directive,
    # which means nothing to a recipient who runs no linter.
    got = minify_js(
        "/* eslint-disable no-unused-vars -- the component API */\n"
        "function update () {}\n"
    )
    assert got == "function update () {}\n", repr(got)


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
    # Sparing block comments does not spare line comments -- marked or not.
    # No vendored file carries a "//!", so this path loses nothing (#385).
    kept = minify_js("//! marked\n// plain\nconst x = 1\n", drop_blocks=False)
    assert kept == "const x = 1\n", repr(kept)


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


def test_splices_an_include_relative_to_the_including_file():
    # A "// #include <path>" line is replaced by the named file's text, so one
    # copy of a shared segment can serve every paste target that needs it.
    with tempfile.TemporaryDirectory() as d:
        root = pathlib.Path(d)
        (root / "_shared").mkdir()
        (root / "_shared" / "seg.js").write_text("function f () { return 1 }\n")
        (root / "main-global.js").write_text("// #include _shared/seg.js\nf()\n")
        got = minify_file(root / "main-global.js")
    assert got == "function f () { return 1 }\nf()\n", repr(got)


def test_minifies_the_included_text_too():
    # The include is spliced before the strip runs, so an included file's
    # commentary is dropped exactly like the including file's.
    with tempfile.TemporaryDirectory() as d:
        root = pathlib.Path(d)
        (root / "seg.js").write_text(
            "/* eslint-disable no-unused-vars */\n"
            "// commentary, dropped\n"
            "const x = 1  //! dropped too\n"
        )
        (root / "main.js").write_text("// #include seg.js\n")
        got = minify_file(root / "main.js")
    assert got == "const x = 1\n", repr(got)


def test_an_include_that_minifies_to_nothing_leaves_no_blank_line():
    # Minify's contract is that no blank line survives. An included file made
    # only of commentary minifies to "", and splicing that in unconditionally
    # shipped a stray blank line (#359 review F5).
    with tempfile.TemporaryDirectory() as d:
        root = pathlib.Path(d)
        (root / "seg.js").write_text("// all commentary, nothing to ship\n")
        (root / "main.js").write_text("const a = 1\n// #include seg.js\nconst b = 2\n")
        got = minify_file(root / "main.js")
    assert got == "const a = 1\nconst b = 2\n", repr(got)


def test_refuses_a_missing_include_rather_than_shipping_the_directive():
    # A directive that resolves to nothing must stop the build: silently
    # leaving it in ships a link whose backend is missing a whole function.
    with tempfile.TemporaryDirectory() as d:
        root = pathlib.Path(d)
        (root / "main.js").write_text("// #include nope.js\n")
        try:
            minify_file(root / "main.js")
        except AssertionError:
            return
        raise AssertionError("expected a refusal for a missing include")


def test_refuses_an_include_when_no_base_directory_is_known():
    # minify_js on a bare string cannot resolve a relative path, so it refuses
    # instead of dropping the directive as an ordinary comment.
    # The message has to name the missing directory, not the missing file: a
    # relative path resolved against the process's cwd fails as "no such file"
    # too, and that refusal would hide this one.
    try:
        minify_js("// #include seg.js\n")
    except AssertionError as e:
        assert "minify_file" in str(e), str(e)
        return
    raise AssertionError("expected a refusal with no base_dir")


def test_refuses_an_include_cycle():
    with tempfile.TemporaryDirectory() as d:
        root = pathlib.Path(d)
        (root / "a.js").write_text("// #include b.js\n")
        (root / "b.js").write_text("// #include a.js\n")
        try:
            minify_file(root / "a.js")
        except AssertionError:
            return
        raise AssertionError("expected a refusal for an include cycle")


def test_refuses_a_directive_with_no_path():
    # "// #include" alone is not an ordinary comment to drop: it is a
    # half-written directive, and guessing what it meant is the ambiguity this
    # strip refuses.
    with tempfile.TemporaryDirectory() as d:
        root = pathlib.Path(d)
        (root / "main.js").write_text("// #include\n")
        try:
            minify_file(root / "main.js")
        except AssertionError as e:
            # Named as a pathless directive, not as a missing file: an empty
            # path resolves to the directory itself, which is not a file
            # either, and that refusal would hide this one.
            assert "exactly one path" in str(e), str(e)
            return
        raise AssertionError("expected a refusal for a pathless directive")


if __name__ == "__main__":
    test_drops_every_comment_including_the_marked_ones()
    test_drops_a_marked_comment_that_trails_code()
    test_drops_a_block_comment()
    test_keeps_block_comments_when_asked_to()
    test_drops_a_block_comment_sharing_a_line_with_code()
    test_refuses_an_unpaired_block_marker_rather_than_guessing()
    test_splices_an_include_relative_to_the_including_file()
    test_minifies_the_included_text_too()
    test_an_include_that_minifies_to_nothing_leaves_no_blank_line()
    test_refuses_a_missing_include_rather_than_shipping_the_directive()
    test_refuses_an_include_when_no_base_directory_is_known()
    test_refuses_an_include_cycle()
    test_refuses_a_directive_with_no_path()
    print("ok")
