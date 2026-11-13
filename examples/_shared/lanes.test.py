# The three lanes (lanes.py) -- ring global, ring local and no ring
# (no_ring.py) -- each with its own document build and check: a lane's `files`
# names a board's two files, a lane's `rebuild` re-encodes a committed board
# against the code in the tree, and `main` is the command line every
# build_size.py ends with. These fixtures build a minimal doc via a lane's
# build_doc itself (a real n=4 board, one dummy component) rather than
# reconstructing the document shape by hand, so a case tracks the real builder
# instead of drifting from it.
#
#   uv run examples/_shared/lanes.test.py

import copy
import dataclasses
import json
import pathlib
import random
import sys
from unittest import mock

import no_ring
from board import Geometry, load_board, make_lines
from carve import make_paths, repeating_lines, unique
from document import LOCAL_RULES_SUFFIX, RULES_PREFIX
from frame_fixtures import (
    TOY,
    first_digit,
    make_board,
    post_first_digit,
    temp_spec,
    valid_sudoku,
)
from lanes import RingGlobal, RingLocal, lane_kinds, main
from minify import minify_file, minify_js
from no_ring import NoRing
from sudoku_kit import link_codec


def _build(spec, board=None):
    """A real board built through the global lane's `build_doc`: no drawn
    groups."""
    board = board or make_board()
    doc = RingGlobal(spec).build_doc(board)
    return link_codec.encode_link(doc), doc, board


def test_check_passes_when_the_backend_registers_the_declared_component():
    with temp_spec(["FooComponent.js"]) as spec:
        link, doc, board = _build(spec)
        RingGlobal(spec).check(link, doc, board)


def test_check_catches_a_link_that_does_not_decode_back_to_the_document():
    # the link is the built board's own, but the document it is checked
    # against differs in its name alone: every other check reads that
    # document and passes, so only the round trip catches it
    with temp_spec(["FooComponent.js"]) as spec:
        link, doc, board = _build(spec)
        renamed = copy.deepcopy(doc)
        renamed["puzzle"]["name"] += " (renamed)"
        try:
            RingGlobal(spec).check(link, renamed, board)
        except AssertionError as e:
            assert "round-trip" in str(e), e
        else:
            raise AssertionError("a link that does not round-trip was accepted")


def test_check_catches_a_shipped_component_the_backend_never_registers():
    # the declared list carries a dead name the backend never registers with
    # `new`: the other two checks both pass (names == want; registered is
    # a subset of shipped), so only the shipped-minus-registered assertion
    # catches it
    with temp_spec(["FooComponent.js", "BarComponent.js"]) as spec:
        link, doc, board = _build(spec)
        try:
            RingGlobal(spec).check(link, doc, board)
        except AssertionError as e:
            assert "BarComponent" in str(e), e
        else:
            raise AssertionError("a shipped, never-registered component was not caught")


def test_check_accepts_a_backend_that_reaches_for_a_built_in_component():
    # SudokuMaker provides the built-ins, so a backend that constructs one
    # ships no component file for it and the link is not missing anything.
    # `check_layout.check_components` says the same at the sweep seam; both
    # callers share `component_scan.mismatch`.
    with temp_spec(
        ["FooComponent.js"],
        main_global=(
            "puzzle.addConstraintComponent(new FooComponent())\n"
            "puzzle.addConstraintComponent(new PredefinedCandidatesComponent())"
        ),
    ) as spec:
        link, doc, board = _build(spec)
        RingGlobal(spec).check(link, doc, board)


def test_check_catches_a_document_that_is_not_the_board_s_size():
    # `check` takes the board the document was built from, so the size it
    # holds the document to comes from outside the document -- reading it back
    # out of the doc would make the comparison say nothing.
    with temp_spec(["FooComponent.js"]) as spec:
        link, doc, board = _build(spec)
        try:
            RingGlobal(spec).check(
                link, doc, dataclasses.replace(board, n=6, height=6, digits=6)
            )
        except AssertionError as e:
            assert "maxDigit" in str(e), e
        else:
            raise AssertionError("a document of the wrong size was not caught")


