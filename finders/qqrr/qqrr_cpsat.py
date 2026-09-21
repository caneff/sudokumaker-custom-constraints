"""Check the QQRR opener: is it still satisfiable, and how open is it?

    uv run finders/qqrr/qqrr_cpsat.py [opener.json] --corner tl|tr|bl|br|none
        [--hypotheses] [--count N] [--workers W] [--timeout S] [--progress FILE]

One run per corner pin and hypothesis setting (map #591's protocol is eight).
`--hypotheses` fixes the entered digits and the uncircled rank marks; without
it they steer the search as hints only. The verdict stops at `--count`
solutions. Every grid printed has been re-ranked by the oracle. The report
goes to stdout and is appended to `--progress`, each solution as it lands, so
a killed run keeps what it found. Never prints a puzzle link.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import checker

HERE = Path(__file__).resolve().parent


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("opener", nargs="?", default=HERE / "opener.json")
    ap.add_argument("--corner", choices=[*checker.CORNERS, "none"], default="none")
    ap.add_argument("--hypotheses", action="store_true")
    ap.add_argument("--count", type=int, default=2)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--timeout", type=float, default=600)
    ap.add_argument("--progress", type=Path)
    a = ap.parse_args(argv)

    def log(text):
        print(text, flush=True)
        if a.progress:
            with a.progress.open("a") as f:
                f.write(text + "\n")

    op = checker.load_opener(a.opener)
    corner = None if a.corner == "none" else a.corner
    log(
        f"qqrr: corner={a.corner} hypotheses={'on' if a.hypotheses else 'off'} "
        f"count<={a.count} workers={a.workers} timeout={a.timeout:.0f}s"
    )
    report = checker.run(
        op,
        corner,
        a.hypotheses,
        a.count,
        a.workers,
        a.timeout,
        on_solution=lambda sol, i: log(checker.render_solution(sol, i)),
    )
    head = checker.render(report).split("\n", 1)[0]
    log(head)
    return 0


if __name__ == "__main__":
    sys.exit(main())
