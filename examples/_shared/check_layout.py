# Every example under examples/ (all but _shared) must carry the same file
# set and name its puzzle links by the same grammar, so a tool can discover
# a new example with no justfile edit. See docs/example-layout.md. It also
# decodes every committed link under an example, a board's own subdirectory
# included -- the shipped PUZZLE_LINK*.txt
# boards and the other link .txt files an example commits beside them
# (fillomino's frozen timing fixtures and its hunt records) -- and checks the
# three mechanical pre-share criteria from docs/share-checklist.md: the link
# opens clean (no entered values on non-given cells), the outside ring is not
# filled end to end, and the rules text carries the sudoku prefix, except an
# example whose manifest sets rules_prefix = "none" (not sudoku). A _clued
# link is exempt from the first two -- filling every clue is what that name
# means. It also checks that every link ships exactly the components its own
# embedded code registers (the backend, or a shipped component that constructs
# another through `customComponents`), so a link cannot go stale behind its
# builder, and that every interior row and column of a sudoku example's board is
# a house the link actually declares (a region constraint gives boxes only --
# see docs/gotchas.md #9; a manifest with houses = false is a bare
# board, and a "sudoku" document gets its lines from the app, so both are
# exempt).
#
# What is special about an example is that example's own: each carries an
# example.toml (manifest.py), and this sweep names no example.
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
# to a person (a board has been picked out of exactly such a batch).
#
#   uv run examples/_shared/check_layout.py [root]

import dataclasses
import enum
import json
import pathlib
import re
import sys
import tomllib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from component_scan import describe_mismatch, mismatch
from document import (
    FRAME_CORNERS,
    FRAME_ROWCOL,
    GRID_ROWCOL,
    HOUSE_GAC,
    NO_RING_RULES_PREFIX,
    RULES_PREFIX,
    SHARED_BACKEND_TITLES,
    SHARED_BACKENDS,
    backend_code,
    component_code,
)
from manifest import load_manifest
from minify import minify_file
from sudoku_kit.link_codec import decode_puzzle

# What a boardless example (manifest `boardless = true`) still needs: it ships
# components and a harness, and no board.
BOARDLESS_REQUIRED_FILES = ["README.md", "soundness-harness.mjs"]

# What a houses-only example (manifest `houses_only = true`) needs: its backend
# registers only built-in `HouseComponent`s, so there is no component to fuzz,
# and one CP-SAT test proving every registered house is forced replaces the
# harness, the strength fuzz and the optimization log.
HOUSES_ONLY_REQUIRED_FILES = [
    "README.md",
    "main.js",
    "build_link.py",
    "build_link.test.py",
    "forced_houses.test.py",
    "PUZZLE_LINK.txt",
]

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
# plus the gen JSON that records it. An example whose manifest says
# `lanes = "single"` ships main.js alone and neither; one that says
# `lanes = "global"` ships main-global.js in main.js's place, and neither.
REQUIRED_LOCAL_FILES = ["PUZZLE_LINK_local.txt", "gen_local.json"]

# Examples folded into another and deleted, name -> the example that took over.
# One rule has one example, so the directory must not come back -- a second one
# would drift from the first the way numbered-rooms-lines drifted from
# numbered-rooms. Data, not code: a retired name is not an example.
RETIRED_EXAMPLES = tomllib.loads(
    (pathlib.Path(__file__).parent / "retired-examples.toml").read_text()
)


def is_no_ring(puzzle):
    """Does this link carry the whole-grid rows-and-columns backend
    (no_ring.NoRing), whatever code is embedded there? Carrying it is
    what marks a board as no-ring: its rows and columns are declared in JS, and
    its edge cells are real cells, not a clue ring."""
    return any(
        (c.get("definition") or {}).get("name") == GRID_ROWCOL.title
        for c in puzzle.get("constraints", [])
    )


