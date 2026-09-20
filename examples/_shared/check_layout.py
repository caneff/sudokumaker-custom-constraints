# Every example under examples/ (all but _shared) must carry the same file
# set and name its puzzle links by the same grammar, so a tool can discover
# a new example with no justfile edit. See docs/example-layout.md. It also
# decodes every committed link IN AN EXAMPLE -- the shipped PUZZLE_LINK*.txt
# boards and the other link .txt files an example commits beside them
# (fillomino's frozen timing fixtures and its hunt records) -- and checks the
# three mechanical pre-share criteria from docs/share-checklist.md: the link
# opens clean (no entered values on non-given cells), the outside ring is not
# filled end to end, and the rules text carries the sudoku prefix, except an
# example in NO_RULES_PREFIX (isofill and fillomino are not sudoku). A _clued
# link is exempt from the first two -- filling every clue is what that name
# means. It also checks that every link ships exactly the components its own
# embedded backend registers, so a link cannot go stale behind its builder, and
# that every interior row and column of a sudoku example's board is a house the
# link actually declares (a region constraint gives boxes only -- see #335 and
# docs/gotchas.md #9; isofill and fillomino are bare boards and exempt).
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

import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from component_scan import describe_mismatch, mismatch
from framebuild import (
    FRAME_BACKENDS,
    GRID_BACKEND,
    HOUSE_GAC_BACKEND_TITLE,
    HOUSE_GAC_COMPONENT_NAME,
    NO_RING_RULES_PREFIX,
    RULES_PREFIX,
    frame_backend_code,
    grid_backend_constraint,
    house_gac_backend_code,
)
from link_codec import decode_puzzle
from minify import minify_file

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
# (spec #303). house-gac is a different shape again but lands in the same
# place: it filters fixed board geometry (every row, column and box), not a
# line an author draws, so there is no per-line group to split a local lane
# out of either (#428). up-to-n has drawn groups but no global lane: its clues
# are typed into them, and a board with no groups has no clue to read (spec
# #366). Every other example needs both lanes (#194, #235, #268).
NO_LOCAL_GLOBAL_SPLIT = {"isofill", "fillomino", "house-gac", "up-to-n"}

# An example whose one required component lives in `_shared/` on purpose,
# shared across every board that carries the same filter, rather than a copy
# owned by this example: house-gac's `HouseGacComponent.js` is also the
# backend #421's frame boards will register (#408, #422). A copy pasted into
# the example dir would only drift from that shared original, so the
# `*Component.js` check below follows the name into `_shared/` instead of
# requiring a local file.
SHARED_COMPONENT = {"house-gac": "HouseGacComponent"}

# An example folded into another and deleted. One rule has one example, so
# the directory must not come back -- a second one would drift from the
# first the way numbered-rooms-lines drifted from numbered-rooms (#238).
MERGED_AWAY = {"numbered-rooms-lines": "numbered-rooms"}


def is_no_ring(puzzle):
    """Does this link carry the whole-grid rows-and-columns backend
    (framebuild.no_ring_doc), whatever code is embedded there? Carrying it is
    what marks a board as no-ring: its rows and columns are declared in JS, and
    its edge cells are real cells, not a clue ring."""
    return any(
        (c.get("definition") or {}).get("name") == GRID_BACKEND[1]
        for c in puzzle.get("constraints", [])
    )


# An example whose rules are not sudoku rules, so its link comment must not
# carry RULES_PREFIX. isofill is not sudoku (spec #232) and its rules text
# must say so (#271); fillomino is not sudoku either (spec #303). Same
# pattern as NO_LOCAL_GLOBAL_SPLIT above.
NO_RULES_PREFIX = {"isofill", "fillomino"}

# An example whose board has no houses at all: isofill and fillomino are
# whole-grid constraints on a bare board, with no row, column or box rule to
# check (specs #232, #303). Every other example is a sudoku, so every one of
# its interior rows and columns must be a house the link actually declares.
NO_HOUSES = {"isofill", "fillomino"}

