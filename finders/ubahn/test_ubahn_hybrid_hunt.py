"""The hybrid finder's CLI (#783), black-box: hunts, `verify` and `classify`.

A fresh 4x4 hunt with no condition, then with circles and the piece-count
condition: every example must be one of the brute force's valid hybrid grids
for those conditions, and no two examples the same grid under the symmetry
those conditions leave. Then `verify DIR` over hand-written records, each a
grid `test_ubahn_hybrid.py` works out by hand; the `classify` command against
the decision log's table, § Hybrid; and the flags the finder refuses. Every
run names `--engine cpsat` but the last, which leaves the flag out and reads
the default engine off the records. One CP-SAT worker; about fifteen seconds
in all.

    uv run finders/ubahn/test_ubahn_hybrid_hunt.py
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "hunt"))
import brute
import hybrid
import network
from subprocess_env import success_env
from verified_io import read_verified

FINDER = HERE / "hybrid_finder.py"
BOARD = ["--rows", "4", "--cols", "4", "--timeout", "10", "--engine", "cpsat"]

ok = True


def check(name, cond):
    global ok
    status = "ok" if cond else "FAIL"
    if not cond:
        ok = False
    print(f"{status}: {name}")


def run_cli(*args):
    return subprocess.run(
        [sys.executable, str(FINDER), *args],
        capture_output=True,
        text=True,
        env=success_env(),
    )


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def record(net, rows=4, cols=4, circles=(), exactly=None, blank_strip=False):
    """A record written here by hand: `h` and `v` hold one string per row of
    horizontal and of vertical edges, "1" where one is on."""
    return {
        "rows": rows,
        "cols": cols,
        "circles": list(circles),
        "exactly": exactly,
        "blank_strip": blank_strip,
        "h": [
            "".join(str(int(((r, c), (r, c + 1)) in net)) for c in range(cols - 1))
            for r in range(rows)
        ],
        "v": [
            "".join(str(int(((r, c), (r + 1, c)) in net)) for c in range(cols))
            for r in range(rows - 1)
        ],
    }


def network_of(rec):
    """The network a record's `h` and `v` describe."""
    net = set()
    for r, bits in enumerate(rec["h"]):
        net |= {((r, c), (r, c + 1)) for c, bit in enumerate(bits) if bit == "1"}
    for r, bits in enumerate(rec["v"]):
        net |= {((r, c), (r + 1, c)) for c, bit in enumerate(bits) if bit == "1"}
    return frozenset(net)


def transposed(net):
    """The network reflected in the main diagonal, rows for columns."""
    return frozenset(tuple(sorted(((c, r), (c2, r2)))) for (r, c), (r2, c2) in net)


def mirrored(net, cols=4):
    """The network reflected left to right."""
    return frozenset(
        tuple(sorted(((r, cols - 1 - c), (r2, cols - 1 - c2))))
        for (r, c), (r2, c2) in net
    )


def kinds(net):
    return network.kind_grid(net, 4, 4)


def meeting(names, exactly=None):
    """The brute force's 4x4 grids that meet these circles and this
    piece-count condition."""
    circles = [hybrid.parse_cell(name) for name in names]
    return {
        net
        for net in brute.hybrid_grids(4, 4)
        if not hybrid.why_not_hybrid(net, 4, 4, circles)
        and (exactly is None or network.Exactly.parse(exactly).holds(net, 4, 4))
    }


grids = brute.hybrid_grids(4, 4)
# The board has number cells above and on the left only, so its one symmetry
# is the reflection in the main diagonal, which swaps the two sides. A
# left-right mirror image moves the grid away from its row numbers: of the
# 18 grids, every transpose is a grid and some mirror images are not.
check(
    "4x4: the transpose of every valid grid is a valid grid",
    all(transposed(net) in grids for net in grids),
)
check(
    "4x4: the mirror image of some valid grid is not one",
    any(mirrored(net) not in grids for net in grids),
)


