# framebuild's generator half (make_grid, make_paths, unique, generate, run),
# its check, and the board lane the examples drive: `board_files` names a
# board's two files, `save_board`/`load_board` are its round trip, `rebuild`
# re-encodes a committed board against the code in the tree, and `main` is the
# command line every build_size.py ends with. These fixtures build a minimal
# doc via build_doc itself (a real n=4 board, one dummy component) rather than
# reconstructing framebuild's document shape by hand, so a case tracks the
# real builder instead of drifting from it. n=4 throughout: every uniqueness
# proof is a real CP-SAT double solve, and a 4x4 keeps `just check` in the
# tens of milliseconds.
#
#   uv run --with lzstring --with ortools examples/_shared/framebuild.test.py

import contextlib
import dataclasses
import itertools
import json
import pathlib
import random
import tempfile

import framebuild
import link_codec
from framebuild import (
    LOCAL_RULES_SUFFIX,
    Board,
    Spec,
    board_files,
    build_doc,
    check,
    generate,
    house_gac_constraint,
    load_board,
    main,
    make_grid,
    make_lines,
    make_paths,
    rebuild,
    repeating_lines,
    run,
    save_board,
    unique,
)
from minify import minify_js


@contextlib.contextmanager
def _spec(
    components,
    main_global="puzzle.addConstraintComponent(new FooComponent())",
    clue_fn=None,
    cp_sat_clue_fn=None,
    **fields,
):
    """A minimal Spec backed by a temp example dir: `main.js` /
    `main-global.js` plus one `FooComponent.js` and one `BarComponent.js`
    file (content unused by `check`; only the backend files' text matters).
    `components` names the global lane's own declared list.
    """
    with tempfile.TemporaryDirectory() as tmp:
        d = pathlib.Path(tmp)
        (d / "main.js").write_text("puzzle.addConstraintComponent(new FooComponent())")
        (d / "main-global.js").write_text(main_global)
        (d / "FooComponent.js").write_text("class FooComponent {}")
        (d / "BarComponent.js").write_text("class BarComponent {}")
        yield Spec(
            dir=d,
            title="Widget",
            constraint_name="Widget Lines",
            components=components,
            min_digit=1,
            clue_fn=clue_fn or (lambda values, cells, box: 0),
            cp_sat_clue_fn=cp_sat_clue_fn or (lambda *a, **k: None),
            comment_fn=lambda n: "test rules",
            **fields,
        )


# A real, solver-backed clue rule for the generator cases: the clue is the
# digit in the cell nearest the clue, read inward. Trivial as a puzzle, but a
# genuine constraint on the model -- which is all generate()/unique() need, and
# it reads the same on a straight frame line and on a bent path.
def _first_digit(values, cells, box):
    return values[0]


def _post_first_digit(m, x, cells, kk, n, tag, box):
    m.Add(x[cells[0]] == kk)


def _valid_sudoku(grid, n, bh, bw):
    """True when every row, column and box of `grid` holds 1..n once."""
    want = set(range(1, n + 1))
    if any(set(row) != want for row in grid):
        return False
    if any({grid[r][c] for r in range(n)} != want for c in range(n)):
        return False
    return all(
        {grid[br + dr][bc + dc] for dr in range(bh) for dc in range(bw)} == want
        for br in range(0, n, bh)
        for bc in range(0, n, bw)
    )