def test_each_ring_lane_s_check_holds_a_built_document_to_its_own_lane():
    with temp_spec(
        ["FooComponent.js", "BarComponent.js"],
        main_global=(
            "puzzle.addConstraintComponent(new FooComponent())\n"
            "puzzle.addConstraintComponent(new BarComponent())"
        ),
        local_components=["FooComponent.js"],
    ) as spec:
        board = make_board()
        for lane in (RingGlobal, RingLocal):
            doc = lane(spec).build_doc(board)
            lane(spec).check(link_codec.encode_link(doc), doc, board)

        # A build that stops telling the lanes apart -- the local lane
        # shipping the global lane's components, or running its backend -- is
        # caught, because check names the lane's own list and file itself
        # rather than asking the build.
        class SharedComponents(RingLocal):
            def components(self):
                return self.spec.components

        class SharedBackend(RingLocal):
            backend = "main-global.js"

        for broken, fault in (
            (SharedComponents, "wrong lane's components"),
            (SharedBackend, "wrong lane's backend"),
        ):
            doc = broken(spec).build_doc(board)
            try:
                broken(spec).check(link_codec.encode_link(doc), doc, board)
            except AssertionError as e:
                assert fault in str(e), e
            else:
                raise AssertionError(f"{broken.__name__}'s document passed")

        # the local lane's own fault: a line whose drawn group went missing
        doc = RingLocal(spec).build_doc(board)
        lc = next(
            c for c in doc["puzzle"]["constraints"] if c.get("name") == "Widget Lines"
        )
        lc["input"]["groups"].pop()
        try:
            RingLocal(spec).check(link_codec.encode_link(doc), doc, board)
        except AssertionError as e:
            assert "one drawn group per line" in str(e), e
        else:
            raise AssertionError("a local board missing a drawn group passed")


def test_a_lane_refuses_a_spec_of_another_kind():
    # A no-ring Spec's clues live only in its drawn groups, so no ring lane
    # may build it, and the no-ring lane builds nothing else. Its one lane
    # has no second component set either.
    with temp_spec(["FooComponent.js"], groups_fn=_column_markers) as spec:
        for lane in (RingGlobal, RingLocal):
            try:
                lane(spec)
            except ValueError as e:
                assert "builds no-ring only" in str(e), e
            else:
                raise AssertionError(f"{lane.__name__} took a no-ring Spec")
    with temp_spec(["FooComponent.js"]) as spec:
        try:
            NoRing(spec)
        except ValueError as e:
            assert "builds global, local only" in str(e), e
        else:
            raise AssertionError("NoRing took a ring Spec")
    with temp_spec(
        ["FooComponent.js"],
        groups_fn=_column_markers,
        local_components=["FooComponent.js"],
    ) as spec:
        try:
            NoRing(spec)
        except ValueError as e:
            assert "local_components" in str(e), e
        else:
            raise AssertionError("NoRing ignored a local_components it cannot ship")


def test_encode_returns_the_checked_link_and_refuses_one_check_rejects():
    class Unruled(RingGlobal):
        def build_doc(self, board):
            doc = super().build_doc(board)
            doc["puzzle"]["comment"] = "Rules. test rules"
            return doc

    with temp_spec(["FooComponent.js"]) as spec:
        board = make_board()
        link, doc = RingGlobal(spec).encode(board)
        assert link == link_codec.encode_link(doc)
        assert doc == RingGlobal(spec).build_doc(board)
        try:
            Unruled(spec).encode(board)
        except AssertionError as e:
            assert "Normal sudoku rules apply" in str(e), e
        else:
            raise AssertionError("encode returned a link check rejects")


def test_run_and_rebuild_check_the_link_before_writing_it():
    # The lanes' entry points, not only `check` called by hand: a lane whose
    # document drops the project sentence fails inside run and rebuild.
    class Unruled(RingGlobal):
        def build_doc(self, board):
            doc = super().build_doc(board)
            doc["puzzle"]["comment"] = "Rules. test rules"
            return doc

    n, bh, bw = 4, 2, 2
    fields = {"clue_fn": first_digit, "cp_sat_clue_fn": post_first_digit}
    with temp_spec(["FooComponent.js"], **fields) as spec:
        try:
            Unruled(spec).run(Geometry.square(n, bh, bw), range(101, 103))
        except AssertionError as e:
            assert "Normal sudoku rules apply" in str(e), e
        else:
            raise AssertionError("run wrote a link check rejects")
        assert not RingGlobal(spec).files(n)[0].exists()
    with temp_spec(["FooComponent.js"], **fields) as spec:
        main(spec, [str(n), str(bh), str(bw), "2"])
        try:
            Unruled(spec).rebuild(n)
        except AssertionError as e:
            assert "Normal sudoku rules apply" in str(e), e
        else:
            raise AssertionError("rebuild returned a link check rejects")


def test_build_doc_ships_no_house_gac_constraint_by_default():
    # `Spec.house_gac` defaults to no size, so every already-shipped link
    # stays byte-unchanged until a board opts in.
    with temp_spec(["FooComponent.js"]) as spec:
        _, doc, _ = _build(spec)
        names = [
            c.get("definition", {}).get("name") for c in doc["puzzle"]["constraints"]
        ]
        assert "House GAC" not in names