def hunt(d, name, *flags, seeds="0:40"):
    """Run a hunt with these flags; returns (exit, examples, summary,
    progress, run.json's config)."""
    out = Path(d) / name
    r = run_cli(*BOARD, *flags, "--out", str(out), f"--seeds={seeds}", "--workers", "1")
    check(f"{name}: the hunt exits 0 (stderr: {r.stderr[-500:]})", r.returncode == 0)
    return (
        read_jsonl(out / "examples.jsonl"),
        json.loads((out / "summary.json").read_text()),
        read_jsonl(out / "progress.jsonl"),
        json.loads((out / "run.json").read_text()).get("config"),
    )


def accounted(name, summary, seeds=40):
    check(
        f"{name}: every seed is accounted for, none rejected by verify",
        summary.get("seeds_done") == seeds
        and summary["examples"] + summary["duplicates"] + summary["empty"] == seeds
        and summary["rejected"] == 0,
    )


with tempfile.TemporaryDirectory() as d:
    examples, summary, _, config = hunt(d, "no condition")
    nets = [network_of(ex) for ex in examples]
    check(f"no condition: the hunt wrote examples ({len(nets)})", len(nets) >= 5)
    check(
        "no condition: every example is a brute-force hybrid grid",
        all(net in grids for net in nets),
    )
    check(
        "no condition: a dedupe key is the grid of kinds or its transpose's, "
        "whichever is less",
        all(
            tuple(ex["__dedupe_key__"]) == min(kinds(net), kinds(transposed(net)))
            for ex, net in zip(examples, nets, strict=True)
        ),
    )
    check(
        "no condition: no example is the transpose of another",
        all(transposed(a) != b for a in nets for b in nets if a != b),
    )
    check(
        f"no condition: the hunt met and dropped repeats ({summary.get('duplicates')})",
        summary.get("duplicates", 0) > 0,
    )
    accounted("no condition", summary)
    check(
        "no condition: a record carries its conditions, its engine and the "
        "board's drawing",
        all(
            (ex["rows"], ex["cols"], ex["circles"], ex["exactly"]) == (4, 4, [], None)
            and ex["blank_strip"] is False
            and ex["engine"] == "cpsat"
            and ex["drawing"] == hybrid.drawing(net, 4, 4)
            for ex, net in zip(examples, nets, strict=True)
        ),
    )
    check(
        "no condition: run.json records the finder's config",
        config
        == {
            "rows": 4,
            "cols": 4,
            "circles": [],
            "exactly": None,
            "blank_strip": False,
            "engine": "cpsat",
            "timeout": 10.0,
        },
    )

    # r2c2 is on the main diagonal: the transpose keeps the circle, so it is
    # still a symmetry and a grid's transpose is a repeat.
    examples, summary, _, _ = hunt(d, "r2c2", "--circles", "r2c2")
    nets = [network_of(ex) for ex in examples]
    want = meeting(["r2c2"])
    check(
        f"r2c2 circled: every example is one of the brute force's {len(want)} "
        f"({len(nets)} examples)",
        nets and all(net in want for net in nets),
    )
    check(
        "r2c2 circled: no example is the transpose of another, and all of "
        "the grids are reached up to it",
        all(transposed(a) != b for a in nets for b in nets if a != b)
        and {min(kinds(net), kinds(transposed(net))) for net in want}
        == {tuple(ex["__dedupe_key__"]) for ex in examples},
    )
    check(
        "r2c2 circled: the record draws the circle",
        all(
            ex["circles"] == ["r2c2"]
            and ex["drawing"] == hybrid.drawing(net, 4, 4, [(1, 1)])
            for ex, net in zip(examples, nets, strict=True)
        ),
    )
    accounted("r2c2 circled", summary)

    # r2c4 is off the diagonal: the transpose would move the circle to r4c2,
    # so the condition has no symmetry and a grid and its transpose are two
    # examples.
    examples, summary, _, _ = hunt(d, "r2c4", "--circles", "r2c4")
    nets = [network_of(ex) for ex in examples]
    want = meeting(["r2c4"])
    check(
        f"r2c4 circled: every one of the brute force's {len(want)} grids is an "
        f"example, each once ({len(nets)} examples)",
        len(nets) == len(want) and set(nets) == want,
    )
    check(
        "r2c4 circled: a dedupe key is the grid of kinds as it stands",
        all(
            tuple(ex["__dedupe_key__"]) == kinds(net)
            for ex, net in zip(examples, nets, strict=True)
        ),
    )
    accounted("r2c4 circled", summary)

    # A piece-count condition names a row or a column, which the transpose
    # swaps: it leaves no symmetry either. Together with circles.
    examples, summary, _, _ = hunt(
        d, "two crosses", "--circles", "c1:turn c4:turn", "--exactly", "2:cross:r2"
    )
    nets = [network_of(ex) for ex in examples]
    want = meeting(["c1:turn", "c4:turn"], "2:cross:r2")
    check(
        f"2 crosses in r2, c1:turn and c4:turn circled: every one of the brute "
        f"force's {len(want)} grids is an example, each once ({len(nets)})",
        len(want) == 2 and len(nets) == 2 and set(nets) == want,
    )
    check(
        "2 crosses in r2 with circles: the record carries both conditions",
        all(
            ex["circles"] == ["c1:turn", "c4:turn"] and ex["exactly"] == "2:cross:r2"
            for ex in examples
        ),
    )
    accounted("2 crosses in r2 with circles", summary)

    # The blank strip: off unless asked for, and a different answer when on.
    examples, summary, _, _ = hunt(d, "blank strip", "--blank-strip")
    nets = [network_of(ex) for ex in examples]
    with_blank = brute.hybrid_grids(4, 4, blank_strip=True)
    check(
        f"blank strip on: every example is a grid of the five-strip board "
        f"({len(nets)} examples)",
        nets and all(net in with_blank for net in nets),
    )
    check(
        "blank strip on: the record says so and draws the fifth strip",
        all(
            ex["blank_strip"] is True
            and ex["drawing"] == hybrid.drawing(net, 4, 4, blank_strip=True)
            for ex, net in zip(examples, nets, strict=True)
        ),
    )

    # Conditions with no grid: every seed is empty and says why.
    examples, summary, progress, _ = hunt(
        d, "no grid", "--circles", "r2c2 r2c4", seeds="0:3"
    )
    reasons = [e.get("empty_reason") for e in progress if e.get("outcome") == "empty"]
    check(
        f"r2c2 and r2c4 circled: no example, three seeds empty as infeasible "
        f"({reasons})",
        not examples
        and len(reasons) == 3
        and all("infeasible" in reason for reason in reasons),
    )

