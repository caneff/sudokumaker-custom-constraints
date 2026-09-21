"""Read the QQRR opener, run the model on it, and say what it found.

`load_opener` turns the decoded link (`opener.json`) into an `Opener`, the
classification `OPENER_NOTES.md` records: a circled rank mark is a clue, an
uncircled one a hypothesis, an entered digit a hypothesis, the cage a clue.
`run` builds the model for one corner and one hypothesis setting, then
solves, forbids and solves again up to `count` times; every grid it returns
has been re-ranked by `oracle.py` and matched against the model's own rank
variables. `render` prints the verdict with the grid and all three tables.
"""

import json
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import model
import oracle

from examples._shared import cpsat

CORNERS = {"tl": (0, 0), "tr": (0, 8), "bl": (8, 0), "br": (8, 8)}
CORNER_RANK = 5  # Chris: a QQRR clue of 5 sits in one corner, corner undecided.
CIRCLES = "QR Circles"
WINDOW_MARKS = "QR Ranks"
CELL_CAGES = "QQRR Ranks"


@dataclass
class Opener:
    n: int
    window_clues: dict  # window top-left (row, col) -> (lo, hi) rank band
    cell_clues: dict  # cell (row, col) -> QQRR value
    window_hypotheses: dict  # window top-left -> (lo, hi), fixed only with --hypotheses
    digit_hypotheses: dict  # cell -> digit, fixed only with --hypotheses


@dataclass
class Solution:
    grid: list
    window_ranks: list
    cell_numbers: list
    cell_ranks: list


@dataclass
class Report:
    status: str  # infeasible | unique | multiple | timeout
    solutions: list
    seconds: float
    corner: str | None
    hypotheses: bool
    count: int
    note: str = ""
    checks: list = field(default_factory=list)


def parse_band(text, top):
    """'10' -> (10, 10); '51-56' -> (51, 56); '58+' -> (58, top)."""
    text = text.strip()
    if text.endswith("+"):
        return int(text[:-1]), top
    if "-" in text:
        lo, hi = text.split("-")
        return int(lo), int(hi)
    return int(text), int(text)


def load_opener(path):
    doc = json.loads(Path(path).read_text())["puzzle"]
    cells = doc["cells"]
    n = int(len(cells) ** 0.5)
    assert n * n == len(cells)
    top = (n - 1) ** 2
    by_name = {c.get("name"): c for c in doc["constraints"]}
    circled = {(y, x) for x, y, *_ in by_name[CIRCLES]["symbols"]}
    marks = by_name[WINDOW_MARKS]
    window_clues, window_hypotheses = {}, {}
    for x, y, *rest in marks["symbols"]:
        text = marks["params"][rest[0] if rest else 0]["text"]
        band = parse_band(text, top)
        (window_clues if (y, x) in circled else window_hypotheses)[(y, x)] = band
    cell_clues = {}
    for cage in by_name[CELL_CAGES]["cages"]:
        (i,) = cage["cells"]
        cell_clues[divmod(i, n)] = int(cage["value"])
    digit_hypotheses = {
        divmod(i, n): c["value"]
        for i, c in enumerate(cells)
        if "value" in c and not c.get("given")
    }
    return Opener(n, window_clues, cell_clues, window_hypotheses, digit_hypotheses)