def _board(n=4, bh=2, bw=2, **fields):
    """A real n x n board value: a valid grid, no givens, every ring clue
    shown -- unit fixtures only, this board is never shared, so the "leave
    most of the ring blank" rule for a shared board does not apply here.
    """
    grid = [[((r * bw + r // bh + c) % n) + 1 for c in range(n)] for r in range(n)]
    lines = make_lines(n)
    return dataclasses.replace(
        Board(
            n=n,
            bh=bh,
            bw=bw,
            grid=grid,
            clue=dict.fromkeys(lines, 0),
            givens={},
            active=set(lines),
            lines=lines,
        ),
        **fields,
    )


def _build(spec, board=None):
    """A real board built through `build_doc`, no drawn groups (global lane)."""
    board = board or _board()
    doc = build_doc(spec, board, local=False)
    return link_codec.encode_link(doc), doc, board


def test_check_passes_when_the_backend_registers_the_declared_component():
    with _spec(["FooComponent.js"]) as spec:
        link, doc, board = _build(spec)
        check(spec, link, doc, board, local=False)


def test_check_catches_a_shipped_component_the_backend_never_registers():
    # the declared list carries a dead name the backend never registers with
    # `new`: the existing two checks both pass (names == want; registered is
    # a subset of shipped), so only the shipped-minus-registered assertion
    # catches it (#292)
    with _spec(["FooComponent.js", "BarComponent.js"]) as spec:
        link, doc, board = _build(spec)
        try:
            check(spec, link, doc, board, local=False)
        except AssertionError as e:
            assert "BarComponent" in str(e), e
        else:
            raise AssertionError("a shipped, never-registered component was not caught")


def test_check_accepts_a_backend_that_reaches_for_a_built_in_component():
    # SudokuMaker provides the built-ins, so a backend that constructs one
    # ships no component file for it and the link is not missing anything.
    # `check_layout.check_components` says the same at the sweep seam; the two
    # copies of this rule have to agree (#394).
    with _spec(
        ["FooComponent.js"],
        main_global=(
            "puzzle.addConstraintComponent(new FooComponent())\n"
            "puzzle.addConstraintComponent(new PredefinedCandidatesComponent())"
        ),
    ) as spec:
        link, doc, board = _build(spec)
        check(spec, link, doc, board, local=False)


def test_check_catches_a_document_that_is_not_the_board_s_size():
    # `check` takes the board the document was built from, so the size it
    # holds the document to comes from outside the document -- reading it back
    # out of the doc would make the comparison say nothing.
    with _spec(["FooComponent.js"]) as spec:
        link, doc, board = _build(spec)
        try:
            check(spec, link, doc, dataclasses.replace(board, n=6), local=False)
        except AssertionError as e:
            assert "maxDigit" in str(e), e
        else:
            raise AssertionError("a document of the wrong size was not caught")


def test_build_doc_ships_no_house_gac_constraint_by_default():
    # `Spec.house_gac` defaults False, so every already-shipped link stays
    # byte-unchanged until a board opts in (#421).
    with _spec(["FooComponent.js"]) as spec:
        _, doc, _ = _build(spec)
        names = [
            c.get("definition", {}).get("name") for c in doc["puzzle"]["constraints"]
        ]
        assert "House GAC" not in names


def test_build_doc_house_gac_wires_the_shared_filter_onto_every_house():
    # Opting in adds one more constraint: the shared house-gac.js backend,
    # carrying HouseGacComponent.js as its one component (#421, following
    # docs/research/408-house-gac/house_gac_links.py's shape).
    with _spec(["FooComponent.js"], house_gac=frozenset({4})) as spec:
        _, doc, _ = _build(spec)
        gac = next(
            c
            for c in doc["puzzle"]["constraints"]
            if c.get("definition", {}).get("name") == "House GAC"
        )
        shared = pathlib.Path(__file__).parent
        assert gac["definition"]["backend"]["code"] == minify_js(
            (shared / "house-gac.js").read_text()
        )
        assert gac["definition"]["components"] == [
            {
                "type": "code",
                "name": "HouseGacComponent",
                "code": minify_js((shared / "HouseGacComponent.js").read_text()),
            }
        ]


def test_build_doc_refuses_house_gac_above_nine_cells():
    # HouseGacComponent.js refuses to register past a 9-cell house at setup
    # (MAX_CELLS); a board that would silently ship a house past that size
    # fails loud here instead, at build time (#421).
    with _spec(["FooComponent.js"], house_gac=frozenset({10})) as spec:
        board = _board(n=10, bh=2, bw=5)
        try:
            build_doc(spec, board, local=False)
            raise AssertionError("build_doc accepted a house_gac board above 9 cells")
        except ValueError as e:
            assert "9" in str(e)


def test_house_gac_constraint_refuses_above_nine_cells_on_its_own():
    # build_doc's own cap check (test above) is not the only caller: a
    # hand-built board (running-start/build_link.py's build_from_template)
    # appends `house_gac_constraint()` directly, bypassing build_doc
    # entirely, so the cap has to live in the one function every caller goes
    # through, not just in build_doc (#421 review round 1).
    house_gac_constraint(9)  # does not raise
    try:
        house_gac_constraint(10)
        raise AssertionError("house_gac_constraint accepted n=10")
    except ValueError as e:
        assert "9" in str(e)


def test_build_doc_house_gac_names_one_board_not_the_whole_example():
    # A Spec is shared by every size and both lanes a build_size.py builds
    # (framebuild.main), so naming one size must not silently carry onto a
    # rebuild of another size or of the local lane -- a real bug caught in
    # review (#421): the same Spec's 9x9 was measured and shipped, but a
    # plain bool put it on every rebuild of that example, sizes and lanes
    # that were never timed included.
    with _spec(["FooComponent.js"], house_gac=frozenset({4})) as spec:
        _, doc, _ = _build(spec, board=_board(n=4))
        names = [
            c.get("definition", {}).get("name") for c in doc["puzzle"]["constraints"]
        ]
        assert "House GAC" in names

        _, other_size, _ = _build(spec, board=_board(n=6, bh=2, bw=3))
        names = [
            c.get("definition", {}).get("name")
            for c in other_size["puzzle"]["constraints"]
        ]
        assert "House GAC" not in names

        local_doc = build_doc(spec, _board(n=4), local=True)
        names = [
            c.get("definition", {}).get("name")
            for c in local_doc["puzzle"]["constraints"]
        ]
        assert "House GAC" not in names


def test_build_doc_leaves_the_frame_corners_empty():
    # A corner belongs to no line, no region and no cage, so a given is the
    # only thing the document itself could hold it down with -- and a given is
    # a digit the recipient reads off the board. The document leaves the
    # corners empty and the frame backend pins them instead (#394).
    with _spec(["FooComponent.js"]) as spec:
        _, doc, board = _build(spec)
        W = board.n + 2
        corners = [0, W - 1, W * (W - 1), W * W - 1]
        assert [doc["puzzle"]["cells"][i] for i in corners] == [{}] * 4


def test_build_doc_declares_the_interior_rows_and_columns_in_its_backends():
    # A region constraint gives boxes only, so the interior lines have to be
    # declared somewhere or the board is not the puzzle it looks like (#335).
    # They are declared in the frame backend, as named houses: a house carries
    # a name the app prints in its own step log, and costs nothing once its
    # ids are coerced (#394). A document cage cannot carry one -- the app
    # hard-codes "the cage at <cell>" and duplicates it between row 1 and
    # column 1. This pins that the link runs both frame backends -- the ones
    # `frame-rowcol.test.mjs` and `frame-corners.test.mjs` cover -- and that no
    # cage is left claiming to do the job.
    with _spec(["FooComponent.js"]) as spec:
        _, doc, _ = _build(spec)
        backends = [
            c.get("definition", {}).get("backend", {}).get("code", "")
            for c in doc["puzzle"]["constraints"]
        ]
        shared = pathlib.Path(__file__).parent
        for name in ("frame-rowcol.js", "frame-corners.js"):
            assert minify_js((shared / name).read_text()) in backends, (
                f"the link does not run {name}"
            )
        assert not [c for c in doc["puzzle"]["constraints"] if c.get("type") == 301], (
            "the interior lines are declared twice: as houses and as cages"
        )


# A no-ring caller's groups: a two-cell marker at the top of every column,
# typed with that column's clue when the clue is shown and left empty when it
# is not. The shape up-to-n draws (#366), which is all these cases need.
def _column_markers(board):
    return [
        ([(0, c), (1, c)], board.clue[("T", c)] if ("T", c) in board.active else None)
        for c in range(len(board.grid))
    ]


def _no_ring_board():
    return _board(
        givens={(3, 3): 3},
        clue={("T", c): 10 + c for c in range(4)},
        active={("T", 0), ("T", 2)},
    )


def test_build_doc_without_a_ring_is_the_bare_grid_with_the_caller_s_groups():
    with _spec(["FooComponent.js"], groups_fn=_column_markers) as spec:
        board = _no_ring_board()
        p = build_doc(spec, board, local=True)["puzzle"]
        assert (p["width"], p["height"]) == (4, 4), "no ring cells around the grid"
        assert len(p["cells"]) == 16
        # cell ids are row * n + column: the given at (3, 3) is the last cell
        assert p["cells"][15] == {"value": 3, "given": True}
        assert p["cells"][:15] == [{}] * 15
        assert _regions(p) == [0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 3, 3, 2, 2, 3, 3]
        lc = next(c for c in p["constraints"] if c.get("name") == "Widget Lines")
        assert lc["input"]["groups"] == [
            {"cells": [0, 4], "value": "10"},
            {"cells": [1, 5], "value": ""},
            {"cells": [2, 6], "value": "12"},
            {"cells": [3, 7], "value": ""},
        ]
        # A "custom" document, which the live editor opens at its own size (a
        # "sudoku" one opens as 9x9 whatever its width says --
        # docs/research/368-up-to-n-setup-throw.md). Its region constraint
        # gives boxes only, so the rows and columns come from the whole-grid
        # backend (docs/gotchas.md #9). The frame's own backends would strip a
        # ring that is not there and pin four real cells as corners, so
        # neither ships.
        assert p["type"] == "custom"
        names = [c.get("definition", {}).get("name") for c in p["constraints"]]
        assert names == [None, None, "Grid Rows and Columns", "Widget Lines", None], (
            names
        )
        grid = p["constraints"][2]["definition"]
        shared = pathlib.Path(__file__).parent
        assert grid["backend"]["code"] == minify_js(
            (shared / "grid-rowcol.js").read_text()
        )
        assert grid["components"] == [], "it registers built-in houses only"
        assert not [c for c in p["constraints"] if c.get("type") == 301], (
            "no cage outlines: the lines are houses, not drawn cages"
        )
        # A drawn group renders nothing, so each clued group gets a text label:
        # one cosmetic symbol per shown clue, half a cell outside the grid
        # beyond the group's first cell, reading the group's own value. The
        # markers at the top of columns 1 and 3 are clued 10 and 12; the two
        # empty ones get none (docs/research/368-up-to-n-setup-throw.md).
        labels = p["constraints"][4]
        assert labels["type"] == 2002
        assert labels["symbols"] == [[0.5, -0.5], [2.5, -0.5, 1]]
        assert [q["type"] for q in labels["params"]] == ["text", "text"]
        assert [q["text"] for q in labels["params"]] == ["10", "12"]


def _regions(puzzle):
    return next(c["regions"] for c in puzzle["constraints"] if "regions" in c)


def test_build_doc_without_a_ring_numbers_wide_boxes_across_the_row():
    # 2x3 boxes on a 6x6: two rows tall, three columns wide, so a square-box
    # board cannot tell box height from box width
    with _spec(["FooComponent.js"], groups_fn=_column_markers) as spec:
        board = _board(n=6, bh=2, bw=3, clue={("T", c): 0 for c in range(6)})
        p = build_doc(spec, board, local=True)["puzzle"]
        assert _regions(p) == (
            [0, 0, 0, 1, 1, 1] * 2 + [2, 2, 2, 3, 3, 3] * 2 + [4, 4, 4, 5, 5, 5] * 2
        )


def test_build_doc_refuses_a_group_cell_off_the_grid():
    # (0, 5) on a 4x4 would encode as cell 5, which is (1, 1): a real cell the
    # caller never drew
    def off_grid(board):
        return [([(0, 3), (0, 5)], None)]

    with _spec(["FooComponent.js"], groups_fn=off_grid) as spec:
        try:
            build_doc(spec, _no_ring_board(), local=True)
        except ValueError as e:
            assert "(0, 5)" in str(e), e
        else:
            raise AssertionError("a group cell off the grid was encoded")


def test_build_doc_opens_the_rules_text_with_the_spec_s_prefix():
    with _spec(["FooComponent.js"]) as spec:
        _, doc, _ = _build(spec)
        assert doc["puzzle"]["comment"] == (
            "Normal sudoku rules apply on the inner grid. test rules"
        )
    with _spec(["FooComponent.js"], rules_prefix="Normal sudoku rules apply. ") as spec:
        _, doc, _ = _build(spec)
        assert doc["puzzle"]["comment"] == "Normal sudoku rules apply. test rules"
    with _spec(
        ["FooComponent.js"],
        groups_fn=_column_markers,
        rules_prefix="Normal sudoku rules apply. ",
    ) as spec:
        doc = build_doc(spec, _no_ring_board(), local=True)
        assert doc["puzzle"]["comment"] == "Normal sudoku rules apply. test rules"


def _check_fails(spec, doc, board, fault):
    """`check` on `doc` raises an AssertionError naming `fault`."""
    try:
        check(spec, link_codec.encode_link(doc), doc, board, local=True)
    except AssertionError as e:
        assert fault in str(e), e
    else:
        raise AssertionError(f"check passed a document with a fault: {fault}")


def test_check_accepts_a_no_ring_board_and_still_catches_its_faults():
    with _spec(
        ["FooComponent.js"],
        groups_fn=_column_markers,
        rules_prefix="Normal sudoku rules apply. ",
    ) as spec:
        board = _no_ring_board()
        doc = build_doc(spec, board, local=True)
        check(spec, link_codec.encode_link(doc), doc, board, local=True)

        # the same faults `check` rejects on a ring board
        wrong_range = json.loads(json.dumps(doc))
        wrong_range["puzzle"]["maxDigit"] = 9
        _check_fails(spec, wrong_range, board, "maxDigit")
        entered = json.loads(json.dumps(doc))
        entered["puzzle"]["cells"][0] = {"value": 2}
        _check_fails(spec, entered, board, "non-given cell")
        unprefixed = json.loads(json.dumps(doc))
        unprefixed["puzzle"]["comment"] = "test rules"
        _check_fails(spec, unprefixed, board, "required sentence")
        dropped = json.loads(json.dumps(doc))
        lc = next(
            c
            for c in dropped["puzzle"]["constraints"]
            if c.get("name") == "Widget Lines"
        )
        lc["input"]["groups"].pop()
        _check_fails(spec, dropped, board, "drawn group")
        # a group's typed value is a shown clue: a changed one is a changed
        # puzzle, not a changed count
        retyped = json.loads(json.dumps(doc))
        lc = next(
            c
            for c in retyped["puzzle"]["constraints"]
            if c.get("name") == "Widget Lines"
        )
        lc["input"]["groups"][0]["value"] = "11"
        _check_fails(spec, retyped, board, "drawn group")
        # the labels are the groups' values drawn: a label that says something
        # else, or a missing one, is a board that shows the wrong clue
        relabelled = json.loads(json.dumps(doc))
        next(c for c in relabelled["puzzle"]["constraints"] if c.get("type") == 2002)[
            "params"
        ][0]["text"] = "11"
        _check_fails(spec, relabelled, board, "label")
        unlabelled = json.loads(json.dumps(doc))
        unlabelled["puzzle"]["constraints"] = [
            c for c in unlabelled["puzzle"]["constraints"] if c.get("type") != 2002
        ]
        _check_fails(spec, unlabelled, board, "label")
        # its rows and columns are only houses while it carries the grid
        # backend in the tree: dropped or stale, the board is boxes only
        for fault in ("dropped", "stale"):
            broken = json.loads(json.dumps(doc))
            cons = broken["puzzle"]["constraints"]
            i = next(
                i
                for i, c in enumerate(cons)
                if c.get("definition", {}).get("name") == "Grid Rows and Columns"
            )
            if fault == "dropped":
                del cons[i]
            else:
                cons[i]["definition"]["backend"]["code"] += ";"
            _check_fails(spec, broken, board, "grid-rowcol.js")
    # the Spec chooses the sentence, but not one without the project rule
    with _spec(
        ["FooComponent.js"], groups_fn=_column_markers, rules_prefix="Rules. "
    ) as spec:
        board = _no_ring_board()
        _check_fails(
            spec, build_doc(spec, board, local=True), board, "Normal sudoku rules apply"
        )
    with _spec(
        ["FooComponent.js", "BarComponent.js"], groups_fn=_column_markers
    ) as spec:
        board = _no_ring_board()
        _check_fails(spec, build_doc(spec, board, local=True), board, "BarComponent")


def test_build_doc_refuses_a_no_ring_board_on_the_global_lane():
    # The global lane reads no drawn groups, and a no-ring board's clues live
    # nowhere else: built that way it would ship a board with no clues at all.
    with _spec(["FooComponent.js"], groups_fn=_column_markers) as spec:
        try:
            build_doc(spec, _no_ring_board(), local=False)
        except ValueError as e:
            assert "local=True" in str(e), e
        else:
            raise AssertionError("a no-ring board built on the global lane")


def test_main_refuses_a_no_ring_global_lane_before_searching():
    # The refusal costs nothing only if it comes first: a 9x9 search is
    # minutes of CP-SAT spent on a board that is then thrown away.
    def searched(*args):
        raise AssertionError("the search ran before the lane was refused")

    with _spec(
        ["FooComponent.js"], groups_fn=_column_markers, cp_sat_clue_fn=searched
    ) as spec:
        try:
            main(spec, ["4", "2", "2", "2"])
        except ValueError as e:
            assert "local=True" in str(e), e
        else:
            raise AssertionError("a no-ring board ran on the global lane")
        assert not board_files(spec, 4)[1].exists()


def test_rebuild_reproduces_a_no_ring_link_and_guards_its_typed_clues():
    n, bh, bw = 4, 2, 2
    with _spec(
        ["FooComponent.js"],
        clue_fn=_first_digit,
        cp_sat_clue_fn=_post_first_digit,
        groups_fn=_column_markers,
        rules_prefix="Normal sudoku rules apply. ",
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "2", "--local"])
        link_path, gen_path = board_files(spec, n, local=True)
        assert rebuild(spec, n, local=True) + "\n" == link_path.read_text()
        # The grid backend is code from the tree, not board data: a changed
        # grid-rowcol.js rebuilds into the new code instead of failing the
        # board comparison.
        real = framebuild.grid_backend_constraint

        def edited():
            c = real()
            c["definition"]["backend"]["code"] += ";"
            return c

        framebuild.grid_backend_constraint = edited
        try:
            relinked = link_codec.decode_puzzle(rebuild(spec, n, local=True))
        finally:
            framebuild.grid_backend_constraint = real
        assert edited() in relinked["puzzle"]["constraints"]
        # A second board of the same size keeps its own named pair; `files`
        # points the rebuild at it instead of the size's default names.
        other_link = spec.dir / "PUZZLE_LINK_9x9.txt"
        other_gen = spec.dir / "gen_9x9.json"
        link_path.rename(other_link)
        gen_path.rename(other_gen)
        files = (other_link, other_gen)
        assert (
            rebuild(spec, n, local=True, files=files) + "\n" == other_link.read_text()
        )
        other_link.rename(link_path)
        other_gen.rename(gen_path)
        # The labels are drawn from the groups the rebuild already guards, so
        # a committed link written before them rebuilds into one that has
        # them rather than failing the board comparison.
        old = link_codec.decode_puzzle(link_path.read_text().strip())
        old["puzzle"]["constraints"] = [
            c for c in old["puzzle"]["constraints"] if c.get("type") != 2002
        ]
        link_path.write_text(link_codec.encode_link(old) + "\n")
        relabelled = link_codec.decode_puzzle(rebuild(spec, n, local=True))
        assert [c for c in relabelled["puzzle"]["constraints"] if c["type"] == 2002]
        # A no-ring board's shown clues live only in its groups' typed values:
        # hide one in the gen JSON and the rebuilt groups no longer match.
        g = json.loads(gen_path.read_text())
        g["active"] = [k for k in g["active"] if k != "T0"] + (
            [] if "T0" in g["active"] else ["T0"]
        )
        gen_path.write_text(json.dumps(g))
        try:
            rebuild(spec, n, local=True)
        except AssertionError as e:
            assert "draws different lines" in str(e), e
        else:
            raise AssertionError("a no-ring board's typed clue moved without complaint")


def test_make_grid_is_a_real_sudoku_reproducible_from_its_seed():
    for seed in (1, 7, 101):
        g = make_grid(random.Random(seed), 6, 2, 3)
        assert _valid_sudoku(g, 6, 2, 3), f"seed {seed} is not a valid sudoku"
    assert make_grid(random.Random(5), 4, 2, 2) == make_grid(random.Random(5), 4, 2, 2)
    assert make_grid(random.Random(5), 4, 2, 2) != make_grid(random.Random(6), 4, 2, 2)


def test_make_paths_draws_one_bent_l_per_ring_key():
    n = 6
    paths = make_paths(random.Random(3), n)
    assert set(paths) == set(make_lines(n)), "a path per ring key, same keys"
    for key, cells in paths.items():
        assert len(cells) == n, f"{key} has {len(cells)} cells, want {n}"
        assert len(set(cells)) == n, f"{key} visits a cell twice"
        assert all(0 <= r < n and 0 <= c < n for r, c in cells), (
            f"{key} leaves the grid"
        )
        # a straight run inward, then exactly one turn: two distinct steps in
        # all, and the second never reverses the first
        steps = {(b[0] - a[0], b[1] - a[1]) for a, b in itertools.pairwise(cells)}
        assert len(steps) == 2, f"{key} is straight or turns twice: {steps}"
        (d1, d2) = steps
        assert d1 != (-d2[0], -d2[1]), f"{key} doubles back"
        assert len({r for r, _ in cells}) > 1 and len({c for _, c in cells}) > 1, (
            f"{key} is a straight line, not a bent path"
        )
    # the clue's own cell starts the path, so a clue reads its line inward
    for (side, i), cells in paths.items():
        assert (
            cells[0]
            == {
                "L": (i, 0),
                "R": (i, n - 1),
                "T": (0, i),
                "B": (n - 1, i),
            }[side]
        ), (side, i)


def test_unique_is_the_cp_sat_double_solve():
    n, bh, bw = 4, 2, 2
    lines = make_lines(n)
    grid = make_grid(random.Random(11), n, bh, bw)
    bare = Board(
        n=n,
        bh=bh,
        bw=bw,
        grid=grid,
        clue=dict.fromkeys(lines, 0),
        givens={},
        active=set(),
        lines=lines,
    )
    # a bare 4x4 with no givens and no clues has many solutions
    assert unique(_post_first_digit, bare) is False
    # every cell given: exactly one solution
    full = {(r, c): grid[r][c] for r in range(n) for c in range(n)}
    assert unique(_post_first_digit, dataclasses.replace(bare, givens=full)) is True
    # an infeasible model (a given contradicting its own row) is neither: None,
    # so the carve loop cannot read "no solution" as "unique"
    broken = dict(full)
    broken[(0, 1)] = broken[(0, 0)]
    assert unique(_post_first_digit, dataclasses.replace(bare, givens=broken)) is None
    # the clues alone do work: the whole ring pinned makes the border cells
    # given, and dropping every clue on the same givens loses uniqueness
    clue = {k: grid[cells[0][0]][cells[0][1]] for k, cells in lines.items()}
    clued = dataclasses.replace(bare, clue=clue)
    assert unique(
        _post_first_digit, dataclasses.replace(clued, active=set(lines))
    ) != unique(_post_first_digit, clued), "the active clue set must change the answer"


def test_generate_carves_a_unique_and_minimal_board():
    n, bh, bw = 4, 2, 2
    with _spec(
        ["FooComponent.js"], clue_fn=_first_digit, cp_sat_clue_fn=_post_first_digit
    ) as spec:
        board = generate(spec, n, bh, bw, range(101, 104))
        assert board.seed in range(101, 104)
        assert (board.n, board.bh, board.bw) == (n, bh, bw)
        assert _valid_sudoku(board.grid, n, bh, bw)
        # every clue is read off the solution, never invented
        for k, cells in board.lines.items():
            assert board.clue[k] == _first_digit(
                [board.grid[r][c] for r, c in cells], cells, (bh, bw)
            ), k
        # the carved board is unique...
        assert unique(_post_first_digit, board) is True
        # ...and minimal in both directions: put any dropped clue's line back
        # out, or any given back out, and it stops being unique
        for k in sorted(board.active):
            fewer = dataclasses.replace(board, active=board.active - {k})
            assert not unique(_post_first_digit, fewer), (
                f"clue {k} is not load-bearing -- generate left a redundant clue"
            )
        for cell in sorted(board.givens):
            fewer = dataclasses.replace(
                board, givens={c: v for c, v in board.givens.items() if c != cell}
            )
            assert not unique(_post_first_digit, fewer), (
                f"given {cell} is not load-bearing -- generate left a redundant given"
            )

        # paths=True draws bent paths instead of frame lines, and keeps only a
        # seed whose lines repeat a digit -- the property that makes the board
        # a bare-line fixture rather than a frame board in disguise
        bent = generate(spec, n, bh, bw, range(101, 106), paths=True)
        assert repeating_lines(bent.grid, bent.lines), (
            "a paths board must repeat a digit"
        )
        assert unique(_post_first_digit, bent) is True

    # a rule whose clues constrain nothing forces the other half of generate:
    # the interior-given carve, which the clue-only board above never reaches
    with _spec(["FooComponent.js"]) as spec:  # clue_fn 0, cp_sat posts nothing
        board = generate(spec, n, bh, bw, range(101, 103))
        assert board.givens, "a board its clues cannot pin needs interior givens"
        assert unique(spec.cp_sat_clue_fn, board)
        for cell in sorted(board.givens):
            fewer = dataclasses.replace(
                board, givens={c: v for c, v in board.givens.items() if c != cell}
            )
            assert not unique(spec.cp_sat_clue_fn, fewer), (
                f"given {cell} is not load-bearing -- generate left a redundant given"
            )


def test_board_files_plain_names_the_9x9_and_tags_every_other_size():
    with _spec(["FooComponent.js"]) as spec:
        d = spec.dir
        assert board_files(spec, 9) == (d / "PUZZLE_LINK.txt", d / "gen.json")
        assert board_files(spec, 9, local=True) == (
            d / "PUZZLE_LINK_local.txt",
            d / "gen_local.json",
        )
        assert board_files(spec, 6) == (d / "PUZZLE_LINK_6x6.txt", d / "gen_6x6.json")
        assert board_files(spec, 6, local=True) == (
            d / "PUZZLE_LINK_6x6_local.txt",
            d / "gen_6x6_local.json",
        )
    # an example whose plain names belong to a different board (numbered-rooms,
    # running-start) keeps the 9x9 tag on the global lane -- and its local 9x9
    # is still the plain-named one, because nothing else claims those names
    with _spec(["FooComponent.js"], plain_global_9x9=False) as spec:
        d = spec.dir
        assert board_files(spec, 9) == (d / "PUZZLE_LINK_9x9.txt", d / "gen_9x9.json")
        assert board_files(spec, 9, local=True) == (
            d / "PUZZLE_LINK_local.txt",
            d / "gen_local.json",
        )
    # a no-ring example has one lane, so its names carry no lane tag: the 9x9
    # is plain-named and every other size is tagged by size alone (#370)
    with _spec(["FooComponent.js"], groups_fn=_column_markers) as spec:
        d = spec.dir
        assert board_files(spec, 9, local=True) == (
            d / "PUZZLE_LINK.txt",
            d / "gen.json",
        )
        assert board_files(spec, 4, local=True) == (
            d / "PUZZLE_LINK_4x4.txt",
            d / "gen_4x4.json",
        )


def test_save_board_and_load_board_round_trip_a_frame_board():
    with tempfile.TemporaryDirectory() as tmp:
        path = pathlib.Path(tmp) / "gen.json"
        board = dataclasses.replace(_board(), seed=101, givens={(0, 0): 1})
        save_board(board, path)
        back = load_board(path)
        assert back == board
        # the ring keys survive the JSON's flat "T3" spelling, parsed in one
        # place: load_board
        assert ("T", 3) in back.clue and ("L", 0) in back.active
        # a straight-frame board records no geometry -- its lines are the ones
        # n implies
        assert "paths" not in json.loads(path.read_text())


def test_save_board_records_bent_geometry_and_load_board_reads_it_back():
    with tempfile.TemporaryDirectory() as tmp:
        path = pathlib.Path(tmp) / "gen_local.json"
        n = 6
        lines = make_paths(random.Random(3), n)
        board = dataclasses.replace(_board(n=6, bh=2, bw=3), lines=lines)
        save_board(board, path)
        assert "paths" in json.loads(path.read_text())
        back = load_board(path)
        assert back.lines == lines != make_lines(n)
        assert back == board


def test_main_generates_a_board_from_its_own_argv_and_writes_both_files():
    n, bh, bw = 4, 2, 2
    with _spec(
        ["FooComponent.js"], clue_fn=_first_digit, cp_sat_clue_fn=_post_first_digit
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "2"])
        link_path, gen_path = board_files(spec, n)
        link = link_path.read_text().strip()
        doc = link_codec.decode_puzzle(link)
        board = load_board(gen_path)
        # the written link decodes, and passes the same check main ran
        check(spec, link, doc, board, local=False)
        # a cell holds a value only when it is a given: the shipped board must
        # never carry the solution or a hidden clue as an entered digit
        assert not [
            c for c in doc["puzzle"]["cells"] if "value" in c and not c.get("given")
        ]
        # the gen JSON reads back as the board the link ships
        assert (board.bh, board.bw) == (bh, bw)
        assert _valid_sudoku(board.grid, n, bh, bw)
        assert board.lines == make_lines(n), "a straight-frame run records no paths"
        assert unique(_post_first_digit, board) is True, (
            "the recorded board must be the unique one main proved"
        )
        assert link_codec.encode_link(build_doc(spec, board, local=False)) == link, (
            "rebuilding from the gen JSON must reproduce the written link"
        )


def test_main_builds_the_local_lane_under_either_flag_name():
    n, bh, bw = 4, 2, 2
    for flag in ("--paths", "--local"):
        with _spec(
            ["FooComponent.js"], clue_fn=_first_digit, cp_sat_clue_fn=_post_first_digit
        ) as spec:
            main(spec, [str(n), str(bh), str(bw), "4", flag])
            link_path, gen_path = board_files(spec, n, local=True)
            link = link_path.read_text().strip()
            doc = link_codec.decode_puzzle(link)
            check(spec, link, doc, load_board(gen_path), local=True)
            assert not [
                c for c in doc["puzzle"]["cells"] if "value" in c and not c.get("given")
            ]
            # the local board records its generated geometry -- a bent path is
            # not derivable from n
            board = load_board(gen_path)
            assert board.lines != make_lines(n), f"{flag} must record bent paths"
            assert repeating_lines(board.grid, board.lines), (
                "the recorded board must repeat a digit"
            )


def test_a_spec_whose_local_lines_stay_straight_draws_the_frame():
    # outside-sudoku's shape: its rule needs a direction, so its local board
    # draws the straight frame lines and its rules text must not say a line is
    # no house (#268). The Spec says so, not the caller.
    n, bh, bw = 4, 2, 2
    with _spec(
        ["FooComponent.js"],
        clue_fn=_first_digit,
        cp_sat_clue_fn=_post_first_digit,
        bent_lines=False,
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "2", "--local"])
        link_path, gen_path = board_files(spec, n, local=True)
        board = load_board(gen_path)
        assert board.lines == make_lines(n), "straight local lines, not bent paths"
        doc = link_codec.decode_puzzle(link_path.read_text().strip())
        assert LOCAL_RULES_SUFFIX not in doc["puzzle"]["comment"]


def test_the_rules_text_follows_the_board_not_the_spec():
    # The "a digit may repeat along it" sentence belongs to a board whose drawn
    # lines really bend. A Spec that GENERATES bent paths still must not put it
    # on a board whose recorded lines are the straight frame lines -- there the
    # lines are houses (#268).
    with _spec(["FooComponent.js"]) as spec:
        assert spec.bent_lines
        straight = _board()
        doc = build_doc(spec, straight, local=True)
        assert LOCAL_RULES_SUFFIX not in doc["puzzle"]["comment"]
        bent = dataclasses.replace(
            straight, lines=make_paths(random.Random(3), straight.n)
        )
        assert (
            LOCAL_RULES_SUFFIX in build_doc(spec, bent, local=True)["puzzle"]["comment"]
        )


def test_rebuild_names_the_file_it_cannot_find():
    # Both halves of a board have to be there, and a reader who ran the wrong
    # size or the wrong lane needs to be told which file is missing -- not a
    # bare traceback out of a read.
    n, bh, bw = 4, 2, 2
    with _spec(
        ["FooComponent.js"], clue_fn=_first_digit, cp_sat_clue_fn=_post_first_digit
    ) as spec:
        # no board of this size has been built at all
        try:
            rebuild(spec, n)
        except AssertionError as e:
            assert board_files(spec, n)[1].name in str(e), e
        else:
            raise AssertionError("a rebuild with no recorded board said nothing")

        main(spec, [str(n), str(bh), str(bw), "2"])
        link_path, _ = board_files(spec, n)
        link_path.unlink()
        try:
            rebuild(spec, n)
        except AssertionError as e:
            assert link_path.name in str(e), e
        else:
            raise AssertionError("a rebuild with no committed link said nothing")


def test_rebuild_refuses_a_gen_json_that_moved_the_drawn_lines():
    # On the local lane the drawn groups are the ONLY place the line geometry
    # reaches the document, and the frame comparison clears them -- so moving
    # the recorded paths has to be caught on its own.
    n, bh, bw = 4, 2, 2
    with _spec(
        ["FooComponent.js"], clue_fn=_first_digit, cp_sat_clue_fn=_post_first_digit
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "4", "--paths"])
        _, gen_path = board_files(spec, n, local=True)
        g = json.loads(gen_path.read_text())
        # bend one path somewhere else on the grid: the shown clues no longer
        # describe the cells the rebuilt link would draw
        key = sorted(g["paths"])[0]
        g["paths"][key] = list(reversed(g["paths"][key]))
        gen_path.write_text(json.dumps(g))
        try:
            rebuild(spec, n, local=True)
        except AssertionError as e:
            assert "draws different lines" in str(e), e
        else:
            raise AssertionError("a moved line geometry rebuilt without complaint")


