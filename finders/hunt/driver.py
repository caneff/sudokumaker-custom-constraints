"""The hunt driver: `run(finder, argv)` (#483/#484).

A thin loop over a finder's `propose`/`verify`/`record`/`key`: it owns the
output directory, inline verification, and dedupe -- no finder rule, no
search strategy. Fresh-hunt only in this ticket (#484): a `--out` that
already holds a hunt's files is refused rather than silently mixed with
new output, since resuming into it correctly is #487's job, not this one's.
The grid helpers, CP-SAT helpers, the `--workers`/load gate, deferred
verification and the render hook are the other later tickets (#485-#490)
under the parent spec (#483).

    uv run finders/hunt/toy_finder.py --out DIR --seeds START:END
"""

import argparse
import json
import random
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dedupe import D4, canonical_key

OUTPUT_FILES = ("examples.jsonl", "summary.json", "progress.jsonl", "run.json")
REPO_ROOT = Path(__file__).resolve().parents[2]


def _parse_seeds(text):
    start, _, end = text.partition(":")
    if not _:
        raise argparse.ArgumentTypeError(f"--seeds wants START:END, got {text!r}")
    return int(start), int(end)


def _parse_args(argv):
    parser = argparse.ArgumentParser(prog="hunt")
    parser.add_argument("--out", required=True)
    parser.add_argument("--seeds", required=True, type=_parse_seeds)
    return parser.parse_args(argv)


def _git_sha():
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def _write_json_atomic(path, data):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data))
    tmp.replace(path)


def run(finder, argv):
    """Run one fresh hunt for `finder` over the seed range in `argv`.

    Writes examples.jsonl, summary.json, progress.jsonl and run.json under
    --out. Refuses when --out already holds any of those (fresh hunts only
    -- #487 is where resuming into an existing one becomes safe). Returns
    the process exit code: 0 on a completed hunt, 2 on that refusal.
    """
    args = _parse_args(argv)
    out = Path(args.out)
    existing = [name for name in OUTPUT_FILES if (out / name).exists()]
    if existing:
        print(
            f"hunt: refusing to run -- {args.out} already has {', '.join(existing)} "
            "(this ticket is fresh hunts only; resuming into it is #487)",
            file=sys.stderr,
        )
        return 2
    out.mkdir(parents=True, exist_ok=True)
    seed_start, seed_end = args.seeds

    _write_json_atomic(
        out / "run.json",
        {
            "argv": list(argv),
            "git_sha": _git_sha(),
            "start_time": datetime.now(UTC).isoformat(),
        },
    )

    seen = set()
    counts = {
        "seeds_done": 0,
        "examples": 0,
        "rejected": 0,
        "duplicates": 0,
        "empty": 0,
    }
    _write_json_atomic(out / "summary.json", dict(counts))

    symmetry = getattr(finder, "symmetry", D4)

    with (
        (out / "examples.jsonl").open("a") as examples_f,
        (out / "progress.jsonl").open("a") as progress_f,
    ):
        for seed in range(seed_start, seed_end):
            candidate = finder.propose(random.Random(seed))
            event = {"event": "seed_done", "seed": seed}
            if candidate is None:
                counts["empty"] += 1
            else:
                verdict = finder.verify(candidate)
                if not verdict.ok:
                    counts["rejected"] += 1
                    if verdict.reason:
                        event["rejected_reason"] = verdict.reason
                else:
                    key = canonical_key(finder.key(candidate), symmetry)
                    if key in seen:
                        counts["duplicates"] += 1
                    else:
                        seen.add(key)
                        examples_f.write(json.dumps(finder.record(candidate)) + "\n")
                        examples_f.flush()
                        counts["examples"] += 1

            progress_f.write(json.dumps(event) + "\n")
            progress_f.flush()
            counts["seeds_done"] += 1
            _write_json_atomic(out / "summary.json", dict(counts))

    return 0
