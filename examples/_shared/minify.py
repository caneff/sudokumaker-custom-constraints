# Shrink the embedded JS before it goes into a puzzle link, so the shared URL
# stays small. The source files keep their full commentary; only the copy baked
# into the link is stripped.
#
# What survives into the export: the code, its indentation, and the few comments
# a maintainer marked "//!" as essential to reading the algorithm. Every other
# comment and every blank line is dropped. Keep "//!" comments self-contained --
# they ship to people who never see this repo, so they must not point at local
# files, docs, or ADRs.
#
# ponytail: regex strip, not a real parser. Safe for these files because none of
# them holds "//" inside a string or a regex literal (only single slashes, e.g.
# a URL or a template `${...}/${...}`). The `(?<!:)` guard keeps "http://".

import re


def minify_js(src):
    out = []
    for line in src.splitlines():
        stripped = line.lstrip()
        if stripped.startswith("//!"):                 # keep, as a plain comment
            indent = line[: len(line) - len(stripped)]
            out.append(indent + "// " + stripped[3:].strip())
            continue
        line = re.sub(r"(?<!:)//.*$", "", line)        # drop comments, keep URLs
        if line.strip():
            out.append(line.rstrip())
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    sample = (
        "// ordinary comment, dropped\n"
        "  //! kept note\n"
        "const x = 1        // inline note, dropped\n"
        "\n"
        "  const u = 'http://a/b'\n")
    got = minify_js(sample)
    assert got == "  // kept note\nconst x = 1\n  const u = 'http://a/b'\n", repr(got)
    print("minify self-check OK")
