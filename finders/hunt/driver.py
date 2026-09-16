"""The hunt driver: `run(finder, argv)` (#483/#484/#487).

A thin loop over a finder's `propose`/`verify`/`record`/`key`: it owns the
output directory, inline verification, dedupe and resume after a kill -- no
finder rule, no search strategy. A fresh `--out` (no `run.json`) starts a
new hunt; an `--out` that already has one resumes it: seeds with a
`seed_done` event are skipped, the dedupe set is rebuilt from
examples.jsonl, and a finder's optional `save_state`/`load_state` round-trip
through state.json. A differing argv versus the recorded run refuses to
start and writes nothing; a differing git sha only warns. The grid helpers,
CP-SAT helpers, the `--workers`/load gate, deferred verification and the
render hook are the other later tickets (#485-#490) under the parent spec
(#483).

    uv run finders/hunt/toy_finder.py --out DIR --seeds START:END
"""

import argparse
import errno
import fcntl
import json
import os
import random
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dedupe import D4, canonical_key

OUTPUT_FILES = (
    "examples.jsonl",
    "summary.json",
    "progress.jsonl",
    "run.json",
    "state.json",
)
REPO_ROOT = Path(__file__).resolve().parents[2]

# The per-seed outcome, alongside the driver's `event`/`seed`/`rejected_reason`
# fields in each progress.jsonl line -- it's what lets a resume rebuild
# summary.json's counts from progress.jsonl alone, without trusting a
# summary.json snapshot that a kill may have left one seed stale.
_OUTCOME_COUNT_KEY = {
    "empty": "empty",
    "rejected": "rejected",
    "duplicate": "duplicates",
    "example": "examples",
}


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


def _refuse(out_arg, why):
    print(f"hunt: refusing to run -- {out_arg} already has {why}", file=sys.stderr)
    return 2


def _read_valid_lines(path):
    """Every complete, parseable line in `path`, plus its raw text.

    A kill can only ever leave the last line half-written -- every earlier
    line was already flushed whole -- so this stops at the first line that
    fails to parse and treats it and everything after it as the casualty.
    """
    if not path.exists():
        return [], []
    valid_lines = []
    parsed = []
    with path.open() as f:
        for line in f:
            if not line.strip():
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                break
            valid_lines.append(line if line.endswith("\n") else line + "\n")
            parsed.append(obj)
    return valid_lines, parsed


def _truncate_to_valid(path, valid_lines):
    if not path.exists() and not valid_lines:
        return
    path.write_text("".join(valid_lines))


def _save_state(finder, out):
    save = getattr(finder, "save_state", None)
    if save is None:
        return
    _write_json_atomic(out / "state.json", save())


def _load_state(finder, out):
    load = getattr(finder, "load_state", None)
    state_path = out / "state.json"
    if load is None or not state_path.exists():
        return
    load(json.loads(state_path.read_text()))


def _process_seed(finder, seed, seen, symmetry, examples_f, progress_f, counts):
    """Run one seed and append its outcome to examples.jsonl/progress.jsonl,
    updating `seen` and `counts` in place. Shared by the fresh and resumed
    loops so the two can't drift apart on what a seed's outcome means."""
    candidate = finder.propose(random.Random(seed))
    event = {"event": "seed_done", "seed": seed}
    if candidate is None:
        counts["empty"] += 1
        event["outcome"] = "empty"
    else:
        verdict = finder.verify(candidate)
        if not verdict.ok:
            counts["rejected"] += 1
            event["outcome"] = "rejected"
            if verdict.reason:
                event["rejected_reason"] = verdict.reason
        else:
            key = canonical_key(finder.key(candidate), symmetry)
            if key in seen:
                counts["duplicates"] += 1
                event["outcome"] = "duplicate"
            else:
                seen.add(key)
                record = dict(finder.record(candidate))
                record["_dedupe_key"] = list(key)
                examples_f.write(json.dumps(record) + "\n")
                examples_f.flush()
                counts["examples"] += 1
                event["outcome"] = "example"

    progress_f.write(json.dumps(event) + "\n")
    progress_f.flush()
    counts["seeds_done"] += 1


def _hunt_loop(finder, out, seed_start, seed_end, seen, counts, skip=frozenset()):
    symmetry = getattr(finder, "symmetry", D4)
    with (
        (out / "examples.jsonl").open("a") as examples_f,
        (out / "progress.jsonl").open("a") as progress_f,
    ):
        for seed in range(seed_start, seed_end):
            if seed in skip:
                continue
            _process_seed(finder, seed, seen, symmetry, examples_f, progress_f, counts)
            _write_json_atomic(out / "summary.json", dict(counts))
            _save_state(finder, out)


