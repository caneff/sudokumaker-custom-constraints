# Zombo Brainanas hunt tooling

Working copies run from the git-ignored `scratch-zombo/` dir at the worktree
root (`hunt/` holds arm/sync scripts, `tpl/` holds shading templates). This
directory holds the sync/logging drivers; results sync into `../found/`.

- `arm.sh outdir first last [extra]` — one process per seed, 9 GB ulimit, stops on `hunt/STOP`
- `sync.sh` / `sync_loop.sh` — dedupe hits, render PNGs, commit + push every 30 min
- `memlog.sh` — RSS log per solver process

The one-off hunt scripts themselves (`arm.sh`'s and `memlog.sh`'s targets,
plus the shading/pair/triple/pocket search scripts once kept alongside them —
`b9cover.py`, `build_lineup.py`, `ceiling.py`, `forced.py`, `groups.py`,
`kill9.py`, `kinds.py`, `kinds5.py`, `minuniq.py`, the `pair99*.py` family,
`pairone5.py`, `pairopt.py`, `pairs.py`, `pairs8.py`, `pinx.py`, `plant.py`,
`pocket4.py`, `render_unique.py`, `sanity.py`, `template.py`, the `tri3*.py`
and `tri68*.py` family, `x9hunt.py`, `x9kill.py`) were deleted in #471: each
hardcoded a `sys.path.insert` into a sibling `tang` checkout that no longer
exists, so none of them could run. Their results are recorded in
`BRAINANAS.md`, `DOTS.md`, `FORCED.md`, `PAIRS.md`, `SWAP.md` and
`UPPER_LEFT.md` in the directory above; the scripts themselves are on file at
`git show 59335b1:finders/zombo-brainanas/tools/<name>.py`.
