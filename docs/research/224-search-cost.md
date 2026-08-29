# #224 — Node count or per-node cost, and which component?

Part of #222. Question: on the shipped Hit Counts 9×9 board
(`examples/hit-counts/PUZZLE_LINK.txt`), is the app's search **wide** (too
many nodes) or **slow** (a costly `update` per node), and which of
`HitCountsComponent`, `HitCountsPairComponent` and `SideSumComponent` is
responsible?

## Board

The committed `examples/hit-counts/PUZZLE_LINK.txt`, used as shipped. It is
already searchable: a decode counts **35 given cells, 0 entered values, 0
pencil marks** — 31 ring givens (27 active clues plus the 4 filler corners)
and 4 interior givens. Nothing had to be stripped. `examples/hit-counts/gen_9x9.json`
is the same board (27 active clues, 4 interior givens, seed 114).

### `--ring-clues` is needed, and it is not a ring-clue board

`app-solve.mjs` refuses a board that carries entered values by counting SVG
text elements whose fill is not black. On this board that check reports
`1 entered values` and the run dies — the failure the example README already
records. It is a **false positive**. A dump of every `svg text` element on the
loaded board gives 36 elements: 35 with fill `#000` (exactly the 35 givens)
and one with fill `rgb(255, 255, 255)` whose content is the string `00` — white
text, not a board digit. The link decode above independently proves there are
no entered values.

So every app run below passes `--ring-clues` purely to get past that check.
That flag also switches off the "based on already entered values" verdict
guard, so this research checked the verdict text by hand instead: a raw dump of
the app's readout on the shipped link contains **no** "based on already entered
values" phrase. The timings are real searches.

## Building the variants

`build_link.py --component` swaps one component's code; it cannot drop a
component from the wiring. Registration happens in `main.js`, which is the
constraint's **backend** code, and `just time` cannot see a main.js-only change
(#151). So, as #135 did, this research swapped the backend code directly with
`link_swap.replace_constraint_code(base, "Hit Counts Lines", backend_code=...)`,
starting from the backend string **already stored in the committed link** and
deleting one registration block from it. `check_and_write` then asserts nothing
outside the named constraint changed. The `shipped` variant is the unedited
stored string, and its rebuilt link is **byte-identical** to the committed
`PUZZLE_LINK.txt` — the baseline is the shipped board, not a re-render of it.

The mock variants use a copy of `examples/hit-counts/recovery-probe.mjs` with
one change: the registrar tags each instance with its constructor name, so a
named component can be filtered out of the wiring before the search runs. The
leaf check, the geometry, the state seeding, the Régin (GAC) all-different
floor and the MRV DFS are the shipped probe's. Cross-check: on `gen_6x6.json`
the copy reports **1046 search nodes**, exactly what
`recovery-probe.mjs gen_6x6.json --search --only=off` reports.

None of this touched a committed file; the variant links and scripts live in
the job's tmp directory.

## Results — mock search (`gen_9x9.json`, Régin floor, node cap 200,000)

| Wiring | registered | nodes | solutions | probe wall |
| --- | --- | --- | --- | --- |
| shipped | 36 hit-count + 18 pair + 4 side sum | **39,549** | 1 | 145 s |
| − `HitCountsPairComponent` | 36 hit-count + 4 side sum | 47,542 | 1 | 175 s |
| − `SideSumComponent` | 36 hit-count + 18 pair | 200,004 **CAPPED** | 0 | 694 s |
| − `HitCountsComponent` | 18 pair + 4 side sum | 200,001 **CAPPED** | 0 | 438 s |

Root propagation solves 5 of 81 interior cells with the shipped wiring, 4
without `HitCountsComponent` or without `SideSumComponent` (the 4 givens alone).

## Results — real app (`app-solve.mjs <link> 1 ShowCandidates --ring-clues`)

App `v2026.08.14-d47fc4b`, replayed from the checked-in HAR, non-deterministic
solve off, 1 rep, cold.

| Variant | first | unique | sum | verdict |
| --- | --- | --- | --- | --- |
| shipped wiring | null | null | null | `[timeout]`, no first solve |
| − `HitCountsComponent` | null | null | null | `[timeout]`, no first solve |
| − `HitCountsPairComponent` | null | null | null | `[timeout]`, no first solve |
| − `SideSumComponent` | null | null | null | `[timeout]`, no first solve |

Every variant stops with **no first solution at all**. The app hits its **own**
solve limit, and it does so at about **60 s**, not 300 s: a hand-driven run of
the same click reached "Stopped solving (time limit was reached)" after 63 s
wall including page load. The driver's 300 s wait never expires here. (#222's
note "search [timeout] at 300 s" names the driver's cap, not the app's.)

