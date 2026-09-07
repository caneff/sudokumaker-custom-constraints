# Zombo Brainanas hunt tooling

Working copies run from the git-ignored `scratch-zombo/` dir at the worktree
root (`hunt/` holds arm/sync scripts, `tpl/` holds shading templates). This
directory is the durable copy of those scripts; results sync into `../found/`.

- `arm.sh outdir first last [extra]` — one process per seed, 9 GB ulimit, stops on `hunt/STOP`
- `sync.sh` / `sync_loop.sh` — dedupe hits, render PNGs, commit + push every 30 min
- `template.py mk|run` + `tpl/*.txt` — fix an opener's shading, solve for the rest
- `pairs.py shard nshards [round_s] [total_s]` — every box-9 circle pair as open circles
- `b9cover.py` — build-once cover loop over box-9 pairs
- `build_lineup.py` + `lineup_template.html` — the lineup artifact page
- `memlog.sh`, `sanity.py` — RSS log per solver process, quick model check
