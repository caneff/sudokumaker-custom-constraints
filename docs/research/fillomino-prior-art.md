# Fillomino prior art: what published solvers deduce

Ticket #279, child of the fillomino map (#277). Question: what does published
fillomino solving practice deduce that neither ISOFILL nor the community
catalog's baseline component (catalog row 55, decoded from
<https://tinyurl.com/2cckzhow>, described in #277) already has?

Fillomino here is a bare board, no houses: partition the grid into
orthogonally connected regions; a region of size k holds the digit k
everywhere; two distinct regions of equal size may not touch orthogonally.

## Sources read, in trust order

1. **puzz.link / pzprjs** — `sabo2/pzprjs`, `src/variety/fillomino.js`
   (checked via GitHub raw fetch, no local commit pinned — read once,
   2026-08-31). **Validates only.** Five checks run against a *completed*
   grid: region size matches its digit (both directions), one digit per
   region, no two same-size regions share a border, every region (and
   optionally every cell) holds a number. No active deduction, no partial-grid
   candidate reasoning — it is a UI answer-checker, not a solver. Dead end for
   this question.
2. **ISS** (`docs/agents/iss.md`) — grepped the local checkout
   (`~/src/iss-stuff/Interactive-Sudoku-Solver`) for `fillomino`: no handler
   exists. `connected_values.md` (the doc ISOFILL's perimeter/tour/cut rules
   already came from) is the nearest thing, but it reasons about a **fixed
   value set** occupying **one region of unknown size**, the opposite shape
   from fillomino, where **every cell's own digit fixes its own region's
   size** and **many regions may share one digit**. See "What does not
   transfer" below for why that shape mismatch matters.
3. **Nikoli** — no fillomino solving guide found. Nikoli's public pages are
   rules-only; gmpuzzles' "Fillomino Rules and Info" page, fetched and read,
   is rules-and-index too and explicitly points to unlinked books
   (*Logic Puzzles 101*, *Starter Pack 1: Fillomino*) for technique. Treat
   "no Nikoli guide exists online" as the finding here, not an unread source.
4. **Published technique write-ups** —
   `puzzle-magazine.com/fillomino-strategy.php` (fetched and read in full):
   the one page found that states named techniques with worked examples
   rather than just rules. Quoted below.
5. **A Bachelor's thesis with a real deterministic solver**:
   Ryan Behari, *Solving Fillomino: An Algorithmic and SMT-Based Approach*
   (LIACS, Leiden, 2025), <https://theses.liacs.nl/pdf/2024-2025-BehariRRyan.pdf>.
   Not in the ticket's source list, but it is a primary source — a from-scratch
   deterministic solver with pseudocode, not a secondary summary — and the
   listed sources turned up thin, so it is included. §5 names and states three
   deduction rules; read in full (§1–10 plus appendices).
6. **Community catalog** (`docs/catalog.md`) — no fillomino row found by name;
   the map issue #277 already names catalog row 55 (SudokuFan) as the baseline
   and describes what it does, so this pass did not re-decode that link. Its
   description, quoted from #277: "BFS-floods each placed island, stops on
   overflow, seals a complete region's border, checks reachable space, and
   forces growth when one frontier cell remains. It reasons only from placed
   cells."

## The rules, by name

### 1. Single-Exit Group (LIACS thesis §5.2)

**Statement.** A region short of its target size, with exactly one open
orthogonal neighbour across all its cells, must grow into that cell.

**Soundness.** The region is connected and must reach its target size; if
every cell of the region has at most one open neighbour in total and there is
exactly one, no other growth path exists.

**Cost.** One pass over each incomplete region's cells and their neighbours;
cheap, and the thesis runs it in a loop since one application often exposes
another.

**Delta vs. baseline.** This is the catalog baseline's "forces growth when one
frontier cell remains" rule, and ISOFILL's own "seed walk holding one cell of
a digit's remaining budget forces that cell." Nothing new — flagged so later
readers do not re-port it as if it were.

### 2. Structurally Forced Cells (LIACS thesis §5.3, Algorithm 2)

**Statement.** An incomplete region of target size k may have several ways to
grow to size k; a cell may nonetheless appear in *every* such completion. Find
all size-k completions of the region by BFS from each of the region's
boundary cells, and intersect the cell sets. Any cell in the intersection must
belong to the region.

**Soundness.** The true completion is one of the enumerated ones (BFS from
every growth direction is exhaustive up to depth k), so a cell in all of them
is in the true one too. Single-exit (#1) is the k=1-remaining-cell special
case of this, cheap enough to run separately first.

**Cost.** One BFS per boundary cell per incomplete region, each bounded by
the region's own remaining size. More expensive than single-exit, run after
it.

**Delta vs. baseline.** **New.** The catalog baseline forces a cell only when
a region's frontier narrows to one cell (the single-exit case). This rule
catches a region with several apparent growth directions where the paths
still funnel through one shared cell before diverging — the catalog baseline
and ISOFILL's own per-digit walk (which asks reachability, not
completion-set-intersection) both miss this. It is close in spirit to
ISOFILL's tour rule (both bound growth by a shortest-path argument through a
committed skeleton) but tour reasons about *which cells the region can never
reach*; this rule reasons about *which cells every valid completion must
use* — the complementary direction, and one ISOFILL has no equivalent of
because its regions are all fixed at one size N, so "every completion" is a
much smaller space there.