# `verify` re-reads each record with the solver-free rule reader. The grids
# are the ones test_ubahn_hybrid.py works out by hand.
FOUR_LOOPS = network.from_drawing(["┌┐┌┐", "└┼┼┘", "┌┼┼┐", "└┘└┘"])
C_SHAPE = network.from_drawing(["┌┐┌┐", "└┼┤│", "┌┼┤│", "└┘└┘"])
LOOP2 = network.from_drawing(["┌┐", "└┘"])
U_SHAPE = network.from_drawing(["┌┐┌┐", "├┼┼┤", "└┴┴┘"])
with tempfile.TemporaryDirectory() as d:
    out = Path(d)
    cases = [
        ("a valid grid", record(FOUR_LOOPS), True, ""),
        (
            "a valid grid with all four crosses circled",
            record(FOUR_LOOPS, circles=["r2c2", "r2c3", "r3c2", "r3c3"]),
            True,
            "",
        ),
        (
            "a valid grid filed under its own piece count",
            record(FOUR_LOOPS, circles=["r2c2"], exactly="2:cross:r2"),
            True,
            "",
        ),
        (
            "an odd group that is a rectangle",
            record(LOOP2, 2, 2),
            False,
            "odd group at r1c1 is a 2x2 rectangle",
        ),
        (
            "an even group that is no rectangle",
            record(U_SHAPE, 3, 4),
            False,
            "even group at c1:straight is not a rectangle",
        ),
        (
            "a circled cell whose value is not its region's size",
            record(FOUR_LOOPS, circles=["r2c2", "r1:turn"]),
            False,
            "circle at r1:turn: value 4, region of 16 cells",
        ),
        ("a grid valid with no blank strip", record(C_SHAPE), True, ""),
        (
            "the same grid with the blank strip on",
            record(C_SHAPE, blank_strip=True),
            False,
            "even group at r1:blank is not a rectangle",
        ),
        (
            "a valid grid filed under another piece count",
            record(FOUR_LOOPS, exactly="1:cross:r2"),
            False,
            "1:cross:r2",
        ),
        (
            "a valid grid filed under a row off its board",
            record(FOUR_LOOPS, exactly="0:cross:r9"),
            False,
            "r9",
        ),
        (
            "a circle off the board",
            record(FOUR_LOOPS, circles=["r9c1"]),
            False,
            "circle off the board",
        ),
        (
            "a network with a dead end",
            record(FOUR_LOOPS - {min(FOUR_LOOPS)}),
            False,
            "dead end",
        ),
    ]
    (out / "examples.jsonl").write_text(
        "".join(json.dumps(rec) + "\n" for _, rec, _, _ in cases)
    )
    r = run_cli("verify", str(out))
    check(f"verify exits 0 (stderr: {r.stderr[-500:]})", r.returncode == 0)
    _, verdicts = read_verified(out / "verified.jsonl")
    for (name, _, want, reason), v in zip(cases, verdicts, strict=True):
        check(f"verify: {name} -> {want}", v["ok"] is want)
        if reason:
            check(f"verify: {name} says why ({reason})", reason in v.get("reason", ""))

    for i, (name, damage, reason) in enumerate(
        (
            ("a circle that names no cell", {"circles": ["r2"]}, "rKcK"),
            ("an empty piece-count condition", {"exactly": ""}, "N:PIECE:rK"),
            (
                "an edge row that is not 0s and 1s",
                {"h": ["x1x", *record(FOUR_LOOPS)["h"][1:]]},
                "'x1x' of h",
            ),
        )
    ):
        bad = out / str(i)
        bad.mkdir()
        (bad / "examples.jsonl").write_text(
            json.dumps({**record(FOUR_LOOPS), **damage}) + "\n"
        )
        r = run_cli("verify", str(bad))
        check(
            f"verify refuses {name}, exit 2, naming {reason!r}",
            r.returncode == 2
            and reason in r.stderr
            and not (bad / "verified.jsonl").exists(),
        )

