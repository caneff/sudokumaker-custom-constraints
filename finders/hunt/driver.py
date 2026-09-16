"""The hunt driver: `run(finder, argv)` (#483/#484/#487).

A thin loop over a finder's `propose`/`verify`/`record`/`key`: it owns the
output directory, inline verification, dedupe and resume after a kill -- no
finder rule, no search strategy. A fresh `--out` (no `run.json`) starts a
new hunt; an `--out` that already has one resumes it: seeds with a
`seed_done` event are skipped, the dedupe set is rebuilt from the durable
log, and a finder's optional `save_state`/`load_state` round-trip through
state.json. A differing argv versus the recorded run refuses to start and
writes nothing; a differing git sha only warns. The grid helpers, CP-SAT
helpers, the `--workers`/load gate, deferred verification and the render
hook are the other later tickets (#485-#490) under the parent spec (#483).

    uv run finders/hunt/toy_finder.py --out DIR --seeds START:END

Every seed's outcome (empty/rejected/duplicate/example) and, for an
example, its canonical dedupe key, live in progress.jsonl -- not in
examples.jsonl, which stays exactly what `finder.record()` returned, with
nothing driver-owned added to it. That split matters for resume:
`_process_seed` always writes an accepted example to examples.jsonl
*before* that seed's progress.jsonl event, so a kill can leave the two
logs' tails disagreeing by exactly one seed -- an example written with no
confirming event, or (see the corruption tests) a confirmed event whose
example line got corrupted by something other than the kill that produced
the event. `_resume` reconciles that disagreement before rebuilding
anything from the logs.
"""

import argparse
import fcntl
import json
import os
import random
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dedupe import D4, IDENTITY, canonical_key, validate_group

OUTPUT_FILES = (
    "examples.jsonl",
    "summary.json",
    "progress.jsonl",
    "run.json",
    "state.json",
)
REPO_ROOT = Path(__file__).resolve().parents[2]

# The per-seed outcome in each progress.jsonl line, alongside `event`/`seed`/
# `rejected_reason`/`dedupe_key` -- it's what lets a resume rebuild
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


def _write_text_atomic(path, text):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text)
    tmp.replace(path)


def _refuse(out_arg, why):
    print(f"hunt: refusing to run -- {out_arg} already has {why}", file=sys.stderr)
    return 2


def _to_hashable(value):
    """Undo JSON's list-ifying of a dedupe key's tuple(s) on the way back
    in, so a key nested more than one level deep still hashes."""
    if isinstance(value, list):
        return tuple(_to_hashable(v) for v in value)
    return value


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


def _validate_symmetry(finder):
    """Refuse before any output exists if `finder.symmetry` is a custom
    group that doesn't form one (#508/#511) -- a resume validates it again
    since it reruns `canonical_key` on every un-skipped seed the same as a
    fresh hunt would."""
    symmetry = getattr(finder, "symmetry", D4)
    if symmetry in (D4, IDENTITY):
        return None
    try:
        validate_group(symmetry)
    except ValueError as e:
        print(f"hunt: refusing to run -- invalid symmetry group: {e}", file=sys.stderr)
        return 2
    return None


def _truncate_to_valid(path, valid_lines):
    if not path.exists():
        return
    _write_text_atomic(path, "".join(valid_lines))


