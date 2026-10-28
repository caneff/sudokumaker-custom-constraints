"""RESEARCH, not shipped code (#851): the fortress rule on top of the repo's
fillomino CP-SAT model, its brute-force check, and the uniqueness timing sweep.
The note that records what it found is ../fortress-fillomino-cpsat.md.

    uv run docs/research/fortress-fillomino-cpsat/fortress.py check
    uv run docs/research/fortress-fillomino-cpsat/fortress.py sweep <cap> <seed>... > rows.jsonl

It extends `model()` in examples/fillomino/generate.py rather than copying it:
`fortress_model` calls that model and adds one peak/pit bool per cell. The
shipped `solutions()`, `unique()` and `sample()` are reused unchanged, run
inside `fortress()`, which points generate.py's `model` at the fortress model
and its sampling portfolio at one worker (MACHINE-LOAD: one worker unless told).

Fortress rule (GLOSSARY.md): every region is strictly larger than all its
orthogonal neighbour regions (a peak) or strictly smaller than all of them (a
pit). Two neighbouring regions are therefore always one peak and one pit, the
peak the larger, and the encoding is exactly that, per edge:

    peak[p] == peak[q]          ->  x[p] == x[q]   (same side: one region)
    peak[p] and not peak[q]     ->  x[p] >  x[q]

peak is constant on a region because equal digits across an edge are one region
in the base model, and differing peaks force differing digits.
"""

import contextlib
import json
import random
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "examples" / "fillomino"))
import generate
from generate import Board

BASE_MODEL = generate.model


def fortress_model(board, givens, implied=True):
    m, x = BASE_MODEL(board, givens)
    peak = {p: m.NewBoolVar(f"pk{p}") for p in board.cells}
    for p, q in board.uedges:
        a, b = peak[p], peak[q]
        m.Add(x[p] == x[q]).OnlyEnforceIf([a, b])
        m.Add(x[p] == x[q]).OnlyEnforceIf([a.Not(), b.Not()])
        m.Add(x[p] > x[q]).OnlyEnforceIf([a, b.Not()])
        m.Add(x[q] > x[p]).OnlyEnforceIf([b, a.Not()])
    if implied:
        # What the rule forces, stated so propagation needs no edge to find it:
        # a peak beats some neighbour (>= 2), a pit loses to one (<= cap - 1).
        # So every 1 is a pit and every cap-sized region is a peak.
        for p in board.cells:
            m.Add(x[p] >= 2).OnlyEnforceIf(peak[p])
            m.Add(x[p] <= board.cap - 1).OnlyEnforceIf(peak[p].Not())
    return m, x


@contextlib.contextmanager
def fortress(implied=True):
    """Run generate.py's own solutions()/unique()/sample() on the fortress model."""
    old_model, old_workers = generate.model, generate.cpsat.SEARCH_WORKERS
    generate.model = lambda b, g: fortress_model(b, g, implied)
    generate.cpsat.SEARCH_WORKERS = 1
    try:
        yield
    finally:
        generate.model, generate.cpsat.SEARCH_WORKERS = old_model, old_workers


# ---------------------------------------------------------------- brute force


def regions(board, g):
    """Flood-fill a full grid {cell: digit} into equal-digit components."""
    seen, out = set(), []
    for p in board.cells:
        if p in seen or p not in g:
            continue
        blob, stack = {p}, [p]
        while stack:
            r, c = stack.pop()
            for q in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if q in g and g[q] == g[p] and q not in blob:
                    blob.add(q)
                    stack.append(q)
        seen |= blob
        out.append(blob)
    return out


def is_fortress(board, g):
    """The rule read literally, no solver: every component's size is its digit,
    and each component is larger than every neighbour or smaller than every one."""
    regs = regions(board, g)
    for blob in regs:
        d = g[next(iter(blob))]
        if len(blob) != d:
            return False
        nbr = {
            g[q]
            for r, c in blob
            for q in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1))
            if q in g and q not in blob
        }
        if nbr and not (all(d > e for e in nbr) or all(d < e for e in nbr)):
            return False
    return True


def brute(board, givens):
    """Every fortress grid on a small board, by depth-first search over digits in
    row-major order, no solver. After each assignment it looks at the
    equal-digit components touching the new cell and prunes only what fails in
    every completion: a component larger than its digit; a component with no
    unassigned neighbour whose size is not its digit; a component with one
    assigned neighbour digit above its own and another below (an assigned
    different-digit neighbour cell is a final neighbour region). The final test
    is is_fortress()."""
    cells, g, out, n = board.cells, {}, [], board.side

    def around(r, c):
        for q in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= q[0] < n and 0 <= q[1] < n:
                yield q

    def blob_of(p):
        blob, stack = {p}, [p]
        while stack:
            for q in around(*stack.pop()):
                if q in g and g[q] == g[p] and q not in blob:
                    blob.add(q)
                    stack.append(q)
        return blob

    def dead(p):
        seen = set()
        for start in [p, *around(*p)]:
            if start not in g or start in seen:
                continue
            blob = blob_of(start)
            seen |= blob
            d = g[start]
            if len(blob) > d:
                return True
            edge = {q for b in blob for q in around(*b)} - blob
            nbr = {g[q] for q in edge if q in g}
            if any(e > d for e in nbr) and any(e < d for e in nbr):
                return True
            if all(q in g for q in edge) and len(blob) != d:
                return True
        return False

    def walk(i):
        if i == len(cells):
            if is_fortress(board, g):
                out.append(generate._rows_from_dict(board, g))
            return
        p = cells[i]
        for v in [givens[p]] if p in givens else range(1, board.cap + 1):
            g[p] = v
            if not dead(p):
                walk(i + 1)
            del g[p]

    walk(0)
    return out


