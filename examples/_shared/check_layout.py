# Every example under examples/ (all but _shared) must carry the same file
# set and name its puzzle links by the same grammar, so a tool can discover
# a new example with no justfile edit. See docs/example-layout.md. It also
# decodes every committed link IN AN EXAMPLE -- the shipped PUZZLE_LINK*.txt
# boards and the other link .txt files an example commits beside them
# (fillomino's frozen timing fixtures and its hunt records) -- and checks the
# three mechanical pre-share criteria from docs/share-checklist.md: the link
# opens clean (no entered values on non-given cells), the outside ring is not
# filled end to end, and the rules text carries the sudoku prefix, except an
# example in NO_RULES_PREFIX (isofill is not sudoku). A _clued link is exempt
# from the first two -- filling every clue is what that name means. It also
# checks that every link ships exactly the components its own embedded
# backend registers, so a link cannot go stale behind its builder.
#
# Links committed outside examples/ (docs/research/fillomino-baseline/'s
# PUZZLE_LINK.txt and its 19 timing fixtures) are out of scope for this sweep
# -- they are not an example directory and carry no builder to check
# components against. They still get a manual decode pass when touched; see
# examples/fillomino/README.md's fixture-reuse justification.
#
# The link-NAME grammar binds only PUZZLE_LINK*.txt: a fixture or a hunt record
# is not a shipped board and names itself for what it records. The share
# criteria bind all of them -- a link is a link, and any of these can be handed
# to a person (#310's board was picked out of exactly such a batch).
#
#   uv run --with lzstring examples/_shared/check_layout.py [root]

import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from component_scan import registered_components
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
# groups at all (spec #232, Out of Scope), and fillomino is the same shape
# (spec #303). Every other example needs both lanes (#194, #235, #268).
NO_LOCAL_GLOBAL_SPLIT = {"isofill", "fillomino"}

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
# must say so (#271); fillomino is not sudoku either (spec #303). Same
# pattern as NO_LOCAL_GLOBAL_SPLIT above.
NO_RULES_PREFIX = {"isofill", "fillomino"}

# `build_original.py` / `build_clued.py` build a hand-derived twin: the same
# board as another committed link, re-encoded with different wrapper code or
# extra clues. That board already has its own gen entry under an untagged
# name -- skyscraper's PUZZLE_LINK_6x6_original.txt reads gen_6x6.json (the
# 6x6 size's own entry, not a "6x6_original" one), and its untagged twin
# PUZZLE_LINK_original.txt reads gen.json the same way -- or, for
# numbered-rooms' PUZZLE_LINK.txt, no gen JSON at all (NO_GENERATOR_LINKS
# below). Either way, a link whose suffix carries either tag never gets its
# own separate gen*.json (#294).
NO_GENERATOR_TAGS = {"clued", "original"}

# A link with no generator at all: numbered-rooms/PUZZLE_LINK.txt is
# hand-made, its own README's "Not covered" section says so -- no gen.json
# has ever paired with it (#294).
NO_GENERATOR_LINKS = {("numbered-rooms", "PUZZLE_LINK.txt")}

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


def _link_suffix(filename, prefix, ext):
    """The part of a `gen*.json`/`PUZZLE_LINK*.txt` name between `prefix` and
    `ext`, minus one leading underscore -- "" for the plain-named file."""
    return filename[len(prefix) : -len(ext)].lstrip("_")


def check_gen_link_pairing(example_dir):
    """Return one violation string per gen*.json / PUZZLE_LINK*.txt name that
    does not pair with the other of the same suffix (docs/example-layout.md,
    "Board naming"): `gen.json` pairs with `PUZZLE_LINK.txt`, `gen_6x6.json`
    with `PUZZLE_LINK_6x6.txt`, and so on. A gen JSON always needs its link;
    a link needs a gen JSON back only where one is generated -- not a
    build_original.py/build_clued.py twin (NO_GENERATOR_TAGS) or a hand-made
    exception (NO_GENERATOR_LINKS) (#294)."""
    name = example_dir.name
    violations = []

    for gen in sorted(example_dir.glob("gen*.json")):
        suffix = _link_suffix(gen.name, "gen", ".json")
        link_name = f"PUZZLE_LINK_{suffix}.txt" if suffix else "PUZZLE_LINK.txt"
        if not (example_dir / link_name).is_file():
            violations.append(f"{name}: {gen.name} has no matching {link_name}")

    for link in sorted(example_dir.glob("PUZZLE_LINK*.txt")):
        # A malformed link name is reported by the LINK_RE check below; its
        # "suffix" is not well-formed either, so pairing does not pile on.
        if not LINK_RE.match(link.name):
            continue
        suffix = _link_suffix(link.name, "PUZZLE_LINK", ".txt")
        if set(suffix.split("_")) & NO_GENERATOR_TAGS:
            continue
        if (name, link.name) in NO_GENERATOR_LINKS:
            continue
        gen_name = f"gen_{suffix}.json" if suffix else "gen.json"
        if not (example_dir / gen_name).is_file():
            violations.append(
                f"{name}: {link.name} has no matching {gen_name} -- most "
                "likely the gen JSON is missing or misnamed and should match "
                "this link's own suffix; if this link is genuinely hand-made "
                "instead, record it in check_layout.py's NO_GENERATOR_LINKS"
            )

    return violations