# An example whose digit range is deliberately wider than its interior lines.
# A house is "every digit exactly once", which needs the line to be as long as
# the range; hit-counts runs minDigit 0 so a clue can read 0 and keeps 0 out of
# the interior with a look-and-say cage, so ten digits sit over nine-cell lines
# and `frame-rowcol.js` drops them to all-different on purpose. Every other
# frame board's range must span its interior line exactly.
DIGITS_EXCEED_LINES = {"hit-counts"}

# `build_original.py` / `build_clued.py` build a hand-derived twin: the same
# board as another committed link, re-encoded with different wrapper code or
# extra clues. That board already has its own gen entry under an untagged
# name -- skyscraper's PUZZLE_LINK_6x6_original.txt reads gen_6x6.json (the
# 6x6 size's own entry, not a "6x6_original" one), and its untagged twin
# PUZZLE_LINK_original.txt reads gen.json the same way -- or, for
# numbered-rooms' PUZZLE_LINK.txt, no gen JSON at all (NO_GENERATOR_LINKS
# below). Either way, a link whose suffix carries either tag never gets its
# own separate gen*.json (#294). "annotated" is the same shape: house-gac's
# PUZZLE_LINK_annotated.txt is the same board as PUZZLE_LINK.txt with only its
# embedded code's minification changed, not a fresh generation (#433).
NO_GENERATOR_TAGS = {"clued", "original", "annotated"}

# A link with no generator at all: numbered-rooms/PUZZLE_LINK.txt is
# hand-made, its own README's "Not covered" section says so -- no gen.json
# has ever paired with it (#294).
NO_GENERATOR_LINKS = {
    ("numbered-rooms", "PUZZLE_LINK.txt"),
    # house-gac's board and givens come from another committed link
    # (docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt), re-proved
    # unique with CP-SAT, not from a gen*.json this example owns (#428).
    ("house-gac", "PUZZLE_LINK.txt"),
}

# NxN: the same digit run on both sides, so 6x7 is rejected same as 6-7.
SIZE = r"\d+"
# Tags chain in this fixed order; each is optional, but present tags must
# keep this relative order (PUZZLE_LINK_original_clued.txt is rejected).
TAGS = ("clued", "original", "silent", "local", "annotated")
LINK_RE = re.compile(
    rf"^PUZZLE_LINK(_({SIZE})x\2)?(_\d+g)?"
    + "".join(f"(_{t})?" for t in TAGS)
    + r"\.txt$"
)


def check_lanes(example_dir):
    """`main.js` (the local, drawn-groups paste target) must never build the
    frame itself; `main-global.js` (the whole-grid paste target) must never
    read the drawn groups. See docs/example-layout.md.

    Both scans read the SHIPPED text -- `minify_file`, so `// #include`s are
    spliced in and comments are gone. That is the lane: a paste target's real
    body can live in an included file, and a mention inside a comment is not
    part of it."""
    name = example_dir.name
    violations = []

    def shipped(path):
        """path's shipped text, or None with a violation recorded. minify_file
        signals a malformed file (unpaired block marker, broken #include) by
        assertion; letting that out would end the whole sweep on one example
        and leave the rest unchecked, so it becomes a violation like any
        other."""
        try:
            return minify_file(path)
        except AssertionError as exc:
            violations.append(f"{name}: {path.name} does not minify: {exc}")
            return None

    main_js = example_dir / "main.js"
    if main_js.is_file() and "getCellAt(" in (shipped(main_js) or ""):
        violations.append(f"{name}: main.js builds frame lines (calls getCellAt)")

    main_global_js = example_dir / "main-global.js"
    if main_global_js.is_file() and "input.groups" in (shipped(main_global_js) or ""):
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