def test_build_doc_house_gac_wires_the_shared_filter_onto_every_house():
    # Opting in adds one more constraint: the shared house-gac.js backend,
    # carrying HouseGacComponent.js as its one component (the shape of
    # docs/research/408-house-gac/house_gac_links.py).
    with temp_spec(["FooComponent.js"], house_gac=frozenset({4})) as spec:
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
                "code": minify_file(shared / "HouseGacComponent.js"),
            }
        ]


def test_build_doc_refuses_house_gac_above_nine_cells():
    # HouseGacComponent.js refuses to register past a 9-cell house at setup
    # (MAX_CELLS); a board that would silently ship a house past that size
    # fails loud here instead, at build time.
    with temp_spec(["FooComponent.js"], house_gac=frozenset({10})) as spec:
        board = make_board(n=10, bh=2, bw=5)
        try:
            RingGlobal(spec).build_doc(board)
        except ValueError as e:
            assert "9-cell house cap" in str(e), e
        else:
            raise AssertionError("build_doc accepted a house_gac board above 9 cells")


def test_build_doc_house_gac_names_one_board_not_the_whole_example():
    # A Spec is shared by every size and both lanes a build_size.py builds
    # (lanes.main), so naming one size must not silently carry onto a
    # rebuild of another size or of the local lane: a plain bool would put
    # it on every rebuild of that example, sizes and lanes that were never
    # timed included.
    with temp_spec(["FooComponent.js"], house_gac=frozenset({4})) as spec:
        _, doc, _ = _build(spec, board=make_board(n=4))
        names = [
            c.get("definition", {}).get("name") for c in doc["puzzle"]["constraints"]
        ]
        assert "House GAC" in names

        _, other_size, _ = _build(spec, board=make_board(n=6, bh=2, bw=3))
        names = [
            c.get("definition", {}).get("name")
            for c in other_size["puzzle"]["constraints"]
        ]
        assert "House GAC" not in names

        local_doc = RingLocal(spec).build_doc(make_board(n=4))
        names = [
            c.get("definition", {}).get("name")
            for c in local_doc["puzzle"]["constraints"]
        ]
        assert "House GAC" not in names


def test_build_doc_leaves_the_frame_corners_empty():
    # A corner belongs to no line, no region and no cage, so a given is the
    # only thing the document itself could hold it down with -- and a given is
    # a digit the recipient reads off the board. The document leaves the
    # corners empty and the frame backend pins them instead.
    with temp_spec(["FooComponent.js"]) as spec:
        _, doc, board = _build(spec)
        W = board.n + 2
        corners = [0, W - 1, W * (W - 1), W * W - 1]
        assert [doc["puzzle"]["cells"][i] for i in corners] == [{}] * 4


def test_build_doc_declares_the_interior_rows_and_columns_in_its_backends():
    # A region constraint gives boxes only, so the interior lines have to be
    # declared somewhere or the board is not the puzzle it looks like.
    # They are declared in the frame backend, as named houses: a house carries
    # a name the app prints in its own step log, and costs nothing once its
    # ids are coerced. A document cage cannot carry one -- the app
    # hard-codes "the cage at <cell>" and duplicates it between row 1 and
    # column 1. This pins that the link runs both frame backends -- the ones
    # `frame-rowcol.test.mjs` and `frame-corners.test.mjs` cover -- and that no
    # cage is left claiming to do the job.
    with temp_spec(["FooComponent.js"]) as spec:
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
# is not. The shape up-to-n draws, which is all these cases need.
def _column_markers(board):
    return [
        ([(0, c), (1, c)], board.clue[("T", c)] if ("T", c) in board.active else None)
        for c in range(len(board.grid))
    ]


def _no_ring_board():
    return make_board(
        givens={(3, 3): 3},
        clue={("T", c): 10 + c for c in range(4)},
        active={("T", 0), ("T", 2)},
    )


def test_build_doc_without_a_ring_is_the_bare_grid_with_the_caller_s_groups():
    with temp_spec(["FooComponent.js"], groups_fn=_column_markers) as spec:
        board = _no_ring_board()
        p = NoRing(spec).build_doc(board)["puzzle"]
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
    with temp_spec(["FooComponent.js"], groups_fn=_column_markers) as spec:
        board = make_board(n=6, bh=2, bw=3, clue={("T", c): 0 for c in range(6)})
        p = NoRing(spec).build_doc(board)["puzzle"]
        assert _regions(p) == (
            [0, 0, 0, 1, 1, 1] * 2 + [2, 2, 2, 3, 3, 3] * 2 + [4, 4, 4, 5, 5, 5] * 2
        )


