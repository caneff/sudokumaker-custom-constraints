# The timing-only skyscraper board (#140): pick a seed by search hardness, then
# build PUZZLE_LINK_timing.txt + gen_9_timing.json from it. build_size.py picks
# its seed by fewest givens, which is not hardness; the shipped board solves in
# ~5 s with ±30% noise, too fast to show a per-call change.
#
#   uv run --with ortools --with lzstring examples/skyscraper/build_timing.py scan 101 161
#   uv run --with ortools --with lzstring examples/skyscraper/build_timing.py build 135
#
# scan: for each seed, carve the board as build_size.py would and count the mock
# search nodes (recovery-probe.mjs --search --only=ours). One line per seed;
# about a minute each, the carve dominates. PROBE-TIMEOUT marks a board harder
# than the probe's budget. Pick the hardest seed with over half the ring blank,
# and confirm it stays under the app's 300 s limit before committing it.
# build: write the pair for one seed; the committed pair is seed 135.

import json
import os
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))
import link_codec
from build_size import SPEC
from framebuild import build_doc, check, generate

N, BH, BW = 9, 3, 3


def gen_json(seed, grid, clue, givens, active):
    return {
        "seed": seed,
        "n": N,
        "box": [BH, BW],
        "grid": grid,
        "clue": {f"{s}{i}": clue[(s, i)] for (s, i) in clue},
        "active": [f"{s}{i}" for (s, i) in sorted(active)],
        "givens": {f"{r},{c}": v for (r, c), v in givens.items()},
    }


def scan(lo, hi):
    out = HERE / ".scan"
    out.mkdir(exist_ok=True)
    for seed in range(lo, hi):
        s, grid, clue, givens, active, _ = generate(SPEC, N, BH, BW, [seed])
        f = out / f"gen_9_{seed}.json"
        f.write_text(json.dumps(gen_json(s, grid, clue, givens, active), indent=1))
        try:
            r = subprocess.run(
                [
                    "node",
                    str(HERE / "recovery-probe.mjs"),
                    os.path.relpath(f, HERE),
                    "--search",
                    "--only=ours",
                    "--cap=300000",
                ],
                capture_output=True,
                text=True,
                timeout=90,
            )
            line = [ln for ln in r.stdout.splitlines() if "search nodes" in ln]
            result = line[0].strip() if line else r.stderr[-200:]
        except subprocess.TimeoutExpired:
            result = "PROBE-TIMEOUT"
        print(
            f"SEED {seed} givens={len(givens)} shown={len(active)} {result}", flush=True
        )


def build(seed):
    seed, grid, clue, givens, active, lines = generate(SPEC, N, BH, BW, [seed])
    doc = build_doc(SPEC, N, BH, BW, grid, clue, givens, active, lines)
    link = link_codec.encode_link(doc)
    check(SPEC, link, doc, N)
    (HERE / "PUZZLE_LINK_timing.txt").write_text(link + "\n")
    (HERE / "gen_9_timing.json").write_text(
        json.dumps(gen_json(seed, grid, clue, givens, active), indent=1)
    )
    print(
        f"wrote PUZZLE_LINK_timing.txt and gen_9_timing.json (seed {seed}, shown {len(active)}/36)"
    )


if __name__ == "__main__":
    if sys.argv[1:2] == ["scan"] and len(sys.argv) == 4:
        scan(int(sys.argv[2]), int(sys.argv[3]))
    elif sys.argv[1:2] == ["build"] and len(sys.argv) == 3:
        build(int(sys.argv[2]))
    else:
        sys.exit("usage: build_timing.py scan <lo> <hi> | build <seed>")