def test_main_refuses_a_rebuild_that_also_asks_for_a_fresh_search():
    # A rebuild re-encodes a committed board; a box shape belongs to a fresh
    # search. Accepting both silently discards one and prints a success line
    # for a search that never ran.
    with _spec(["FooComponent.js"]) as spec:
        try:
            main(spec, ["4", "2", "2", "--rebuild"])
        except SystemExit as e:
            assert e.code != 0
        else:
            raise AssertionError("a rebuild carrying a box shape was accepted")


def test_rebuild_reproduces_a_committed_link_byte_for_byte():
    n, bh, bw = 4, 2, 2
    with _spec(
        ["FooComponent.js"], clue_fn=_first_digit, cp_sat_clue_fn=_post_first_digit
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "2"])
        link_path, _ = board_files(spec, n)
        assert rebuild(spec, n) + "\n" == link_path.read_text()


def test_rebuild_opts_a_board_into_house_gac_for_the_first_time():
    # A board that never carried House GAC turning it on is not board drift:
    # the guard must not read "new constraint appeared" as "the puzzle
    # changed" (#421).
    n, bh, bw = 4, 2, 2
    with _spec(
        ["FooComponent.js"], clue_fn=_first_digit, cp_sat_clue_fn=_post_first_digit
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "2"])
        opted_in = dataclasses.replace(spec, house_gac=frozenset({n}))
        link = rebuild(opted_in, n)
        doc = link_codec.decode_puzzle(link)
        names = [
            c.get("definition", {}).get("name") for c in doc["puzzle"]["constraints"]
        ]
        assert "House GAC" in names


