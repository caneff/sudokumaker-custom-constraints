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

import link_codec
from framebuild import (
    LOCAL_RULES_SUFFIX,
    Board,
    Spec,
    board_files,
    build_doc,
    check,
    generate,
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
    return link_codec.encode_link(doc), doc


def test_check_passes_when_the_backend_registers_the_declared_component():
    with _spec(["FooComponent.js"]) as spec:
        link, doc = _build(spec)
        check(spec, link, doc, 4, local=False)


def test_check_catches_a_shipped_component_the_backend_never_registers():
    # the declared list carries a dead name the backend never registers with
    # `new`: the existing two checks both pass (names == want; registered is
    # a subset of shipped), so only the shipped-minus-registered assertion
    # catches it (#292)
    with _spec(["FooComponent.js", "BarComponent.js"]) as spec:
        link, doc = _build(spec)
        try:
            check(spec, link, doc, 4, local=False)
        except AssertionError as e:
            assert "BarComponent" in str(e), e
        else:
            raise AssertionError("a shipped, never-registered component was not caught")


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
        # the written link decodes, and passes the same check main ran
        check(spec, link, doc, n, local=False)
        # a cell holds a value only when it is a given: the shipped board must
        # never carry the solution or a hidden clue as an entered digit
        assert not [
            c for c in doc["puzzle"]["cells"] if "value" in c and not c.get("given")
        ]
        # the gen JSON reads back as the board the link ships
        board = load_board(gen_path)
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
            check(spec, link, doc, n, local=True)
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
    # `build_size.py 9 3 3 --rebuild` used to parse cleanly and quietly
    # re-encode, printing a success line for a search that never ran.
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
    test_rebuild_refuses_a_gen_json_that_moved_the_drawn_lines()
    test_main_refuses_a_rebuild_that_also_asks_for_a_fresh_search()
    test_rebuild_reproduces_a_committed_link_byte_for_byte()
    test_rebuild_refuses_a_gen_json_that_moved_the_board()
    test_main_rebuild_writes_the_committed_link_back()
    test_run_takes_its_arguments_and_never_reads_sys_argv()
    print("framebuild self-check OK")