def _fresh(finder, argv, args, out):
    out.mkdir(parents=True, exist_ok=True)
    seed_start, seed_end = args.seeds

    try:
        run_fd = os.open(out / "run.json", os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except OSError as e:
        if e.errno != errno.EEXIST:
            raise
        return _refuse(args.out, "run.json")
    with os.fdopen(run_fd, "w") as run_f:
        run_f.write(
            json.dumps(
                {
                    "argv": list(argv),
                    "git_sha": _git_sha(),
                    "start_time": datetime.now(UTC).isoformat(),
                }
            )
        )

    counts = {
        "seeds_done": 0,
        "examples": 0,
        "rejected": 0,
        "duplicates": 0,
        "empty": 0,
    }
    _write_json_atomic(out / "summary.json", dict(counts))

    _hunt_loop(finder, out, seed_start, seed_end, set(), counts)
    return 0


def _resume(finder, argv, args, out, run_path):
    prior = json.loads(run_path.read_text())
    if prior.get("argv") != list(argv):
        print(
            "hunt: refusing to resume -- argv differs from the recorded run "
            f"({prior.get('argv')!r} vs {list(argv)!r})",
            file=sys.stderr,
        )
        return 2

    current_sha = _git_sha()
    if prior.get("git_sha") != current_sha:
        print(
            "hunt: warning -- git sha differs from the recorded run "
            f"({prior.get('git_sha')!r} vs {current_sha!r}), resuming anyway",
            file=sys.stderr,
        )

    seed_start, seed_end = args.seeds

    progress_lines, progress_events = _read_valid_lines(out / "progress.jsonl")
    examples_lines, examples_records = _read_valid_lines(out / "examples.jsonl")
    _truncate_to_valid(out / "progress.jsonl", progress_lines)
    _truncate_to_valid(out / "examples.jsonl", examples_lines)

    done_seeds = {e["seed"] for e in progress_events if e.get("event") == "seed_done"}
    seen = {tuple(r["_dedupe_key"]) for r in examples_records}

    counts = {
        "seeds_done": 0,
        "examples": 0,
        "rejected": 0,
        "duplicates": 0,
        "empty": 0,
    }
    for e in progress_events:
        counts["seeds_done"] += 1
        count_key = _OUTCOME_COUNT_KEY.get(e.get("outcome"))
        if count_key:
            counts[count_key] += 1
    _write_json_atomic(out / "summary.json", dict(counts))
    _load_state(finder, out)

    _hunt_loop(finder, out, seed_start, seed_end, seen, counts, skip=done_seeds)
    return 0


def run(finder, argv):
    """Run or resume a hunt for `finder` over the seed range in `argv`.

    A fresh `--out` (no run.json) starts a new hunt, refusing when it
    already holds any other output file with no run.json to explain it. An
    `--out` with a run.json resumes: already-done seeds are skipped, the
    dedupe set and summary.json's counts are rebuilt from progress.jsonl and
    examples.jsonl, and a finder's optional state round-trips through
    state.json. Returns the process exit code: 0 on a completed hunt, 2 on
    a refusal (an occupied fresh --out, a resume whose argv doesn't match
    the recorded run, or a second process already holding this --out's
    lock).
    """
    args = _parse_args(argv)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    # An advisory lock on a dedicated file, held for the whole run (fresh or
    # resumed): two processes landing on the same --out at once must not
    # both proceed, whichever path each would otherwise take -- a resume
    # replays seeds and dedupes in this process's own memory, so a second
    # process resuming concurrently would redo seeds and could both decide
    # the same candidate is novel. `flock` is tied to the open fd, so a
    # SIGKILLed holder releases it the instant the process dies -- no stale
    # lock to clean up before the next, real resume.
    lock_fd = os.open(out / ".lock", os.O_CREAT | os.O_RDWR)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        os.close(lock_fd)
        return _refuse(args.out, "an active hunt (locked)")

    try:
        run_path = out / "run.json"
        if run_path.exists():
            return _resume(finder, argv, args, out, run_path)

        other_files = [
            name
            for name in OUTPUT_FILES
            if name != "run.json" and (out / name).exists()
        ]
        if other_files:
            return _refuse(args.out, ", ".join(other_files))
        return _fresh(finder, argv, args, out)
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        os.close(lock_fd)