def test_rebuild_refuses_a_gen_json_that_moved_the_board():
    n, bh, bw = 4, 2, 2
    with _spec(
        ["FooComponent.js"], clue_fn=_first_digit, cp_sat_clue_fn=_post_first_digit
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "2"])
        _, gen_path = board_files(spec, n)
        g = json.loads(gen_path.read_text())
        # drop one shown clue: the rebuilt board is a different puzzle, which
        # is exactly what a rebuild-from-seed must never quietly ship
        g["active"] = g["active"][1:]
        gen_path.write_text(json.dumps(g))
        try:
            rebuild(spec, n)
        except AssertionError as e:
            assert "shown clues" in str(e), e
        else:
            raise AssertionError("a moved board rebuilt without complaint")


def test_main_rebuild_writes_the_committed_link_back():
    n, bh, bw = 4, 2, 2
    with _spec(
        ["FooComponent.js"], clue_fn=_first_digit, cp_sat_clue_fn=_post_first_digit
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "2"])
        link_path, _ = board_files(spec, n)
        before = link_path.read_bytes()
        # a component edit reaches the shipped link, and nothing else moves
        (spec.dir / "FooComponent.js").write_text("class FooComponent { /* v2 */ }")
        main(spec, ["--rebuild", str(n)])
        after = link_path.read_bytes()
        assert after != before, "the rebuild must pick the working tree's code up"
        assert rebuild(spec, n) + "\n" == after.decode()