def test_clue_labels_refuse_a_group_they_cannot_place():
    # A label sits half a cell beyond a group's first cell, away from its
    # second, which only lands outside the grid for a marker's shape: two
    # cells with the first on the border. Anything else is refused rather
    # than drawn over the puzzle's own cells.
    n = 4
    assert no_ring.clue_labels([{"cells": [0, 4], "value": "3"}], n) is not None
    for cells, why in (
        ([5], "a one-cell group"),
        ([5, 9], "a group away from the border"),
        ([1, 0], "a border cell listed second"),
    ):
        try:
            no_ring.clue_labels([{"cells": cells, "value": "3"}], n)
        except ValueError as e:
            assert str(cells) in str(e), (why, e)
        else:
            raise AssertionError(f"labelled {why}")
    # an empty group is never labelled, so its shape is not this check's job
    assert no_ring.clue_labels([{"cells": [5], "value": ""}], n) is None


def test_build_doc_refuses_a_group_cell_off_the_grid():
    # (0, 5) on a 4x4 would encode as cell 5, which is (1, 1): a real cell the
    # caller never drew
    def off_grid(board):
        return [([(0, 3), (0, 5)], None)]

    with temp_spec(["FooComponent.js"], groups_fn=off_grid) as spec:
        try:
            NoRing(spec).build_doc(_no_ring_board())
        except ValueError as e:
            assert "(0, 5)" in str(e), e
        else:
            raise AssertionError("a group cell off the grid was encoded")


def test_build_doc_opens_the_rules_text_with_the_lane_s_prefix():
    with temp_spec(["FooComponent.js"]) as spec:
        _, doc, _ = _build(spec)
        assert doc["puzzle"]["comment"] == (
            "Normal sudoku rules apply on the inner grid. test rules"
        )
    # a no-ring board has no inner grid to name: the lane picks the sentence
    with temp_spec(["FooComponent.js"], groups_fn=_column_markers) as spec:
        doc = NoRing(spec).build_doc(_no_ring_board())
        assert doc["puzzle"]["comment"] == "Normal sudoku rules apply. test rules"


def _check_fails(spec, doc, board, fault):
    """`check` on `doc` raises an AssertionError naming `fault`."""
    try:
        NoRing(spec).check(link_codec.encode_link(doc), doc, board)
    except AssertionError as e:
        assert fault in str(e), e
    else:
        raise AssertionError(f"check passed a document with a fault: {fault}")


def test_check_accepts_a_no_ring_board_and_still_catches_its_faults():
    with temp_spec(
        ["FooComponent.js"],
        groups_fn=_column_markers,
    ) as spec:
        board = _no_ring_board()
        doc = NoRing(spec).build_doc(board)
        NoRing(spec).check(link_codec.encode_link(doc), doc, board)

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
    with temp_spec(
        ["FooComponent.js", "BarComponent.js"], groups_fn=_column_markers
    ) as spec:
        board = _no_ring_board()
        _check_fails(spec, NoRing(spec).build_doc(board), board, "BarComponent")


def test_main_builds_a_no_ring_spec_s_one_lane_under_any_flag():
    # A no-ring board's clues live only in its drawn groups, so it has one
    # lane: with or without --local, main builds the same no-ring board into
    # the same files.
    n, bh, bw = 4, 2, 2
    built = []
    for flags in ([], ["--local"]):
        with temp_spec(
            ["FooComponent.js"],
            clue_fn=first_digit,
            cp_sat_clue_fn=post_first_digit,
            groups_fn=_column_markers,
        ) as spec:
            assert lane_kinds(spec) == (NoRing,)
            main(spec, [str(n), str(bh), str(bw), "2", *flags])
            link_path, _ = NoRing(spec).files(n)
            p = link_codec.decode_puzzle(link_path.read_text().strip())["puzzle"]
            assert p["width"] == n, "the bare grid, no ring around it"
            built.append(link_path.read_text())
    assert built[0] == built[1]


