"""The shared Renbanana encodings, one behaviour at a time (#663).

    uv run --with ortools finders/renbanana/tools/test_renbanana_model.py

Each encoding is pinned to a small board and the solver's verdict read back:
a legal pin must solve, an illegal one must be INFEASIBLE (a proof, not a
timeout -- the status is compared by name). The last test checks that the
hunt and the four probes use these definitions rather than their own copies.
"""

import sys
from pathlib import Path

from ortools.sat.python import cp_model as cp

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import renbanana_model as rm
import renbanana_verify as rv

DATA_ROOT = Path(__file__).resolve().parents[3] / "docs" / "research" / "renbanana"


def status_of(m):
    s = cp.CpSolver()
    s.parameters.max_time_in_seconds = 30
    s.parameters.num_workers = 1
    return s.status_name(s.solve(m))


def digits_and_shading():
    m = cp.CpModel()
    d = {p: m.new_int_var(1, 9, f"d{p}") for p in rm.CELLS}
    choc = {p: m.new_bool_var(f"c{p}") for p in rm.CELLS}
    return m, d, choc


def pin(m, choc, chocolate):
    for p in rm.CELLS:
        m.add(choc[p] == (1 if p in chocolate else 0))


def test_sudoku():
    path = sorted(DATA_ROOT.glob("candidates*/cand_*.json"))[0]
    grid, _, _ = rv.load(path)
    m, d, _ = digits_and_shading()
    rm.sudoku(m, d)
    for p in rm.CELLS:
        m.add(d[p] == grid[p])
    assert status_of(m) == "OPTIMAL"
    m, d, _ = digits_and_shading()
    rm.sudoku(m, d)
    m.add(d[0, 0] == 4)
    m.add(d[0, 8] == 4)  # same row
    assert status_of(m) == "INFEASIBLE"
    m, d, _ = digits_and_shading()
    rm.sudoku(m, d)
    m.add(d[0, 0] == 4)
    m.add(d[2, 2] == 4)  # same box
    assert status_of(m) == "INFEASIBLE"


def test_rectangle_lemma():
    block = {(0, 0), (0, 1), (1, 0), (1, 1)}
    m, _, choc = digits_and_shading()
    rm.rectangle_lemma(m, choc)
    pin(m, choc, block)
    assert status_of(m) == "OPTIMAL"
    m, _, choc = digits_and_shading()
    rm.rectangle_lemma(m, choc)
    pin(m, choc, block - {(1, 1)})  # an L: three of a 2x2 window
    assert status_of(m) == "INFEASIBLE"


def test_whisper():
    pair = {(4, 4), (4, 5)}
    for lo, hi, want in (
        (3, 4, "INFEASIBLE"),
        (3, 7, "INFEASIBLE"),  # a gap of 4: the boundary
        (2, 7, "OPTIMAL"),
    ):
        m, d, choc = digits_and_shading()
        rm.whisper(m, d, choc)
        pin(m, choc, pair)
        m.add(d[4, 4] == lo)
        m.add(d[4, 5] == hi)
        assert status_of(m) == want, (lo, hi)
    m, d, choc = digits_and_shading()  # banana neighbours are unconstrained
    rm.whisper(m, d, choc)
    pin(m, choc, set())
    m.add(d[4, 4] == 3)
    m.add(d[4, 5] == 4)
    assert status_of(m) == "OPTIMAL"


def test_whisper_on_a_fixed_shading():
    is_choc = dict.fromkeys(rm.CELLS, False) | {(4, 4): True, (4, 5): True}
    for lo, hi, want in (
        (3, 4, "INFEASIBLE"),
        (3, 7, "INFEASIBLE"),  # a gap of 4: the boundary
        (2, 7, "OPTIMAL"),
    ):
        m, d, _ = digits_and_shading()
        rm.whisper_on_shading(m, d, is_choc)
        m.add(d[4, 4] == lo)
        m.add(d[4, 5] == hi)
        assert status_of(m) == want, (lo, hi)


def test_maximal_rectangle_literals():
    """Chocolate 2x2 inside, banana border: all literals hold; a chocolate
    border cell breaks it."""
    block = {(3, 3), (3, 4), (4, 3), (4, 4)}
    border = set(rm.border_of(2, 2, 3, 3))
    assert len(border) == 8
    for extra, want in ((set(), "OPTIMAL"), ({(2, 3)}, "INFEASIBLE")):
        m, _, choc = digits_and_shading()
        for lit in rm.maximal_chocolate_lits(choc, 2, 2, 3, 3):
            m.add(lit == 1)
        pin(m, choc, block | extra)
        assert status_of(m) == want, extra


def test_forbid_banana_rectangles():
    m, _, choc = digits_and_shading()
    rm.forbid_banana_rectangles(m, choc)
    pin(m, choc, set())  # all banana: one 9x9 rectangle
    assert status_of(m) == "INFEASIBLE"
    m, _, choc = digits_and_shading()
    rm.forbid_banana_rectangles(m, choc)
    pin(m, choc, {(0, 0)})  # banana minus a corner: not a rectangle
    assert status_of(m) == "OPTIMAL"


def test_banana_labels():
    m, _, choc = digits_and_shading()
    lab = rm.banana_labels(m, choc)
    pin(m, choc, {(0, 0)})
    s = cp.CpSolver()
    s.parameters.num_workers = 1
    assert s.solve(m) == cp.OPTIMAL
    held = {
        p: [e for e in range(rm.IDX[p] + 1) if s.value(lab[p, e])] for p in rm.CELLS
    }
    assert held[0, 0] == []  # chocolate carries no label
    assert all(len(held[p]) == 1 for p in rm.CELLS if p != (0, 0))
    assert held[0, 1] == held[1, 1] == held[1, 0]  # banana neighbours share it


def test_encodings_have_one_definition():
    """The hunt and the probes reuse these objects, they do not carry copies."""
    import max_house_circles
    import probe_circle_pattern
    import probe_inverted
    import prove_pair
    import renbanana_cpsat

    for mod in (
        renbanana_cpsat,
        probe_inverted,
        prove_pair,
        probe_circle_pattern,
        max_house_circles,
    ):
        assert mod.CELLS is rm.CELLS, mod.__name__
        assert getattr(mod, "ADJACENT", rm.ADJACENT) is rm.ADJACENT, mod.__name__
    assert not hasattr(renbanana_cpsat, "neighbours")  # rv.neighbours is the one


if __name__ == "__main__":
    test_sudoku()
    test_rectangle_lemma()
    test_whisper()
    test_whisper_on_a_fixed_shading()
    test_maximal_rectangle_literals()
    test_forbid_banana_rectangles()
    test_banana_labels()
    test_encodings_have_one_definition()
    print("OK")