# `classify`: the decision log's table, § Hybrid, word for word.
for flags, word, said in (
    ([], "not_unique", "more than one grid"),
    (["--circles", "r2c2"], "not_unique", "more than one grid"),
    (["--circles", "c1:turn r2c4"], "unique", "exactly one grid"),
    (["--circles", "r1:turn r4c2"], "unique", "exactly one grid"),
    (["--circles", "r2c2 r2c4"], "infeasible", "no grid"),
    (["--circles", "c4:turn r4:turn"], "infeasible", "no grid"),
    (["--circles", "r1c1"], "infeasible", "no grid"),
    # 8 of the 18 grids have 2 crosses in r2, none of them with r2c4 circled.
    (["--exactly", "2:cross:r2"], "not_unique", "more than one grid"),
    (["--exactly", "2:cross:r2", "--circles", "r2c4"], "infeasible", "no grid"),
):
    label = " ".join(flags) or "no condition"
    r = run_cli("classify", *BOARD, *flags)
    first = r.stdout.splitlines()[:1]
    check(
        f"classify {label}: {word}, {said} ({first}, stderr: {r.stderr[-300:]})",
        r.returncode == 0 and first == [f"{word}: {said}"],
    )
    # A time limit reached is a timeout whatever the true answer is.
    r = run_cli("classify", "--rows", "4", "--cols", "4", *flags, "--timeout", "0")
    check(
        f"classify {label} with a zero time limit: timeout ({r.stdout.strip()!r})",
        r.returncode == 0 and r.stdout.splitlines() == ["timeout: time limit reached"],
    )

