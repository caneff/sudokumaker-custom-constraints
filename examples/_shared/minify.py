# Shrink the embedded JS before it goes into a puzzle link, so the shared URL
# stays small. The source files keep their full commentary; only the copy baked
# into the link is stripped.
#
# What survives into the export: the code and its indentation. Every comment
# and every blank line is dropped, block comments included -- a component's
# `/* eslint-disable ... */` is an apology to a linter the recipient does not
# run, and the commentary a source file carries in its "//!" blocks is a large
# fraction of both the shipped code and the link it goes into (#385; the
# measured shares are in docs/research/skyscraper-builtin-constraint-baseline.md).
# The source files keep those blocks; how a reuser gets the commentary is a
# separate question.
#
# One source file can splice in another with a line reading
#
#     // #include ../_shared/frame-lines.js
#
# resolved relative to the INCLUDING file's directory, and minified the same
# way its includer is -- the directive is read before the comment strip, so it
# is never mistaken for commentary. `minify_file(path)` is the entry point that
# knows a directory; `minify_js` on a bare string has none, and refuses a
# directive rather than dropping it. A missing file, a cycle, and a directive
# with no path all stop the build, the way an unpaired block marker does.
#
# The Node side runs the same assembled source without Python: the include
# splice is mirrored in examples/_shared/include.mjs. Two copies of one rule --
# keep the syntax identical when either changes.
#
# ponytail: regex strip, not a real parser. Safe for these files because none of
# them holds "//" inside a string or a regex literal (only single slashes, e.g.
# a URL or a template `${...}/${...}`). The `(?<!:)` guard keeps "http://".
# Block comments are paired within one line and nowhere else, so anything left
# unpaired -- a block spanning lines, a "/*" inside a string -- stops the build
# instead of being half-cut.

import pathlib
import re

# A whole line whose only content is the directive. Group 1 is everything after
# the keyword, so a pathless "// #include" is caught rather than read as a
# comment.
_INCLUDE_RE = re.compile(r"^\s*//\s*#include\b(.*)$")


def minify_file(path):
    """`minify_js` on `path`'s text, with includes resolved against its own
    directory. Every caller that ships a file's code into a link uses this."""
    path = pathlib.Path(path)
    return minify_js(path.read_text(), base_dir=path.parent)


def minify_js(src, drop_blocks=True, base_dir=None, _stack=()):
    """`drop_blocks=False` keeps block comments, for vendored code that has to
    round-trip byte-for-byte: the fillomino baseline carries `/* : Generator
    <Change> */` type annotations, and its whole point is being the author's
    own file. Everything shipped from examples/ takes the default."""
    out = []
    for line in src.splitlines():
        directive = _INCLUDE_RE.match(line)
        if directive:
            # An include that minifies to nothing appends nothing: every blank
            # line is dropped, an included file's included.
            spliced = _include(directive.group(1), drop_blocks, base_dir, _stack)
            if spliced:
                out.append(spliced)
            continue
        if drop_blocks:
            line = re.sub(r"/\*.*?\*/", "", line)  # drop block comments
            assert "/*" not in line and "*/" not in line, (
                f"unpaired block-comment marker, which this strip cannot read: {line!r}"
            )
        line = re.sub(r"(?<!:)//.*$", "", line)  # drop comments, keep URLs
        if line.strip():
            out.append(line.rstrip())
    return "\n".join(out) + "\n"


def _include(rest, drop_blocks, base_dir, stack):
    """The minified text of the file one `// #include` names, without its
    trailing newline -- the caller re-joins the lines."""
    rel = rest.strip()
    assert rel and len(rel.split()) == 1, (
        f"an #include names exactly one path, which this one does not: {rest!r}"
    )
    assert base_dir is not None, (
        f"#include {rel} needs the including file's directory: minify a path "
        "with minify_file, not a bare string with minify_js"
    )
    target = (pathlib.Path(base_dir) / rel).resolve()
    assert target.is_file(), f"#include {rel} resolves to no file: {target}"
    assert target not in stack, f"#include cycle through {target}"
    return minify_js(
        target.read_text(), drop_blocks, target.parent, (*stack, target)
    ).rstrip("\n")


if __name__ == "__main__":
    sample = (
        "/* eslint-disable no-unused-vars -- the component API */\n"
        "// ordinary comment, dropped\n"
        "  //! marked comment, dropped too\n"
        "const x = 1        // inline note, dropped\n"
        "\n"
        "  const u = 'http://a/b'\n"
    )
    got = minify_js(sample)
    assert got == "const x = 1\n  const u = 'http://a/b'\n", repr(got)
    print("minify self-check OK")