## Results — how many `update` calls fit in that limit

The committed link with all three components' `update` wrapped in the counter
`count_calls.py` uses (`[probe] <tag>=N`, relayed by the driver). The counter
is one shared variable per component, not per instance — every logged value is
an exact multiple of the log interval — so these are whole-component totals.

Logging every 100,000 calls, one run, **68.05 s wall**:

| Component | instances | `update` calls before the app gave up |
| --- | --- | --- |
| `HitCountsComponent` | 36 | **≥ 14,400,000** |
| `HitCountsPairComponent` | 18 | **≥ 7,000,000** |
| `SideSumComponent` | 4 | **< 500** |

`SideSumComponent` logged nothing even at a 500-call interval, so it ran fewer
than 500 times in the whole search: its cells are the outside clue cells, most
of them givens, so the app almost never re-triggers it once the board is loaded.

Over 21.4 million `update` calls in roughly 60 s of solving is about **3 µs per
call**.

## Conclusion

**The board is wide, not the wiring slow — the same verdict #120 reached for
Skyscraper, and by the same evidence.**

- *Not slow.* An `update` costs about 3 µs. The app ran more than 21 million of
  them inside its own limit and had not reached a first solution. No plausible
  saving on per-call cost closes a gap that size.
- *Wide.* The mock needs 39,549 backtracking nodes on a Régin-strength (GAC)
  all-different floor — far stronger than the app's default "singles only"
  Solutions finder — so the app's own node count on this board can only be
  larger. Taking 36 + 18 firing components as a rough per-node cost, 21.4 M
  calls is on the order of 400 K nodes explored without finishing: an order of
  magnitude past what the strongest wiring here needs, and still short.
- *Which component?* None is the slow part; the four app variants are
  indistinguishable, all failing to find a first solution. By pruning power in
  the mock the ranking is clear: `HitCountsComponent` and `SideSumComponent`
  are both load-bearing (drop either and the search does not finish inside
  200,000 nodes), while `HitCountsPairComponent` is worth about **17 %** of the
  nodes (47,542 → 39,549) — real, but nowhere near the several orders of
  magnitude the app needs.
- *A specific note on `SideSumComponent`.* It is the strongest single deduction
  in the mock and it is nearly free in the app (< 500 calls), because it fires
  at load and then sits idle. Its whole contribution is already spent at the
  root. Anything that closes this board has to prune **during** search, where
  only the per-line and pair components are running.

So the lever for #222 is node count, not `update` cost, and it has to bite
deep in the tree, not at the root.

## Caveats

- App runs are 1 rep each. Reps buy nothing when every rep returns
  `[timeout]` with null times; a `[timeout]` is itself the result.
- The mock's node counts are not the app's. The mock's GAC all-different floor
  is stronger than the app's default search, so the app's real node count on
  this board is very likely **higher** than 39,549, not lower.
- The two capped rows (200,001 and 200,004 nodes, 0 solutions) are lower
  bounds. Those wirings may need far more than 200,000 nodes; the cap only says
  "more than this".
- The per-node estimate (~400 K nodes) assumes every registered component fires
  about once per node. It is an order-of-magnitude reading, not a measurement —
  the app exposes no node counter.
- The `--ring-clues` flag on a given-only board is a workaround for a driver
  bug, documented above and checked by hand. `app-solve.mjs`'s entered-value
  test should look at board cells, not at non-black SVG text.
