# Shrink the embedded JS before it goes into a puzzle link, so the shared URL
# stays small. The source files keep their full commentary; only the copy baked
# into the link is stripped.
#
# What survives into the export: the code, its indentation, and the few comments
# a maintainer marked "//!" as essential to reading the algorithm. Every other
# comment and every blank line is dropped, block comments included -- a
# component's `/* eslint-disable ... */` is an apology to a linter the
# recipient does not run. Keep "//!" comments self-contained -- they ship to
# people who never see this repo, so they must not point at local files, docs,
# or ADRs.
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
        stripped = line.lstrip()
        if stripped.startswith("//!"):  # keep, as a plain comment
            # Only the marker goes: the spacing after it is load-bearing, since
            # these blocks lay rules out in columns and the shipped copy is the
            # one a reader sees.
            indent = line[: len(line) - len(stripped)]
            out.append((indent + "//" + stripped[3:]).rstrip())
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


if __name__ == "__main__":
    sample = (
        "/* eslint-disable no-unused-vars -- the component API */\n"
        "// ordinary comment, dropped\n"
        "  //! kept note\n"
        "const x = 1        // inline note, dropped\n"
        "\n"
        "  const u = 'http://a/b'\n"
    )
    got = minify_js(sample)
    assert got == "  // kept note\nconst x = 1\n  const u = 'http://a/b'\n", repr(got)
    print("minify self-check OK")