def _reconcile_examples(
    progress_lines, progress_events, examples_lines, examples_records
):
    """Make the two logs' tails agree on how many examples really happened.

    `_process_seed` writes an accepted example to examples.jsonl and
    *then* that seed's event to progress.jsonl, so in a clean log the
    number of examples.jsonl lines always equals the number of
    `"outcome": "example"` progress events. A kill (or, for the
    half-written-line tests, a hand corruption) can knock that out of
    step in either direction:

    - progress claims one more example than the file has: the example's
      own line was lost (truncated as invalid, or corrupted by something
      that left it valid-but-wrong) -- un-confirm the most recent
      "example" event so its seed reruns and rewrites it.
    - the file has one more example than progress confirms: the example
      was written but the kill landed before its progress event -- drop
      that orphaned trailing line; its seed reruns and rewrites it too.

    Either way, nothing is left that both logs don't agree really happened,
    so resume can't double-count or silently lose a find.
    """
    confirmed = sum(1 for e in progress_events if e.get("outcome") == "example")
    while confirmed > len(examples_records) and progress_events:
        idx = max(
            i for i, e in enumerate(progress_events) if e.get("outcome") == "example"
        )
        del progress_events[idx]
        del progress_lines[idx]
        confirmed -= 1
    if len(examples_records) > confirmed:
        examples_records = examples_records[:confirmed]
        examples_lines = examples_lines[:confirmed]
    return progress_lines, progress_events, examples_lines, examples_records


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
                examples_f.write(json.dumps(finder.record(candidate)) + "\n")
                examples_f.flush()
                counts["examples"] += 1
                event["outcome"] = "example"
                event["dedupe_key"] = list(key)

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
    seed_start, seed_end = args.seeds
    _write_json_atomic(
        out / "run.json",
        {
            "argv": list(argv),
            "git_sha": _git_sha(),
            "start_time": datetime.now(UTC).isoformat(),
        },
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


def _resume(finder, argv, args, out, prior):
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
    progress_lines, progress_events, examples_lines, examples_records = (
        _reconcile_examples(
            progress_lines, progress_events, examples_lines, examples_records
        )
    )
    _truncate_to_valid(out / "progress.jsonl", progress_lines)
    _truncate_to_valid(out / "examples.jsonl", examples_lines)

    done_seeds = {e["seed"] for e in progress_events if e.get("event") == "seed_done"}
    seen = {
        _to_hashable(e["dedupe_key"])
        for e in progress_events
        if e.get("outcome") == "example"
    }

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
    dedupe set and summary.json's counts are rebuilt from the durable log,
    and a finder's optional state round-trips through state.json. A
    refusal on a mismatched argv or a stray leftover file is checked and
    returned before anything (including the lock file below) is written,
    so it leaves --out exactly as it found it. Returns the process exit
    code: 0 on a completed hunt, 2 on a refusal (an occupied fresh --out,
    a resume whose argv doesn't match the recorded run, or a second
    process already holding this --out's lock).
    """
    args = _parse_args(argv)
    refusal = _validate_symmetry(finder)
    if refusal is not None:
        return refusal
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    run_path = out / "run.json"

    prior = None
    if run_path.exists():
        prior = json.loads(run_path.read_text())
        if prior.get("argv") != list(argv):
            print(
                "hunt: refusing to resume -- argv differs from the recorded run "
                f"({prior.get('argv')!r} vs {list(argv)!r})",
                file=sys.stderr,
            )
            return 2
    else:
        other_files = [
            name
            for name in OUTPUT_FILES
            if name != "run.json" and (out / name).exists()
        ]
        if other_files:
            return _refuse(args.out, ", ".join(other_files))

    # An advisory lock on a dedicated file, held for the whole run (fresh or
    # resumed): two processes landing on the same --out at once must not
    # both proceed, whichever path each would otherwise take -- a resume
    # replays seeds and dedupes in this process's own memory, so a second
    # process resuming concurrently would redo seeds and could both decide
    # the same candidate is novel. `flock` is tied to the open fd, so a
    # SIGKILLed holder releases it the instant the process dies -- no stale
    # lock to clean up before the next, real resume. Taken only now, after
    # the checks above, so a refusal on those never creates this file.
    lock_fd = os.open(out / ".lock", os.O_CREAT | os.O_RDWR)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        os.close(lock_fd)
        return _refuse(args.out, "an active hunt (locked)")

    try:
        if prior is not None:
            return _resume(finder, argv, args, out, prior)
        return _fresh(finder, argv, args, out)
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        os.close(lock_fd)
