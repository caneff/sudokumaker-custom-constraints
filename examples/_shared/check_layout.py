# Every example under examples/ (all but _shared) must carry the same file
# set and name its puzzle links by the same grammar, so a tool can discover
# a new example with no justfile edit. See docs/example-layout.md.
#
#   uv run examples/_shared/check_layout.py [root]

import pathlib
import re
import sys

REQUIRED_FILES = [
    "README.md",
    "main.js",
    "build_link.py",
    "build_link.test.py",
    "soundness-harness.mjs",
    "update-strength.test.mjs",
    "OPTIMIZATION_LOG.md",
    "PUZZLE_LINK.txt",
]

# NxN: the same digit run on both sides, so 6x7 is rejected same as 6-7.
SIZE = r"\d+"
TAGS = ("clued", "original", "silent")
LINK_RE = re.compile(rf"^PUZZLE_LINK(_({SIZE})x\2)?(_({'|'.join(TAGS)}))?\.txt$")


def check_example(example_dir):
    """Return one violation string per problem found in `example_dir`."""
    name = example_dir.name

    violations = [
        f"{name}: missing required file {required}"
        for required in REQUIRED_FILES
        if not (example_dir / required).is_file()
    ]

    if not list(example_dir.glob("*Component.js")):
        violations.append(f"{name}: missing required file *Component.js")

    violations.extend(
        f"{name}: link name {link.name} does not match "
        f"PUZZLE_LINK[_<size>][_<tag>].txt "
        f"(size=NxN, tag in {list(TAGS)})"
        for link in sorted(example_dir.glob("PUZZLE_LINK*.txt"))
        if not LINK_RE.match(link.name)
    )

    return violations


def check_tree(root):
    """Return one violation string per problem in every example under `root`.

    Every directory directly under `root` is an example, except `_shared`.
    """
    root = pathlib.Path(root)
    if not root.is_dir():
        return [f"{root}: not a directory"]

    violations = []
    for example_dir in sorted(root.iterdir()):
        if not example_dir.is_dir() or example_dir.name == "_shared":
            continue
        violations.extend(check_example(example_dir))
    return violations


def main(argv):
    root = argv[1] if len(argv) > 1 else "examples"
    violations = check_tree(root)
    for v in violations:
        print(v)
    print(f"{'FAILED' if violations else 'ok'} — {len(violations)} violation(s)")
    return 1 if violations else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
