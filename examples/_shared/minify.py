# Shrink the embedded JS before it goes into a puzzle link, so the shared URL
# stays small. The source files keep their full commentary; only the copy baked
# into the link is stripped.
#
# What survives into the export: the code and its indentation. Every comment
# and every blank line is dropped, block comments included -- a component's
# `/* eslint-disable ... */` is an apology to a linter the recipient does not
# run, and the commentary a source file carries in its "//!" blocks is 43% of
# the shipped code and 30% of the link (#385). The source files keep those
# blocks; how a reuser gets the commentary is a separate question.
#
# ponytail: regex strip, not a real parser. Safe for these files because none of
# them holds "//" inside a string or a regex literal (only single slashes, e.g.
# a URL or a template `${...}/${...}`). The `(?<!:)` guard keeps "http://".
# Block comments are paired within one line and nowhere else, so anything left
# unpaired -- a block spanning lines, a "/*" inside a string -- stops the build
# instead of being half-cut.

import re


def minify_js(src, drop_blocks=True):
    """`drop_blocks=False` keeps block comments, for vendored code that has to
    round-trip byte-for-byte: the fillomino baseline carries `/* : Generator
    <Change> */` type annotations, and its whole point is being the author's
    own file. Everything shipped from examples/ takes the default."""
    out = []
    for line in src.splitlines():
        if drop_blocks:
            line = re.sub(r"/\*.*?\*/", "", line)  # drop block comments
            assert "/*" not in line and "*/" not in line, (
                f"unpaired block-comment marker, which this strip cannot read: {line!r}"
            )
        line = re.sub(r"(?<!:)//.*$", "", line)  # drop comments, keep URLs
        if line.strip():
            out.append(line.rstrip())
    return "\n".join(out) + "\n"


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
