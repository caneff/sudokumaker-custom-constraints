#!/bin/bash
# Interleaved real-app timing: one rep per variant per round, lead rotates.
cd ~/src/sudokumaker-custom-constraints
D=.scratch/dfm-compare
V=(${VARIANTS})
for round in 1 2 3; do
  for mode in cold after; do
    n=${#V[@]}; off=$(( (round-1) % n ))
    for i in $(seq 0 $((n-1))); do
      v=${V[$(( (i+off) % n ))]}
      flag=""; [ $mode = after ] && flag="--after-logical"
      out=$(node examples/_shared/app-solve.mjs $D/$v.txt 1 $flag 2>&1 | tail -4 | tr '\n' ' ')
      echo -e "$round\t$mode\t$v\t$out" >> $D/${OUT}
    done
  done
done
echo DONE >> $D/${OUT}
