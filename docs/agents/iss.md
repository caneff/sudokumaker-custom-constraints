# Reading Interactive Sudoku Solver (ISS)

ISS (`sigh/Interactive-Sudoku-Solver`) is the one public solver with the same
shape as SudokuMaker: propagation plus DFS, a handler per constraint, the
handler's pass run on every search node. It is the first place to look for a
deduction or a cost pattern. This doc says how to look so the next agent does
not redo the read.

## Where it is

- Local checkout: `~/src/iss-stuff/Interactive-Sudoku-Solver`. Run `git log -1`
  there and record the commit you read; GitHub `main` moves, and section
  numbers in the docs shift.
- Deductions: `js/solver/handler_docs/*.md`. One doc per handler family
  (`chaos_construction`, `connected_values`, `count_distinct`, `nfa`, `sum`).
  Each is a numbered algorithm note with measurements. Read the doc before the
  code.
- Code: `js/solver/handlers.js` and the per-family `*_handler.js`.
- Engine contract: `js/solver/SOLVER_ENGINE.md`, "Writing `enforceConsistency`".

## How to read it

1. **Read the whole doc, not the section that matches your ticket.** The
   isofill pass read `connected_values.md` §4–5 and ticketed three rules
   (#148, #149, #150). §7.2 (0-1 BFS from the seed island, strictly stronger
   than multi-source reach) and §8 (dirty-region tracking) sat in the same
   file and were found again later by a fresh survey
   (`docs/research/connectivity-techniques.md`).
2. **Record what you passed on, and why.** One line per section in the
   ticket, the README, or a `docs/research/` note: ported, rejected (reason),
   or not applicable. A future agent then knows whether a section was judged
   or never read.
3. **Map each ISS rule to ours before porting.** Write the table: ISS rule →
   our rule that covers it, or "new". Most of `connected_values.md` is
   cap/force/reach/capacity/cut under other names.
4. **ISS's verdicts do not transfer.** ISS measured our cut rule and dropped
   it (node count tripled on its board); it closes our shipped instance. Port,
   then time on our fixtures (`docs/real-app-timing.md`). Their numbers tell
   you a rule is sound and can fire, nothing more.
5. **Some of ISS has no SudokuMaker equivalent.** `priority`,
   `candidateFinders`, `stateAllocator`, and `initialize`-time scratch handed
   in by the engine (`docs/agents/per-call-cost.md`, last section). Do not
   look for hooks we do not have.

## What has been read

| ISS source | Read for | Record |
| --- | --- | --- |
| `handlers.js` `Skyscraper`, `HiddenSkyscraper`; `SOLVER_ENGINE.md` | per-call cost patterns | `docs/agents/per-call-cost.md` (#138) |
| `connected_values.md` §4.4, §5.2, §5.3 | isofill rules | #150 (cut), #148 (cut), #149 (kept, `issue-149`) |
| `connected_values.md` §7.2, §7.4, §8; `chaos_construction.md` | isofill survey | `docs/research/connectivity-techniques.md` |
| `Skyscraper`, `HiddenSkyscraper`, `Indexing`, `Lunchbox`, `FullRank`; `sudoku_builder.js` `XSum`; `sudoku_constraint.js` outside-clue defs | how outside-clue deductions are gated on house / full house, and ties | `docs/research/190-one-sided-clues-ties-non-house-lines.md` (#190) |
| `count_distinct.md` §5, `sum.md` §4 | exclusion-group gating only | same doc, §7. Rest of both docs still unread. |
| `chaos_construction.md` §7.4 (the general cut rule ISS dropped) | whether their heuristic warning applies to SudokuMaker | #169: it does not. Both halves of cut ship; each half alone is worse, and starve alone times the app out. `examples/isofill/README.md` § Cut split |
| `chaos_construction.md` §8 (dirty-region tracking); `connected_values.md` §7.4 read as one articulation pass | whether either can replace cut's per-cell re-walks | #170: neither built. Cut is 36-45% of `update` on the hard fixtures, under the 50% bar both were parked behind. Re-open conditions in `examples/isofill/README.md` § Cut profile |
| `nfa.md` | — | not yet read |

Add a row when you read more.
