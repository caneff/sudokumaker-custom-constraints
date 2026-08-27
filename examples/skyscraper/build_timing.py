# The timing-only skyscraper board (#140): pick a seed by search hardness, then
# build PUZZLE_LINK_timing.txt + gen_9_timing.json from it. build_size.py picks
# its seed by fewest givens, which is not hardness; the shipped board solves in
# ~5 s with ±30% noise, too fast to show a per-call change.
#
#   uv run --with ortools --with lzstring examples/skyscraper/build_timing.py scan 101 161
#   uv run --with ortools --with lzstring examples/skyscraper/build_timing.py build-adv 427
#
# scan-adv / build-adv: same, but the carve hides the informative ring clues
# (1, 9, 2, 8) first so the mid-range clues stay shown. Over 160 seeds it
# lifted the median node count and found the hardest board (adv 427: 5681
# nodes, 2000 ms in the app; best random, 328: 4846 nodes but 200 ms). The
# seed spread is still larger than the lever, and mock nodes only roughly
# predict app time, so scan wide with both modes and time the top few.
#
# scan: for each seed, carve the board as build_size.py would and count the mock
# search nodes (recovery-probe.mjs --search --only=ours). One line per seed;
# about a minute each, the carve dominates. PROBE-TIMEOUT marks a board harder
# than the probe's budget. Pick the hardest seed with over half the ring blank,
# and confirm it stays under the app's 300 s limit before committing it.
# build: write the pair for one seed; the committed pair is build-adv 427 (seed
# 135 fell to 16 nodes / 0 ms after #137, below the app's readout floor).

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


# ponytail: adversarial = hide the informative clues (1, 9, 2, 8) first so the
# mid-range clues, which prune least, are what stays shown. One lever only.
def adv_key(v):
    return min(v, N + 1 - v)


def scan(lo, hi, hide_key=None):
    out = HERE / ".scan"
    out.mkdir(exist_ok=True)
    for seed in range(lo, hi):
        s, grid, clue, givens, active, _ = generate(SPEC, N, BH, BW, [seed], hide_key)
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


def build(seed, hide_key=None):
    seed, grid, clue, givens, active, lines = generate(
        SPEC, N, BH, BW, [seed], hide_key
    )
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
    key = adv_key if sys.argv[1:2] in (["scan-adv"], ["build-adv"]) else None
    if sys.argv[1:2] in (["scan"], ["scan-adv"]) and len(sys.argv) == 4:
        scan(int(sys.argv[2]), int(sys.argv[3]), key)
    elif sys.argv[1:2] in (["build"], ["build-adv"]) and len(sys.argv) == 3:
        build(int(sys.argv[2]), key)
    else:
        sys.exit("usage: build_timing.py scan[-adv] <lo> <hi> | build[-adv] <seed>")