def test_rebuild_reproduces_a_no_ring_link_and_guards_its_typed_clues():
    n, bh, bw = 4, 2, 2
    with temp_spec(
        ["FooComponent.js"],
        clue_fn=first_digit,
        cp_sat_clue_fn=post_first_digit,
        groups_fn=_column_markers,
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "2", "--local"])
        link_path, gen_path = NoRing(spec).files(n)
        assert NoRing(spec).rebuild(n) + "\n" == link_path.read_text()
        # The grid backend is code from the tree, not board data: a changed
        # grid-rowcol.js rebuilds into the new code instead of failing the
        # board comparison.
        real = no_ring.grid_backend_constraint

        def edited():
            c = real()
            c["definition"]["backend"]["code"] += ";"
            return c

        no_ring.grid_backend_constraint = edited
        try:
            relinked = link_codec.decode_puzzle(NoRing(spec).rebuild(n))
        finally:
            no_ring.grid_backend_constraint = real
        assert edited() in relinked["puzzle"]["constraints"]
        # A second board of the same size keeps its own named pair; `files`
        # points the rebuild at it instead of the size's default names.
        other_link = spec.dir / "PUZZLE_LINK_9x9.txt"
        other_gen = spec.dir / "gen_9x9.json"
        # The default pair moves away while the named one is rebuilt, so the
        # named pair is the only place the board can come from; the finally
        # puts it back when an assertion fails.
        link_path.rename(other_link)
        gen_path.rename(other_gen)
        try:
            files = (other_link, other_gen)
            assert NoRing(spec).rebuild(n, pair=files) + "\n" == other_link.read_text()
        finally:
            other_link.rename(link_path)
            other_gen.rename(gen_path)
        # The labels are drawn from the groups the rebuild already guards, so a
        # committed link without them rebuilds into one that has them rather
        # than failing the board comparison.
        old = link_codec.decode_puzzle(link_path.read_text().strip())
        old["puzzle"]["constraints"] = [
            c for c in old["puzzle"]["constraints"] if c.get("type") != 2002
        ]
        link_path.write_text(link_codec.encode_link(old) + "\n")
        relabelled = link_codec.decode_puzzle(NoRing(spec).rebuild(n))
        assert [c for c in relabelled["puzzle"]["constraints"] if c["type"] == 2002]
        # A no-ring board's shown clues live only in its groups' typed values:
        # hide one in the gen JSON and the rebuilt groups no longer match.
        g = json.loads(gen_path.read_text())
        g["active"] = [k for k in g["active"] if k != "T0"] + (
            [] if "T0" in g["active"] else ["T0"]
        )
        gen_path.write_text(json.dumps(g))
        try:
            NoRing(spec).rebuild(n)
        except AssertionError as e:
            assert "draws different lines" in str(e), e
        else:
            raise AssertionError("a no-ring board's typed clue moved without complaint")


def test_lane_files_plain_names_the_9x9_and_tags_every_other_size():
    with temp_spec(["FooComponent.js"]) as spec:
        d = spec.dir
        assert RingGlobal(spec).files(9) == (d / "PUZZLE_LINK.txt", d / "gen.json")
        assert RingLocal(spec).files(9) == (
            d / "PUZZLE_LINK_local.txt",
            d / "gen_local.json",
        )
        assert RingGlobal(spec).files(6) == (
            d / "PUZZLE_LINK_6x6.txt",
            d / "gen_6x6.json",
        )
        assert RingLocal(spec).files(6) == (
            d / "PUZZLE_LINK_6x6_local.txt",
            d / "gen_6x6_local.json",
        )
    # an example whose plain names belong to a different board (numbered-rooms,
    # running-start) keeps the 9x9 tag on the global lane -- and its local 9x9
    # is still the plain-named one, because nothing else claims those names
    with temp_spec(["FooComponent.js"], plain_global_9x9=False) as spec:
        d = spec.dir
        assert RingGlobal(spec).files(9) == (
            d / "PUZZLE_LINK_9x9.txt",
            d / "gen_9x9.json",
        )
        assert RingLocal(spec).files(9) == (
            d / "PUZZLE_LINK_local.txt",
            d / "gen_local.json",
        )
    # a no-ring example has one lane, so its names carry no lane tag: the 9x9
    # is plain-named and every other size is tagged by size alone
    with temp_spec(["FooComponent.js"], groups_fn=_column_markers) as spec:
        d = spec.dir
        assert NoRing(spec).files(9) == (
            d / "PUZZLE_LINK.txt",
            d / "gen.json",
        )
        assert NoRing(spec).files(4) == (
            d / "PUZZLE_LINK_4x4.txt",
            d / "gen_4x4.json",
        )


