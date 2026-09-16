"""Deferred verification through the `hunt` CLI, black-box (#489).

`--no-verify` skips `finder.verify` while searching, so a candidate the
verifier would reject still reaches examples.jsonl. `hunt verify DIR` then
runs `finder.verify` over every line in examples.jsonl afterwards and writes
one verdict per line to verified.jsonl.

    uv run finders/hunt/test_hunt_verify.py
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOY_FINDER = HERE / "toy_finder.py"
TOY_STATEFUL_FINDER = HERE / "toy_stateful_finder.py"

ok = True


def check(name, cond):
    global ok
    status = "ok" if cond else "FAIL"
    if not cond:
        ok = False
    print(f"{status}: {name}")


with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "hunt-out"
    result = subprocess.run(
        [
            sys.executable,
            str(TOY_FINDER),
            "--out",
            str(out),
            "--seeds",
            "0:200",
            "--no-verify",
        ],
        capture_output=True,
        text=True,
    )
    check(f"exit code 0 (stderr: {result.stderr[-500:]})", result.returncode == 0)

    examples = [
        json.loads(line)
        for line in (out / "examples.jsonl").read_text().splitlines()
        if line
    ]

    # Toy finder's own trivial verifier rejects an odd shading count -- see
    # toy_finder.py. With --no-verify, that check never ran, so over 200
    # seeds at least one odd-count candidate should have reached
    # examples.jsonl -- the thing inline verification exists to prevent.
    any_odd = any(sum(ex["grid"]) % 2 != 0 for ex in examples)
    check(
        "with --no-verify, a candidate the verifier would reject reached "
        "examples.jsonl",
        any_odd,
    )

    verify_result = subprocess.run(
        [sys.executable, str(TOY_FINDER), "verify", str(out)],
        capture_output=True,
        text=True,
    )
    check(
        f"hunt verify exits 0 (stderr: {verify_result.stderr[-500:]})",
        verify_result.returncode == 0,
    )
    check("verified.jsonl was written", (out / "verified.jsonl").exists())

    verified = [
        json.loads(line)
        for line in (out / "verified.jsonl").read_text().splitlines()
        if line
    ]
    check(
        "verified.jsonl has one line per examples.jsonl line",
        len(verified) == len(examples),
    )

    expected_ok = [sum(ex["grid"]) % 2 == 0 for ex in examples]
    check(
        "verified.jsonl marks each candidate the verifier would reject as rejected",
        [v["ok"] for v in verified] == expected_ok,
    )
    check(
        "every rejected line carries a reason",
        all(v.get("reason") for v in verified if not v["ok"]),
    )
    check(
        "each verified.jsonl line carries its own record, not just position "
        "(#489 review S4/P1/C4)",
        all(v.get("record") == ex for v, ex in zip(verified, examples, strict=True)),
    )

    # A dir already holding verified.jsonl must refuse a fresh --out the same
    # way it refuses one already holding examples.jsonl -- otherwise a second
    # hunt into the same --out silently leaves this run's verdicts beside a
    # different search's examples.jsonl (#489 review, correctness C2).
    (out / "does-not-exist").mkdir()
    (out / "does-not-exist" / "verified.jsonl").write_text('{"ok": true}\n')
    refused = subprocess.run(
        [
            sys.executable,
            str(TOY_FINDER),
            "--out",
            str(out / "does-not-exist"),
            "--seeds",
            "0:5",
        ],
        capture_output=True,
        text=True,
    )
    check(
        "a fresh --out already holding verified.jsonl refuses",
        refused.returncode == 2,
    )

    # A trailing half-written line in examples.jsonl (a kill mid-write) must
    # not crash `hunt verify` and lose every verdict already computed for the
    # good lines before it (#489 review, correctness C1).
    with (out / "examples.jsonl").open("a") as f:
        f.write('{"grid": [0, 0')  # deliberately unterminated
    corrupted_verify = subprocess.run(
        [sys.executable, str(TOY_FINDER), "verify", str(out)],
        capture_output=True,
        text=True,
    )
    check(
        f"hunt verify tolerates a half-written trailing line (stderr: "
        f"{corrupted_verify.stderr[-500:]})",
        corrupted_verify.returncode == 0,
    )
    reverified = [
        json.loads(line)
        for line in (out / "verified.jsonl").read_text().splitlines()
        if line
    ]
    check(
        "a half-written trailing line is dropped, not counted",
        len(reverified) == len(examples),
    )

with tempfile.TemporaryDirectory() as tmp:
    # A finder whose record() differs from its candidate (SlowToyFinder's
    # {"grid": [...]} wrapper) must still verify through inheritance, not
    # just on the one finder the review happened to touch first (#489
    # review, correctness C3: this crashed with a raw TypeError on
    # toy_stateful_finder.py before candidate_from_record moved onto
    # SlowToyFinder).
    out = Path(tmp) / "hunt-out"
    result = subprocess.run(
        [
            sys.executable,
            str(TOY_STATEFUL_FINDER),
            "--out",
            str(out),
            "--seeds",
            "0:50",
            "--no-verify",
        ],
        capture_output=True,
        text=True,
    )
    check(
        f"stateful finder --no-verify exits 0 (stderr: {result.stderr[-500:]})",
        result.returncode == 0,
    )
    verify_result = subprocess.run(
        [sys.executable, str(TOY_STATEFUL_FINDER), "verify", str(out)],
        capture_output=True,
        text=True,
    )
    check(
        "hunt verify on a finder inheriting candidate_from_record exits 0 "
        f"(stderr: {verify_result.stderr[-500:]})",
        verify_result.returncode == 0,
    )
    check("verified.jsonl was written", (out / "verified.jsonl").exists())

with tempfile.TemporaryDirectory() as tmp:
    # A finder with no candidate_from_record whose record() isn't itself
    # verify-able must fail loud with a named cause, not a raw traceback
    # into finder.verify's own internals (#489 review, correctness C3).
    out = Path(tmp) / "hunt-out"
    wrapped_finder_script = f"""
import sys
sys.path.insert(0, {str(HERE)!r})
from driver import run
from protocol import Verdict

class WrappedRecordFinder:
    def propose(self, rng):
        return (rng.randint(0, 1),)

    def verify(self, candidate):
        return Verdict(ok=sum(candidate) % 2 == 0)

    def record(self, candidate):
        return {{"grid": list(candidate)}}

    def key(self, candidate):
        return candidate

sys.exit(run(WrappedRecordFinder(), sys.argv[1:]))
"""
    seed_result = subprocess.run(
        [
            sys.executable,
            "-c",
            wrapped_finder_script,
            "--out",
            str(out),
            "--seeds",
            "0:5",
        ],
        capture_output=True,
        text=True,
    )
    check(
        f"seeding the no-candidate_from_record fixture exits 0 (stderr: "
        f"{seed_result.stderr[-300:]})",
        seed_result.returncode == 0,
    )
    verify_result = subprocess.run(
        [sys.executable, "-c", wrapped_finder_script, "verify", str(out)],
        capture_output=True,
        text=True,
    )
    check(
        "hunt verify on a finder without candidate_from_record refuses "
        f"(exit {verify_result.returncode}, stderr: "
        f"{verify_result.stderr[-300:]})",
        verify_result.returncode == 2,
    )
    check(
        "the refusal names candidate_from_record, not a raw traceback",
        "candidate_from_record" in verify_result.stderr
        and "Traceback" not in verify_result.stderr,
    )

sys.exit(0 if ok else 1)
