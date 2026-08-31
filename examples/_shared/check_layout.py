# Every example under examples/ (all but _shared) must carry the same file
# set and name its puzzle links by the same grammar, so a tool can discover
# a new example with no justfile edit. See docs/example-layout.md. It also
# decodes every shipped PUZZLE_LINK*.txt and checks the two mechanical
# pre-share criteria from docs/share-checklist.md: the link opens clean (no
# entered values on non-given cells) and the rules text carries the sudoku
# prefix, except an example in NO_RULES_PREFIX (isofill is not sudoku).
#
#   uv run --with lzstring examples/_shared/check_layout.py [root]

import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from link_codec import decode_puzzle

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

# The local lane's own files. PUZZLE_LINK.txt is the GLOBAL-lane board in
# every split example, so the local lane needs a board of its own: the link
# plus the gen JSON that records it (#268).
REQUIRED_LOCAL_FILES = ["PUZZLE_LINK_local.txt", "gen_local.json"]

# An example whose constraint has no local/global duality ships main.js
# alone, and no local board: isofill is a whole-grid constraint with no drawn
# groups at all (spec #232, Out of Scope). Every other example needs both
# lanes (#194, #235, #268).
NO_LOCAL_GLOBAL_SPLIT = {"isofill"}

# An example folded into another and deleted. One rule has one example, so
# the directory must not come back -- a second one would drift from the
# first the way numbered-rooms-lines drifted from numbered-rooms (#238).
MERGED_AWAY = {"numbered-rooms-lines": "numbered-rooms"}

# Must match framebuild.RULES_PREFIX. Duplicated (not imported) so this
# check does not pull in ortools -- framebuild.py imports it at module load,
# and check_layout.py runs with just `--with lzstring`.
RULES_PREFIX = "Normal sudoku rules apply on the inner grid. "

# An example whose rules are not sudoku rules, so its link comment must not
# carry RULES_PREFIX. isofill is not sudoku (spec #232) and its rules text
# must say so (#271). Same pattern as NO_LOCAL_GLOBAL_SPLIT above.
NO_RULES_PREFIX = {"isofill"}

# NxN: the same digit run on both sides, so 6x7 is rejected same as 6-7.
SIZE = r"\d+"
# Tags chain in this fixed order; each is optional, but present tags must
# keep this relative order (PUZZLE_LINK_original_clued.txt is rejected).
TAGS = ("clued", "original", "silent", "local")
LINK_RE = re.compile(
    rf"^PUZZLE_LINK(_({SIZE})x\2)?(_\d+g)?"
    + "".join(f"(_{t})?" for t in TAGS)
    + r"\.txt$"
)


def check_lanes(example_dir):
    """`main.js` (the local, drawn-groups paste target) must never build the
    frame itself; `main-global.js` (the whole-grid paste target) must never
    read the drawn groups. See docs/example-layout.md."""
    name = example_dir.name
    violations = []

    main_js = example_dir / "main.js"
    if main_js.is_file() and "getCellAt(" in main_js.read_text():
        violations.append(f"{name}: main.js builds frame lines (calls getCellAt)")

    main_global_js = example_dir / "main-global.js"
    if main_global_js.is_file() and "input.groups" in main_global_js.read_text():
        violations.append(f"{name}: main-global.js reads input.groups")

    return violations


def check_share_ready(example_dir, link):
    """Decode `link` (a PUZZLE_LINK*.txt path) and return one violation
    string per pre-share criterion it fails: the link opens clean, and the
    rules text carries the sudoku prefix (docs/share-checklist.md)."""
    name = example_dir.name
    violations = []

    try:
        puzzle = decode_puzzle(link.read_text().strip())["puzzle"]
    except Exception as e:
        return [f"{name}: {link.name} failed to decode: {e}"]

    # The clued twins fill all 36 outside clues on purpose -- that is what
    # the name means, and app-solve.mjs reads them with --ring-clues. The
    # entered-values check does not apply to them; the prefix check still
    # does.
    clued = f"_{TAGS[0]}" in link.name
    entered = sum(
        1 for cell in puzzle["cells"] if "value" in cell and not cell.get("given")
    )
    if entered and not clued:
        violations.append(
            f"{name}: {link.name} has {entered} entered value(s) on non-given cells"
        )

    if name not in NO_RULES_PREFIX and not puzzle.get("comment", "").startswith(
        RULES_PREFIX
    ):
        violations.append(f"{name}: {link.name} comment missing rules prefix")

    return violations


def check_example(example_dir):
    """Return one violation string per problem found in `example_dir`."""
    name = example_dir.name

    if name in MERGED_AWAY:
        return [
            f"{name}: folded into {MERGED_AWAY[name]} (#238); "
            "this directory must not exist"
        ]

    violations = [
        f"{name}: missing required file {required}"
        for required in REQUIRED_FILES
        if not (example_dir / required).is_file()
    ]

    if not list(example_dir.glob("*Component.js")):
        violations.append(f"{name}: missing required file *Component.js")

    if name not in NO_LOCAL_GLOBAL_SPLIT:
        violations.extend(
            f"{name}: missing required file {required}"
            for required in ["main-global.js", *REQUIRED_LOCAL_FILES]
            if not (example_dir / required).is_file()
        )

    violations.extend(check_lanes(example_dir))

    for link in sorted(example_dir.glob("PUZZLE_LINK*.txt")):
        if not LINK_RE.match(link.name):
            violations.append(
                f"{name}: link name {link.name} does not match "
                f"PUZZLE_LINK[_<size>][_<givens>g][_<tag>]*.txt "
                f"(size=NxN, tags in fixed order {list(TAGS)})"
            )
        violations.extend(check_share_ready(example_dir, link))

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