def test_main_generates_a_board_from_its_own_argv_and_writes_both_files():
    n, bh, bw = 4, 2, 2
    with temp_spec(
        ["FooComponent.js"], clue_fn=first_digit, cp_sat_clue_fn=post_first_digit
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "2"])
        link_path, gen_path = RingGlobal(spec).files(n)
        link = link_path.read_text().strip()
        doc = link_codec.decode_puzzle(link)
        board = load_board(gen_path)
        # the written link decodes, and passes the same check main ran
        RingGlobal(spec).check(link, doc, board)
        # a cell holds a value only when it is a given: the shipped board must
        # never carry the solution or a hidden clue as an entered digit
        assert not [
            c for c in doc["puzzle"]["cells"] if "value" in c and not c.get("given")
        ]
        # the gen JSON reads back as the board the link ships
        assert (board.bh, board.bw) == (bh, bw)
        assert valid_sudoku(board.grid, n, bh, bw)
        assert board.lines == make_lines(n), "a straight-frame run records no paths"
        assert unique(post_first_digit, board) is True, (
            "the recorded board must be the unique one main proved"
        )
        assert link_codec.encode_link(RingGlobal(spec).build_doc(board)) == link, (
            "rebuilding from the gen JSON must reproduce the written link"
        )


def test_main_builds_the_local_lane_under_either_flag_name():
    n, bh, bw = 4, 2, 2
    for flag in ("--paths", "--local"):
        with temp_spec(
            ["FooComponent.js"], clue_fn=first_digit, cp_sat_clue_fn=post_first_digit
        ) as spec:
            main(spec, [str(n), str(bh), str(bw), "4", flag])
            link_path, gen_path = RingLocal(spec).files(n)
            link = link_path.read_text().strip()
            doc = link_codec.decode_puzzle(link)
            RingLocal(spec).check(link, doc, load_board(gen_path))
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
    # no house. The Spec says so, not the caller.
    n, bh, bw = 4, 2, 2
    with temp_spec(
        ["FooComponent.js"],
        clue_fn=first_digit,
        cp_sat_clue_fn=post_first_digit,
        bent_lines=False,
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "2", "--local"])
        link_path, gen_path = RingLocal(spec).files(n)
        board = load_board(gen_path)
        assert board.lines == make_lines(n), "straight local lines, not bent paths"
        doc = link_codec.decode_puzzle(link_path.read_text().strip())
        assert LOCAL_RULES_SUFFIX not in doc["puzzle"]["comment"]


def test_the_rules_text_follows_the_board_not_the_spec():
    # The "a digit may repeat along it" sentence belongs to a board whose drawn
    # lines really bend. A Spec that GENERATES bent paths still must not put it
    # on a board whose recorded lines are the straight frame lines -- there the
    # lines are houses.
    with temp_spec(["FooComponent.js"]) as spec:
        assert spec.bent_lines
        straight = make_board()
        doc = RingLocal(spec).build_doc(straight)
        assert LOCAL_RULES_SUFFIX not in doc["puzzle"]["comment"]
        bent = dataclasses.replace(
            straight, lines=make_paths(random.Random(3), straight.n)
        )
        assert (
            LOCAL_RULES_SUFFIX in RingLocal(spec).build_doc(bent)["puzzle"]["comment"]
        )


def test_rebuild_names_the_file_it_cannot_find():
    # Both halves of a board have to be there, and a reader who ran the wrong
    # size or the wrong lane needs to be told which file is missing -- not a
    # bare traceback out of a read.
    n, bh, bw = 4, 2, 2
    with temp_spec(
        ["FooComponent.js"], clue_fn=first_digit, cp_sat_clue_fn=post_first_digit
    ) as spec:
        # no board of this size has been built at all
        try:
            RingGlobal(spec).rebuild(n)
        except AssertionError as e:
            assert RingGlobal(spec).files(n)[1].name in str(e), e
        else:
            raise AssertionError("a rebuild with no recorded board said nothing")

        main(spec, [str(n), str(bh), str(bw), "2"])
        link_path, _ = RingGlobal(spec).files(n)
        link_path.unlink()
        try:
            RingGlobal(spec).rebuild(n)
        except AssertionError as e:
            assert link_path.name in str(e), e
        else:
            raise AssertionError("a rebuild with no committed link said nothing")


def test_rebuild_refuses_a_gen_json_that_moved_the_drawn_lines():
    # On the local lane the drawn groups are the ONLY place the line geometry
    # reaches the document, and the frame comparison clears them -- so moving
    # the recorded paths has to be caught on its own.
    n, bh, bw = 4, 2, 2
    with temp_spec(
        ["FooComponent.js"], clue_fn=first_digit, cp_sat_clue_fn=post_first_digit
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "4", "--paths"])
        _, gen_path = RingLocal(spec).files(n)
        g = json.loads(gen_path.read_text())
        # bend one path somewhere else on the grid: the shown clues no longer
        # describe the cells the rebuilt link would draw
        key = sorted(g["paths"])[0]
        g["paths"][key] = list(reversed(g["paths"][key]))
        gen_path.write_text(json.dumps(g))
        try:
            RingLocal(spec).rebuild(n)
        except AssertionError as e:
            assert "draws different lines" in str(e), e
        else:
            raise AssertionError("a moved line geometry rebuilt without complaint")