# Exactly the docs/research/*.py paths present at the commit that landed this
# rule (#474): docs/research reads as not-code to the global gate, so finder
# code kept landing there instead of finders/ and ruff never saw it. This
# list only SHRINKS as paths move to finders/ -- a new directory must not be
# added to it; new finder code goes in finders/ from the start.
GRANDFATHERED_RESEARCH_PY = frozenset(
    {
        "docs/research/367-no-ring-board-type/build_docs.py",
        "docs/research/368-up-to-n-setup-throw/probe_clues.py",
        "docs/research/406-gac-demo/tools/build9.py",
        "docs/research/406-gac-demo/tools/build_hard.py",
        "docs/research/406-gac-demo/tools/build_plain.py",
        "docs/research/406-gac-demo/tools/build_variant.py",
        "docs/research/406-gac-demo/tools/gap2.py",
        "docs/research/406-gac-demo/tools/hard.py",
        "docs/research/406-gac-demo/tools/subset_gac_equivalence.py",
        "docs/research/408-house-gac/build-house-gac-links.py",
        "docs/research/408-house-gac/house_gac_links.py",
        "docs/research/408-house-gac/link-delta-house-gac.py",
        "docs/research/fillomino-baseline/build_link.py",
    }
)


def check_research_python(repo_root):
    """Return one violation string per `.py` file under `repo_root`'s
    docs/research/ that is not in GRANDFATHERED_RESEARCH_PY.

    docs/research/ reads as not-code to the global gate (it is not code per
    AGENTS.md's Gate 2), so finder code landing there skips the code lane and
    ruff never sees it. Finder code belongs in finders/ instead (#469, #474).
    """
    repo_root = pathlib.Path(repo_root)
    research_dir = repo_root / "docs" / "research"
    if not research_dir.is_dir():
        return []

    violations = []
    for path in sorted(research_dir.rglob("*.py")):
        rel = path.relative_to(repo_root).as_posix()
        if rel in GRANDFATHERED_RESEARCH_PY:
            continue
        violations.append(
            f"{rel}: new .py file under docs/research/ -- finder code goes in finders/"
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


def check_share_ready(example_dir, link, puzzle):
    """Return one violation string per pre-share criterion `link` (a
    committed link, decoded as `puzzle`) fails: the link opens clean, the ring is
    not filled end to end, and the rules text carries the sudoku prefix
    (docs/share-checklist.md).

    The ring criterion is criterion 3's mechanical half: a ring with every cell
    filled hands the solver every outside clue, which is the recurring share
    mistake. It is a floor, not the whole criterion -- "no unnecessary clue"
    still needs a human against the recorded carve."""
    name = example_dir.name
    violations = []

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

    no_ring = is_no_ring(puzzle)
    ring_filled, ring_total = (0, 0) if no_ring else _ring_state(puzzle)
    if ring_total and ring_filled == ring_total and not clued:
        violations.append(
            f"{name}: {link.name} fills all {ring_total} ring cells -- curate "
            f"the clue set, or name the link _clued if every clue is meant"
        )

    prefix = NO_RING_RULES_PREFIX if no_ring else RULES_PREFIX
    if name not in NO_RULES_PREFIX and not puzzle.get("comment", "").startswith(prefix):
        violations.append(f"{name}: {link.name} comment missing rules prefix")

    return violations


def check_components(example_dir, link, puzzle):
    """Return one violation string per custom constraint in `puzzle`
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
    an alias, or named some other way, is invisible to it. SudokuMaker's own
    built-ins are subtracted first (`component_scan.builtin_components`): the
    app provides those classes, so a backend that constructs one ships no
    component file for it and the link is not stale (#394). Comment lines are
    dropped first: a link built today ships none (#385, minify.py), but this
    sweep also reads backends off links no builder rebuilds -- fillomino's
    frozen timing fixtures and hunt records -- whose committed backends still
    carry them, and a note that names a component must not read as a
    registration.
    """
    name = example_dir.name
    violations = []
    for constraint in puzzle.get("constraints", []):
        definition = constraint.get("definition")
        if not definition:
            continue
        shipped = [c["name"] for c in definition.get("components", [])]
        # A definition with no code backend registers nothing; its component
        # list is then empty too, so the two sets still match.
        backend = definition.get("backend", {}).get("code", "")
        violations.extend(
            f"{name}: {link.name} constraint {definition['name']!r}: {problem}"
            for problem in describe_mismatch(*mismatch(shipped, backend))
        )

    return violations


def declared_houses(puzzle):
    """Every set of cells the document says must hold distinct digits: each
    group of a region constraint, plus the cells of every cage."""
    houses = set()
    for constraint in puzzle.get("constraints", []):
        groups = {}
        for i, region in enumerate(constraint.get("regions", [])):
            if isinstance(region, int) and region >= 0:
                groups.setdefault(region, []).append(i)
        houses.update(frozenset(cells) for cells in groups.values())
        for cage in constraint.get("cages", []):
            houses.add(frozenset(cage["cells"]))
    return houses


# The constraint name `framebuild.build_doc` ships the row/column backend
# under, read off the one place that pairing lives so a rename reaches this
# sweep too. It is the handle that says "this board meant to declare its lines
# in JS" even when the code embedded under it is an old copy.
FRAME_ROWCOL_CONSTRAINT = dict(FRAME_BACKENDS)["frame-rowcol"]


def frame_backend_files():
    """`{constraint name: (source file name, its minified code in the tree)}`
    for the frame's two always-on shared backends, plus the opt-in house-GAC
    filter (#421) and a no-ring board's whole-grid rows and columns when a link
    carries them -- `check_frame_backends` only checks a title it finds in a
    link's own constraints, so an opt-in backend needs no separate gate here."""
    code = dict(frame_backend_code())
    files = {title: (f"{stem}.js", code[title]) for stem, title in FRAME_BACKENDS}
    gac_title, gac_backend_code, _ = house_gac_backend_code()
    files[gac_title] = ("house-gac.js", gac_backend_code)
    grid = grid_backend_constraint()["definition"]
    files[grid["name"]] = (f"{GRID_BACKEND[0]}.js", grid["backend"]["code"])
    return files


def house_gac_component_file():
    """(component name, source file name, its minified code in the tree) for
    the house-GAC filter's one component -- `check_frame_backends` compares
    it against a link's own copy the same way it compares the backend, since
    HouseGacComponent.js is not a per-example file `check_components` would
    ever look for."""
    _, _, code = house_gac_backend_code()
    return (HOUSE_GAC_COMPONENT_NAME, f"{HOUSE_GAC_COMPONENT_NAME}.js", code)


def carries_frame_rowcol(puzzle):
    """Does this link ship the frame row/column backend under its own name,
    whatever code is embedded there?"""
    return any(
        (c.get("definition") or {}).get("name") == FRAME_ROWCOL_CONSTRAINT
        for c in puzzle.get("constraints", [])
    )


# An example whose board carries a non-frame rows/columns backend that
# builds its houses in JS at postprocessJSON time -- invisible to
# declared_houses' static read of the document, the same blind spot the
# frame's own row/col backend has -- mapped to the constraint name it ships
# that backend under. house-gac's board is docs/research/406-gac-demo's own
# "Rows & Columns" backend, carried unmodified (#428); house-gac does not own
# or rebuild it, so there is nothing here for check_frame_backends to compare
# against. Scoped per example, not by name alone: a name match on some other
# example's own unrelated constraint must not silently exempt it too.
RESEARCH_ROWCOL_BACKENDS = {"house-gac": "Rows & Columns"}


def declares_rows_and_columns_in_js(example_name, puzzle):
    """Does this link carry a constraint that builds its own row and column
    houses in JS, invisible to declared_houses' static read of the document?
    The frame's shared row/col backend, a no-ring board's whole-grid one, or
    the one research backend RESEARCH_ROWCOL_BACKENDS names for this example."""
    if carries_frame_rowcol(puzzle) or is_no_ring(puzzle):
        return True
    name = RESEARCH_ROWCOL_BACKENDS.get(example_name)
    return name is not None and any(
        (c.get("definition") or {}).get("name") == name
        for c in puzzle.get("constraints", [])
    )


def interior_cells(puzzle, width, height):
    """The ids of the cells a region constraint places in a region.

    That is the interior of a frame board: its ring is outside every region and
    has no house of its own. A board with no region constraint is all interior.
    """
    regions = next(
        (c["regions"] for c in puzzle.get("constraints", []) if "regions" in c), None
    )
    if regions is None:
        return set(range(width * height))
    return {i for i, r in enumerate(regions) if isinstance(r, int) and r >= 0}


def interior_line_lengths(puzzle, width, height):
    """How many interior cells each row and each column holds, empty lines
    dropped -- a frame board's ring rows and columns hold none."""
    inside = interior_cells(puzzle, width, height)
    rows = ([i for i in inside if i // width == r] for r in range(height))
    columns = ([i for i in inside if i % width == c] for c in range(width))
    return {len(line) for line in (*rows, *columns) if line}


def check_houses(example_dir, link, puzzle):
    """Return one violation string per interior row or column of `puzzle`
    that is neither a house the document declares nor one the shared frame
    backend declares in JS.

    A region constraint gives you BOXES ONLY -- rows and columns are not
    implied, and nothing in the app says so: it solves, times and counts
    solutions on a board that is not the one you meant. `framebuild.py` ships
    them as two type-301 cage constraints; a builder that writes its own
    constraint list has to do the same. This cost three tickets of quad-rank
    work, where a 9x9 that CP-SAT proves unique in 0.01s timed out at 300s and
    a 6x6 whose true count is 2 came back as 5 (#335, docs/gotchas.md #9).

    Interior is `interior_cells` above.
    """
    name = example_dir.name
    if name in NO_HOUSES:
        return []

    width, height = puzzle.get("width"), puzzle.get("height")
    if not isinstance(width, int) or not isinstance(height, int):
        return []

    inside = interior_cells(puzzle, width, height)

    # A board carrying a row/column backend declares its lines in JS, so
    # counting missing rows here would send the reader after a constraint that
    # is already present. Whether the copy embedded there is the current one is
    # `check_frame_backends`' question, with its own message and its own fix
    # (house-gac's borrowed "Rows & Columns" backend has no such check -- see
    # declares_rows_and_columns_in_js).
    if declares_rows_and_columns_in_js(name, puzzle):
        return []

    houses = declared_houses(puzzle)
    violations = []
    for label, lines in (
        ("row", [[i for i in inside if i // width == r] for r in range(height)]),
        ("column", [[i for i in inside if i % width == c] for c in range(width)]),
    ):
        missing = sum(1 for line in lines if line and frozenset(line) not in houses)
        if missing:
            violations.append(
                f"{name}: {link.name} declares no house for {missing} interior "
                f"{label}(s) -- a region constraint gives boxes only, so rows and "
                f"columns need their own constraints (docs/gotchas.md #9)"
            )
    return violations


def check_frame_backends(example_dir, link, puzzle):
    """Return one violation per shared frame backend `link` (decoded as
    `puzzle`) ships under its own
    name with code that is not the copy in the tree, plus one if it ships
    either backend and declares no digit range.

    BOTH backends need checking here and only here. `check_components` cannot
    see `frame-corners.js` at all: it registers a `PredefinedCandidatesComponent`,
    which is a built-in, so that constraint ships no component file and the
    shipped/registered sets agree whatever its code says. A changed
    `frame-corners.js` with un-rebuilt links would otherwise pass every gate in
    silence -- and the corner pin is the whole reason a frame board comes back
    unique (#394).

    The digit range is the other silent one. Both backends read
    `helpers.digits`, and the app defaults a custom puzzle to 1..9 whatever the
    grid size (#461). With no `minDigit`/`maxDigit` the range rests on that
    default, not on the document. A range that does not span the interior line
    degrades every row and column from a named `HouseComponent` to a bare
    `DifferentDigitsComponent` -- the weaker rule, with no houseType for the
    solver's row/column machinery -- and pins the corners to a digit the puzzle
    never uses, so the range is checked against the line and not merely for
    being there. None of it shows on the board or in the source text.

    The component staleness check is keyed on the shipped component's own
    name, not the constraint's title: house-gac's standalone board splices in
    HouseGacComponent.js under a title of its own ("House GAC (standalone)",
    to avoid the reserved "House GAC" -- see build_link.py's module
    docstring) with a backend that is legitimately not house-gac.js, so only
    the component -- the one thing that board does share -- is compared
    against the tree (#439).

    `minify_js` drops comments, so editing a backend file's prose leaves every
    committed link valid; only a real code change makes them stale, and a stale
    link genuinely runs different code from the one under review.
    """
    name = example_dir.name
    current = frame_backend_files()
    comp_name, comp_source, comp_want = house_gac_component_file()
    # The annotated link (#433) embeds the same component file through the
    # comment-keeping minify mode, not the usual full strip -- compare it
    # against that copy instead, or every rebuild would read as stale.
    # Scoped to house-gac, the only example that builds one today: a bare
    # "annotated" tag on some other example's link is not this carve-out's
    # business, and comparing it against a keep-comments copy it never
    # embedded would be its own false stale reading.
    if name == "house-gac" and "annotated" in link.stem.split("_"):
        comp_want = minify_file(
            pathlib.Path(__file__).parent / f"{comp_name}.js", keep_comments=True
        )
    violations = []
    carried = []
    for constraint in puzzle.get("constraints", []):
        definition = constraint.get("definition") or {}
        title = definition.get("name")
        if title in current:
            carried.append(title)
            source, want = current[title]
            if definition.get("backend", {}).get("code") != want:
                violations.append(
                    f"{name}: {link.name} embeds a stale copy of {source} -- "
                    f"rebuild it in the same commit as the change (the example's "
                    f"`build_size.py --rebuild <n>`, or `build_link.py --refresh` "
                    f"for a hand-built board)"
                )
        # Keyed on the COMPONENT's own name, not the constraint's title: a
        # board that splices HouseGacComponent.js under a title of its own
        # (house-gac's standalone board renames away from the reserved
        # "House GAC" -- see build_link.py's module docstring) still ships
        # this exact shared file, and a title-keyed lookup here is exactly
        # the miss #439 was filed about -- a second title literal to keep in
        # sync with build_link.py's own rename would only reopen it the next
        # time either name changes. A MISSING component is not this check's
        # job: `check_components` already flags any constraint whose backend
        # registers a name its own `components` list omits (shipped-minus-
        # registered mismatch, checked for every constraint), so guarding it
        # again here would just double-report the same link.
        comp = next(
            (c for c in definition.get("components", []) if c["name"] == comp_name),
            None,
        )
        if comp is not None and comp.get("code") != comp_want:
            violations.append(
                f"{name}: {link.name} embeds a stale copy of {comp_source} -- "
                f"rebuild it in the same commit as the change (the example's "
                f"`build_size.py --rebuild <n>`, or `build_link.py --refresh` "
                f"for a hand-built board)"
            )

    if not carried:
        return violations

    lo, hi = puzzle.get("minDigit"), puzzle.get("maxDigit")
    if not all(isinstance(v, int) and not isinstance(v, bool) for v in (lo, hi)):
        violations.append(
            f"{name}: {link.name} ships {sorted(carried)} but declares no "
            f"digit range -- the app defaults a custom puzzle to 1..9 whatever "
            f"the grid size, so the range rests on that default, not on the "
            f"document. Pin minDigit/maxDigit on the document (#394)"
        )
        return violations

    width, height = puzzle.get("width"), puzzle.get("height")
    if name in DIGITS_EXCEED_LINES or not (
        isinstance(width, int) and isinstance(height, int)
    ):
        return violations

    lengths = interior_line_lengths(puzzle, width, height)
    span = hi - lo + 1
    if lengths and lengths != {span}:
        cells = "/".join(str(n) for n in sorted(lengths))
        violations.append(
            f"{name}: {link.name} ships {sorted(carried)} and declares "
            f"{span} digits (minDigit {lo}, maxDigit {hi}) against {cells} "
            f"cell interior lines -- a line as long as the range is a house, "
            f"any other length falls back to plain all-different, and the "
            f"corner pin lands on minDigit whether or not the board uses it. "
            f"Match the range to the interior (#394)"
        )
    return violations


def check_gen_frame_backends(example_dir):
    """Return one violation per `gen*.json` that records a frame backend's code.

    A gen JSON is the board's record, and the shared frame backends are not
    part of a board: their code is read from the tree at build time
    (`framebuild.refresh_frame_backends`), so a copy kept here is dead data no
    build reads and nothing rebuilds -- it can only drift from the file it
    copies, and a reader comparing the two has no way to tell which one runs.
    Keep the field empty.
    """
    name = example_dir.name
    titles = {title for _, title in FRAME_BACKENDS} | {HOUSE_GAC_BACKEND_TITLE}
    violations = []
    for gen in sorted(example_dir.glob("gen*.json")):
        try:
            doc = json.loads(gen.read_text())
            constraints = doc["puzzle"]["constraints"]
        except Exception:
            continue  # a board-data gen JSON carries no document at all
        for constraint in constraints:
            definition = constraint.get("definition") or {}
            if definition.get("name") in titles and definition.get("backend", {}).get(
                "code"
            ):
                violations.append(
                    f"{name}: {gen.name} records code for "
                    f"{definition['name']!r} -- the frame backends come from "
                    f"the tree at build time, so a copy here is dead data that "
                    f"goes stale. Empty the field"
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

    if name in SHARED_COMPONENT:
        shared_file = example_dir.parent / "_shared" / f"{SHARED_COMPONENT[name]}.js"
        if not shared_file.is_file():
            violations.append(
                f"{name}: declared shared component {SHARED_COMPONENT[name]!r} "
                f"has no file at {shared_file}"
            )
    elif not list(example_dir.glob("*Component.js")):
        violations.append(f"{name}: missing required file *Component.js")

    if name not in NO_LOCAL_GLOBAL_SPLIT:
        violations.extend(
            f"{name}: missing required file {required}"
            for required in ["main-global.js", *REQUIRED_LOCAL_FILES]
            if not (example_dir / required).is_file()
        )

    violations.extend(check_lanes(example_dir))
    violations.extend(check_gen_link_pairing(example_dir))
    violations.extend(check_gen_frame_backends(example_dir))

    for link in committed_links(example_dir):
        if link.name.startswith("PUZZLE_LINK") and not LINK_RE.match(link.name):
            violations.append(
                f"{name}: link name {link.name} does not match "
                f"PUZZLE_LINK[_<size>][_<givens>g][_<tag>]*.txt "
                f"(size=NxN, tags in fixed order {list(TAGS)})"
            )
        # Decoded once, here: every check below reads the same puzzle.
        try:
            puzzle = decode_puzzle(link.read_text().strip())["puzzle"]
        except Exception as e:
            violations.append(f"{name}: {link.name} failed to decode: {e}")
            continue
        violations.extend(check_share_ready(example_dir, link, puzzle))
        violations.extend(check_components(example_dir, link, puzzle))
        violations.extend(check_frame_backends(example_dir, link, puzzle))
        violations.extend(check_houses(example_dir, link, puzzle))

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
    # docs/research/ sits beside examples/ at the repo root, not inside the
    # argv root, so it is found relative to this file rather than `root` --
    # but only for the real, no-args invocation `just check` makes. A test
    # that passes an explicit root is pointed at a temp tree on purpose, and
    # must stay hermetic: scanning this file's real repo location in that
    # case would fail check_layout.test.py's subprocess cases on whatever
    # scratch .py another session happens to have under docs/research/ right
    # now, unrelated to the temp tree under test.
    if len(argv) <= 1:
        repo_root = pathlib.Path(__file__).resolve().parents[2]
        violations.extend(check_research_python(repo_root))
    for v in violations:
        print(v)
    print(f"{'FAILED' if violations else 'ok'} — {len(violations)} violation(s)")
    return 1 if violations else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
