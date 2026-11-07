# The kinds of board a Spec builds. A `Lane` -- ring global, ring local, or no
# ring (no_ring.py) -- owns the document, its check, and its file names; the
# board it encodes comes from `carve.generate` or a committed gen JSON
# (`board.load_board`).
#
# `main(spec, argv)` is the command line every example's `build_size.py` ends
# with -- it parses, picks the lane (`lane_kinds`), and calls its `run` (fresh
# search) or `rebuild` (re-encode a committed board against the code in the
# tree right now).
#
#   n box_height box_width [seed_count] [--paths|--local]
#   n --height H --digits D [--seeds K]
#   --rebuild n [--paths|--local] [--height H]
#
# Writes PUZZLE_LINK*.txt and gen*.json next to the caller's script.

import argparse
import pathlib
import sys
from dataclasses import dataclass
from pathlib import PurePath

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from board import Geometry, Spec, _ring_name, load_board, make_lines, save_board
from carve import generate
from component_scan import describe_mismatch, mismatch
from document import (
    FRAME_BACKENDS,
    HOUSE_GAC_BACKEND_TITLE,
    LOCAL_RULES_SUFFIX,
    RULES_PREFIX,
    frame_backend_code,
    frame_groups,
    house_gac_constraint,
    puzzle_document,
)
from frame import corner_cells, cosmetics, ring_cell
from link_swap import frame_and_comment_only
from minify import minify_file
from sm_document import assert_round_trips, code_constraint, find_constraint
from sudoku_kit import link_codec


def named_files(spec, tag):
    """The (link, gen) paths for a board whose file tag is `tag`: the plain
    names when it is empty, `PUZZLE_LINK_<tag>.txt` / `gen_<tag>.json`
    otherwise."""
    link = f"PUZZLE_LINK_{tag}.txt" if tag else "PUZZLE_LINK.txt"
    gen = f"gen_{tag}.json" if tag else "gen.json"
    return spec.dir / link, spec.dir / gen