### 3. Reachability-Based Number Deduction (LIACS thesis §5.4)

**Statement.** *Basic variant only* (every eventual region has at least one
given clue — see "Fillomino has two published variants" below). For each
empty cell, and each existing region, check whether the region can reach that
cell within its remaining budget (BFS from the region, walking through empty
cells and same-numbered not-yet-joined cells, budget = target size − current
size). Collect every region number that can reach the cell. If exactly one
*number* (not region — several regions can share a number) can reach it, and
assigning that number there does not overflow any region or strand another,
assign it.

**Soundness.** A region is connected and bounded by its own target size, so a
cell more than (target − current) steps from every one of its cells cannot
join it; if only one number's regions can reach a cell at all, no other
number can occupy it.

**Cost.** One bounded BFS per (region, empty cell) pair in the worst case,
though the thesis's own implementation starts from each region rather than
each cell and reports it usually faster in practice (their measurement: for
puzzles up to 15×15 this deterministic solver beats an SMT encoding on
median time, only losing ground once boards reach 20×20 and empty-cell counts
climb past ~150 — see the thesis's own §9 experiments).

**Delta vs. baseline.** **Partially new.** The catalog baseline "checks
reachable space" per placed island already computes something like this per
region. What is new is the cross-region step: reading off, per empty cell,
*which digits* can reach it at all, and pruning a digit outright when its
every reaching region has a different actual number than the one the cell
would need. This is the fillomino-shaped analogue of ISOFILL's cap/force —
except ISOFILL's cap/force reasons over ten fixed-size regions with a known
total cell budget per digit, and fillomino has neither (see "What ISOFILL has
that does not transfer," below).

Caveat carried over from the thesis itself: this rule is stated for the
*basic variant* only — the one where hidden, clue-less regions cannot occur.
The map's rule source (issue #277) does not restrict itself that way, so
whichever design ticket ships this must re-derive whether it stays sound once
a region can exist with no given cell at all (the analogue of ISOFILL's
"silent" digit problem — see below).

### 4. Same-size adjacency as an active pruning tool, not just a completed-region check (puzzle-magazine.com)

**Statement, quoted:** "Regions of the same size cannot touch by sides... The
only other option given there are just two cells is therefore a new
polyomino of '2'" — a two-cell empty pocket next to two separate 1-regions
cannot itself split into two 1s (they would touch), so it must be one
2-region.

**Generalises to:** a small enclosed empty pocket's own **size** can rule out
partitions of it that would put two equal-size regions in contact, even
before any digit is placed in the pocket. This is exactly the ticket's
"empty pocket" and "separation rule beyond sealing" question, and the one
clear hit for it in the sources read. The general form — for a k-cell pocket
bordered by regions of various sizes, some partitions of the pocket into
sub-regions are ruled out purely by which of those sub-regions would end up
size-adjacent to an equal-size neighbour or to each other — is not itself
spelled out anywhere read; the source states the k=2 instance as a worked
example, not a general rule with a name. No source read states the general
form or gives it a soundness argument beyond the direct case-count for small
k. Treat the general pocket-partition rule as **not found in the literature,
only its smallest instance** — a design ticket building it earns no citation
past this one example.

**Soundness (the general claim, argued here, not sourced):** the region
containing an empty cell must eventually be one connected component holding a
digit equal to its own final size; if a pocket's only feasible partitions
into sub-regions all place two components of equal size against each other,
every such partition is dead, and if that leaves one surviving partition, its
region boundaries are forced. This is a case-count over set partitions of a
small connected region, not a single formula — cost grows with the number of
combinatorial partitions of the pocket, so it is only cheap while the pocket
stays small (the source's own example is 2 cells).

**Delta vs. baseline.** **New**, and the ticket's centrepiece question. The
catalog baseline "seals a complete region's border" — i.e. it applies the
separation rule only *after* a region is finished, to close off its
neighbours. It never uses the rule to constrain an *unfinished* or *entirely
empty* pocket's own partition. ISOFILL's perimeter rule is the nearer analogue
in spirit (also a separation-style argument, also reads the rule as
forbidding interleaved regions along a boundary) but perimeter reasons about
the grid's *outer* border specifically; nothing in ISOFILL reasons about an
*interior* empty pocket's size, because ISOFILL's regions are all the same
fixed size N, so two regions are never simultaneously candidates for
"same size" the way two differently-sized fillomino regions can be.

### 5. Forced extension / connectivity among same-digit givens (puzzle-magazine.com)

Two more named-in-passing techniques on the same page, both already covered
by name elsewhere:

- **Forced extension**: a given digit N cell must reach N total cells, so its
  region needs (N − 1) more. Mechanically identical to "a region needs its
  remaining budget of cells" — the premise every rule above already uses, not
  a separate rule.
- **Connectivity deduction among same-digit givens**: two clue cells with the
  same number, whose only expansion paths necessarily meet, must be the same
  region. This is fillomino-specific in one way ISOFILL structurally cannot
  be: since a fillomino digit may label *several* distinct regions (unlike
  ISOFILL, whose whole-board rule guarantees each digit is exactly one
  region), "are these two same-numbered clues the same region or two
  different ones" is a live question fillomino has to answer that ISOFILL's
  rule set never asks. No source gives this a name beyond the prose above or
  a general algorithm — treat as the same shape as Structurally Forced Cells
  (#2) applied across two starting cells rather than one, not independently
  new machinery.

## What ISOFILL has that does not transfer

Worth stating plainly, since the map (#277) is explicit that ISOFILL is the
worked precedent: ISOFILL's strongest and most expensive rules — cap, force,
budget with its matching prune, and the "every digit is exactly one region of
size N" premise the seed walk, cut, and tour all lean on — all rest on **one
digit occupying exactly one region of one known fixed size, the same for
every digit.** None of that holds in plain fillomino:

- A digit's total cell count across the board is **not fixed** (regions of
  digit 3 can exist zero, one, or many times), so there is no fillomino
  analogue of cap ("once a digit fills its ten cells, remove it everywhere
  else") or force ("once exactly ten cells can still hold a digit, fill them
  all") stated over a *digit*. The nearest fillomino analogue of force is
  per-*region*, not per-digit (Single-Exit, #1 above).
- Budget's flow argument (`10 − placed` slots per digit, matched against open
  cells) has no fillomino restatement without first knowing how many regions
  of each size the solution has, which the puzzle does not commit to.
- ISOFILL's "silent digit" problem (a digit with zero placed cells gets no
  rule at all, since every ISOFILL rule starts a walk from a placed cell) has
  a **fillomino-shaped worse cousin**: a wholly hidden region — no clue cell
  anywhere in it — can exist under the map's own rule source (#277 rules out
  "fillomino laid over sudoku," not hidden regions) and under the LIACS
  thesis's own "challenging variant" (§4.2, §9.2: their deterministic solver
  could not handle it at all — only their SMT encoder was tested against it,
  and its own solve times blow up past ~60 empty cells, some hitting a 300 s
  cap). No source read offers a deterministic rule for this case. It is the
  fillomino analogue of ISOFILL's silent-digit gap, and by the thesis's own
  numbers it is harder to close, not easier — flag it early in design rather
  than discovering it the way ISOFILL discovered silent (#142, after two
  purpose-built fixtures).

## Answer to the ticket's four call-outs

- **Separation rule beyond sealing a completed region:** yes — technique #4,
  one concrete worked instance (a 2-cell pocket), no general statement found
  in any source read. The general form is a case-count over small-pocket
  partitions, argued above, uncited past the k=2 case.
- **What an enclosed empty pocket's size alone implies:** the same finding as
  above — bounds which partitions of the pocket are legal, via the separation
  rule, but no source states this as a size-indexed rule (e.g. "a pocket of
  size k implies X") — only the k=2 instance is documented anywhere found.
- **What a cell's candidate set implies about its neighbours:** no source
  states this in candidate-set form (SudokuMaker's `update`/`DigitSet`
  shape). The nearest published statements are region-level, not cell-level:
  Single-Exit (#1) and Structurally Forced Cells (#2) both derive which
  *cells* a region needs, not which digits a neighbour cell may hold given
  the current cell's digit. A design ticket restating "a 1 seals itself, a 2
  needs exactly one same-digit neighbour" in `DigitSet` terms would be
  translating Single-Exit/Structurally-Forced into SudokuMaker's
  candidate-per-cell shape, not porting a rule that already exists in that
  shape.
- **Counting or area arguments over the whole board:** none found. Every
  rule above is local (one region, one pocket, or one pair of regions) or, at
  most, a bounded BFS from existing clues. Nothing published reasons about
  total cell count, parity, or a whole-board flow/matching argument the way
  ISOFILL's budget rule does — and per "What ISOFILL has that does not
  transfer" above, the fixed-per-digit-count premise that argument depends on
  is exactly what plain fillomino does not have.

## Sources not fully read

- `connected_values.md` §6 onward and `nfa.md` — deferred; already marked "no
  fillomino handler exists" makes a full read low-yield for this ticket
  specifically, though a future connectivity-technique survey (as
  `docs/research/connectivity-techniques.md` did for ISOFILL) may still find
  general-purpose material worth reading in full.
- Behari thesis Appendix B (full SMT encoder) — read in full above; it is a
  from-scratch existence encoding (spanning tree per region, no deduction),
  not a rule list, so nothing further to extract from it for this ticket.
- Logic Masters Deutschland's fillomino variant pages, `puzzles.wiki`,
  `cross-plus-a.com` — surfaced by search, not fetched; the puzzle-magazine.com
  page already gave the one concrete worked technique (#4) these were being
  searched for, and effort here was capped rather than exhaustive.