def test_main_refuses_a_rebuild_that_also_asks_for_a_fresh_search():
    # A rebuild re-encodes a committed board; a box shape belongs to a fresh
    # search. Accepting both silently discards one and prints a success line
    # for a search that never ran.
    with temp_spec(["FooComponent.js"]) as spec:
        try:
            main(spec, ["4", "2", "2", "--rebuild"])
        except SystemExit as e:
            assert e.code != 0
        else:
            raise AssertionError("a rebuild carrying a box shape was accepted")


def test_rebuild_reproduces_a_committed_link_byte_for_byte():
    n, bh, bw = 4, 2, 2
    with temp_spec(
        ["FooComponent.js"], clue_fn=first_digit, cp_sat_clue_fn=post_first_digit
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "2"])
        link_path, _ = RingGlobal(spec).files(n)
        assert RingGlobal(spec).rebuild(n) + "\n" == link_path.read_text()


def test_rebuild_opts_a_board_into_house_gac_for_the_first_time():
    # A board that never carried House GAC turning it on is not board drift:
    # the guard must not read "new constraint appeared" as "the puzzle
    # changed".
    n, bh, bw = 4, 2, 2
    with temp_spec(
        ["FooComponent.js"], clue_fn=first_digit, cp_sat_clue_fn=post_first_digit
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "2"])
        opted_in = dataclasses.replace(spec, house_gac=frozenset({n}))
        link = RingGlobal(opted_in).rebuild(n)
        doc = link_codec.decode_puzzle(link)
        names = [
            c.get("definition", {}).get("name") for c in doc["puzzle"]["constraints"]
        ]
        assert "House GAC" in names


def test_rebuild_refuses_a_gen_json_that_moved_the_board():
    n, bh, bw = 4, 2, 2
    with temp_spec(
        ["FooComponent.js"], clue_fn=first_digit, cp_sat_clue_fn=post_first_digit
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "2"])
        _, gen_path = RingGlobal(spec).files(n)
        g = json.loads(gen_path.read_text())
        # drop one shown clue: the rebuilt board is a different puzzle, which
        # is exactly what a rebuild-from-seed must never quietly ship
        g["active"] = g["active"][1:]
        gen_path.write_text(json.dumps(g))
        try:
            RingGlobal(spec).rebuild(n)
        except AssertionError as e:
            assert "shown clues" in str(e), e
        else:
            raise AssertionError("a moved board rebuilt without complaint")


def test_main_rebuild_writes_the_committed_link_back():
    n, bh, bw = 4, 2, 2
    with temp_spec(
        ["FooComponent.js"], clue_fn=first_digit, cp_sat_clue_fn=post_first_digit
    ) as spec:
        main(spec, [str(n), str(bh), str(bw), "2"])
        link_path, _ = RingGlobal(spec).files(n)
        before = link_path.read_bytes()
        # a component edit reaches the shipped link, and nothing else moves
        (spec.dir / "FooComponent.js").write_text("class FooComponent { /* v2 */ }")
        main(spec, ["--rebuild", str(n)])
        after = link_path.read_bytes()
        assert after != before, "the rebuild must pick the working tree's code up"
        assert RingGlobal(spec).rebuild(n) + "\n" == after.decode()


def test_run_takes_its_arguments_and_never_reads_sys_argv():
    # `run` is the library entry point: `main` parses, `run` is handed values.
    # The process's own argv is set to something that would fail any parse,
    # so a `run` that read it would crash or build another board.
    n, bh, bw = 4, 2, 2
    with (
        temp_spec(
            ["FooComponent.js"], clue_fn=first_digit, cp_sat_clue_fn=post_first_digit
        ) as spec,
        mock.patch.object(sys, "argv", ["build_size.py", "not-a-size", "--bogus"]),
    ):
        RingGlobal(spec).run(Geometry.square(n, bh, bw), range(107, 109))
        link_path, gen_path = RingGlobal(spec).files(n)
        assert link_path.exists()
        # the seeds it searched are the ones it was handed, not a default range
        assert load_board(gen_path).seed in (107, 108)