@dataclass(frozen=True)
class Lane:
    """One kind of board a Spec builds. Three exist -- `RingGlobal`,
    `RingLocal` and `no_ring.NoRing` -- and `lane_kinds` says which ones a
    Spec builds. A lane refuses a Spec that is not its kind, so a combination
    with no meaning (a no-ring board that draws no groups) cannot be built.

    A lane owns everything that differs between kinds of board: its document
    (`build_doc`), its drawn groups (`drawn`, None for a lane that draws
    none), its own half of `check` (`_check_lane`), its file names (`files`),
    the sentence its rules text opens with (`rules_prefix`),
    the backend file its constraint runs (`backend`), and what a rebuild
    refreshes rather than compares (`generated`: the shared backends' titles;
    `derived`: constraint types recomputed from the board). `paths` is
    whether a fresh search draws bent paths.
    """

    spec: Spec
    derived = frozenset()
    # The sentence the rules text opens with; a lane whose board has no inner
    # grid to name overrides it.
    rules_prefix = RULES_PREFIX

    def __post_init__(self):
        kinds = lane_kinds(self.spec)
        if not isinstance(self, kinds):
            raise ValueError(
                f"the {self.name} lane cannot build this Spec: it builds "
                f"{', '.join(k.name for k in kinds)} only"
            )

    @property
    def paths(self):
        return self.spec.bent_lines

    def components(self):
        """The component filenames this lane's link carries."""
        return self.spec.components

    def example_constraint(self, groups):
        """The example's own custom constraint: this lane's backend, its
        components, and `groups` as its input (None declares no input)."""
        return code_constraint(
            self.spec.constraint_name,
            minify_file(self.spec.dir / self.backend),
            [
                (PurePath(f).stem, minify_file(self.spec.dir / f))
                for f in self.components()
            ],
            groups=groups,
            named=True,
        )

    def check(self, link, doc, board):
        """Everything a built link must satisfy before it is written: it
        decodes back to `doc`, opens with the rules prefix, stores no value on
        a non-given cell, draws this lane's groups, and ships exactly the
        components its backend registers. `board` is what `doc` was built
        from, so the size is compared against the board rather than read back
        out of the document."""
        spec = self.spec
        assert_round_trips(link, doc)
        assert doc["puzzle"]["comment"].startswith(self.rules_prefix), (
            f"the rules text must open with the required sentence {self.rules_prefix!r}"
        )
        # A cell holds a value only when it is a given: a non-given value
        # ships as an entered digit, and the recipient opens a board already
        # filled in.
        assert not [
            c for c in doc["puzzle"]["cells"] if "value" in c and not c.get("given")
        ], "a non-given cell carries a value"
        lc = find_constraint(doc, spec.constraint_name)
        # `_check_lane` names the backend and components itself: an assertion
        # built from the builder's own call passes when that call breaks.
        backend_file, want = self._check_lane(lc, doc, board)
        backend = minify_file(spec.dir / backend_file)
        assert lc["definition"]["backend"]["code"] == backend, (
            f"the link runs the wrong lane's backend ({self.name})"
        )
        names = [c["name"] for c in lc["definition"]["components"]]
        assert names == [PurePath(f).stem for f in want], (
            f"the link carries the wrong lane's components ({self.name}): {names}"
        )
        # A lane's own link must ship exactly what its backend registers, in
        # both directions: the backend must not register a component the link
        # leaves out (that one fails inside the app, where the author never
        # sees it), and the link must not carry a name the backend never
        # registers (that one is dead weight the recipient still reads as part
        # of the rule). `component_scan.mismatch` is
        # a lexical check: it reads `new <Name>Component` off the backend
        # source, so a class reached through an alias, or named some other
        # way, is invisible to it.
        problems = describe_mismatch(*mismatch(names, backend))
        assert not problems, "; ".join(problems)
        assert doc["puzzle"]["maxDigit"] == board.digits, (
            "maxDigit must be the digit count, not the 1..9 default"
        )
        assert doc["puzzle"]["minDigit"] == spec.min_digit

    def run(self, geo, seeds):
        """Search `seeds` for a board of geometry `geo` on this lane, build its
        link, and write both files. A rectangle's box is the builder's grammar
        only, so it is not held to n."""
        assert geo.box is None or geo.box[0] * geo.box[1] == geo.n, (
            "box_height * box_width must equal n"
        )
        board = generate(self.spec, geo, seeds, paths=self.paths)
        doc = self.build_doc(board)
        link = link_codec.encode_link(doc)
        self.check(link, doc, board)
        link_path, gen_path = self.files(geo.n, height=geo.shape.get("height"))
        link_path.write_text(link + "\n")
        save_board(board, gen_path)
        print(f"wrote {link_path.name} ({len(link)} chars) and {gen_path.name}")

    def rebuild(self, n, pair=None, height=None):
        """The link for a committed board, re-encoded against the code in the
        tree right now, with no fresh CP-SAT search.

        The grid, givens and shown clues come from the recorded seed; only
        the constraint's code, backend, input and the comment follow the
        working tree. Asserts exactly that against the link it replaces, and
        returns the new link unwritten, so a test can compare bytes.

        `pair` names the (link, gen) files for a board that does not own its
        size's default names (`files(n)`) -- a second board of one size.
        `height` names a rectangular board's files.
        """
        spec = self.spec
        link_path, gen_path = pair or self.files(n, height=height)
        assert gen_path.exists(), (
            f"{gen_path.name} does not exist: this example ships no carved "
            f"board at n={n} on the {self.name} lane. A link whose board was "
            "not carved here is rebuilt by its own build_link.py."
        )
        board = load_board(gen_path)
        doc = self.build_doc(board)
        link = link_codec.encode_link(doc)
        self.check(link, doc, board)
        assert link_path.exists(), (
            f"{link_path.name} does not exist: there is no committed link for "
            "this board to rebuild"
        )
        before = link_codec.decode_puzzle(link_path.read_text().strip())
        # `frame_and_comment_only` clears the constraint's own input, and a
        # lane that draws groups carries its line geometry there and nowhere
        # else -- a no-ring board its shown clues too, as typed values.
        # Compare it here, or a gen JSON whose "paths" moved rebuilds into a
        # link drawing lines the shown clues no longer describe, and the guard
        # below sees nothing. A lane that draws none compares None to None.
        drawn = find_constraint(before, spec.constraint_name)["input"].get("groups")
        assert drawn == self.drawn(board), (
            "the committed link draws different lines from the recorded "
            "board's -- a rebuild from the recorded seed must not move the "
            "geometry"
        )

        def _without_generated_constraints(d):
            """Drop House GAC whole, not blanked: it is opt-in
            (`spec.house_gac`), so a rebuild that first turns it on adds a
            constraint the old link never carried. Its code is generated, not
            board data. The lane's `derived` constraints go too."""
            d = dict(d)
            d["puzzle"] = dict(d["puzzle"])
            d["puzzle"]["constraints"] = [
                c
                for c in d["puzzle"]["constraints"]
                if c.get("definition", {}).get("name") != HOUSE_GAC_BACKEND_TITLE
                and c.get("type") not in self.derived
            ]
            return d

        # The shared backends' code is generated, so blanked like the example's.
        assert _without_generated_constraints(
            frame_and_comment_only(before, spec.constraint_name, self.generated)
        ) == _without_generated_constraints(
            frame_and_comment_only(doc, spec.constraint_name, self.generated)
        ), (
            "grid, givens, or shown clues changed -- a rebuild from the recorded "
            "seed must only change the constraint code and comment"
        )
        return link


