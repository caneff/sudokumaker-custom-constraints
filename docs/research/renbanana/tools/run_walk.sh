#!/bin/sh
# Walk every known-good grid in parallel, one worker per process.
# PROCS must stay at or below half the machine's cores (AGENTS.md).
set -eu
PROCS=${PROCS:-12}
BUDGET=${BUDGET:-900}
OUT=${OUT:-docs/research/renbanana/walk}
ls docs/research/renbanana/candidates*/cand_*.json \
  | xargs -P "$PROCS" -I{} uv run --with ortools \
      docs/research/renbanana/tools/probe_walk.py \
      --source {} --budget "$BUDGET" --seconds 20 --workers 1 --out "$OUT"