# The one grid of a unique condition is drawn under the answer, circles in
# brackets.
r = run_cli("classify", *BOARD, "--circles", "c1:turn r2c4")
(only,) = meeting(["c1:turn", "r2c4"])
check(
    "classify draws the one grid of a unique condition",
    r.stdout.splitlines()[1:] == hybrid.drawing(only, 4, 4, [(-1, 0), (1, 3)]),
)

with tempfile.TemporaryDirectory() as d:
    board = ["--rows", "4", "--cols", "4"]
    for i, (flags, reason) in enumerate(
        (
            ([*board, "--circles", "r2"], "rKcK"),
            ([*board, "--circles", "r5c1"], "r5c1"),
            ([*board, "--circles", "c5:turn"], "c5:turn"),
            ([*board, "--circles", "r1:blank"], "r1:blank"),
            ([*board, "--exactly", "2:cross"], "N:PIECE:rK"),
            ([*board, "--exactly", "2:cross:r5"], "r5"),
            ([*board, "--engine", "abacus"], "abacus"),
            (["--rows", "1", "--cols", "4"], "2x2"),
        )
    ):
        out = Path(d) / str(i)
        r = run_cli(*flags, "--out", str(out), "--seeds=0:1", "--workers", "1")
        check(
            f"hunt {' '.join(flags)} is refused, exit 2, naming {reason!r}",
            r.returncode == 2 and reason in r.stderr and not out.exists(),
        )
        r = run_cli("classify", *flags)
        check(
            f"classify {' '.join(flags)} is refused, exit 2, naming {reason!r}",
            r.returncode == 2 and reason in r.stderr and not r.stdout,
        )
    # The blank number cell is on the board once the blank strip is on.
    r = run_cli("classify", *board, "--blank-strip", "--circles", "r1:blank")
    check(
        f"classify takes r1:blank with the blank strip on ({r.stdout[:20]!r})",
        r.returncode == 0 and r.stdout.startswith("infeasible: no grid"),
    )

r = run_cli("--help")
check(
    "--help prints the usage text, naming every condition and classify",
    r.returncode == 0
    and all(
        word in r.stdout
        for word in (
            "--circles",
            "--exactly",
            "--blank-strip",
            "--engine",
            "classify",
            "verify",
        )
    ),
)
check(
    "--help says pysat-lazy is the engine unless one is given",
    "pysat-lazy unless given" in r.stdout and "cpsat unless given" not in r.stdout,
)

# The default engine is PySAT with lazy cuts (Chris's ruling, 2026-10-11).
with tempfile.TemporaryDirectory() as d:
    out = Path(d) / "default engine"
    r = run_cli(
        "--rows", "4", "--cols", "4", "--timeout", "10",
        "--out", str(out), "--seeds=0:3", "--workers", "1",
    )  # fmt: skip
    examples = read_jsonl(out / "examples.jsonl") if r.returncode == 0 else []
    check(
        "no --engine: the hunt runs on pysat-lazy, in every record and in run.json",
        bool(examples)
        and all(ex["engine"] == "pysat-lazy" for ex in examples)
        and json.loads((out / "run.json").read_text())["config"]["engine"]
        == "pysat-lazy",
    )

sys.exit(0 if ok else 1)