def run(op, corner, hypotheses, count, workers, timeout, on_solution=None):
    """Solve the opener under one corner pin and one hypothesis setting.

    `corner` is a CORNERS key or None. With `hypotheses` the entered digits
    and uncircled marks are fixed; without it they are solution hints. Stops
    at `count` solutions, or when CP-SAT proves there is no next one, or when
    `timeout` seconds have elapsed across the whole loop.
    """
    n = op.n
    ranked = list(op.cell_clues)
    if corner is not None and CORNERS[corner] not in ranked:
        ranked.append(CORNERS[corner])
    q = model.build(n, ranked_cells=ranked)
    m = q.m
    for (wr, wc), (lo, hi) in op.window_clues.items():
        m.AddLinearConstraint(q.rank[wr][wc], lo, hi)
    for cell, value in op.cell_clues.items():
        m.Add(q.q[cell] == value)
    if corner is not None:
        m.Add(q.q[CORNERS[corner]] == CORNER_RANK)
    if hypotheses:
        for (r, c), d in op.digit_hypotheses.items():
            m.Add(q.x[r][c] == d)
        for (wr, wc), (lo, hi) in op.window_hypotheses.items():
            m.AddLinearConstraint(q.rank[wr][wc], lo, hi)
    else:
        for (r, c), d in op.digit_hypotheses.items():
            m.AddHint(q.x[r][c], d)
        for (wr, wc), (lo, hi) in op.window_hypotheses.items():
            if lo == hi:
                m.AddHint(q.rank[wr][wc], lo)

    cells = {(r, c): q.x[r][c] for r in range(n) for c in range(n)}
    start = time.monotonic()
    deadline = start + timeout
    solutions = []
    status = None
    while len(solutions) < count:
        s = cpsat.solver(max(deadline - time.monotonic(), 0.0), reproducible=False)
        s.parameters.num_workers = workers
        result = s.Solve(m)
        if result == cpsat.UNKNOWN:
            status = "timeout"
            break
        if result not in cpsat.SOLVED:
            status = ["infeasible", "unique", "multiple"][min(len(solutions), 2)]
            break
        sol = _extract(s, q, ranked)
        solutions.append(sol)
        if on_solution:
            on_solution(sol, len(solutions))
        cpsat.forbid(
            m,
            cells,
            {rc: sol.grid[rc[0]][rc[1]] for rc in cells},
            tag=str(len(solutions)),
        )
    if status is None:
        status = "multiple"
    note = ""
    if status == "multiple" and len(solutions) == count:
        note = f"at least {count} solutions (count capped at {count})"
    elif status == "multiple":
        note = f"exactly {len(solutions)} solutions"
    elif status == "timeout":
        note = f"{len(solutions)} solutions found before the {timeout:.0f}s ceiling; no verdict"
    return Report(
        status, solutions, time.monotonic() - start, corner, hypotheses, count, note
    )


def _extract(s, q, ranked):
    """Read the grid back and assert the model's ranks are the oracle's."""
    n = q.n
    grid = [[s.Value(q.x[r][c]) for c in range(n)] for r in range(n)]
    ranks, numbers, cranks = oracle.rank_grid(grid)
    got_ranks = [[s.Value(v) for v in row] for row in q.rank]
    got_numbers = [[s.Value(v) for v in row] for row in q.num]
    got_q = {cell: s.Value(v) for cell, v in q.q.items()}
    if got_ranks != ranks:
        raise AssertionError(
            f"model window ranks disagree with the oracle:\n{got_ranks}\n{ranks}"
        )
    if got_numbers != numbers:
        raise AssertionError(
            f"model cell numbers disagree with the oracle:\n{got_numbers}\n{numbers}"
        )
    for (r, c), v in got_q.items():
        if v != cranks[r][c]:
            raise AssertionError(
                f"model cell rank at {(r, c)} is {v}, oracle says {cranks[r][c]}"
            )
    return Solution(grid, ranks, numbers, cranks)


def _table(rows, width):
    return "\n".join(" ".join(str(v).rjust(width) for v in row) for row in rows)


def render_solution(sol, index):
    return "\n".join(
        [
            f"solution {index}",
            _table(sol.grid, 1),
            "window ranks (by top-left cell)",
            _table(sol.window_ranks, 2),
            "cell numbers",
            _table(sol.cell_numbers, 8),
            "cell ranks",
            _table(sol.cell_ranks, 2),
        ]
    )


def render(report):
    head = (
        f"{report.status}: corner={report.corner or 'none'} hypotheses={'on' if report.hypotheses else 'off'} "
        f"count<={report.count} {report.seconds:.1f}s"
    )
    parts = [head + (f" -- {report.note}" if report.note else "")]
    for i, sol in enumerate(report.solutions, 1):
        parts.append(render_solution(sol, i))
    return "\n".join(parts)