def test_run_takes_its_arguments_and_never_reads_sys_argv():
    # `run` is the library entry point: `main` parses, `run` is handed values.
    n, bh, bw = 4, 2, 2
    with _spec(
        ["FooComponent.js"], clue_fn=_first_digit, cp_sat_clue_fn=_post_first_digit
    ) as spec:
        run(spec, n, bh, bw, range(107, 109))
        link_path, gen_path = board_files(spec, n)
        assert link_path.exists()
        # the seeds it searched are the ones it was handed, not a default range
        assert load_board(gen_path).seed in (107, 108)


if __name__ == "__main__":
    test_check_passes_when_the_backend_registers_the_declared_component()
    test_check_catches_a_shipped_component_the_backend_never_registers()
    test_check_catches_a_document_that_is_not_the_board_s_size()
    test_check_accepts_a_backend_that_reaches_for_a_built_in_component()
    test_build_doc_leaves_the_frame_corners_empty()
    test_build_doc_declares_the_interior_rows_and_columns_in_its_backends()
    test_build_doc_ships_no_house_gac_constraint_by_default()
    test_build_doc_house_gac_wires_the_shared_filter_onto_every_house()
    test_build_doc_refuses_house_gac_above_nine_cells()
    test_house_gac_constraint_refuses_above_nine_cells_on_its_own()
    test_build_doc_house_gac_names_one_board_not_the_whole_example()
    test_build_doc_without_a_ring_is_the_bare_grid_with_the_caller_s_groups()
    test_build_doc_without_a_ring_numbers_wide_boxes_across_the_row()
    test_build_doc_refuses_a_group_cell_off_the_grid()
    test_build_doc_opens_the_rules_text_with_the_spec_s_prefix()
    test_check_accepts_a_no_ring_board_and_still_catches_its_faults()
    test_build_doc_refuses_a_no_ring_board_on_the_global_lane()
    test_main_refuses_a_no_ring_global_lane_before_searching()
    test_rebuild_reproduces_a_no_ring_link_and_guards_its_typed_clues()
    test_make_grid_is_a_real_sudoku_reproducible_from_its_seed()
    test_make_paths_draws_one_bent_l_per_ring_key()
    test_unique_is_the_cp_sat_double_solve()
    test_generate_carves_a_unique_and_minimal_board()
    test_board_files_plain_names_the_9x9_and_tags_every_other_size()
    test_save_board_and_load_board_round_trip_a_frame_board()
    test_save_board_records_bent_geometry_and_load_board_reads_it_back()
    test_main_generates_a_board_from_its_own_argv_and_writes_both_files()
    test_main_builds_the_local_lane_under_either_flag_name()
    test_a_spec_whose_local_lines_stay_straight_draws_the_frame()
    test_the_rules_text_follows_the_board_not_the_spec()
    test_rebuild_names_the_file_it_cannot_find()
    test_rebuild_opts_a_board_into_house_gac_for_the_first_time()
    test_rebuild_refuses_a_gen_json_that_moved_the_drawn_lines()
    test_main_refuses_a_rebuild_that_also_asks_for_a_fresh_search()
    test_rebuild_reproduces_a_committed_link_byte_for_byte()
    test_rebuild_refuses_a_gen_json_that_moved_the_board()
    test_main_rebuild_writes_the_committed_link_back()
    test_run_takes_its_arguments_and_never_reads_sys_argv()
    print("framebuild self-check OK")
