# The per-link checks of the layout sweep: each reads one committed link,
# decoded once into a `CommittedLink`, and returns its violations. The sweep
# itself (required files, link names, gen/link pairing, the tree walk) is
# check_layout.py, which hands every link it finds to LINK_CHECKS below.
# Like the sweep, this module names no example: what is special about an
# example is its manifest's (manifest.py).

import dataclasses
import enum

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

# What a stale-backend violation tells the author to run; every example's
# build_link.py takes the flag (size_builders.test.py).
REFRESH_COMMAND = "build_link.py --refresh"


def is_no_ring(puzzle):
    """Does this link carry the whole-grid rows-and-columns backend
    (no_ring.NoRing), whatever code is embedded there? Carrying it is
    what marks a board as no-ring: its rows and columns are declared in JS, and
    its edge cells are real cells, not a clue ring."""
    return any(
        (c.get("definition") or {}).get("name") == GRID_ROWCOL.title
        for c in puzzle.get("constraints", [])
    )


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
    example, as a violation names it), `tags` (from check_layout's `link_tags`: empty for a
    link found by its `LINK_PREFIX` text), the decoded `puzzle` and its
    `LinkFacts`."""

    example: str
    shown: str
    tags: frozenset
    puzzle: dict
    facts: LinkFacts

    @classmethod
    def of(cls, example_dir, path, puzzle, tags):
        return cls(
            example_dir.name,
            path.relative_to(example_dir).as_posix(),
            tags,
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


# Every per-link check, run in this order over each committed link.
LINK_CHECKS = (
    check_share_ready,
    check_components,
    check_stale_backend_code,
    check_digit_range,
    check_houses,
)