# The prefix every SudokuMaker link starts with. A committed .txt beside an
# example is a link when it starts with this and nothing else is; a golden or a
# note is not decoded and not checked.
LINK_PREFIX = "https://sudokumaker.app/?puzzle="


def committed_links(example_dir):
    """Every committed link .txt directly under `example_dir`, PUZZLE_LINK*.txt
    first.

    A PUZZLE_LINK*.txt is a link by its name -- one that does not decode is a
    broken shipped board and gets reported as one. Any other .txt is a link
    only when its text starts with `LINK_PREFIX`, so a fixture or a hunt record
    is covered without a naming rule of its own and a golden or a note is left
    alone."""
    named, sniffed = [], []
    for f in sorted(example_dir.glob("*.txt")):
        if f.name.startswith("PUZZLE_LINK"):
            named.append(f)
            continue
        try:
            if f.read_text().lstrip().startswith(LINK_PREFIX):
                sniffed.append(f)
        except (OSError, UnicodeDecodeError):
            continue
    return named + sniffed


def _ring_state(puzzle):
    """`(filled, total)` for the board's outer ring -- row and column 0 and the
    last. `(0, 0)` when the cells do not fill `width` x `height`, where the ring
    would be a guess."""
    w, h = puzzle.get("width"), puzzle.get("height")
    cells = puzzle["cells"]
    if not isinstance(w, int) or not isinstance(h, int) or len(cells) != w * h:
        return 0, 0
    ring = [
        i
        for i in range(w * h)
        for row, col in [divmod(i, w)]
        if row in (0, h - 1) or col in (0, w - 1)
    ]
    return sum(1 for i in ring if cells[i]), len(ring)


def check_share_ready(example_dir, link):
    """Decode `link` (a PUZZLE_LINK*.txt path) and return one violation
    string per pre-share criterion it fails: the link opens clean, the ring is
    not filled end to end, and the rules text carries the sudoku prefix
    (docs/share-checklist.md).

    The ring criterion is criterion 3's mechanical half: a ring with every cell
    filled hands the solver every outside clue, which is the recurring share
    mistake. It is a floor, not the whole criterion -- "no unnecessary clue"
    still needs a human against the recorded carve."""
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

    ring_filled, ring_total = _ring_state(puzzle)
    if ring_total and ring_filled == ring_total and not clued:
        violations.append(
            f"{name}: {link.name} fills all {ring_total} ring cells -- curate "
            f"the clue set, or name the link _clued if every clue is meant"
        )

    if name not in NO_RULES_PREFIX and not puzzle.get("comment", "").startswith(
        RULES_PREFIX
    ):
        violations.append(f"{name}: {link.name} comment missing rules prefix")

    return violations


def check_components(example_dir, link):
    """Decode `link` and return one violation string per custom constraint
    whose shipped component set differs from the set its own embedded backend
    registers.

    A component the backend never instantiates is dead weight, and the
    recipient reads its source as part of the rule; a component the backend
    instantiates but the link omits fails inside the app, where the author
    never sees it. `framebuild.check` asserts this when it builds a link, but
    a committed link goes stale on its own: the builder's component list
    changes, the link is not regenerated, and nothing notices (#287, #289,
    #290, #291).

    A lexical check, like the one in `framebuild.check`: it reads
    `new <Name>Component` off the backend source, so a class reached through
    an alias, or named some other way, is invisible to it. Comment lines are
    dropped first, or a kept `//!` note that mentions a component would read
    as a registration.
    """
    name = example_dir.name

    try:
        puzzle = decode_puzzle(link.read_text().strip())["puzzle"]
    except Exception:
        return []  # check_share_ready reports the decode failure

    violations = []
    for constraint in puzzle.get("constraints", []):
        definition = constraint.get("definition")
        if not definition:
            continue
        shipped = {c["name"] for c in definition.get("components", [])}
        # A definition with no code backend registers nothing; its component
        # list is then empty too, so the two sets still match.
        backend = definition.get("backend", {}).get("code", "")
        registered = registered_components(backend)
        if shipped != registered:
            violations.append(
                f"{name}: {link.name} constraint {definition['name']!r} ships "
                f"{sorted(shipped)}, its backend registers {sorted(registered)}"
            )

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
    violations.extend(check_gen_link_pairing(example_dir))

    for link in committed_links(example_dir):
        if link.name.startswith("PUZZLE_LINK") and not LINK_RE.match(link.name):
            violations.append(
                f"{name}: link name {link.name} does not match "
                f"PUZZLE_LINK[_<size>][_<givens>g][_<tag>]*.txt "
                f"(size=NxN, tags in fixed order {list(TAGS)})"
            )
        violations.extend(check_share_ready(example_dir, link))
        violations.extend(check_components(example_dir, link))

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
