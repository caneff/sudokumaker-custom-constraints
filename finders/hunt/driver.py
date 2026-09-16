"""The hunt driver: `run(finder, argv)` (#483/#484).

A thin loop over a finder's `propose`/`verify`/`record`/`key`: it owns the
output directory, inline verification, and dedupe -- no finder rule, no
search strategy. Fresh-hunt only in this ticket (#484); resume, the
`--workers`/load gate, deferred verification and the render hook are later
tickets (#487-#490) under the parent spec (#483).

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
from dedupe import canonical_key

OUTPUT_FILES = ("examples.jsonl", "summary.json", "progress.jsonl", "run.json")


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
    --out. Returns the process exit code (0 on a completed hunt).
    """
    args = _parse_args(argv)
    out = Path(args.out)
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

    with (
        (out / "examples.jsonl").open("a") as examples_f,
        (out / "progress.jsonl").open("a") as progress_f,
    ):
        for seed in range(seed_start, seed_end):
            candidate = finder.propose(random.Random(seed))
            if candidate is None:
                counts["empty"] += 1
            else:
                verdict = finder.verify(candidate)
                if not verdict.ok:
                    counts["rejected"] += 1
                else:
                    key = canonical_key(finder.key(candidate), finder.symmetry)
                    if key in seen:
                        counts["duplicates"] += 1
                    else:
                        seen.add(key)
                        examples_f.write(json.dumps(finder.record(candidate)) + "\n")
                        examples_f.flush()
                        counts["examples"] += 1

            progress_f.write(json.dumps({"event": "seed_done", "seed": seed}) + "\n")
            progress_f.flush()
            counts["seeds_done"] += 1
            _write_json_atomic(out / "summary.json", dict(counts))

    return 0
