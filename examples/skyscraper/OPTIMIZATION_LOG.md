# Skyscraper — optimization log

Every speed-up tried on `SkyscraperLineComponent.js`, kept or rejected, with
the numbers that decided it. Read this before trying a new one — a dead end
here does not need a second attempt. Background: `docs/research/133-skip-unchanged.md`,
`docs/research/137-exact-line-dp.md`, `docs/real-app-timing.md` (the method).

Boards changed across these rows (the original per-line/per-pair split →
the joint line component's own boards → the 8-arm timing board dropped in
#178 → the current shipped 9x9 → the 10x10 cap-lift board), so earlier rows
are not directly comparable to later ones — each row's caveat says which
board and app build produced its numbers.

| Variant | Kept / rejected | Hard-board numbers (first / unique / sum) | Clued-board result | Board + timer caveat | Commit |
|---|---|---|---|---|---|
| One-1-per-side / at-most-one-n-per-side count (#135) | Kept — wash, not a speed win | Timed with and without it on both the shipped and timing boards; a wash in both directions (no numbers recorded beyond "wash") | correctness rule, kept regardless | shipped 9x9 + timing board of the day, app v2026.08.14-d47fc4b | 3d45515 |
| Bitmask DP in one scratch buffer (ISS-style prune) — replaces a `Set`-of-packed-keys DP layer with a `Uint16Array` bitmask layer and a backward-sweep removal pass (#134) | Kept | `just time skyscraper --ring-clues`, median of 3: timing board 45.0 s → 3.6 s (ratio 0.08); shipped board 2.5 s → 0.3 s (ratio 0.12). Mock: `FUZZ=20000` soundness fuzz 3.5 s → 0.23 s, same 19,951 prune firings | recovery-probe goldens byte-identical; 150,000-state differential fuzz at sizes 4–9 found no difference either direction | 8-arm timing board (dropped #178) + shipped board, app v2026.08.14-d47fc4b | 8b53d71 |
| Skip `update` when candidates unchanged since last call (signature over the 11 candidate bitmasks, skip on match) (#133) | Rejected — no net gain | 57,000 `update` calls in one "Find all solutions" run, 3,996 skipped (7%). `just time skyscraper --ring-clues`, medians of 3 reps across three runs: (4.5 s → 6.4 s), (6.1 s → 6.1 s), (2.8 s table row → 4.5 s → 6.1 s baseline drift). Mock probe `gen_9x9 --search`, 3 runs each: without 11.0/10.9/13.5 s, with 10.6/10.4/9.5 s (mock only, ~10% gain) | soundness harness 0 violations at 2,000 and `FUZZ=20000`, goldens byte-identical | shipped 9x9, given-only, ring kept; app v2026.08.14-d47fc4b, 2026-08-27 | 23be8c3 (research note; the skip itself was never shipped) |
| Exact line DP over digit subsets — keys each DP layer by the subset of sub-peak digits used instead of `(position, visible count)`; exact peak join by subset complement (#137) | Kept | Mock search nodes (`recovery-probe.mjs --search --only=ours`): `gen_4x4.json` 0 → 0 (0.02 s → 0.03 s), `gen_6x6.json` 8 → 4 (0.03 s → 0.04 s), `gen_9x9.json` 762 → **0** (0.98 s → 0.06 s), the dropped 8-arm timing board 6972 → **16** (13.00 s → 0.14 s). Per-call: exact DP ~1.8× more work per call (soundness fuzz 0.23 s → 0.41 s at 19,951 firings). Real app (`--ring-clues`, median of 3): dropped timing board baseline 3600 ms → candidate 0 ms; shipped board baseline 300 ms → candidate 0 ms | position-keyed DP disagrees with a brute-force n=5 oracle on 1,303 of 2,000 states; exact DP agrees on all; soundness harness 0 violations at 2,000 and `FUZZ=20000` | shipped 9x9 + 8-arm timing board (dropped #178), app v2026.08.14-d47fc4b, 2026-08-27 | c501eea |
| Lift the line-DP cap `MAXN` from 9 to 16 (widens the scratch `Uint16Array`, no path change at n ≤ 9) | Kept — capability, not a speed win on the 9x9 | New `PUZZLE_LINK_10x10.txt` / `gen_10x10.json` (2×5 boxes, 12 givens, 20 shown clues): with the n=9 cap the app times out with no first solve; with the DP at n≤16 it proves the board unique in 0.1 s, 3/3 reps. 9x9 unchanged within noise: ratios 1.37, 0.85, 0.95 across three runs | — | shipped 9x9 (unchanged) + new 10x10 board, app v2026.08.14-d47fc4b | fe8fc96 |
| Full-house gate in front of the two-clue DP — replaces the `minDigit !== 1` and `line.length !== maxDigit` stand-downs with a solve-time test that the line is a house whose live candidates union to `{1..length}` (#240) | Kept — gate change, no deduction added | `just time skyscraper --ring-clues --board <previous PUZZLE_LINK.txt>`, median of 3: cold 8200 ms → 8300 ms (ratio 1.01); after-logical 0 ms → 0 ms, no time on either side | recovery-probe goldens byte-identical, 10x10 probe output byte-identical; soundness harness 0 violations on bare, house, and full-house lines | previously committed 9x9 link as the baseline board (the shipped one now carries the gated code), so the row swaps the DP's code alone and says nothing about the side component that replaced the built-in count in the same change; for that, the previous link's own baseline read 8200 ms against the shipped link's 7400 ms on the same day and app build. App v2026.08.14-d47fc4b, 2026-08-30 | this commit |

## Win bar (for any future attempt against the current baseline)

Follow `docs/real-app-timing.md`'s protocol: a 3-rep median on
`just time skyscraper --ring-clues`, candidate at or below 0.9× baseline,
non-deterministic solve off, and the soundness harness at 0 violations before
the change is considered.