class _RingLane(Lane):
    """The two lanes with a clue ring around the grid: the (n+2) x (n+2)
    board, its frame backends and cosmetics. They differ in the groups they
    draw, whether House GAC may ride along, and the rules text's close."""

    @property
    def generated(self):
        """The frame backends this lane's links carry, by title."""
        return tuple(title for title, _ in self._frame_backends())

    def _frame_backends(self):
        """`frame_backend_code()` less frame-rowcol when the Spec's interior
        has no row/column houses."""
        code = dict(frame_backend_code())
        return [
            (title, code[title])
            for stem, title in FRAME_BACKENDS
            if stem != "frame-rowcol" or self.spec.rowcol_houses
        ]

    @property
    def rules_prefix(self):
        """The Spec's own opening sentence, else the sudoku one."""
        if self.spec.rules_prefix is None:
            return RULES_PREFIX
        return self.spec.rules_prefix

    def build_doc(self, board):
        """Assemble the whole SudokuMaker document for `board`."""
        spec = self.spec
        n, bh, bw = board.n, board.bh, board.bw
        rows = board.height
        W, H = n + 2, rows + 2
        idx = lambda r, c: r * W + c
        # interior cell (r,c) 0-indexed sits at board (r+1, c+1)
        cells = [{"value": 1} for _ in range(W * H)]

        # corners: empty, and belong to no line. A given here is a digit the
        # recipient reads off the board, so the frame backend pins them instead.
        for r, c in corner_cells(W, H):
            cells[idx(r, c)] = {}

        # interior: a given carries its value; every other cell is EMPTY. The
        # solution is never stored — a non-given value ships as an entered digit.
        interior = []
        for r in range(rows):
            for c in range(n):
                cells[idx(r + 1, c + 1)] = (
                    {"value": board.grid[r][c], "given": True}
                    if (r, c) in board.givens
                    else {}
                )
                interior.append(idx(r + 1, c + 1))

        # clue ring: a shown clue is a given; a hidden (interactive) clue is an
        # EMPTY cell. Never store the hidden value — a non-given value ships as
        # an entered digit, so the recipient opens the link with every clue
        # typed in.
        for key in board.lines:
            ci = idx(*ring_cell(_ring_name(key), W, H))
            cells[ci] = (
                {"value": board.clue[key], "given": True} if key in board.active else {}
            )

        regions = [-1] * (W * H)
        for r in range(rows):
            for c in range(n):
                regions[idx(r + 1, c + 1)] = (r // bh) * (n // bw) + (c // bw)

        # The frame's own backends (their rules live in the files' own
        # headers); every ring board carries frame-corners, and frame-rowcol
        # unless its Spec's interior has no row/column houses:
        #   frame-rowcol   declares the interior's rows and columns as named
        #                  houses, and hands SudokuPad the same lines at
        #                  publish time. A region constraint gives BOXES ONLY,
        #                  so without this the board is not the puzzle it looks
        #                  like (docs/gotchas.md #9).
        #   frame-corners  pins the four corner cells, which no line, region or
        #                  house reaches; without it the app calls the board
        #                  not unique.
        frame_backends = self._frame_backends()

        # The cap is `house_gac_constraint`'s to enforce -- it raises below
        # when the lane opts in and n is too big -- so it is checked once, for
        # every caller, not duplicated here.
        constraints = [
            *([{"type": 1, "regions": regions}] if spec.box_regions else []),
            {"type": 0},
            *(spec.extra_cages(interior) if spec.extra_cages else []),
            self.example_constraint(self.drawn(board)),
            *(code_constraint(name, code) for name, code in frame_backends),
            *([house_gac_constraint(n)] if self._house_gac(n) else []),
            *cosmetics(W, cells, H),
        ]

        comment = (
            self.rules_prefix
            + spec.comment_fn(n, **board.shape)
            + self._rules_close(board)
        )
        return puzzle_document(spec, board, W, cells, constraints, comment, H)


class RingGlobal(_RingLane):
    """The ring board that draws no groups: main-global.js builds all 4n frame
    lines itself from the grid at solve time.

    The 9x9 is the board every example's timing loop, README and comparison
    links reuse, so it is plain-named (PUZZLE_LINK.txt / gen.json); every
    other size carries its `NxN` tag. An example whose PUZZLE_LINK.txt is some
    other, hand-built board says so with `Spec.plain_global_9x9 = False`, and
    its 9x9 keeps the `9x9` tag.
    """

    name = "global"
    backend = "main-global.js"
    paths = False

    def drawn(self, board):
        return None

    def files(self, n, height=None):
        plain = height is None and n == 9 and self.spec.plain_global_9x9
        tag = f"{n}x{n if height is None else height}"
        return named_files(self.spec, "" if plain else tag)

    def _house_gac(self, n):
        # `spec.house_gac` names sizes on this lane only.
        return n in self.spec.house_gac

    def _rules_close(self, board):
        # This lane draws no lines at all, so they are never bent.
        return ""

    def _check_lane(self, lc, doc, board):
        assert lc["input"] == {}, "the global board reads no drawn groups"
        return "main-global.js", self.spec.components


class RingLocal(_RingLane):
    """The ring board that ships each line as a drawn group, clue cell first,
    which is the order main.js reads (docs/line-contract.md,
    docs/example-layout.md). Whether those lines bend is the Spec's
    `bent_lines`, so a caller names the lane and the example names its own
    geometry.

    Its 9x9 is PUZZLE_LINK_local.txt / gen_local.json -- nothing else claims
    those names -- and every other size is tagged `NxN_local`.
    """

    name = "local"
    backend = "main.js"

    def components(self):
        if self.spec.local_components is not None:
            return self.spec.local_components
        return self.spec.components

    def drawn(self, board):
        return frame_groups(board.n, board.lines)

    def files(self, n, height=None):
        if height is not None:
            raise ValueError("the local lane builds square boards only")
        return named_files(self.spec, "local" if n == 9 else f"{n}x{n}_local")

    def _house_gac(self, n):
        # Never on this lane: no measured local board cleared the timing bar
        # (docs/research/421-frame-link-timing.md).
        return False

    def _rules_close(self, board):
        # Whether the drawn lines bend is read off `board` itself, so a link
        # never tells a solver a digit may repeat along cells that are a
        # plain row.
        return LOCAL_RULES_SUFFIX if board.lines != make_lines(board.n) else ""

    def _check_lane(self, lc, doc, board):
        spec = self.spec
        groups = lc["input"].get("groups", [])
        assert len(groups) == 4 * board.n, "one drawn group per line"
        want = (
            spec.local_components
            if spec.local_components is not None
            else spec.components
        )
        return "main.js", want


def lane_kinds(spec):
    """The lane classes `spec` builds, the default first and the `--local`
    one last.

    A ring Spec builds both ring lanes. A Spec with a `groups_fn` builds the
    no-ring lane and only that: its clues live in its drawn groups, so a
    no-ring board that draws none has no lane, and the flag names the one
    lane either way.
    """
    if spec.groups_fn is None:
        return (RingGlobal, RingLocal)
    # Imported here: no_ring builds its lane on this module's `Lane`, so a
    # module-scope import would be circular.
    from no_ring import NoRing

    return (NoRing,)


def main(spec, argv=None):
    """The command line every example's `build_size.py` ends with.

        <n> <box_height> <box_width> [seed_count] [--paths|--local]
        <n> --height H --digits D [--seeds K]
        --rebuild <n> [--paths|--local] [--height H]

    `n` is the interior's width. `--height` and `--digits` build a rectangular
    board on the global lane (an interior with its own grid_fn and model_fn),
    where nothing reads a box, so none is named.

    `--paths` and `--local` are two names for the same lane: both build the
    LOCAL board. The Spec's `bent_lines` -- not the flag -- says whether that
    board's drawn lines bend. A no-ring Spec has one lane, which the flag
    names either way (`lane_kinds`).

    `argv` defaults to the process's, and is passed explicitly by
    `lanes.test.py`: nothing below `main` reads `sys.argv`.
    """
    p = argparse.ArgumentParser(description=f"Build a {spec.title} puzzle link.")
    p.add_argument("n", type=int, help="interior size")
    p.add_argument("box_height", type=int, nargs="?")
    p.add_argument("box_width", type=int, nargs="?")
    p.add_argument("seed_count", type=int, nargs="?", default=40)
    p.add_argument("--height", type=int, help="interior height, for a rectangle")
    p.add_argument("--digits", type=int, help="digit count, for a rectangle")
    p.add_argument("--seeds", type=int, help="seed count, for a rectangle")
    p.add_argument(
        "--rebuild",
        action="store_true",
        help="re-encode the committed board of this size against the current code",
    )
    p.add_argument(
        "--paths",
        "--local",
        dest="local",
        action="store_true",
        help="build the drawn-groups lane (main.js) instead; a no-ring Spec has "
        "only that lane",
    )
    args = p.parse_args(argv)
    kinds = lane_kinds(spec)
    lane = (kinds[-1] if args.local else kinds[0])(spec)

    if args.height is not None and args.local:
        p.error("a rectangle is built on the global lane only")
    if args.rebuild and (args.box_height is not None or args.box_width is not None):
        p.error("--rebuild re-encodes a committed board: pass n and the lane only")
    if args.rebuild and (args.digits is not None or args.seeds is not None):
        p.error(
            "--rebuild reads the digits off the committed board and draws no "
            "seeds: pass n, the lane and --height only"
        )
    if not args.rebuild and (args.height is None) != (args.digits is None):
        p.error("a rectangle needs --height and --digits together")
    if args.seeds is not None and args.digits is None:
        p.error(
            "--seeds names a rectangle's seed count: a square takes it positionally"
        )
    if args.rebuild:
        link_path, _ = lane.files(args.n, height=args.height)
        link = lane.rebuild(args.n, height=args.height)
        link_path.write_text(link + "\n")
        print(
            f"wrote {link_path.name} ({len(link)} chars) -- "
            "current component code, same board"
        )
        return
    if args.digits is not None:
        if args.box_height is not None:
            p.error("a rectangle names no box: pass n, --height and --digits")
        geo, count = (
            Geometry.rect(args.n, args.height, args.digits),
            (args.seeds or args.seed_count),
        )
    elif args.box_height is None or args.box_width is None:
        p.error("a fresh search needs n, box_height and box_width")
    else:
        geo = Geometry.square(args.n, args.box_height, args.box_width)
        count = args.seed_count
    lane.run(geo, range(101, 101 + count))
