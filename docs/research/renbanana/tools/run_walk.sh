#!/bin/sh
# Walk a set of seed grids in parallel, one worker per process.
# PROCS must stay at or below half the machine's cores (AGENTS.md).
# SEEDS is a glob of candidate files to start from; walking seeds that have
# already been walked out mostly returns grids the skip-set throws away, so
# point it at the newest pool.
set -eu
PROCS=${PROCS:-12}
BUDGET=${BUDGET:-900}
OUT=${OUT:-docs/research/renbanana/walk}
SEEDS=${SEEDS:-docs/research/renbanana/candidates*/cand_*.json}
# shellcheck disable=SC2086
ls $SEEDS \
  | xargs -P "$PROCS" -I{} uv run --with ortools \
      docs/research/renbanana/tools/probe_walk.py \
      --source {} --budget "$BUDGET" --seconds 20 --workers 1 --out "$OUT"