# `build_original.py` / `build_clued.py` build a hand-derived twin: the same
# board as another committed link, re-encoded with different wrapper code or
# extra clues. That board already has its own gen entry under an untagged
# name -- skyscraper's PUZZLE_LINK_6x6_original.txt reads gen_6x6.json (the
# 6x6 size's own entry, not a "6x6_original" one), and its untagged twin
# PUZZLE_LINK_original.txt reads gen.json the same way -- or, for
# a hand-made link, no gen JSON at all (the manifest's generator_less_links).
# Either way, a link whose suffix carries either tag never gets its
# own separate gen*.json. "annotated" is the same shape: a link of the
# same board as PUZZLE_LINK.txt with only its embedded code's minification
# changed, not a fresh generation.
NO_GENERATOR_TAGS = {"clued", "original", "annotated"}

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


def link_tags(filename):
    """The tags `filename` carries, read once from `LINK_RE`'s groups. Empty
    for a name the grammar rejects: a link found by its `LINK_PREFIX` text, or a
    malformed `PUZZLE_LINK*` name, claims no tag and so earns no exemption."""
    match = LINK_RE.match(filename)
    if not match:
        return frozenset()
    return frozenset(
        t for t, g in zip(TAGS, match.groups()[-len(TAGS) :], strict=True) if g
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


# What a stale-backend violation tells the author to run; every example's
# build_link.py takes the flag (size_builders.test.py).
REFRESH_COMMAND = "build_link.py --refresh"


def _link_suffix(filename, prefix, ext):
    """The part of a `gen*.json`/`PUZZLE_LINK*.txt` name between `prefix` and
    `ext`, minus one leading underscore -- "" for the plain-named file."""
    return filename[len(prefix) : -len(ext)].lstrip("_")


def check_gen_link_pairing(example_dir, manifest):
    """Return one violation string per gen*.json / PUZZLE_LINK*.txt name that
    does not pair with the other of the same suffix (docs/example-layout.md,
    "Board naming"): `gen.json` pairs with `PUZZLE_LINK.txt`, `gen_6x6.json`
    with `PUZZLE_LINK_6x6.txt`, and so on. A gen JSON always needs its link;
    a link needs a gen JSON back only where one is generated -- not a
    build_original.py/build_clued.py twin (NO_GENERATOR_TAGS) or a hand-made
    exception (the manifest's generator_less_links)."""
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
        if link_tags(link.name) & NO_GENERATOR_TAGS:
            continue
        suffix = _link_suffix(link.name, "PUZZLE_LINK", ".txt")
        if link.name in manifest.generator_less_links:
            continue
        gen_name = f"gen_{suffix}.json" if suffix else "gen.json"
        if not (example_dir / gen_name).is_file():
            violations.append(
                f"{name}: {link.name} has no matching {gen_name} -- most "
                "likely the gen JSON is missing or misnamed and should match "
                "this link's own suffix; if this link is genuinely hand-made "
                "instead, record it in the example's example.toml generator_less_links"
            )

    return violations


# The prefix every SudokuMaker link starts with. A committed .txt beside an
# example is a link when it starts with this and nothing else is; a golden or a
# note is not decoded and not checked.
LINK_PREFIX = "https://sudokumaker.app/?puzzle="


def committed_links(example_dir):
    """Every committed link .txt under `example_dir`, its board subdirectories
    included, PUZZLE_LINK*.txt first. A dot directory is scratch, not a board,
    and is skipped: a link may sit in a board's own subdirectory, and every
    one is gated.

    A PUZZLE_LINK*.txt is a link by its name -- one that does not decode is a
    broken shipped board and gets reported as one. Any other .txt is a link
    only when its text starts with `LINK_PREFIX`, so a fixture or a hunt record
    is covered without a naming rule of its own and a golden or a note is left
    alone."""
    named, sniffed = [], []
    for f in sorted(example_dir.rglob("*.txt")):
        if any(p.startswith(".") for p in f.relative_to(example_dir).parts):
            continue
        if f.name.startswith("PUZZLE_LINK"):
            named.append(f)
            continue
        try:
            if f.read_text().lstrip().startswith(LINK_PREFIX):
                sniffed.append(f)
        except (OSError, UnicodeDecodeError):
            continue
    return named + sniffed


def is_sudoku_document(puzzle):
    """Is this a "sudoku" document? The app prepends SudokuRules to one --
    every row and column of the whole grid a house (bundle.claude.js:11450-11456,
    the handler at :11066) -- so its lines need no declaration and its edge
    cells are real cells, not a clue ring."""
    return puzzle.get("type") == "sudoku"


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


def check_share_ready(link, manifest):
    """Return one violation string per pre-share criterion `link` (a
    `CommittedLink`) fails: the link opens clean, the ring is
    not filled end to end, and the rules text carries the sudoku prefix
    (docs/share-checklist.md).

    The ring criterion is criterion 3's mechanical half: a ring with every cell
    filled hands the solver every outside clue, which is the recurring share
    mistake. It is a floor, not the whole criterion -- "no unnecessary clue"
    still needs a human against the recorded carve."""
    puzzle, facts = link.puzzle, link.facts
    violations = []

    # The clued twins fill every outside clue on purpose -- that is what the
    # name means, and app-solve.mjs reads them with --ring-clues. The
    # entered-values check and the full-ring check do not apply to them; the
    # prefix check still does.
    clued = "clued" in link.tags
    entered = sum(
        1 for cell in puzzle["cells"] if "value" in cell and not cell.get("given")
    )
    if entered and not clued:
        violations.append(
            link.fail(f"has {entered} entered value(s) on non-given cells")
        )

    ring_filled, ring_total = (0, 0) if facts.ringless else _ring_state(puzzle)
    if ring_total and ring_filled == ring_total and not clued:
        violations.append(
            link.fail(
                f"fills all {ring_total} ring cells -- curate "
                f"the clue set, or name the link _clued if every clue is meant"
            )
        )

    ringless = facts.ringless or manifest.rules_prefix == "ringless"
    prefix = NO_RING_RULES_PREFIX if ringless else RULES_PREFIX
    if manifest.rules_prefix != "none" and not puzzle.get("comment", "").startswith(
        prefix
    ):
        violations.append(link.fail("comment missing rules prefix"))

    return violations


def check_components(link, manifest):
    """Return one violation string per custom constraint in `link`'s puzzle
    whose shipped component set differs from the set its own embedded code
    registers: the backend, plus any shipped component that constructs another
    in its place (`new customComponents.<Name>`, a wrapper swapping itself
    out).

    A component nothing in the link instantiates is dead weight, and the
    recipient reads its source as part of the rule; a component the link's
    code instantiates but the link omits fails inside the app, where the author
    never sees it. `lanes.Lane.check` asserts this when it builds a link, but
    a committed link goes stale on its own: the builder's component list
    changes, the link is not regenerated, and nothing notices.

    A lexical check, like the one in `lanes.Lane.check`: it reads
    `new <Name>Component` (or `new customComponents.<Name>Component`) off that
    code, so a class reached through
    an alias, or named some other way, is invisible to it. SudokuMaker's own
    built-ins are subtracted first (`component_scan.builtin_components`): the
    app provides those classes, so a backend that constructs one ships no
    component file for it and the link is not stale. Comment lines are
    dropped first: a link built today ships none (minify.py strips them), but this
    sweep also reads backends off links no builder rebuilds -- fillomino's
    frozen timing fixtures and hunt records -- whose committed backends still
    carry them, and a note that names a component must not read as a
    registration.
    """
    violations = []
    for constraint in link.puzzle.get("constraints", []):
        definition = constraint.get("definition")
        if not definition:
            continue
        shipped = [c["name"] for c in definition.get("components", [])]
        # A definition with no code backend registers nothing; its component
        # list is then empty too, so the two sets still match. A shipped
        # component can construct another in its place (a wrapper swapping
        # itself out through `customComponents`), so their code registers
        # too.
        registering = "\n".join(
            [
                definition.get("backend", {}).get("code", ""),
                *(c.get("code", "") for c in definition.get("components", [])),
            ]
        )
        violations.extend(
            link.fail(f"constraint {definition['name']!r}: {problem}")
            for problem in describe_mismatch(*mismatch(shipped, registering))
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


# The constraint name the ring lanes' `build_doc` ships the row/column backend
# under, read off the one place that pairing lives so a rename reaches this
# sweep too. It is the handle that says "this board meant to declare its lines
# in JS" even when the code embedded under it is an old copy.
FRAME_ROWCOL_CONSTRAINT = FRAME_ROWCOL.title
# ...and the corner pin's, which only a ring board carries.
CORNERS_TITLE = FRAME_CORNERS.title


def frame_backend_files(keep_comments=False):
    """`{constraint name: (source file name, its minified code in the tree)}`
    for the frame's two always-on shared backends, plus the opt-in house-GAC
    filter and a no-ring board's whole-grid rows and columns when a link
    carries them -- `check_stale_backend_code` only checks a title it finds in a
    link's own constraints, so an opt-in backend needs no separate gate here.
    `keep_comments` is the copy an annotated link embeds."""
    return {
        b.title: (f"{b.stem}.js", backend_code(b, keep_comments))
        for b in SHARED_BACKENDS
    }


def house_gac_component_file(keep_comments=False):
    """(component name, source file name, its minified code in the tree) for
    the house-GAC filter's one component -- `check_stale_backend_code` compares
    it against a link's own copy the same way it compares the backend, since
    HouseGacComponent.js is not a per-example file `check_components` would
    ever look for. `keep_comments` is the copy an annotated link embeds."""
    return (
        HOUSE_GAC.component,
        f"{HOUSE_GAC.component}.js",
        component_code(HOUSE_GAC, keep_comments),
    )


# The constraint type of `SudokuRules`: the app expands it into a house for
# every row and column of the grid (a custom document can carry it too).
SUDOKU_RULES_TYPE = 2003

# Every backend title a link can ship under its own name is
# `document.SHARED_BACKEND_TITLES`. Titles only -- reading the code behind them
# means minifying it, which `frame_backend_files` does for the staleness check
# alone.


class LinkKind(enum.Enum):
    """`LinkFacts.kind`: a misspelt member raises, a misspelt string would
    compare unequal and pass."""

    NO_RING = "no-ring"
    SUDOKU_DOCUMENT = "sudoku-document"
    FRAME = "frame"


class HouseSource(enum.Enum):
    """`LinkFacts.house_source`, an enum for the same reason as `LinkKind`."""

    FRAME_BACKEND = "frame-backend"
    NO_RING_BACKEND = "no-ring-backend"
    SUDOKU_RULES = "sudoku-rules"
    DOCUMENT = "document"


@dataclasses.dataclass(frozen=True)
class LinkFacts:
    """What the per-link checks need to know about one decoded link, worked out
    once from the raw document alone (no frame-builder lane is called).

    - `kind`: "no-ring" (carries the whole-grid rows-and-columns backend,
      `is_no_ring`), "sudoku-document" (`is_sudoku_document`), else "frame".
      The first two have no clue ring; their edge cells are real cells.
    - `backend_titles`: the frame backends the link ships under their own
      name, whatever code is embedded there, in constraint order.
    - `constraint_names`: every custom constraint's name, for a backend a
      manifest borrows (`declares_rows_and_columns`).
    - `interior`: the ids of the cells a frame board's rows and columns run
      through (see `_interior_cells`); None when `width` x `height` is not
      declared as ints.
    - `house_source`: where the board's rows and columns come from when not
      a region or cage: "frame-backend", "no-ring-backend", "sudoku-rules"
      (type 2003, which the app expands into them), or "document" -- a
      static read of the document's regions and cages is all there is."""

    kind: LinkKind
    backend_titles: tuple
    constraint_names: frozenset
    interior: frozenset | None
    house_source: HouseSource

    @classmethod
    def of(cls, puzzle):
        constraints = puzzle.get("constraints", [])
        names = [(c.get("definition") or {}).get("name") for c in constraints]
        titles = tuple(n for n in names if n in SHARED_BACKEND_TITLES)
        no_ring = is_no_ring(puzzle)
        if no_ring:
            kind = LinkKind.NO_RING
        elif is_sudoku_document(puzzle):
            kind = LinkKind.SUDOKU_DOCUMENT
        else:
            kind = LinkKind.FRAME
        if FRAME_ROWCOL_CONSTRAINT in names:
            house_source = HouseSource.FRAME_BACKEND
        elif no_ring:
            house_source = HouseSource.NO_RING_BACKEND
        elif any(c.get("type") == SUDOKU_RULES_TYPE for c in constraints):
            house_source = HouseSource.SUDOKU_RULES
        else:
            house_source = HouseSource.DOCUMENT
        w, h = puzzle.get("width"), puzzle.get("height")
        interior = (
            _interior_cells(constraints, titles, w, h)
            if isinstance(w, int) and isinstance(h, int)
            else None
        )
        return cls(
            kind, titles, frozenset(n for n in names if n), interior, house_source
        )

    @property
    def ringless(self):
        """No clue ring: a no-ring board or a "sudoku" document."""
        return self.kind is not LinkKind.FRAME


@dataclasses.dataclass(frozen=True)
class CommittedLink:
    """One committed link, read once and handed to every per-link check:
    `example` (the example's directory name), `shown` (its path inside the
    example, as a violation names it), `tags` (from `link_tags`: empty for a
    link found by its `LINK_PREFIX` text), the decoded `puzzle` and its
    `LinkFacts`."""

    example: str
    shown: str
    tags: frozenset
    puzzle: dict
    facts: LinkFacts

    @classmethod
    def of(cls, example_dir, path, puzzle):
        return cls(
            example_dir.name,
            path.relative_to(example_dir).as_posix(),
            link_tags(path.name),
            puzzle,
            LinkFacts.of(puzzle),
        )

    def fail(self, message):
        """A violation naming this link, then `message`."""
        return f"{self.example}: {self.shown} {message}"


def declares_rows_and_columns(manifest, facts):
    """Does this link get its row and column houses from something other than
    a region or cage, which declared_houses' static read of the document
    would miss? Either a constraint that builds them in JS, or the bare
    `SudokuRules` constraint (type 2003), which the app expands into them
    (`LinkFacts.house_source`). The JS cases: the frame's shared row/col
    backend, a no-ring board's whole-grid one, or the one borrowed backend the manifest's rowcol_backend names (house-gac's
    "Rows & Columns", docs/research/406-gac-demo's own, carried unmodified;
    nothing here compares it to a file in the tree). Scoped per example,
    not by name alone: a name match on some other example's own unrelated
    constraint must not silently exempt it too. SudokuRules carries no name to
    match and is the app's own constraint, so it is recognised on any example."""
    if facts.house_source is not HouseSource.DOCUMENT:
        return True
    return (
        manifest.rowcol_backend is not None
        and manifest.rowcol_backend in facts.constraint_names
    )


def _interior_cells(constraints, backend_titles, width, height):
    """The ids of the cells a region constraint places in a region.

    That is the interior of a frame board: its ring is outside every region and
    has no house of its own. A board with no region constraint is all interior,
    unless it carries the frame's corner pin: then it is a ring board that
    draws no boxes (isofill-skyscraper), and its interior is every cell off the
    ring.
    """
    regions = next((c["regions"] for c in constraints if "regions" in c), None)
    if regions is None and CORNERS_TITLE in backend_titles:
        return frozenset(
            i
            for i in range(width * height)
            if 0 < i // width < height - 1 and 0 < i % width < width - 1
        )
    if regions is None:
        return frozenset(range(width * height))
    return frozenset(i for i, r in enumerate(regions) if isinstance(r, int) and r >= 0)


def interior_lines(facts, width, height):
    """`(rows, columns)`: for each row and each column of the board, the
    interior cells on it. A frame board's ring rows and columns hold none, so
    a line may be empty."""
    inside = facts.interior
    rows = [[i for i in inside if i // width == r] for r in range(height)]
    columns = [[i for i in inside if i % width == c] for c in range(width)]
    return rows, columns


def interior_line_lengths(facts, width, height):
    """How many interior cells each row and each column holds, empty lines
    dropped."""
    return {
        len(line)
        for lines in interior_lines(facts, width, height)
        for line in lines
        if line
    }


def check_houses(link, manifest):
    """Return one violation string per interior row or column of `link`'s puzzle
    that is neither a house the document declares nor one the shared frame
    backend declares in JS.

    A region constraint gives you BOXES ONLY -- rows and columns are not
    implied, and nothing in the app says so: it solves, times and counts
    solutions on a board that is not the one you meant. The frame builder
    declares them as named houses through the frame-rowcol backend; a builder
    that writes its own constraint list has to declare them itself. This cost three tickets of quad-rank
    work, where a 9x9 that CP-SAT proves unique in 0.01s timed out at 300s and
    a 6x6 whose true count is 2 came back as 5 (docs/gotchas.md #9).

    A "sudoku" document is exempt: the app prepends SudokuRules to it, every
    row and column of the whole grid (`is_sudoku_document`).

    Interior is `LinkFacts.interior`.
    """
    puzzle, facts = link.puzzle, link.facts
    if not manifest.houses:
        return []

    if facts.interior is None:
        return []
    width, height = puzzle["width"], puzzle["height"]

    # A board carrying a row/column backend declares its lines in JS, so
    # counting missing rows here would send the reader after a constraint that
    # is already present. Whether the copy embedded there is the current one is
    # `check_stale_backend_code`'s question, with its own message and its own fix
    # (a borrowed backend named in the manifest has no such check -- see
    # declares_rows_and_columns).
    if (
        declares_rows_and_columns(manifest, facts)
        or facts.kind is LinkKind.SUDOKU_DOCUMENT
    ):
        return []

    houses = declared_houses(puzzle)
    violations = []
    rows, columns = interior_lines(facts, width, height)
    for label, lines in (("row", rows), ("column", columns)):
        missing = sum(1 for line in lines if line and frozenset(line) not in houses)
        if missing:
            violations.append(
                link.fail(
                    f"declares no house for {missing} interior "
                    f"{label}(s) -- a region constraint gives boxes only, so rows "
                    f"and columns need their own constraints (docs/gotchas.md #9)"
                )
            )
    return violations


def check_stale_backend_code(link, manifest):
    """Return one violation per shared frame backend or shared component `link`
    ships with code that is not the copy in the tree.

    BOTH frame backends need checking here and only here. `check_components`
    cannot see `frame-corners.js` at all: it registers a
    `PredefinedCandidatesComponent`, which is a built-in, so that constraint
    ships no component file and the shipped/registered sets agree whatever its
    code says. A changed `frame-corners.js` with un-rebuilt links would
    otherwise pass every gate in silence -- and the corner pin is the whole
    reason a frame board comes back unique.

    The component staleness check is keyed on the shipped component's own
    name, not the constraint's title: house-gac's standalone board splices in
    HouseGacComponent.js under a title of its own ("House GAC (standalone)",
    to avoid the reserved "House GAC" -- see house-gac/build_link.py's
    header comment) with a backend that is legitimately not house-gac.js, so only
    the component -- the one thing that board does share -- is compared
    against the tree. A MISSING component is not this check's job:
    `check_components` already flags any constraint whose backend registers a
    name its own `components` list omits.

    `minify_js` drops comments, so editing a backend file's prose leaves every
    plain committed link valid; only a real code change makes them stale, and a
    stale link genuinely runs different code from the one under review. An
    `_annotated` link under `annotated_keeps_comments` embeds the
    comment-keeping copy, so a prose edit does stale it: rebuild it too.
    """
    # An annotated link embeds the shared backends and the shared component
    # through the comment-keeping minify mode, not the usual full strip --
    # compare it against those copies instead, or every rebuild would read as
    # stale. The manifest says which example builds one.
    annotated = manifest.annotated_keeps_comments and "annotated" in link.tags
    current = frame_backend_files(keep_comments=annotated)
    comp_name, comp_source, comp_want = house_gac_component_file(
        keep_comments=annotated
    )

    def stale(source):
        return link.fail(
            f"embeds a stale copy of {source} -- "
            f"rebuild it in the same commit as the change (the example's "
            f"`build_size.py --rebuild <n>`, or `{REFRESH_COMMAND}` "
            f"for every board of the example)"
        )

    violations = []
    for constraint in link.puzzle.get("constraints", []):
        definition = constraint.get("definition") or {}
        title = definition.get("name")
        if title in current:
            source, want = current[title]
            if definition.get("backend", {}).get("code") != want:
                violations.append(stale(source))
        comp = next(
            (c for c in definition.get("components", []) if c["name"] == comp_name),
            None,
        )
        if comp is not None and comp.get("code") != comp_want:
            violations.append(stale(comp_source))
    return violations


def check_digit_range(link, manifest):
    """Return one violation if `link`'s puzzle ships a frame backend and declares no
    digit range, or a range that does not span the interior line.

    Both backends read `helpers.digits`, and the app defaults a custom puzzle
    to 1..9 whatever the grid size. With no `minDigit`/`maxDigit` the
    range rests on that default, not on the document. A range that does not
    span the interior line degrades every row and column from a named
    `HouseComponent` to a bare `DifferentDigitsComponent` -- the weaker rule,
    with no houseType for the solver's row/column machinery -- and pins the
    corners to a digit the puzzle never uses, so the range is checked against
    the line and not merely for being there. None of it shows on the board or
    in the source text.
    """
    puzzle, facts = link.puzzle, link.facts
    carried = facts.backend_titles
    if not carried:
        return []

    lo, hi = puzzle.get("minDigit"), puzzle.get("maxDigit")
    if not all(isinstance(v, int) and not isinstance(v, bool) for v in (lo, hi)):
        return [
            link.fail(
                f"ships {sorted(carried)} but declares no "
                f"digit range -- the app defaults a custom puzzle to 1..9 whatever "
                f"the grid size, so the range rests on that default, not on the "
                f"document. Pin minDigit/maxDigit on the document (#394)"
            )
        ]

    width, height = puzzle.get("width"), puzzle.get("height")
    if manifest.digits_exceed_lines or not (
        isinstance(width, int) and isinstance(height, int)
    ):
        return []

    lengths = interior_line_lengths(facts, width, height)
    span = hi - lo + 1
    if lengths and lengths != {span}:
        cells = "/".join(str(n) for n in sorted(lengths))
        return [
            link.fail(
                f"ships {sorted(carried)} and declares "
                f"{span} digits (minDigit {lo}, maxDigit {hi}) against {cells} "
                f"cell interior lines -- a line as long as the range is a house, "
                f"any other length falls back to plain all-different, and the "
                f"corner pin lands on minDigit whether or not the board uses it. "
                f"Match the range to the interior (#394)"
            )
        ]
    return []


def _parse_gen(gen):
    """`(document, None)` for a `gen*.json` that parses, `(None, error)` for one
    that does not."""
    try:
        return json.loads(gen.read_text()), None
    except json.JSONDecodeError as e:
        return None, e


def check_gen_json_parses(example_dir):
    """Return one violation per `gen*.json` that is not valid JSON.

    A corrupt board record must stop the gate, not drop out of the checks that
    read it.
    """
    name = example_dir.name
    return [
        f"{name}: {gen.name} is not valid JSON: {error}"
        for gen in sorted(example_dir.glob("gen*.json"))
        if (error := _parse_gen(gen)[1])
    ]


def check_gen_frame_backends(example_dir):
    """Return one violation per `gen*.json` that records a frame backend's code.

    A gen JSON is the board's record, and the shared frame backends are not
    part of a board: their code is read from the tree at build time
    (`document.refresh_frame_backends`), so a copy kept here is dead data no
    build reads and nothing rebuilds -- it can only drift from the file it
    copies, and a reader comparing the two has no way to tell which one runs.
    Keep the field empty. A gen JSON that does not parse is
    `check_gen_json_parses`'s to report.
    """
    name = example_dir.name
    titles = SHARED_BACKEND_TITLES
    violations = []
    for gen in sorted(example_dir.glob("gen*.json")):
        doc, error = _parse_gen(gen)
        if error:
            continue
        try:
            puzzle = doc["puzzle"]
        except KeyError:
            continue  # a board-data gen JSON carries no document at all
        constraints = puzzle["constraints"]
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


def required_files(manifest):
    """The files an example with this manifest must carry."""
    if manifest.boardless:
        return BOARDLESS_REQUIRED_FILES
    if manifest.houses_only:
        return HOUSES_ONLY_REQUIRED_FILES
    if manifest.lanes == "global":
        return ["main-global.js" if f == "main.js" else f for f in REQUIRED_FILES]
    return REQUIRED_FILES


# Every per-link check, run in this order over each committed link.
LINK_CHECKS = (
    check_share_ready,
    check_components,
    check_stale_backend_code,
    check_digit_range,
    check_houses,
)


def check_example(example_dir):
    """Return one violation string per problem found in `example_dir`."""
    name = example_dir.name

    if name in RETIRED_EXAMPLES:
        return [
            f"{name}: folded into {RETIRED_EXAMPLES[name]} (#238); "
            "this directory must not exist"
        ]

    try:
        manifest = load_manifest(example_dir)
    except (FileNotFoundError, ValueError) as e:
        return [f'{name}: {e} (docs/example-layout.md, "The manifest")']

    violations = [
        f"{name}: missing required file {required}"
        for required in required_files(manifest)
        if not (example_dir / required).is_file()
    ]

    if manifest.shared_component:
        shared_file = example_dir.parent / "_shared" / f"{manifest.shared_component}.js"
        if not shared_file.is_file():
            violations.append(
                f"{name}: declared shared component {manifest.shared_component!r} "
                f"has no file at {shared_file}"
            )
    elif not manifest.houses_only and not list(example_dir.glob("*Component.js")):
        violations.append(f"{name}: missing required file *Component.js")

    if manifest.lanes == "split" and not manifest.boardless:
        violations.extend(
            f"{name}: missing required file {required}"
            for required in ["main-global.js", *REQUIRED_LOCAL_FILES]
            if not (example_dir / required).is_file()
        )

    # A single-lane example ships main.js alone and a global-lane one ships
    # main-global.js in its place; neither carries the local board (the
    # comment above REQUIRED_LOCAL_FILES). A stray file is a lane the
    # manifest says does not exist.
    strays = {
        "single": ["main-global.js", *REQUIRED_LOCAL_FILES],
        "global": REQUIRED_LOCAL_FILES,
    }.get(manifest.lanes, [])
    violations.extend(
        f"{name}: {manifest.lanes}-lane example carries {stray}, a file of a lane "
        f"its manifest says it does not have"
        for stray in strays
        if (example_dir / stray).is_file()
    )

    violations.extend(check_lanes(example_dir))
    violations.extend(check_gen_link_pairing(example_dir, manifest))
    violations.extend(check_gen_json_parses(example_dir))
    violations.extend(check_gen_frame_backends(example_dir))

    for path in committed_links(example_dir):
        shown = path.relative_to(example_dir).as_posix()
        if path.name.startswith("PUZZLE_LINK") and not LINK_RE.match(path.name):
            violations.append(
                f"{name}: link name {shown} does not match "
                f"PUZZLE_LINK[_<size>][_<givens>g][_<tag>]*.txt "
                f"(size=NxN, tags in fixed order {list(TAGS)})"
            )
        # Decoded once, here: every check below reads the same puzzle.
        try:
            puzzle = decode_puzzle(path.read_text().strip())["puzzle"]
        except Exception as e:
            violations.append(f"{name}: {shown} failed to decode: {e}")
            continue
        link = CommittedLink.of(example_dir, path, puzzle)
        for check in LINK_CHECKS:
            violations.extend(check(link, manifest))

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