def test_main_reads_the_process_argv_only_when_handed_none():
    # `main(spec)` is how every build_size.py calls it: argv comes from the
    # process. Handed a list it must ignore the process's.
    n, bh, bw = 4, 2, 2
    with temp_spec(
        ["FooComponent.js"], clue_fn=first_digit, cp_sat_clue_fn=post_first_digit
    ) as spec:
        with mock.patch.object(
            sys, "argv", ["build_size.py", str(n), str(bh), str(bw), "2"]
        ):
            main(spec)
        link_path, gen_path = RingGlobal(spec).files(n)
        assert link_path.exists() and load_board(gen_path).n == n
        link_path.unlink()
        with mock.patch.object(sys, "argv", ["build_size.py", "not-a-size"]):
            main(spec, [str(n), str(bh), str(bw), "2"])
        assert link_path.exists()


def test_build_doc_without_box_regions_or_rowcol_houses_declares_neither():
    with temp_spec(["FooComponent.js"], **TOY) as spec:
        _, doc, _ = _build(spec)
        constraints = doc["puzzle"]["constraints"]
        assert not [c for c in constraints if c.get("type") == 1], "box regions"
        names = [c.get("definition", {}).get("name") for c in constraints]
        assert "Frame Rows and Columns" not in names
        # the corners stay pinned: no line, region or house reaches them
        assert "Frame Corners" in names


def test_rebuild_reproduces_a_non_sudoku_interior_link():
    n, bh, bw = 4, 2, 2
    with temp_spec(["FooComponent.js"], **TOY) as spec:
        main(spec, [str(n), str(bh), str(bw), "2"])
        link_path, _ = RingGlobal(spec).files(n)
        assert RingGlobal(spec).rebuild(n) + "\n" == link_path.read_text()


def test_a_ring_spec_s_own_rules_prefix_replaces_the_sudoku_sentence():
    # A non-sudoku interior has no sudoku rules to name: its Spec opens the
    # rules text itself, and the lane's check holds the link to that opening.
    with temp_spec(["FooComponent.js"], rules_prefix="", **TOY) as spec:
        lane = RingGlobal(spec)
        link, doc, board = _build(spec)
        assert doc["puzzle"]["comment"] == spec.comment_fn(board.n)
        lane.check(link, doc, board)
    with temp_spec(["FooComponent.js"]) as spec:
        assert spec.rules_prefix is None
        _, doc, _ = _build(spec)
        assert doc["puzzle"]["comment"].startswith(RULES_PREFIX)


if __name__ == "__main__":
    test_a_ring_spec_s_own_rules_prefix_replaces_the_sudoku_sentence()
    test_build_doc_without_box_regions_or_rowcol_houses_declares_neither()
    test_rebuild_reproduces_a_non_sudoku_interior_link()
    test_check_passes_when_the_backend_registers_the_declared_component()
    test_check_catches_a_link_that_does_not_decode_back_to_the_document()
    test_check_catches_a_shipped_component_the_backend_never_registers()
    test_check_catches_a_document_that_is_not_the_board_s_size()
    test_check_accepts_a_backend_that_reaches_for_a_built_in_component()
    test_build_doc_leaves_the_frame_corners_empty()
    test_build_doc_declares_the_interior_rows_and_columns_in_its_backends()
    test_build_doc_ships_no_house_gac_constraint_by_default()
    test_build_doc_house_gac_wires_the_shared_filter_onto_every_house()
    test_build_doc_refuses_house_gac_above_nine_cells()
    test_build_doc_house_gac_names_one_board_not_the_whole_example()
    test_build_doc_without_a_ring_is_the_bare_grid_with_the_caller_s_groups()
    test_build_doc_without_a_ring_numbers_wide_boxes_across_the_row()
    test_clue_labels_refuse_a_group_they_cannot_place()
    test_build_doc_refuses_a_group_cell_off_the_grid()
    test_build_doc_opens_the_rules_text_with_the_lane_s_prefix()
    test_check_accepts_a_no_ring_board_and_still_catches_its_faults()
    test_main_builds_a_no_ring_spec_s_one_lane_under_any_flag()
    test_each_ring_lane_s_check_holds_a_built_document_to_its_own_lane()
    test_a_lane_refuses_a_spec_of_another_kind()
    test_encode_returns_the_checked_link_and_refuses_one_check_rejects()
    test_run_and_rebuild_check_the_link_before_writing_it()
    test_rebuild_reproduces_a_no_ring_link_and_guards_its_typed_clues()
    test_lane_files_plain_names_the_9x9_and_tags_every_other_size()
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
    test_main_reads_the_process_argv_only_when_handed_none()
    print("lanes self-check OK")
