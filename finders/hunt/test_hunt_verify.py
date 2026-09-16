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

sys.exit(0 if ok else 1)