# Enumerate a clue set's whole solution set through the model only up to this
# many grids. The forbid loop's per-solve cost grows with every forbidden grid
# (0.1 s at grid 1, 0.4 s by grid 300 on an unclued 5x5 cap 7), so a clue set
# with thousands of solutions costs hours, and the first full run of this check
# hit the 600 s limit deep inside one such loop. Above the cap the check
# compares the verdict and that both grids the model returns are brute's.
ENUM_CAP = 50


def check(phases=("sets", "clues")):
    """Model vs brute force: whole solution sets, then random clue sets."""
    for side, cap in ((2, 2), (3, 3), (3, 5), (4, 4), (4, 6), (5, 5)):
        if "sets" not in phases:
            break
        board = Board.of(side, cap=cap)
        t = time.time()
        want = sorted(brute(board, {}))
        tb = time.time() - t
        for implied in (False, True):
            with fortress(implied):
                got = sorted(generate.solutions(board, {}, most=len(want) + 5))
            assert got == want, f"{side}x{side} cap {cap} implied={implied}"
        assert all(is_fortress(board, _dict(board, r)) for r in got)
        print(
            f"{side}x{side} cap {cap}: {len(want)} fortress grids; "
            f"model (bare and with implied) agrees with brute ({tb:.1f}s brute)"
        )
    rng = random.Random(851)
    for side, cap, trials, kmin in ((4, 4, 40, 1), (5, 5, 40, 1), (5, 7, 20, 8)):
        board = Board.of(side, cap=cap)
        if f"clues{side}{cap}" not in phases and "clues" not in phases:
            continue
        verdicts = {"unique": 0, "multi": 0, "none": 0}
        for _ in range(trials):
            pool = brute(board, {}) if side == 4 else None
            if pool:
                sol = rng.choice(pool)
            else:
                with fortress():
                    sol = generate.sample(board, rng.randint(0, 10**6), pins=3)
            # 5x5 cap 7 starts at 8 givens: brute alone on the unclued board
            # did not finish in 300 s.
            k = rng.randint(kmin, side * side // 2)
            givens = {p: sol[p[0]][p[1]] for p in rng.sample(board.cells, k)}
            want = sorted(brute(board, givens))
            most = len(want) + 5 if len(want) <= ENUM_CAP else 2
            with fortress():
                got = sorted(generate.solutions(board, givens, most=most))
                u = generate.unique(board, givens)
            same = (
                got == want if most > 2 else set(map(str, got)) <= set(map(str, want))
            )
            assert same and u == (len(want) == 1), (side, cap, givens)
            verdicts["unique" if len(want) == 1 else "multi"] += 1
        print(f"{side}x{side} cap {cap}: {trials} clue sets agree {verdicts}")
    print("check ok")


def _dict(board, rows):
    return {(r, c): rows[r][c] for r, c in board.cells}


# ---------------------------------------------------------------- sweep


def timed_unique(board, givens, limit, implied=True):
    t = time.time()
    with fortress(implied):
        try:
            v = "unique" if generate.unique(board, givens, limit) else "multi"
        except TimeoutError:
            v = "timeout"
    return v, time.time() - t


def sweep_one(cap, seed, strip_limit=60, limit=generate.LIMIT):
    board = Board.of(9, cap=cap)
    t = time.time()
    with fortress():
        grid = generate.sample(board, seed)
    t_sample = time.time() - t
    assert is_fortress(board, _dict(board, grid))
    rng = random.Random(seed)
    givens = _dict(board, grid)
    order = list(board.cells)
    rng.shuffle(order)
    t = time.time()
    strip_timeouts = 0
    for p in order:
        trial = {q: v for q, v in givens.items() if q != p}
        v, _ = timed_unique(board, trial, strip_limit)
        if v == "unique":
            givens = trial
        strip_timeouts += v == "timeout"
    t_strip = time.time() - t
    row = {
        "cap": cap,
        "seed": seed,
        "sample_s": round(t_sample, 2),
        "strip_s": round(t_strip, 1),
        "strip_timeouts": strip_timeouts,
        "clues": len(givens),
        "max_digit": max(max(r) for r in grid),
    }
    for implied in (True, False):
        v, s = timed_unique(board, givens, limit, implied)
        row[f"prove_{'impl' if implied else 'bare'}"] = [v, round(s, 2)]
    drop = rng.choice(sorted(givens))
    fewer = {q: v for q, v in givens.items() if q != drop}
    v, s = timed_unique(board, fewer, limit)
    row["second"] = [v, round(s, 2)]
    row["clue_set"] = sorted([r, c, d] for (r, c), d in givens.items())
    return row


if __name__ == "__main__":
    if sys.argv[1] == "check":
        check(sys.argv[2:] or ("sets", "clues"))
    elif sys.argv[1] == "sweep":
        cap, *seeds = (int(a) for a in sys.argv[2:])
        for seed in seeds:
            print(json.dumps(sweep_one(cap, seed)), flush=True)
    else:
        sys.exit(f"usage: {sys.argv[0]} check | sweep <cap> <seed>...")
