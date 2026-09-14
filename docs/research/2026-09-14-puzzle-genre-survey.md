# Pencil-puzzle genre survey: shading, loops/paths, region-building

**Date:** 2026-09-14
**Question:** Across the three big families of pencil puzzle genres found online —
shading puzzles, path/loop-drawing puzzles, and region-building puzzles — what are
the exact rules of each genre, which of them make good Sudoku hybrids, and which
hybrids have actually been built and published?

**Why this repo cares:** every genre here is a candidate for a SudokuMaker custom
constraint component: a decision layer (shaded / unshaded, loop segment, region id)
laid over the 9x9 candidate grid, where the component's `update` prunes digit
candidates from the decision layer and vice versa.

## Sources consulted

| Source | URL | Role |
| --- | --- | --- |
| puzz.link rules list | https://puzz.link/rules.html | Canonical short rules, ~150 genres, one page |
| Logic Masters Deutschland wiki | https://wiki.logic-masters.de/ | German canonical rules per genre |
| LMD puzzle portal | https://logic-masters.de/Raetselportal/ | Published puzzles incl. hybrids, searchable by genre |
| GM Puzzles (Thomas Snyder) | https://www.gmpuzzles.com/blog/rules/ | Rules index per genre, championship-grade phrasing |
| Nikoli | https://www.nikoli.co.jp/en/puzzles/ | Original-publisher rules for Nikoli-owned genres |
| Puzzle Square JP | https://puzsq.logicpuzzle.app/ | Genre index, Japanese community |
| GAPP Puzzles | https://gapp-puzzles.com/ | Genre/rules index |
| Cracking The Cryptic | https://www.youtube.com/@CrackingTheCryptic | Hybrid evidence (video puzzles) |
| WPF Sudoku GP booklets | https://gp.worldpuzzle.org/ | Official hybrid variant rules |
| SudokuMaker constraint list | https://sudokumaker.app/ | What this repo can already express |

**Method note:** rules were read from the primary source named inline on each
genre. Where a page could not be fetched, the genre entry says so and falls back
to the next source in the list above. Claims not confirmed at a primary source in
this run are marked `[unverified]`.

## Sources read

(running list, appended as each URL is read)

- https://puzz.link/rules.html — JS-rendered, no text served to a fetcher. Unusable.
- https://puzz.link/list.html — genre index, mostly JS-rendered; only a handful of names served.
- https://www.gmpuzzles.com/blog/rules/ — sidebar only; genre categories recovered, rules text not on this page.
- https://gapp-puzzles.com/ — GAPP is a daily pencil-puzzle series on the Cracking The Cryptic Discord, not a rules index. No per-genre rules pages found.
- https://wiki.logic-masters.de/index.php/Hauptseite — LMD Puzzlewiki index: 844 puzzle types, English pages at `/index.php/<Name>/en`. This is the workhorse source.
- https://wiki.logic-masters.de/index.php/Nurikabe/en
- https://wiki.logic-masters.de/index.php/Hitori/en
- https://wiki.logic-masters.de/index.php/LITS/en
- https://wiki.logic-masters.de/index.php/Tapa/en
- https://wiki.logic-masters.de/index.php/Heyawake/en
- https://wiki.logic-masters.de/index.php/Shakashaka/en
- https://wiki.logic-masters.de/index.php/Minesweeper/en
- LMD portal, Nurikabe hybrids (search "Nurikabe Sudoku"): IDs 000MU6, 000DZI, 000IHU, 000B4H, 00043P
- https://puzz.link/js/pzpr-samples/<pid>.js — **the find of this run.** puzz.link's rules
  page is JS-rendered and unfetchable, but the underlying data files are plain JS and
  serve the canonical English rules text for every genre the pzpr engine implements.
  244 genre ids were read out of `https://puzz.link/list.html` (`data-pid` attributes,
  grouped by family) and 242 rules texts parsed. This is the primary rules source for
  every genre below that is marked "puzz.link".
- https://wiki.logic-masters.de/api.php — MediaWiki API on the LMD Puzzlewiki; raw
  wikitext at `index.php?title=<Page>/en&action=raw`. Used for genres puzz.link words
  loosely, and for German-tradition genres puzz.link does not carry.
- https://wiki.logic-masters.de/index.php/Kuromasu/en, /Yin_Yang/en, /Norinori/en,
  /Akari/en, /Caves/en, /Coralfinder/en
- https://www.nikoli.co.jp/en/puzzles/heyawake/ (via search result excerpt)
- https://www.puzzles.wiki/wiki/Star_Battle
- https://wpcunofficial.miraheze.org/wiki/Star_Battle
- LMD portal hybrid searches (see each genre entry for the puzzle IDs found)
- https://logic-masters.de/Raetselportal/?chlang=en — the portal's own genre tag list,
  which is itself evidence of which pencil genres are routinely combined with Sudoku
  there (it carries tags for Cave, Coral, Country Road, Fillomino, Galaxies, Geradeweg,
  Hakyuu, Heyawake, Hitori, Kuromasu, Kurotto, LITS, Masyu, Mid-loop, Minesweeper,
  Moon-or-Sun, Myopia, Nanro, Nonogram, Norinori, Number Link, Nurikabe, Nurimisaki,
  Pentominous, Pentopia, Sashigane, Shakashaka, Shikaku, Shimaguni, Slitherlink, Snake,
  Star Battle, Stostone, Tapa, Yajilin, Yin and Yang, among others).

---

# 1. Shading puzzles

The decision layer is one bit per cell. That is the cheapest possible extra layer to
put on a SudokuMaker candidate grid, and it is the family with by far the most existing
Sudoku hybrid practice.

## 1.1 Nurikabe (ぬりかべ; "Islands in the Stream", "Cell Structure")

**Rules** (https://puzz.link/js/pzpr-samples/nurikabe.js): "Shade some cells on the
board to form regions of unshaded cells. 1. Each region contains exactly one number.
2. A number indicates the size of the region that contains it. 3. You cannot shade a
cell with a number. 4. The shaded cells cannot form a 2x2 square. 5. All shaded cells
form an orthogonally contiguous area." The LMD wiki adds the corollary that white
areas may touch each other only diagonally
(https://wiki.logic-masters.de/index.php/Nurikabe/en). Nikoli, from Puzzle
Communication Nikoli vol. 33.

**Structure.** Decision: binary shade per cell. Global: one connected shaded set, no
2x2 shaded, unshaded set partitions into islands. Clues: a size number inside an
island, exactly one per island.

**Sudoku hybrid suitability: Good — the strongest in the family.** Three independent
hooks into digits, all of them used in practice: the clue number *is* a digit (island
size = the digit in that cell), island contents can be constrained (no repeats within
an island, island sum), and the shaded/unshaded split can be tied to parity. Island
size is bounded by 9 in a 9x9, which is exactly the digit range — that coincidence is
why this hybrid works so well and why it fits the grid without contortion. The 2x2 and
connectivity constraints are strong enough that the shading is not free, but not so
strong that the shading solves itself independently of the digits. Implementation note:
`update` must be careful — island size deduction needs a connected-component
propagator, not just local pruning, and connectivity is the classic source of unsound
candidate removal. This repo already has `docs/research/connectivity-techniques.md`
and `docs/research/infection-shading-model.md` for exactly this.

**Existing hybrids:** abundant, and the tightest-integrated hybrids in the whole survey.
- *Colossal Nurikabe Sudoku*, LMD 000DZI
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000DZI):
  "the digit in each cell of the Sudoku grid must equal the number of land cells in the
  corresponding 3x3 box in the Nurikabe", with clues ambiguous between land-size clues
  and water-visibility clues.
- *How Far I'll Go (Nurikabe Sudoku)*, LMD 000IHU
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000IHU):
  digits may not repeat within an island; each island's clue gives (island digit sum) x
  (island size); arrow cells count island cells in the arrow directions. The setter
  says "Nurikabe/sudoku hybrids are what truly made me fall in love with variant sudoku".
- *Dodekanesos (Sudoku Nurikabe hybrid)*, LMD 000B4H
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000B4H):
  cage clue = island digit sum; all island cells even, all water cells odd.
- *Nurikabe Sudoku*, LMD 000MU6
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000MU6): from the OUCH!
  series on the Cracking The Cryptic Discord; arrow cells count shaded cells visible in
  the arrow directions.
- Non-sudoku but relevant as a genre-fusion precedent: *Tapa / Nurikabe*, LMD 00043P
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=00043P), one
  grid solvable under either ruleset.

## 1.2 Hitori (ひとりにしてくれ, "Hitori ni shite kure")

**Rules** (https://puzz.link/js/pzpr-samples/hitori.js): "Shade some cells on the board.
1. Shaded cells cannot be horizontally or vertically adjacent. 2. A row or column may
not contain two unshaded cells with identical numbers. 3. All unshaded cells on the
board form an orthogonally connected area." Nikoli vol. 29. LMD wiki agrees
(https://wiki.logic-masters.de/index.php/Hitori/en).

**Structure.** Decision: binary shade. Global: shaded cells non-adjacent, unshaded set
connected. Clues: the grid is pre-filled with numbers; there is no separate clue layer.

**Sudoku hybrid suitability: Poor as a direct overlay, Workable as a twist.** The
problem is that Hitori's *entire* clue content is the pre-filled number grid, and a
Sudoku's grid is by construction already free of row/column repeats. Rule 2 is
therefore vacuous on a completed Sudoku: nothing ever needs shading. Any hybrid must
break the coincidence — e.g. shade so that the *unshaded* cells satisfy Sudoku while a
9x9 grid of given numbers with repeats is reduced, which is really "Hitori that yields
a Latin square" rather than a Sudoku with an extra layer. That inverted form is the one
worth building if you want Hitori: a larger given grid whose unshaded survivors form
the Sudoku. It does not fit SudokuMaker's fixed 9x9 candidate grid comfortably.

**Existing hybrids:** LMD carries a Hitori tag and the wiki carries composite genres
*Kuromasu-Hitori* (https://wiki.logic-masters.de/index.php/Kuromasu-Hitori) and
*Rundweg-Hitori* (https://wiki.logic-masters.de/index.php/Rundweg-Hitori), i.e. Hitori
crossed with Kuromasu and with a loop genre, not with Sudoku. No Hitori x Sudoku hybrid
found (searched: LMD portal for "Hitori Sudoku", GM Puzzles, general web). The
vacuousness argument above is the likely reason. [Hybrid absence verified by search
only, so: unverified as an absolute claim.]

## 1.3 LITS (formerly ヌルオミノ "Nuruomino")

**Rules** (https://puzz.link/js/pzpr-samples/lits.js): "Place a tetromino (a block of 4
cells) in every outlined region. 1. There can not be a 2x2 square of cells occupied by
tetrominoes. 2. Two identical tetrominoes cannot share an edge, counting rotations and
reflections as the same. 3. All tetrominoes form an orthogonally contiguous area."
Nikoli vol. 104. The LMD wiki phrasing is equivalent
(https://wiki.logic-masters.de/index.php/LITS/en), and a portal classic states the
shape-adjacency rule explicitly
(https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=0003CM).

**Structure.** Decision: binary shade, but constrained to exactly four per region
forming an L/I/T/S tetromino. Global: connected shaded set, no 2x2 shaded, no two
edge-adjacent congruent tetrominoes. Clues: the region partition itself is the clue;
classic LITS has no numbers at all.

**Sudoku hybrid suitability: Workable, with one caveat.** The natural region partition
on a 9x9 is the nine boxes, which makes "one tetromino per box" a clean fit: exactly
36 shaded cells, four per box. The digit hook is not built in, so the setter must add
one — typically "the four digits in a tetromino sum to X", "shaded cells contain only
even digits", or "the tetromino letter is encoded by a digit". That is an added rule,
not an emergent interaction, which is what keeps this off "Good". The caveat: LITS on
the nine boxes is quite constrained on its own and can solve independently of the
digits, producing the two-puzzles-glued-together failure mode unless the setter
deliberately underdetermines the shading. Implementation is pleasant: per-box tetromino
placement is a small finite domain (the 9 boxes x ~50 placements each), which propagates
well and is much cheaper than Nurikabe's unbounded island sizes.

**Existing hybrids:**
- *HöhlenSTIL*, LMD 000J1E by Phistomefel
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000J1E): Cave x LITS,
  where each Cave wall and the cave interior counts as a LITS region. Not a Sudoku, but
  it is the canonical demonstration that LITS composes with another decision layer.
- *LITSomino*, LMD 000HEI
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000HEI): Fillomino x
  LITS — the tetrominoes of the Fillomino are exactly the LITS pieces, with arrow clues
  counting tetrominoes seen. This is a number-placement x LITS hybrid, one step from a
  Sudoku hybrid.
- *LITS Battle*, LMD 000IKY by AFrayedKnot
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000IKY): LITS x Star
  Battle, tagged "Doppelstern, LITS", with black stars on tetrominoes and white stars off
  them.
- LMD carries a LITS tag alongside its Sudoku tag
  (https://logic-masters.de/Raetselportal/?chlang=en). A pure "LITS Sudoku" title was
  not found in this search round — the LITS hybrids that exist are with other pencil
  genres. [unverified as an absolute absence]

## 1.4 Tapa

**Rules** (https://puzz.link/js/pzpr-samples/tapa.js): "Shade some cells on the board.
1. You cannot shade a cell with a number. 2. Numbers represent the lengths of the blocks
of consecutive shaded cells in the (up to) eight cells surrounding the clue. Numbers
aren't necessarily in order. 3. A question mark can be replaced by any positive number.
If a cell only has a single question mark, the number is allowed to be zero. 4. The
shaded cells cannot form a 2x2 square. 5. All shaded cells form an orthogonally
contiguous area." Invented by Serkan Yürekli; LMD wiki concurs and adds that groups
around a clue must be separated by at least one white cell
(https://wiki.logic-masters.de/index.php/Tapa/en).

**Structure.** Decision: binary shade. Global: connected shaded set, no 2x2 shaded.
Clues: a multiset of run lengths in the 8-neighbourhood of a clue cell, clue cells
themselves unshaded.

**Sudoku hybrid suitability: Good.** The clue is a *multiset of small numbers in one
cell*, and a Sudoku cell holds exactly one digit — so the natural hybrid is "the digit
in a clue cell is its Tapa clue", which is a one-number Tapa clue and gives a genuine
two-way interaction: the shading constrains the digit and the digit constrains the
shading. A single-number Tapa clue in a cell with 8 neighbours ranges 1..8, inside the
digit range. GM Puzzles alone has 203 Tapa posts, so the genre is well understood and
clue-tuning is a solved art. Implementation: the per-clue constraint is a lookup over
the 256 shadings of the 8-neighbourhood, filtered by the clue — cheap, local, and
exactly the shape SudokuMaker's `update` wants. The global connectivity and no-2x2
constraints are the expensive parts, shared with Nurikabe.

**Existing hybrids:**
- LMD carries a Tapa tag beside the Sudoku tag
  (https://logic-masters.de/Raetselportal/?chlang=en), and the portal's genre list
  includes a *Variables Tapasyu* entry — Tapa crossed with Masyu.
- The LMD wiki carries a large family of Tapa variants as first-class genres —
  *Compass Tapa*, *Encoded Tapa*, *Hungarian Tapa*, *Irregular Tapa*, *Mastermind Tapa*,
  *Easy As Tapa*, *Tapa Borders*, *Tapa Chess*, *Tapa Line*, *Tapa Logic*, *Tapa Place*,
  *Tapa Rectangles*, *Pentapa*
  (https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en) — which is direct
  evidence that Tapa's clue mechanism composes with other rule layers more readily than
  any other shading genre.
- *Tapa / Nurikabe*, LMD 00043P
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=00043P).
- A titled "Tapa Sudoku" was not surfaced by this search round. [unverified as absence]

## 1.5 Kurodoko / Kuromasu (黒どこ, "Where is Black Cells")

**Rules** (https://puzz.link/js/pzpr-samples/kurodoko.js): "Shade some cells on the
board. 1. Shaded cells cannot be horizontally or vertically adjacent. 2. Numbers cannot
be shaded. 3. Clues represent the total number of unshaded cells that can be seen in a
straight line vertically or horizontally, including itself. 4. All unshaded cells on the
board form an orthogonally connected area." Nikoli vol. 34. LMD wiki, under Kuromasu:
"A number in the grid tells the number of cells that are visible from that square,
including the square itself. Blackened cells block the view and they cannot be adjacent"
(https://wiki.logic-masters.de/index.php/Kuromasu/en).

**Structure.** Decision: binary shade. Global: shaded non-adjacent, unshaded connected.
Clues: a visibility count (a four-way X-sums-style count of unshaded cells).

**Sudoku hybrid suitability: Good, and this repo is already close to it.** The clue is
a visibility count, which is the same shape as the X-sums / skyscraper machinery this
repo already has (`docs/research/371-xsum-iss-model.md`, the skyscraper builtin
baseline). The obvious digit hook is "the digit in a clue cell equals its Kurodoko
number", but the count on a 9x9 ranges up to 17, overshooting the digit range badly —
that is the one real friction. Workarounds that setters actually use: make the clue a
*sum* of seen digits rather than a count (as Cave Sums does), or restrict visibility to
one direction. The non-adjacency rule is cheap and local, and unshaded connectivity is
the only expensive global.

**Existing hybrids:** the LMD portal carries a Kuromasu tag alongside Sudoku
(https://logic-masters.de/Raetselportal/?chlang=en), and the wiki carries the composite
genre *Kuromasu-Hitori* (https://wiki.logic-masters.de/index.php/Kuromasu-Hitori). The
directly analogous and heavily-set hybrid is Cave Sudoku (1.11 below), which uses the
same visibility clue with the opposite connectivity rules. No titled "Kurodoko Sudoku"
surfaced in this round (searched: LMD portal, GM Puzzles, general web). [unverified]

## 1.6 Heyawake (へやわけ, "divided rooms")

**Rules** (https://puzz.link/js/pzpr-samples/heyawake.js): "You're given a board divided
into rooms. Shade some cells on the board. 1. Shaded cells cannot be horizontally or
vertically adjacent. 2. A number indicates the amount of shaded cells in a region.
3. There cannot be a horizontal or vertical line of unshaded cells that goes through 2
or more region borders. 4. All unshaded cells on the board form an orthogonally
connected area." Nikoli vol. 39. Nikoli's own English page states the same four rules
and notes that rooms with no number may have any number of painted cells
(https://www.nikoli.co.jp/en/puzzles/heyawake/).

**Structure.** Decision: binary shade. Global: shaded non-adjacent, unshaded connected,
and the distinctive rule 3 — a white run may cross at most one room border. Clues: a
shaded count per room.

**Sudoku hybrid suitability: Good.** The room partition maps onto the nine boxes for
free, and "a number indicates the amount of shaded cells in a region" becomes "the digit
in this cell says how many cells in its box are shaded" — a per-box count in 0..9, i.e.
in the digit range, with no contortion. Rule 3 is the genre's signature and is a genuine
long-range constraint that a solver can exploit; it is also the rule most likely to be
mis-implemented, because it is a run-length constraint across a partition rather than a
neighbourhood check. Verdict Good, with the note that rule 3 makes the shading layer
fairly rigid, so the digit layer must carry the ambiguity.

**Existing hybrids:** LMD carries a Heyawake tag beside the Sudoku tag
(https://logic-masters.de/Raetselportal/?chlang=en). The documented composite is
*Starwacky*, Star Battle x Heyawake with non-rectangular regions, from WPC 2018 Round 6
by Jan Zvěřina (https://wpcunofficial.miraheze.org/wiki/Star_Battle) — object placement
plus Heyawake's rule 3, which is the exact structural move a Sudoku hybrid would make.
The LMD wiki also carries *Heyablock* and *Ayeheya* as derived genres
(https://puzz.link/js/pzpr-samples/heyablock.js, .../ayeheya.js). No titled "Heyawake
Sudoku" surfaced this round. [unverified as absence]

## 1.7 Yin-Yang (しろまるくろまる "Shiromaru-Kuromaru")

**Rules** (https://puzz.link/js/pzpr-samples/yinyang.js): "Place a black or white circle
in every cell. Some circles are given. 1. All circles of the same color must be
orthogonally contiguous. 2. There can not be a 2x2 square of all black or all white
circles." The LMD wiki gives the identical rule
(https://wiki.logic-masters.de/index.php/Yin_Yang/en).

**Structure.** Decision: binary colour, every cell decided (no "unused" state). Global:
*both* colour classes connected, no monochrome 2x2. Clues: some cells pre-coloured; all
other clue content comes from whatever the hybrid adds.

**Sudoku hybrid suitability: Good — the best pure-overlay candidate.** Yin-Yang has no
native clue type at all, which sounds like a weakness and is actually the decisive
strength for hybrids: the setter supplies every clue from the Sudoku side, so the two
layers cannot decouple. The constraint is symmetric, cheap to state, two-sided
connectivity plus a 2x2 ban — and it colours *every* cell, so every digit participates.
This is why it is the single most-set shading hybrid in modern variant sudoku. Fits 9x9
exactly. Implementation cost is dominated by the double connectivity check.

**Existing hybrids:** the richest evidence base in this survey.
- *Yin-Yang Sudoku*, LMD 0004X6 by Phistomefel
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=0004X6): standard Sudoku
  plus standard Yin-Yang, with outside clues giving the sum of all grey cells in that
  row or column.
- *Yin Yang Kropki Sudoku*, LMD 0009P1 by Phistomefel
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=0009P1): the Kropki dot
  colour is determined by the Yin-Yang colour of the two cells — black cells in ratio
  1:2, white cells consecutive. A genuinely two-way interaction.
- *Yin Yang Sum Frame Sudoku*, LMD 000QNK by Dying Flutchman
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000QNK), one of a series
  that also includes Yin Yang Skyscrapers, Yin Yang X-sums, Yin Yang Sandwiches and Yin
  Yang FSOE: each outside clue sees only digits of one Yin-Yang colour.
- *Yin Yang Sudoku Deconstruction [9x9]*, LMD 000HLV
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000HLV): Yin-Yang over a
  deconstructed 11x11, with killer cages summing either the shaded or the unshaded cells;
  part of a series the setter describes as "combining deconstruction with various shading
  puzzle genres (cave, nurikabe)".
- LMD carries a "Yin and Yang" tag (https://logic-masters.de/Raetselportal/?chlang=en).

## 1.8 Nurimisaki (ぬりみさき, "painted cape")

**Rules** (https://puzz.link/js/pzpr-samples/nurimisaki.js): "Shade some cells on the
board. 1. There cannot be a 2x2 square of all shaded or unshaded cells. 2. Circles mark
every instance of a cell which is unshaded and orthogonally adjacent to exactly one other
unshaded cell. 3. Clues represent the total number of unshaded cells that can be seen in
a straight line vertically or horizontally, including itself. 4. All unshaded cells on
the board form an orthogonally connected area."

**Structure.** Decision: binary shade. Global: unshaded connected, no monochrome 2x2.
Clues: circled "cape" cells (unshaded with exactly one unshaded orthogonal neighbour),
optionally carrying a visibility count. The "every instance" wording matters: circles
are a *complete* marking, so an uncircled cell is forbidden from being a cape.

**Sudoku hybrid suitability: Good.** The complete-marking rule is the valuable part — it
turns every uncircled cell into an active negative constraint, which is exactly the
property that keeps a shading layer from solving itself while giving the digit layer
leverage. The visibility count again exceeds 9 in the worst case, so the usual hybrid
move is to put the count in a circle where it is naturally small, or to use a digit sum.
Fits 9x9. Implementation is local apart from unshaded connectivity.

**Existing hybrids:**
- *Santa Pesto, Pt. 2 (9x9)*, LMD 000GBW by SamuPiano
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000GBW): a Sudoku hybrid
  with a "Yin-Yang-Yong" three-path shading and Nurimisaki circles — "Circles must be
  orthogonally connected to their path on exactly one side, and the number in the circle
  indicates the number of consecutive cells on the path that can be seen in a straight
  line from the circle, including the circle itself". The setter explicitly names
  nurimisaki as the source genre; a solver comment reads "Managed to bring a lot of
  nurimisaki logic into the world of sudoku".
- LMD carries a Nurimisaki tag beside the Sudoku tag
  (https://logic-masters.de/Raetselportal/?chlang=en).

## 1.9 Shakashaka (シャカシャカ)

**Rules** (https://puzz.link/js/pzpr-samples/shakashaka.js): "Shade a right triangle in
some empty cells, each of which occupies exactly half the cell it's in. 1. Each unshaded
area must be rectangular in shape. The rectangle can be upright, or rotated at a 45°
angle. 2. A number in a cell represents how many of the (up to 4) cells orthogonally
adjacent to the clue contain triangles." Nikoli vol. 123. LMD wiki agrees
(https://wiki.logic-masters.de/index.php/Shakashaka/en).

**Structure.** Decision: five states per cell (empty, or one of four triangle
orientations) — not binary. Global: every maximal white area is an axis-aligned or
45°-rotated rectangle. Clues: a count of adjacent triangles.

**Sudoku hybrid suitability: Poor.** The five-state decision layer is the problem. It is
not a colouring, the global rule is a geometric property of the white regions that no
local propagator captures cheaply, and there is no natural place for a digit: a triangle
is an orientation, not a quantity. A hybrid would have to invent the digit hook wholesale
("digits in a white rectangle must ..."), and the rotated-rectangle rule is expensive to
enforce in an `update`. Skip.

**Existing hybrids:** LMD carries a Shakashaka tag
(https://logic-masters.de/Raetselportal/?chlang=en). No Shakashaka x Sudoku hybrid found
(searched: LMD portal, GM Puzzles, general web). [unverified as absence]

## 1.10 Star Battle (Doppelstern, Two Not Touch, Sternenschlacht)

**Rules** (https://puzz.link/js/pzpr-samples/starbattle.js): "Place a star into some of
the cells. 1. Stars cannot be horizontally, vertically or diagonally adjacent. 2. The
number at the top of the grid indicates how many stars are in each row, column and
outlined region." The WPF/WPC phrasing is identical
(https://wpcunofficial.miraheze.org/wiki/Star_Battle); puzzles.wiki notes the common
form is a 2-star battle on 10x10
(https://www.puzzles.wiki/wiki/Star_Battle).

**Structure.** Decision: binary (star / no star). Global: king-move non-adjacency, and
an exact count per row, per column, and per region. No connectivity, no 2x2 rule.
Clues: only the region partition and the star count.

**Sudoku hybrid suitability: Good, and cheap.** This is the easiest entry in the whole
survey to implement. Non-adjacency is a king-move constraint SudokuMaker-style
components already express, and "exactly k per row/column/box" is a counting constraint
over a binary layer. The digit hook is direct and much-used: the digits on stars are
constrained (a fixed set, a sum, no repeats), or the count of stars is read off a digit.
On a 9x9 the historical variant simply places stars *instead of* two of the digits —
place 1-7 plus two stars in every row, column and box — which is the neatest fit in this
survey because the star count and the digit count balance exactly.

**Existing hybrids:**
- *Sudoku Variants Series (138) - Star Battle Sudoku*, LMD 0002G5
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=0002G5):
  "Place the digits from 1 to 7 and two stars in every row, column and 3x3-block. Stars
  don't touch each other, not even diagonally." Solvable online in f-puzzles.
- *LITS Battle*, LMD 000IKY
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000IKY): Star Battle x
  LITS.
- *Starwacky*, WPC 2018 Round 6 by Jan Zvěřina
  (https://wpcunofficial.miraheze.org/wiki/Star_Battle): Star Battle x Heyawake. The same
  page documents further Star Battle hybrids (Regions Star Battle, a borderless variant).
- LMD carries a Star Battle tag (https://logic-masters.de/Raetselportal/?chlang=en).

## 1.11 Cave / Corral / Bag / Höhle

**Rules** (https://puzz.link/js/pzpr-samples/cave.js): "Shade some cells on the board to
form a cave. 1. All shaded cells are connected through other shaded cells to the outside
of the grid. 2. Numbers cannot be shaded. 3. Clues represent the total number of unshaded
cells that can be seen in a straight line vertically or horizontally, including itself.
4. All unshaded cells on the board form an orthogonally connected area." Nikoli vol. 58,
under the name 'Bag'. The LMD wiki entry (as *Caves*) is the same, and records the other
names Baggu and Corral (https://wiki.logic-masters.de/index.php/Caves/en); it also lists
two standard variants — banning 2x2 blocks of either colour, and a hexagonal grid.

**Structure.** Decision: binary shade. Global: unshaded connected, shaded connected *to
the border* (equivalently: no enclosed wall). Clues: the same visibility count as
Kurodoko, but with the connectivity rules swapped.

**Sudoku hybrid suitability: Good — the best-evidenced hybrid in this family after
Yin-Yang.** The visibility clue is the X-sums/skyscraper shape this repo already models,
and the setters' standard fix for the 1..17 range overshoot is to make the clue a digit
*sum* rather than a count, which lands naturally in Sudoku territory. Both connectivity
rules are one-sided-ish and tractable; the "connected to the border" rule is cheaper than
full two-sided connectivity because the border is a fixed anchor.

**Existing hybrids:**
- *Cave Sums Sudoku*, LMD 000QU3
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000QU3): clue cells are
  ambiguous; a number in a shaded cell gives the digit sum of its shaded group, a number
  in an unshaded cell gives the digit sum of everything it sees in the cave.
- *Twilight Cave Sudoku*, LMD 000ALC by PixelPlucker
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000ALC): killer
  sudoku x Twilight Cave (a Cave variant where clues may themselves be shaded), citing
  the WPC 2019 instruction booklet p. 48 for the Twilight Cave rules. Digits may not
  repeat within a clue's field of vision, nor within any connected shaded group.
- *Cave Sudoku +*, LMD 000EC2
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000EC2), and the related
  000E9H: each white block holds a set of non-repeating consecutive digits starting at 1;
  black clues count black cells seen.
- *HöhlenSTIL*, LMD 000J1E by Phistomefel
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000J1E): Cave x LITS.
- LMD carries a Cave tag with 233 puzzles under it
  (https://logic-masters.de/Raetselportal/Suche/erweitert.php?tag_id=4002).

## 1.12 Canal View

**Rules** (https://puzz.link/js/pzpr-samples/canal.js): "Shade some cells on the board.
1. The number on a cell indicates how many cells are shaded in a continuous line starting
from the cell. These lines are in the four cardinal directions (up, down, left, right).
2. You cannot shade a cell with a number. 3. The shaded cells cannot form a 2x2 square.
4. All shaded cells form an orthogonally contiguous area." Invented by Prasanna Seshadri.

**Structure.** Decision: binary shade. Global: connected shaded set, no 2x2 shaded.
Clues: the count of shaded cells in the four runs radiating from the clue — the shaded
mirror image of Kurodoko's clue.

**Sudoku hybrid suitability: Workable.** Same shape as Kurodoko and Cave, with the same
range problem (a clue can exceed 9) and the same fix. It is a less distinctive genre than
either — Canal View is essentially Nurikabe's wall with Kurodoko's clue — so if you build
one of the visibility-clue shading genres, build Cave or Kurodoko first and get Canal
View as a rule tweak on the same component.

**Existing hybrids:** none found under that name (searched: LMD portal, GM Puzzles,
general web). The Nurikabe Sudoku LMD 000MU6 and Colossal Nurikabe Sudoku 000DZI both use
*exactly* the Canal View clue ("cells with arrow(s) contain the total number of shaded
cells visible in the direction of the arrow(s)", "the total number of water cells seen in
all four directions from that cell, including itself"), so the clue type is in active
hybrid use even though the genre name is not
(https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000MU6,
https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000DZI).

## 1.13 Kurotto (クロット)

**Rules** (https://puzz.link/js/pzpr-samples/kurotto.js): "Shade some cells on the board.
1. Cells with circles cannot be shaded. 2. Numbers indicate the sum of the size of all
blocks that share at least one border with the circle." Nikoli vol. 138.

**Structure.** Decision: binary shade. Global: none — no connectivity, no 2x2 rule. Clues:
per-circle, the summed size of all orthogonally adjacent shaded blocks.

**Sudoku hybrid suitability: Good, and unusually cheap.** Kurotto has *no global
constraint at all*, which means the whole puzzle lives in the clues. That is ideal for a
constraint component: no connectivity propagator, no 2x2 scan, just a block-size sum per
clue cell. The digit hook is immediate — the digit in a circled cell is its Kurotto
number — and the sum can exceed 9, which setters handle by using it as a cage-sum-like
quantity rather than a single digit. It is the shading genre whose difficulty profile
depends most on the digits, since with no global rule the shading cannot self-solve.

**Existing hybrids:**
- *Sudokurotto* by Phistomefel is named as the direct inspiration for the Shikaku-Sudoku
  hybrids *Shikasudoku* (LMD 00087H,
  https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=00087H) and *Shikasudoku
  2* (LMD 00093U, https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=00093U) —
  a Kurotto x Sudoku hybrid by the most prolific setter of this kind of hybrid.
- LMD carries a Kurotto tag (https://logic-masters.de/Raetselportal/?chlang=en).

## 1.14 Mochikoro and Mochinyoro (もちこ / もちにょろ)

**Rules** — Mochikoro (https://puzz.link/js/pzpr-samples/mochikoro.js): "Shade some cells
on the board to form regions of unshaded cells. 1. All regions must be rectangular in
shape. 2. A region can have no more than one number. 3. A number indicates the size of the
region that contains it. 4. You cannot shade a cell with a number. 5. The shaded cells
cannot form a 2x2 square. 6. All unshaded rectangles form a diagonally contiguous area."
Nikoli vol. 100. Mochinyoro (https://puzz.link/js/pzpr-samples/mochinyoro.js) is the same
with one extra rule: "1. Shaded blocks must not form rectangles or squares."

**Structure.** Decision: binary shade. Global: every white region is a rectangle; the
white regions are *diagonally* connected as a set; no 2x2 shaded. Clues: optional size
numbers, at most one per rectangle — note the "no more than one", which allows unclued
rectangles, unlike Nurikabe.

**Sudoku hybrid suitability: Workable.** The rectangle rule is a real structural hook
(rectangle area = digit, digits in a rectangle don't repeat) and a 9-cell rectangle is
1x9, 3x3 or 9x1 — all meaningful shapes on a Sudoku grid. Against it: diagonal
connectivity of regions is an awkward global to propagate, unclued rectangles weaken the
clue chain, and Shikaku (3.4) already gives you "digit = rectangle area" with a cleaner
ruleset and real hybrid evidence. Build Shikaku instead.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 1.15 Light and Shadow

**Rules** (https://puzz.link/js/pzpr-samples/lightshadow.js): "Shade some cells on the
board to form shaded and unshaded areas. 1. Each orthogonally connected area contains
exactly one clue. 2. The color of clued cells cannot be changed. 3. A clue represents the
size of the area of shaded or unshaded cells that the clue belongs to."

**Structure.** Decision: binary shade. Global: *both* colours partition into areas, each
containing exactly one clue. Clues: area size, given on a pre-coloured cell.

**Sudoku hybrid suitability: Good.** This is Nurikabe made symmetric — both colours are
regions with size clues — and symmetry is what makes a hybrid layer engage every cell.
Area size in 1..9 is exactly the digit range, so "the digit in a clue cell is the size of
its area" works on both colours without overshoot. No 2x2 rule and no global connectivity
means the propagator is just connected-component sizing, the same machinery as Nurikabe
but with no wall constraint. Underexplored and worth building.

**Existing hybrids:** none found under this name (searched: LMD portal, GM Puzzles,
general web). The closest published thing is the Nurikabe Sudoku family (1.1), which uses
one colour's area sizes. [unverified as absence]

## 1.16 Chocona (チョコナ)

**Rules** (https://puzz.link/js/pzpr-samples/chocona.js): "Shade some cells on the board.
1. A group of orthogonally connected shaded cells is called a block. Each block must be a
filled rectangle or square. 2. Numbered regions must contain the indicated amount of
shaded cells."

**Structure.** Decision: binary shade. Global: every shaded block is a filled rectangle.
Clues: a shaded-cell count per outlined region.

**Sudoku hybrid suitability: Good, and directly relevant to this repo.** The clue is a
per-region shaded count, which on a 9x9 maps to "the digit says how many cells in this
box are shaded" — in range, no contortion, exactly the Heyawake hook without Heyawake's
awkward rule 3. The rectangle rule is a purely local shape property (a block is a
rectangle iff it has no notch), which propagates well. This repo already has a
rectangle-shading body of work — the Renbanana chocolate rectangle catalogue at
`docs/research/renbanana/rectangle-catalogue.json` and
`docs/research/choco-banana-propagation.md` — so a Chocona component would reuse existing
machinery rather than start cold.

**Existing hybrids:** none found under the name Chocona (searched: LMD portal, GM
Puzzles, general web), but the rectangle-shading-plus-sudoku idea is live in this repo's
own Renbanana work and in Choco Banana (1.20). [unverified as absence]

## 1.17 Stostone (ストストーン)

**Rules** (https://puzz.link/js/pzpr-samples/stostone.js): "Shade some cells on the board
to form blocks. 1. All regions contain exactly one block, which is an orthogonally
connected group of shaded cells. 2. A number indicates the size of the block in the
region. 3. Shaded cells cannot be adjacent across region borders. 4. If all of the blocks
were to fall straight down without changing shape, they must completely fill the bottom
half of the grid." Nikoli vol. 156.

**Structure.** Decision: binary shade. Global: one block per region, blocks separated
across region borders, and the gravity rule — the blocks tile the bottom half exactly.
Clues: block size per region.

**Sudoku hybrid suitability: Workable, and distinctive.** Block size per region = digit
per box is a clean hook (1..9, in range). The gravity rule is genuinely novel and would
make an unusual constraint, but it is global, non-local and awkward: it constrains the
multiset of column heights after a simulated fall, which no candidate-grid propagator
expresses naturally. On a 9x9, "fill the bottom half" is ill-defined for an odd height —
the genre expects an even number of rows. That mismatch alone argues against 9x9.

**Existing hybrids:** LMD carries a Stostone tag
(https://logic-masters.de/Raetselportal/?chlang=en). No Stostone x Sudoku hybrid found
(searched: LMD portal, GM Puzzles, general web). [unverified as absence]

## 1.18 Nuribou (ぬりぼう)

**Rules** (https://puzz.link/js/pzpr-samples/nuribou.js): "Shade some cells on the board
to form regions of unshaded cells. 1. Each region contains exactly one number. 2. A number
indicates the size of the region that contains it. 3. You cannot shade a cell with a
number. 4. Shaded cells must form rectangular blocks with a width of 1. 5. Two blocks of
the same size cannot be diagonally adjacent." Nikoli vol. 68.

**Structure.** Decision: binary shade. Global: every shaded block is a 1-wide bar; equal
bars not diagonally adjacent. Clues: white region sizes, one per region.

**Sudoku hybrid suitability: Workable.** It is Nurikabe with the wall replaced by bars,
which swaps a connectivity global for a shape global — cheaper to propagate and arguably
more interesting. The digit hooks are the same as Nurikabe's (region size = digit) with
the bonus that bar *length* is also a number in 1..9. Not obviously better than Nurikabe,
which has the hybrid track record, so this is a second-wave candidate.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 1.19 Norinori (のりのり)

**Rules** (https://puzz.link/js/pzpr-samples/norinori.js): "Shade some cells on the board.
1. Each shaded cell is orthogonally adjacent to exactly one other shaded cell. 2. Each
outlined region contains exactly 2 shaded cells." Nikoli vol. 124. The LMD wiki phrases it
identically (https://wiki.logic-masters.de/index.php/Norinori/en).

**Structure.** Decision: binary shade. Global: the shaded set is a perfect matching of
dominoes (every shaded cell in exactly one horizontal or vertical pair), and exactly two
shaded per region. Dominoes may cross region borders — that is the whole trick. Clues:
the region partition only.

**Sudoku hybrid suitability: Good, and very cheap.** Two shaded per box on a 9x9 is
exactly 18 shaded cells in 9 dominoes. No connectivity, no 2x2, no counting clues — the
entire constraint is local (a cell's shaded neighbours number exactly one) plus a per-box
count of two. That is the cheapest non-trivial `update` in this survey. The digit hook has
to be added by the setter, and the obvious ones are strong: the two digits of a domino
sum to a constant, or the two shaded digits in each box are a fixed pair. Fits 9x9
exactly; the box partition is free.

**Existing hybrids:** LMD carries a Norinori tag
(https://logic-masters.de/Raetselportal/?chlang=en). No titled "Norinori Sudoku" surfaced
this round (searched: LMD portal, GM Puzzles, general web). Given how clean the fit is,
this reads as an opportunity rather than a warning. [unverified as absence]

## 1.20 Choco Banana (チョコバナナ)

**Rules** (https://puzz.link/js/pzpr-samples/cbanana.js): "Shade some cells on the board.
1. A group of shaded cells must form a rectangle or square. 2. A group of unshaded cells
must not form a rectangle or square. 3. A number indicates the size of the (shaded or
unshaded) group that overlaps it. A group can contain one or more numbers, or none at
all." Nikoli vol. 176.

**Structure.** Decision: binary shade. Global: every shaded group is a rectangle, every
unshaded group is *not* a rectangle. Clues: group size on either colour; a group may carry
several clues or none.

**Sudoku hybrid suitability: Good, and this repo has already done the work.** The clue is
a group size in the digit range, applying to both colours, so every digit can participate.
The anti-rectangle rule on the white side is the unusual half and is what stops the
shading from collapsing. This repo has `docs/research/choco-banana-propagation.md` and the
Renbanana rectangle catalogue, i.e. the propagation study for this exact genre is on file
— read it before building.

**Existing hybrids:** this repo's own Renbanana work is the closest instance on hand
(`docs/research/renbanana/`). No external Choco Banana x Sudoku hybrid found (searched:
LMD portal, GM Puzzles, general web). [unverified as absence]

## 1.21 Shimaguni (島国, "Islands")

**Rules** (https://puzz.link/js/pzpr-samples/shimaguni.js): "Shade some cells on the board
to form islands. 1. All regions contain exactly one island, which is an orthogonally
connected group of shaded cells. 2. A number indicates the size of the island in the
region. 3. Shaded cells cannot be adjacent across region borders. 4. Two regions which
share a border must have islands of different sizes." Nikoli vol. 117.

**Structure.** Decision: binary shade. Global: one connected island per region, islands
separated across borders, neighbouring regions' islands differ in size. Clues: island size.

**Sudoku hybrid suitability: Good.** Island size per box = digit, in range 1..9, and rule
4 is *exactly* the Fillomino/Sudoku-style "adjacent regions differ" logic that variant
setters already like. On a 9x9 with the nine boxes as regions, rule 4 becomes a small
graph-colouring-style constraint on nine numbers — the same shape as a Latin-square
argument, which composes with Sudoku logic rather than sitting beside it. Cheaper than
Stostone (no gravity), more interesting than Chocona (rule 4 adds cross-box reasoning).

**Existing hybrids:** LMD carries a Shimaguni tag
(https://logic-masters.de/Raetselportal/?chlang=en). No titled Shimaguni Sudoku found
(searched: LMD portal, GM Puzzles, general web). [unverified as absence]

## 1.22 Aqre

**Rules** (https://puzz.link/js/pzpr-samples/aqre.js): "Shade some cells on the board.
1. Numbered regions must contain the indicated amount of shaded cells. 2. There may not be
a horizontal or vertical run of 4 or more consecutive shaded or unshaded cells. 3. All
shaded cells form an orthogonally contiguous area." Invented by Eric Fox.

**Structure.** Decision: binary shade. Global: connected shaded set; no run of 4 in either
colour. Clues: shaded count per region.

**Sudoku hybrid suitability: Good.** Rule 2 is the star: a run-length bound in both
colours is a strictly local, cheap, highly constraining rule that forces shading to
alternate on a scale that a 9-wide row notices — three-on, one-off patterns and their
consequences. Combined with "the digit says how many cells in its box are shaded" (in
range), this is one of the better modern shading genres for a hybrid, and Eric Fox's own
puzzles show it composes. Implementation: run-length constraints are the easiest thing in
this entire survey to write soundly, and the only global is one-sided connectivity.

**Existing hybrids:** none found under the name Aqre (searched: LMD portal, GM Puzzles,
general web). Eric Fox is also the author of the genre-fusion *Tapa / Nurikabe* LMD 00043P
(https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=00043P).
[unverified as absence]

## 1.23 Aquapelago

**Rules** (https://puzz.link/js/pzpr-samples/aquapelago.js): "Shade some cells on the
board. Some shaded cells may be given. 1. Shaded cells cannot be horizontally or
vertically adjacent. 2. The unshaded cells cannot form a 2x2 square. 3. A number indicates
the amount of cells in its diagonally connected group of shaded cells. 4. All unshaded
cells on the board form an orthogonally connected area." Invented by Walker Anderson.

**Structure.** Decision: binary shade. Global: shaded orthogonally non-adjacent but
*diagonally* grouped, unshaded connected with no white 2x2. Clues: diagonal-group size.

**Sudoku hybrid suitability: Workable.** Diagonal connectivity is a genuinely different
adjacency and makes for unusual logic; group size is in the digit range. Against it: the
no-white-2x2 rule combined with orthogonal non-adjacency of shaded cells forces a high
shading density that leaves the digit layer little room, and diagonal component sizing is
a second connectivity propagator on top of the orthogonal one. A second-wave candidate.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 1.24 Minesweeper

**Rules** (https://puzz.link/js/pzpr-samples/mines.js): "Locate the cells containing a
mine in the grid. 1. Numbers indicate the amount of mines in the orthogonally and
diagonally adjacent cells. 2. A number cannot contain a mine." The LMD wiki adds that the
total mine count is normally given and that grid size and mine count vary
(https://wiki.logic-masters.de/index.php/Minesweeper/en).

**Structure.** Decision: binary (mine / no mine). Global: usually a total mine count; no
connectivity, no shape rule. Clues: 8-neighbourhood mine counts, on non-mine cells.

**Sudoku hybrid suitability: Good.** The clue is a count in 0..8 in a single cell —
squarely in digit range — so "the digit in a non-mine cell counts the mines around it" is
a direct, natural, two-way hook, and it is the form actually published. No global
connectivity at all, so implementation is pure local propagation over the 8-neighbourhood:
cheap and sound. The one design risk is that Minesweeper counting and Sudoku counting can
decouple if the setter is not careful, so the interaction rules (mines occupy digits, or
rows/columns/boxes each hold a fixed number of mines) carry the puzzle.

**Existing hybrids:**
- *Minesweeper (Sudoku)* by Serkan Yürekli, GM Puzzles, 2022-07-21
  (https://www.gmpuzzles.com/blog/2022/07/minesweeper-sudoku-by-serkan-yurekli/):
  "Standard Minesweeper rules. Also, each row, column, and bold region must contain
  exactly three mines."
- *Minesweeper Sudoku*, LMD 000CW1
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000CW1):
  "Each value in the sudoku that is not a mine gives the number of mines around the cell.
  Note, mine cells can have any value", plus arrow, killer-cage and 2x2 rules.
- GM Puzzles has a Minesweeper category with 65 posts
  (https://www.gmpuzzles.com/blog/category/objectplacement/minesweeper/), and LMD carries
  a Minesweeper tag (https://logic-masters.de/Raetselportal/?chlang=en).

## 1.25 Battleships (Bimaru, Solitaire Battleships)

**Rules** (https://puzz.link/js/pzpr-samples/battleship.js): "Place every ship from the
fleet into the grid. Ships can be rotated or mirrored. 1. All ships must be used exactly
once. There cannot be ships in the grid that aren't present in the bank. 2. Two ships
cannot be orthogonally or diagonally adjacent. 3. Numbers outside the grid indicate how
many cells in the row or column are occupied by ships. 4. Some ship segments are given
(corner pieces, centers, or single-length boats), along with their orientation. Gray cells
represent ship segments of unknown shape. 5. Cells marked with water cannot be used by
ships."

**Structure.** Decision: binary occupancy, plus a segment-orientation refinement. Global:
an exact fleet multiset, king-move separation between distinct ships. Clues: outside
row/column occupancy counts, plus given segments.

**Sudoku hybrid suitability: Good, and long-established.** Outside counts are exactly the
outside-clue idiom Sudoku variants already use, the fleet gives a strong global that is
easy to state and to propagate as a placement enumeration, and separation is a king-move
rule. The published hybrid is old enough to have appeared at a world championship. Digit
hooks in use: digits on ship cells, digits summing per ship, ship cells being a fixed
parity.

**Existing hybrids:**
- *Battleship Sudoku*, from the 2007 Sudoku Championship instruction booklet, reproduced
  with rules at Erasable Games (https://erasablegames.com/battleship-sudoku/): "Two games
  in one: Battleship and Sudoku. There are fewer Sudoku clues and added Battleship clues.
  Use both sources to solve both objectives."
- GM Puzzles runs Battleship Sudoku as a standing category with 7 posts
  (https://www.gmpuzzles.com/blog/category/sudoku/battleship-sudoku/) alongside 109
  classic Battleships posts
  (https://www.gmpuzzles.com/blog/category/objectplacement/battleships/).
- LMD carries a Battleships tag (https://logic-masters.de/Raetselportal/?chlang=en), and
  the wiki carries eight derived Battleship genres including *Japanese Battleships* and
  *Numerical Battleships* (https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en).

## 1.26 Akari / Light Up (美術館, "Bijutsukan")

**Rules** (https://wiki.logic-masters.de/index.php/Akari/en): "Place a lightbulb in some
cells so that all cells in the grid are lightened. Lightbulbs can give light in straight
lines until the rays meet a black cell or the edge of the grid. Lightbulbs should not
lighten each other. A digit in a cell indicates the number of the lightbulbs that are
adjacent to that cell." Invented by Nikoli, 2001
(https://erasablegames.com/akari-light-up-on-sudoku/). puzz.link's rules file for `akari`
is the one file in the corpus that does not carry a parseable rules string, so the LMD
wiki is the source here.

**Structure.** Decision: binary (bulb / no bulb) on white cells. Global: every white cell
is lit, no two bulbs see each other. Clues: orthogonal bulb counts (0..4) on black cells,
plus the black-cell layout, which is given.

**Sudoku hybrid suitability: Workable.** The clue range 0..4 is comfortably inside the
digit range and the "no two bulbs see each other" rule is a row/column visibility
constraint that Sudoku machinery handles. The obstacle is structural: Akari needs a given
set of black cells to be interesting, and a Sudoku grid has no black cells to give — so
the hybrid must either derive the blockers from the digits (a second decision layer) or
overlay a fixed pattern, which makes the two halves sit beside each other. Real but
second-tier.

**Existing hybrids:** *Akari (Light Up) on Sudoku*, Erasable Games, 2007-12-24 by Robert
Katz (https://erasablegames.com/akari-light-up-on-sudoku/) — an adapted Akari on a Sudoku
frame. LMD carries an Akari tag (https://logic-masters.de/Raetselportal/?chlang=en). Thin
evidence compared with the genres above.

## 1.27 Dominion

**Rules** (https://puzz.link/js/pzpr-samples/dominion.js): "Shade some cells on the board
to divide all unshaded cells into regions. 1. All shaded cells are orthogonally adjacent to
exactly one other shaded cell. 2. Cells with letters cannot be shaded. 3. All identical
letters must be in the same region. There can not be a region without any letters.
4. Different letters must be in different regions. 5. Question marks can be replaced with
any letter, as long as it appears elsewhere on the grid." Invented by Inaba Naoki.

**Structure.** Decision: binary shade. Global: shaded cells form dominoes (as in
Norinori), unshaded cells partition into regions with a letter-consistency condition.
Clues: letters.

**Sudoku hybrid suitability: Workable.** Replace letters with digits and rule 3 becomes
"all cells holding the same digit are in one unshaded region", rule 4 "different digits in
different regions" — which on a Sudoku grid means the nine cells of each digit would have
to be co-regional, a very strong and probably over-tight condition. Restrict the letters
to a subset of the grid and it becomes workable and genuinely novel. The domino rule is
the cheap part (shared with Norinori). Interesting, but needs design work before it is a
component.

**Existing hybrids:** LMD carries a Dominion tag
(https://logic-masters.de/Raetselportal/?chlang=en). No Dominion x Sudoku hybrid found
(searched: LMD portal, GM Puzzles, general web). [unverified as absence]

## 1.28 Cross the Streams

**Rules** (https://puzz.link/js/pzpr-samples/cts.js): "Shade some cells on the board
according to the numbers. 1. Clues outside the grid represent the lengths of each of the
blocks of consecutive shaded cells in the corresponding row or column, in order from left
to right or top to bottom. 2. A question mark represents a block of any length (at least
1). 3. An asterisk represents an unknown amount of blocks of any length. An asterisk may
also be meaningless, i.e. represent no blocks at all. 4. The shaded cells cannot form a
2x2 square. 5. All shaded cells form an orthogonally contiguous area." Invented by Grant
Fikes; GM Puzzles runs it as a standing category with 95 posts
(https://www.gmpuzzles.com/blog/category/shading/cross-the-streams/).

**Structure.** Decision: binary shade. Global: connected shaded set, no 2x2 shaded. Clues:
ordered run-length sequences outside the grid, with wildcards — i.e. a nonogram clue plus
two global rules.

**Sudoku hybrid suitability: Workable.** Outside run-length clues are an established
Sudoku idiom (Japanese Sums is the number-placement cousin), and the wildcard mechanism
means the clue layer can be as loose as the setter wants — useful for keeping the shading
from self-solving. The digit hook is not native, so the setter supplies it; the natural one
is "the shaded digits in each row, in order, are the run lengths", which closes the loop
nicely. Implementation is a line-solver per row and column plus the two globals.

**Existing hybrids:** LMD carries a Cross the Streams tag
(https://logic-masters.de/Raetselportal/?chlang=en). The direct number-placement analogue,
Japanese Sums, is a standing GM Puzzles genre with 30 posts
(https://www.gmpuzzles.com/blog/category/numberplacement/japanese-sums/) and is in effect
Cross the Streams with digits instead of shading — the clearest evidence that this clue
type carries a hybrid. No titled Cross the Streams x Sudoku found. [unverified as absence]

## 1.29 Coral (Coralfinder)

**Rules** (https://puzz.link/js/pzpr-samples/coral.js): "Shade some cells on the board
according to the numbers. 1. Clues outside the grid represent the lengths of each of the
blocks of consecutive shaded cells in the corresponding row or column, not necessarily in
order. 2. Rows or columns without numbers can contain any amount of shaded cells. 3. All
unshaded cells are connected through other unshaded cells to the outside of the grid.
4. The shaded cells cannot form a 2x2 square. 5. All shaded cells form an orthogonally
contiguous area." LMD wiki, under Coralfinder, adds that the coral "cannot touch itself
and cannot have any holes inside it"
(https://wiki.logic-masters.de/index.php/Coralfinder/en).

**Structure.** As Cross the Streams, but the run lengths are unordered and the white set
must reach the border (no holes). Clues: unordered multisets outside the grid.

**Sudoku hybrid suitability: Workable.** Same verdict as Cross the Streams; the unordered
clue is weaker per clue but the no-holes rule is a strong global that a solver can use.
Pick one of the two if you build this family; Cross the Streams has the better wildcard
vocabulary for tuning a hybrid.

**Existing hybrids:** LMD carries a Coral tag
(https://logic-masters.de/Raetselportal/?chlang=en), and the wiki carries *Easy As
Coralfinder* as a derived genre
(https://wiki.logic-masters.de/index.php/Easy_As_Coralfinder/en). No Coral x Sudoku hybrid
found. [unverified as absence]

## 1.30 Creek

**Rules** (https://puzz.link/js/pzpr-samples/creek.js): "Shade some cells on the board.
1. Numbers indicate the amount of shaded cells which overlap the clue. 2. All unshaded
cells on the board form an orthogonally connected area." Nikoli vol. 110. Clues sit on
grid *vertices*, so "overlap the clue" means the up-to-four cells touching that vertex.

**Structure.** Decision: binary shade. Global: unshaded connected. Clues: a 0..4 count at
each grid vertex.

**Sudoku hybrid suitability: Workable, with one real attraction.** The clue lives on a
vertex, not a cell — so a Creek hybrid puts its clues in the *gaps* between digits, which
is the same real estate Kropki dots and XV pairs use and which therefore costs the Sudoku
nothing. Count range 0..4, in digit range. Against it: the only global is white
connectivity, so the shading is loosely determined and needs many clues, which clutters
the vertex layer. Genuinely novel placement, moderate payoff.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 1.31 Tetrochain

**Rules** (https://puzz.link/js/pzpr-samples/tetrochain.js): "Place several tetrominoes
(blocks of 4 cells) in the grid. 1. Tetrominoes cannot be orthogonally adjacent.
2. Tetrominoes cannot overlap a number. 3. A number indicates the amount of cells used by
tetrominoes in the given direction. 4. Two tetrominoes which touch each other at the
corners must have different shapes, counting rotations and reflections as the same.
5. All tetrominoes form a diagonally contiguous area." Nikoli vol. 181.

**Structure.** Decision: binary occupancy constrained to tetromino shapes. Global:
diagonal chain connectivity, orthogonal separation, corner-touching shapes differ. Clues:
directional counts from a clue cell.

**Sudoku hybrid suitability: Poor.** It is LITS with the region partition removed and
replaced by a diagonal-chain global, which trades the one thing that made LITS fit a 9x9
(the box partition) for a harder global. The directional clue is fine; everything else is
expensive. Build LITS instead.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 1.32 Tetrominous — see 3.9 (region division)

Tetrominous divides the grid into tetrominoes rather than shading cells; it belongs to the
region family and is covered there.

## 1.33 Yajilin — see 2.4 (loops)

Yajilin has a shading layer (unused cells are shaded, and shaded cells may not be
adjacent) but its primary decision layer is a loop, so it is covered in the loop section.

## 1.34 Others found on the shading index worth naming

The puzz.link shading index (https://puzz.link/list.html) carries 61 shading genres. The
ones not treated above and their one-line rules, all from
`https://puzz.link/js/pzpr-samples/<pid>.js`:

| Genre | Rule core | Hybrid note |
| --- | --- | --- |
| Tasquare (`tasquare`) | Shaded blocks are filled squares; a clue is the summed size of all blocks bordering it; unshaded connected | Kurotto with a square-shape rule. Same hooks as Kurotto, slightly tighter. Workable |
| Lookair (`lookair`) | Every shaded group is a filled square; a clue counts shaded cells in the 5-cell plus-shape around it; equal squares may not see each other in a row or column | The "see each other" rule is Sudoku-shaped. Workable |
| Nothree (`nothree`) | Shaded cells non-adjacent; each circle overlaps exactly one shaded cell; three shaded in a line must have distinct gaps; unshaded connected | The distinct-gaps rule is a genuinely arithmetic constraint, unusual and Sudoku-compatible. Workable |
| Box (`box`) | Row and column values given; top/left clues sum the values of rows/columns with a shaded cell in that line | Pure arithmetic over a binary layer. Workable but flavourless |
| Aquarium (`aquarium`) | Grid is a side-view aquarium; outside clues count shaded cells per row/column; water fills from the bottom of each tank and levels out | Gravity per region. The level rule is a nice global; outside counts are the standard Sudoku idiom. Workable. Invented by Inaba Naoki. LMD carries an Aquarium tag |
| Norinuri (`norinuri`), Nuriuzu (`nuriuzu`), Chained Block (`chainedb`), International Borders (`interbd`), Circles and Squares (`circlesquare`), Mr. Tile (`mrtile`), Tilepaint (`tilepaint`), Paint Area (`paintarea`), Parquet (`parquet`), Hinge (`hinge`), Cocktail Lamp (`cocktail`), Kuroclone (`kuroclone`), Martini (`martini`), Patchwork (`patchwork`), Mannequin Gate (`mannequin`), Usoone (`usoone`), Kurochute (`kurochute`), One Room One Door (`oneroom`), Context (`context`), Akichiwake (`akichi`), Guide Arrow (`guidearrow`), Nuri-Maze (`nurimaze`), Invasion LITS (`invlitso`) | Rules at the cited URL pattern | None reached the bar for a full entry: either the rule set is a minor variation on one above, or the decision layer is not a per-cell binary, or no plausible digit hook exists. Rules are on file at the URL pattern above if any is wanted later |

---

# 2. Loop and path puzzles

The decision layer is an edge set, not a cell set: per cell, which of its four sides the
line uses (or, for Slitherlink, which of the grid's vertex-to-vertex edges are on the
loop). Two structural facts dominate this family. First, "single closed loop" is a global
connectivity-plus-degree constraint that no purely local propagator settles, so every
component here pays a connectivity cost. Second, and more important for hybrid design: a
loop imposes an *order* on the cells it visits, and order is the one thing a Sudoku grid
does not otherwise have. That is the hook worth chasing.

## 2.1 Slitherlink (スリザーリンク; Fences, Rundweg, Loop the Loop, Number Line)

**Rules** (https://puzz.link/js/pzpr-samples/slither.js): "Draw lines along the edges of
some cells to form a loop. 1. The loop cannot branch off or cross itself. 2. A number
indicates the amount of edges surrounding the cell that are visited by the loop." Nikoli
vol. 26. The LMD wiki files it under *Fences*
(https://wiki.logic-masters.de/index.php/Slitherlink/en redirects there), and the LMD
portal's Slitherlink collection page states it as "Digits in the grid indicate how many
edge pieces that are adjacent to a grid cell (from 0 to 3) belong to the loop"
(https://logic-masters.de/Raetselportal/Suche/spezial.php?chlang=en&listname=rundwege).

**Structure.** Decision: one bit per *grid edge* (2 x 9 x 10 = 180 edges on a 9x9). Global:
the chosen edges form a single closed curve — every vertex has degree 0 or 2, and the
edge set is connected. Clues: a per-cell count 0..3 of used surrounding edges. Derived
structure worth exploiting: the loop partitions cells into inside and outside, which is a
free binary shading layer.

**Sudoku hybrid suitability: Good.** Two hooks, both used in published puzzles. The direct
one: the digit in a cell is its Slitherlink clue — but the clue range is 0..3 and digits
run 1..9, so setters remap (the LMD puzzle below makes 4s behave as 0s and leaves 5-9
inert). The better one: use the inside/outside partition the loop induces as a shading
layer and constrain digits by it, which sidesteps the range mismatch entirely. Cost:
180 edge variables plus a connectivity propagator — the most expensive decision layer in
this survey, and `update` soundness is genuinely hard, because "this edge cannot be used"
usually follows from a global parity or connectivity argument, not a local one.

**Existing hybrids:** well attested.
- *Slitherlink Sudoku*, LMD 000H6A
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000H6A): normal
  Sudoku plus killer cages; "Draw a Slitherlink along the lines of the grid that passes
  through every cage"; "1s, 2s, and 3s are normal Slitherlink clues. 4s are 0s for the
  purposes of Slitherlink"; regions between the grid edge and the loop contain no 2x2
  areas and no repeated digits. Tagged "Sudoku, Slitherlink, Killer (Variant)".
- *Slitherlink Sum Sudoku* by hurrdurr, 2026-02-09, and *Slitherlink Yin Yang* by yttrio,
  2025-03-22 (83 solvers, 99%), both listed on the LMD Slitherlink collection page
  (https://logic-masters.de/Raetselportal/Suche/spezial.php?chlang=en&listname=rundwege);
  the same page lists *Filtered Out (fillomino/slitherlink)* by jwsinclair and *Japanese
  Slitherlink* by KNT, i.e. Slitherlink crossed with a region genre and with a
  number-placement clue type.
- LMD carries a Slitherlink tag (https://logic-masters.de/Raetselportal/?chlang=en); GM
  Puzzles has 121 Slitherlink posts
  (https://www.gmpuzzles.com/blog/category/loop/slitherlink/).

## 2.2 Masyu (ましゅ, "Mashu"; Pearl Necklace, White and Black Pearls)

**Rules** (https://puzz.link/js/pzpr-samples/mashu.js): "Draw lines through orthogonally
adjacent cells to form a loop that goes through every circle. 1. The loop cannot branch
off or cross itself. 2. The loop must turn on black circles and travel straight through
the cells before and after the circle. 3. The loop must go straight through white circles,
and turn in at least one of the cells on either side." Nikoli vol. 90; Nikoli's own
English page gives the same four rules (https://www.nikoli.co.jp/en/puzzles/masyu/).

**Structure.** Decision: per-cell loop shape (unused, or one of two straights and four
turns). Global: one closed loop, not required to visit every cell. Clues: white and black
circles constraining the loop's behaviour at and adjacent to a cell.

**Sudoku hybrid suitability: Good.** The Masyu clue is about *shape at a cell*, which
composes with digits in an obvious way: the circle colour is decided by the digit's parity,
or a digit says how long the straight segment through it is, or the loop's visit order
through the circles is read off as digits. It does not need every cell on the loop, which
leaves the unused cells free for pure Sudoku work — that is what keeps a Masyu hybrid from
feeling like two puzzles. The published hybrid form is the cleanest in the loop family:
digits in some cells, loop through the rest.

**Existing hybrids:** the strongest evidence in the loop family.
- *Masyudoku* is a **named genre in its own right** on the LMD wiki
  (https://wiki.logic-masters.de/index.php/Masyudoku/en): "Fill some cells with digits 1
  to 6 so that each digit appears exactly once in every row, column and outlined region.
  All cells that are not filled with digits should be traversed with a Masyu loop."
- *Massive Masyudoku*, LMD 000SRW, 2026-05-12
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000SRW): a Masyu grid
  beside a Region-Sum-Lines Sudoku, with the interaction "the digits in the RSL sudoku
  grid state how many cells the loop visits in the corresponding 2x3 area of the Masyu".
- *Masyu-Slitherlink* is also a wiki genre
  (https://wiki.logic-masters.de/index.php/Masyu-Slitherlink/en), and the portal carries a
  *Variables Tapasyu* (Tapa x Masyu) entry
  (https://logic-masters.de/Raetselportal/?chlang=en).
- *Polysemy (Castle wall/Masyu/Knapp daneben)*, LMD 000OUD
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000OUD), from the Sudoku
  Skunkworks Discord's Puzzle Agency Contest.
- GM Puzzles runs *Castle Wall (Masyu)* hybrids as a standing form
  (https://www.gmpuzzles.com/blog/2021/08/castle-wall-masyu-by-mark-sweep/,
  https://www.gmpuzzles.com/images/puzzles/190618-CastleWall-Masyu.pdf), and has 121 Masyu
  posts (https://www.gmpuzzles.com/blog/category/loop/masyu/).

## 2.3 Country Road (カントリーロード)

**Rules** (https://puzz.link/js/pzpr-samples/country.js): "Draw lines through orthogonally
adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. Every
country must be visited exactly once. 3. A number indicates how many cells inside the
country are visited by the loop. 4. Two adjacent cells in different countries cannot both
be unused by the loop." Nikoli vol. 65. LMD wiki agrees
(https://wiki.logic-masters.de/index.php/Country_Road/en).

**Structure.** Decision: per-cell loop shape. Global: one loop; each region entered
exactly once (a strong regional constraint); no two unused cells adjacent across a region
border. Clues: a per-region visit count.

**Sudoku hybrid suitability: Good.** "A number indicates how many cells inside the country
are visited" becomes "the digit says how many cells of its box the loop visits", which is
in range 1..9 and reads naturally. Rule 2 — each region visited exactly once — is a strong,
box-shaped global that gives the solver real leverage without needing many clues. Of the
region-flavoured loop genres this is the best fit for a 9x9 with the boxes as regions.

**Existing hybrids:** LMD carries a Country Road tag
(https://logic-masters.de/Raetselportal/?chlang=en). No titled Country Road x Sudoku
hybrid found (searched: LMD portal, GM Puzzles, CTC, general web). [unverified as absence]

## 2.4 Yajilin (ヤジリン, "Arrow Ring"; also Yajirin)

**Rules** (https://puzz.link/js/pzpr-samples/yajilin.js): "Shade some cells on the board,
and draw a single loop that goes through all remaining cells. 1. The loop cannot branch
off or cross itself. 2. Shaded cells cannot be orthogonally adjacent. 3. Cells with
numbers or question marks cannot be shaded, and are not part of the loop. 4. A number
indicates the amount of shaded cells in the given direction." Nikoli vol. 86. A setter's
statement of the same rules: "Shade some white cells and then draw a single closed loop
through all remaining white cells. Shaded cells cannot share an edge with each other.
Some cells are outlined and in gray and cannot be part of the loop. Numbered arrows in
such cells indicate the total number of shaded cells that exist in that direction in the
grid" (https://swaroopg92.blogspot.com/2022/08/puzzle-no-173-yajilin.html).

**Structure.** Two decision layers at once: binary shade *and* a loop through every
unshaded, unclued cell. Global: one loop covering all non-shaded non-clue cells, shaded
cells non-adjacent. Clues: directional shaded counts on cells that are outside both layers.

**Sudoku hybrid suitability: Workable, verging on Good, but expensive.** The attraction is
that Yajilin already carries both a shading and a loop layer, so a Sudoku hybrid gets two
hooks for one genre: digits on shaded cells, and the loop's visiting order over the
unshaded ones. The cost is that the loop must cover *every* unshaded cell, which is a very
tight Hamiltonian-flavoured condition on a 9x9 and leaves little slack for digit logic; and
the clue cells are excluded from the loop, which on a Sudoku grid means clue cells are
digit cells whose digits are doing double duty awkwardly. Build Masyu or Country Road
first; come back to Yajilin when the loop propagator is mature.

**Existing hybrids:** LMD carries a Yajilin tag
(https://logic-masters.de/Raetselportal/?chlang=en); GM Puzzles has 114 Yajilin posts
(https://www.gmpuzzles.com/blog/category/loop/yajilin/); the wiki carries *Yajilin Plus*
and *Majilin* as derived genres
(https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en). *Koburin* (2.13) is the
Nikoli-published Yajilin variant with adjacency clues. No titled Yajilin x Sudoku hybrid
found (searched: LMD portal, GM Puzzles, CTC, Logic Masters India, general web).
[unverified as absence]

## 2.5 Simple Loop (Loop Special / Pure Loop)

**Rules** (https://puzz.link/js/pzpr-samples/simpleloop.js): "Draw a loop that goes through
every unshaded cell. 1. The loop cannot branch off or cross itself. 2. The loop cannot go
through shaded cells." LMD wiki: "Draw a single closed loop that travels through all white
cells moving horizontally or vertically. The loop cannot cross itself"
(https://wiki.logic-masters.de/index.php/Simple_Loop/en).

**Structure.** Decision: per-cell loop shape. Global: a Hamiltonian circuit on the unshaded
cells. Clues: only the given shaded pattern.

**Sudoku hybrid suitability: Workable, and useful as scaffolding.** On its own it is
clueless, which — as with Yin-Yang — is exactly why it composes: the setter provides all
the clue content from the Sudoku side, typically "digits along the loop, read in order,
obey X". That is the *order* hook, and Simple Loop is the cheapest way to get it since
there is no extra clue vocabulary to implement. It is also the right first loop component
to build, because everything harder in this family is Simple Loop plus clues.

**Existing hybrids:** none found under this name (searched: LMD portal, GM Puzzles, CTC,
general web). The idiom is nonetheless ubiquitous in variant sudoku under other names —
any "draw a path through the grid and the digits along it obey X" ruleset is this
structure. [unverified as absence]

## 2.6 Castle Wall

**Rules** (https://puzz.link/js/pzpr-samples/castle.js): "Draw lines through orthogonally
adjacent cells to form a loop. 1. Lines cannot go through bold borders. 2. White cells
must be inside the loop, and black cells must be outside the loop. 3. A number with an
arrow indicates the number of line segments in that direction. Vertical arrows only count
vertical lines, and horizontal arrows count horizontal lines." Invented by Palmer Mebane.
A setter's fuller phrasing: "Numbers and arrows refer to the total sum of the lengths of
loop segments in the given direction. (An equivalent way to understand these values is to
count the number of cell borders crossed by the loop in that direction.)"
(https://swaroopg92.blogspot.com/2021/06/puzzle-no-157-castle-wall.html).

**Structure.** Decision: per-cell loop shape. Global: one loop; an explicit inside/outside
condition on clue cells. Clues: directional segment counts, each carrying an inside/outside
colour.

**Sudoku hybrid suitability: Good.** Castle Wall is the loop genre that makes the
inside/outside partition *explicit* rather than derived, and inside/outside is a free
binary shading layer over the digits. The clue is a directional count that can be large,
so it works better as a cage-sum-style quantity than a single digit; but the colour half
of the clue (inside vs outside) maps onto a digit property (parity, high/low) at no cost.
GM Puzzles' standing Castle Wall x Masyu form is direct evidence the clue vocabulary
composes.

**Existing hybrids:**
- *Castle Wall (Masyu)*, a repeated GM Puzzles form — by Mark Sweep, 2021-08-20
  (https://www.gmpuzzles.com/blog/2021/08/castle-wall-masyu-by-mark-sweep/), and by Ashish
  Kumar, 2019-06-18
  (https://www.gmpuzzles.com/images/puzzles/190618-CastleWall-Masyu.pdf).
- *Polysemy (Castle wall/Masyu/Knapp daneben)*, LMD 000OUD
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000OUD).
- LMD carries a Castle Wall tag (https://logic-masters.de/Raetselportal/?chlang=en); GM
  Puzzles has 66 Castle Wall posts
  (https://www.gmpuzzles.com/blog/category/loop/castle-wall/). No titled Castle Wall x
  Sudoku found. [unverified as absence]

## 2.7 Balance Loop

**Rules** (https://puzz.link/js/pzpr-samples/balance.js): "Draw lines through orthogonally
adjacent cells to form a loop that goes through every circle. 1. The loop cannot branch
off or cross itself. 2. The straight line segments coming out of a white circle must have
equal length. 3. The straight line segments coming out of a black circle must have
different lengths. 4. Numbers indicate the sum of the length of the line segments."
Invented by Prasanna Seshadri.

**Structure.** Decision: per-cell loop shape. Global: one loop through every circle. Clues:
per-circle equality/inequality of the two arm lengths, plus an optional arm-length sum.

**Sudoku hybrid suitability: Good.** Rule 4 is already a number in a cell, and arm-length
sums on a 9x9 land in a usable range, so "the digit in a circle is its Balance Loop number"
is a direct hook with no remapping. Rules 2 and 3 are equality/inequality constraints — the
same shape as Kropki and inequality clues, which Sudoku solvers read fluently. This is the
loop genre whose clue vocabulary translates into Sudoku terms with the least friction.

**Existing hybrids:** none titled found (searched: LMD portal, GM Puzzles, CTC, general
web). GM Puzzles has 51 Balance Loop posts
(https://www.gmpuzzles.com/blog/category/loop/balance-loop/), so the genre is established
even though the hybrid is not. [unverified as absence]

## 2.8 Double Back

**Rules** (https://puzz.link/js/pzpr-samples/doubleback.js): "Draw a loop that goes through
every unshaded cell. 1. The loop cannot branch off or cross itself. 2. The loop cannot go
through shaded cells. 3. The loop visits each outlined region exactly twice." Invented by
Palmer Mebane.

**Structure.** Simple Loop plus a per-region visit count fixed at two. Clues: the region
partition only.

**Sudoku hybrid suitability: Workable.** With the nine boxes as regions, "the loop enters
and leaves each box exactly twice" is a crisp global that interacts with box structure —
the Sudoku's own unit. It is clueless otherwise, which as before is a virtue for hybrids.
It is strictly less flexible than Country Road (which lets the count vary per region and
therefore be a digit), so prefer Country Road unless you specifically want the fixed-two
rhythm.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.9 Detour

**Rules** (https://puzz.link/js/pzpr-samples/detour.js): "Draw a loop that goes through
every cell. 1. The loop cannot branch off or cross itself. 2. A number indicates how many
times the loop turns inside the outlined region."

**Structure.** Hamiltonian loop over all cells, plus a per-region turn count. Clues: turn
counts.

**Sudoku hybrid suitability: Good.** "How many times the loop turns inside this box" is a
count in 0..9 on a 9x9 box, so the digit hook is direct and in range. Counting turns is a
purely local property of the loop shape at each cell, so the clue propagates cheaply even
though the loop itself does not. The one hard constraint is rule 1's requirement that the
loop cover *every* cell, which on 9x9 is a Hamiltonian circuit on 81 cells — very tight,
and it means the loop layer carries most of the puzzle. Pair it with light Sudoku clues.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.10 Geradeweg

**Rules** (https://puzz.link/js/pzpr-samples/geradeweg.js): "Draw lines through
orthogonally adjacent cells to form a loop that goes through every circle. 1. The loop
cannot branch off or cross itself. 2. Every straight line segment that touches a clue must
have a length equal to the clue's value. 3. A question mark can be replaced with any
number."

**Structure.** Decision: per-cell loop shape. Global: one loop through every circle. Clues:
a segment-length equality at each circle.

**Sudoku hybrid suitability: Good.** Segment lengths on a 9x9 run 1..9 — the digit range
exactly — and the clue is one number in one cell. "The digit in a circled cell is the
length of every straight segment touching it" is about as clean a digit hook as this survey
contains, needing no remapping and no invented rule. The loop need not visit every cell, so
there is slack for pure Sudoku deduction. Of the clued loop genres, this is the one I would
build first after Masyu.

**Existing hybrids:** LMD carries a **Geradeweg tag alongside its Sudoku tag**
(https://logic-masters.de/Raetselportal/?chlang=en), which is the portal's own signal that
the genre is in circulation there. No titled Geradeweg x Sudoku hybrid surfaced this round
(searched: LMD portal, GM Puzzles, CTC, general web). [unverified as absence]

## 2.11 Maxi Loop

**Rules** (https://puzz.link/js/pzpr-samples/maxi.js): "Draw a loop that goes through every
cell. 1. The loop cannot branch off or cross itself. 2. A number indicates the length of
the longest visit to that region." Invented by Inaba Naoki.

**Structure.** Hamiltonian loop over all cells; per-region, the longest single contiguous
visit. Clues: that maximum.

**Sudoku hybrid suitability: Workable.** "Longest visit to this box" is in 1..9, in range,
so the digit hook works. But a maximum is a weaker clue than a count or a length equality
— it constrains one visit and says nothing about the others — and the Hamiltonian
requirement is as tight as Detour's. Detour gives more per clue for the same cost.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.12 Mid-Loop (真ん中のループ)

**Rules** (https://puzz.link/js/pzpr-samples/midloop.js): "Draw lines through orthogonally
adjacent cells to form a loop that goes through every circle. 1. The loop cannot branch off
or cross itself. 2. Each circle marks the center of the straight line segment it lies on."
Nikoli vol. 163. Note: circles sit on cell edges or centres depending on parity, so a
segment of even length has its "centre" on a border.

**Structure.** Decision: per-cell loop shape. Global: one loop through every circle. Clues:
a midpoint assertion — geometric, not numeric.

**Sudoku hybrid suitability: Workable.** The clue carries no number, so a hybrid must add
the digit hook (e.g. the digit at a circle is the length of its segment, which combines
Mid-Loop with Geradeweg). The midpoint rule is elegant and strongly constraining, and it
lives partly on cell borders — the same real estate Kropki dots use, so it costs the Sudoku
nothing visually. A reasonable second-wave pick.

**Existing hybrids:** LMD carries a **Mid-loop tag alongside its Sudoku tag**
(https://logic-masters.de/Raetselportal/?chlang=en). No titled hybrid found.
[unverified as absence]

## 2.13 Koburin (こぶりん)

**Rules** (https://puzz.link/js/pzpr-samples/koburin.js): as Yajilin, except rule 4: "A
number indicates the amount of shaded cells in the (up to) four orthogonally adjacent
cells." Nikoli vol. 116.

**Structure.** As Yajilin (2.4), with a neighbourhood clue in place of a directional one.

**Sudoku hybrid suitability: Workable — better than Yajilin on the clue, same cost on the
loop.** The 0..4 neighbourhood count is squarely in digit range and is the Minesweeper-style
clue that hybrids handle best. Everything else — the Hamiltonian-on-unshaded requirement —
is Yajilin's cost. If you build one of the two, build Koburin.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.14 Myopia

**Rules** (https://puzz.link/js/pzpr-samples/myopia.js): "Draw lines along the edges of
some cells to form a loop. 1. The loop cannot branch off or cross itself. 2. Arrows point
towards the lines closest to the clue. If a clue has multiple arrows, the distance to the
closest line must be the same. Directions without an arrow must have a line further away,
or not have a line in that direction."

**Structure.** Slitherlink's edge decision layer, with a nearest-line directional clue
instead of an edge count.

**Sudoku hybrid suitability: Workable.** The clue is about *which direction is nearest*,
i.e. an argmin — a relational clue, not a count. That is unusual and interesting, and it
composes with digits if you say the digit gives the distance. It inherits Slitherlink's
expensive edge layer without Slitherlink's simple local clue, so it is a harder build for
a comparable payoff.

**Existing hybrids:** LMD carries a **Myopia tag alongside its Sudoku tag**
(https://logic-masters.de/Raetselportal/?chlang=en), and the wiki has a Myopia page in
three languages (https://wiki.logic-masters.de/index.php/Myopia). No titled hybrid found.
[unverified as absence]

## 2.15 Onsen-Meguri (温泉めぐり)

**Rules** (https://puzz.link/js/pzpr-samples/onsen.js): "Draw lines through the center of
some cells to form multiple loops. 1. Loops cannot branch or overlap, and cannot cross
themselves or each other. 2. Every loop goes through exactly one circle, and every circle
must have a loop. 3. Every outlined room must be visited by at least one loop. 4. A loop
can enter and exit a room no more than once. 5. Each loop must visit the same amount of
cells in every room it enters. 6. A number indicates how many cells the loop visits in
each room." Nikoli vol. 155.

**Structure.** Multiple disjoint loops, one per circle. Global: per-room visit counts
constant within a loop (rule 5 is the genre's signature). Clues: that constant.

**Sudoku hybrid suitability: Workable.** Rule 5 — "the same amount of cells in every room"
— is structurally the Region Sum Lines constraint that modern variant Sudoku already uses
heavily, only counting cells rather than summing digits. Swap the count for a digit sum and
you have a ruleset a CTC audience would recognise instantly. That makes it a promising but
derivative pick; it is doing what Region Sum Lines already does, with a loop attached.
Multi-loop bookkeeping is more implementation work than single-loop.

**Existing hybrids:** none found under this name (searched: LMD portal, GM Puzzles, CTC,
general web). The Region Sum Lines analogy is visible in *Massive Masyudoku*, LMD 000SRW
(https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000SRW), which pairs a Masyu
loop with a Region-Sum-Lines Sudoku. [unverified as absence]

## 2.16 Pipelink (パイプリンク) and Loop Special (`loopsp`)

**Rules** — Pipelink (https://puzz.link/js/pzpr-samples/pipelink.js): "Draw a loop that goes
through every cell. 1. Two perpendicular line segments may intersect each other, but they
may not turn at their intersection or otherwise overlap. 2. Some cells have given loop
segments. These cells cannot have other lines added to them." Nikoli vol. 45. Loop Special
(https://puzz.link/js/pzpr-samples/loopsp.js) is the multi-loop version with numbered
circles: "All circles with identical numbers must be part of the same loop, and different
numbers must be in different loops." Nikoli vol. 57.

**Structure.** Decision: per-cell loop shape, *including a crossing state* — so the layer
is larger than the other loop genres. Global: Hamiltonian coverage (Pipelink), or loop
identity classes (Loop Special).

**Sudoku hybrid suitability: Poor to Workable.** Crossings multiply the per-cell state
without adding a digit hook, and Pipelink has essentially no clue vocabulary beyond given
segments. Loop Special's "same number, same loop" is the more interesting half and is a
genuine digit hook — digits as loop identifiers — but it needs several loops to be
meaningful, which crowds a 9x9. Low priority.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.17 Round Trip

**Rules** (https://puzz.link/js/pzpr-samples/roundtrip.js): "Draw lines through orthogonally
adjacent cells to form a loop. 1. The loop cannot branch off or retrace itself. When the
loop visits a cell twice, it must travel in a straight line each time. 2. The numbers to
the left/right of the rows indicate the number of cells visited by the nearest section of
the loop that travels horizontally in that row. Likewise, the numbers to the top/bottom of
the columns indicate the number of cells visited by the nearest section of the loop that
travels vertically in that column." Invented by Craig Kasper.

**Structure.** Loop with crossings allowed, plus outside clues counting the length of the
nearest parallel segment.

**Sudoku hybrid suitability: Workable.** Outside clues are the standard Sudoku idiom, and
"length of the nearest segment" is a 1..9 number — in range. The "nearest" qualifier makes
it a skyscraper-flavoured visibility clue, which this repo already models. Crossings are
the awkward part. A reasonable candidate if you want an outside-clue loop.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web). GM
Puzzles has 18 Round Trip posts
(https://www.gmpuzzles.com/blog/category/loop/round-trip/). [unverified as absence]

## 2.18 Tapa-Like Loop

**Rules** (https://puzz.link/js/pzpr-samples/tapaloop.js): "Draw lines through orthogonally
adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. The loop
cannot go through clues. 3. Clues represent the numbers of consecutive cells occupied by
the loop each time it enters the (up to) eight cells surrounding the clue. 4. A question
mark can be replaced by any positive number. If a cell only has a single question mark, the
number is allowed to be zero."

**Structure.** Loop decision layer with Tapa's 8-neighbourhood run-length clue.

**Sudoku hybrid suitability: Good.** It is Tapa's clue — the best clue type in the shading
family — mounted on a loop. Everything said about Tapa's digit hook (the digit in a clue
cell is its single-number clue, range 1..8) carries over, and the loop adds the ordering
structure that shading lacks. The per-clue constraint is again a lookup over the
8-neighbourhood, so the clue side is cheap; only the loop global is expensive.

**Existing hybrids:** the LMD portal carries a *Variables Tapasyu* entry — Tapa x Masyu
(https://logic-masters.de/Raetselportal/?chlang=en). *Regional Necklace Tapa Loop* by
swaroop guggilam (https://swaroopg92.blogspot.com/2021/07/puzzle-no-167-regional-necklace-tapa.html)
combines a Tapa clue set, a shading layer and a loop that alternates between shaded and
unshaded cells, with a per-region turn count — a live example of Tapa clues driving a loop.
GM Puzzles has 33 Tapa-Like Loop posts
(https://www.gmpuzzles.com/blog/category/loop/tapa-like-loop/). No titled Sudoku hybrid
found. [unverified as absence]

## 2.19 Moon or Sun (お月さまと太陽)

**Rules** (https://puzz.link/js/pzpr-samples/moonsun.js): "Draw lines through orthogonally
adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. Every
region must be visited exactly once. 3. Within a region, the loop must pass through all
moons and no suns, or all suns and no moons. 4. All regions must have at least one moon or
sun that is used by the loop. 5. The loop may not pass through the same type of clue in two
consecutively used regions." Nikoli vol. 154.

**Structure.** Loop with per-region single visit; a binary choice per region (moons or
suns) that must alternate along the loop's region sequence.

**Sudoku hybrid suitability: Good.** Rule 5 is the interesting one: it forces an
alternation along the loop's *order of regions*, which is precisely the ordering structure
that a Sudoku grid lacks and that a hybrid wants. Map moon/sun onto a digit property
(odd/even, high/low) and the alternation becomes a statement about digits, not an extra
symbol layer — a genuinely two-way interaction with no invented rule. Per-region single
visit keeps the loop tractable.

**Existing hybrids:** LMD carries a **Moon-or-Sun tag alongside its Sudoku tag**
(https://logic-masters.de/Raetselportal/?chlang=en). No titled hybrid found.
[unverified as absence]

## 2.20 Numberlink (ナンバーリンク) and Arukone

**Rules** — Numberlink (https://puzz.link/js/pzpr-samples/numlin.js): "Draw paths going
through the cells to connect identical numbers. 1. Two paths cannot occupy the same cell."
Arukone (https://puzz.link/js/pzpr-samples/arukone.js) is the variant that additionally
requires full coverage: "2. All cells must be used by a path connecting two letters." The
LMD wiki states Arukone as "Connect the same letters with a line going horizontally and
vertically from field to field. Every field can be used only once"
(https://wiki.logic-masters.de/index.php/Arukone/en).

**Structure.** Decision: per-cell, which path (if any) occupies it and in what shape.
Global: disjointness; for Arukone, full coverage. Clues: the endpoint pairs.

**Sudoku hybrid suitability: Poor.** Numberlink is notorious for admitting many solutions
unless full coverage is imposed, and its logic is topological routing rather than
arithmetic — there is no count, length or ordering that a digit naturally supplies. The
one appealing move, "the endpoints are digits and identical digits are connected", forces
the nine cells of each digit into one path, which is over-tight in exactly the way
Dominion's letter rule is. Skip.

**Existing hybrids:** LMD carries a Number Link tag
(https://logic-masters.de/Raetselportal/?chlang=en). No Sudoku hybrid found.
[unverified as absence]

## 2.21 Nagenawa (なげなわ) and Ring-Ring

**Rules** — Nagenawa (https://puzz.link/js/pzpr-samples/nagenawa.js): "Draw lines through
the center of some cells to make rectangular loops. 1. Loops may cross each other, but may
not overlap or share a corner. 2. Numbers indicate how many cells in the outlined region
are used by a loop." Nikoli vol. 123. Ring-Ring
(https://puzz.link/js/pzpr-samples/ringring.js): same rectangle-loop rules, but "fill each
empty cell with a rectangular loop" — full coverage, no numeric clue. Nikoli vol. 135.

**Structure.** Decision: rectangle placements rather than free loop shapes. Global:
non-overlap, no shared corners, crossings allowed. Clues: per-region usage counts
(Nagenawa) or none (Ring-Ring).

**Sudoku hybrid suitability: Workable.** Rectangles are a much smaller decision space than
free loops, so this is cheaper to implement than any other entry in the loop family, and
Nagenawa's per-region count is a digit-range number on a 9x9 box. The genre feels closer to
Shikaku (3.4) than to a loop puzzle, which is a point in its favour for a candidate-grid
implementation. Modest but real.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.22 Snake (Schlange)

**Rules** (https://puzz.link/js/pzpr-samples/snake.js): "Shade some cells into the grid to
form a snake. 1. The snake cannot loop back on itself and visit a cell that's orthogonally
or diagonally adjacent to a cell it has visited before. 2. Black circles must lie on one
end of the path. 3. White circles must lie somewhere along the path, but not at an end.
4. A number outside the grid represents how many cells in the corresponding row or column
are shaded." LMD wiki: "Locate a snake in the grid that travels horizontally and vertically
without touching itself. The head and the tail of the snake are given. Numbers outside the
grid represent the amount of snake segments in the corresponding directions"
(https://wiki.logic-masters.de/index.php/Snake/en).

**Structure.** Decision: binary occupancy that must form a single self-avoiding path with
no diagonal self-contact. Global: path connectivity plus the king-move non-touching rule.
Clues: outside row/column counts, given head and tail.

**Sudoku hybrid suitability: Good, and already established in variant sudoku.** The snake
gives an *ordered* sequence of cells — the ordering hook — and the outside counts are the
standard Sudoku outside-clue idiom. The non-touching rule is a king-move constraint,
cheap and familiar. Digits along the snake obeying a rule (increasing, summing per segment,
non-repeating) is the standard hybrid form and reads naturally.

**Existing hybrids:**
- LMD carries **both a Snake tag and a Snake (Variant) tag** alongside its Sudoku tag
  (https://logic-masters.de/Raetselportal/?chlang=en).
- *Yin-Yang Sudoku*, LMD 0004X6, names "Quarterthru's wonderful Snake-Sum series" as its
  inspiration (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=0004X6) — a
  snake-plus-digit-sum sudoku series.
- *Slithering Snakes* by logicanimal, 2025-12-30, and *A Snake In The Forest* by SlickSquid,
  2024-12-11, both on the LMD Slitherlink collection page
  (https://logic-masters.de/Raetselportal/Suche/spezial.php?chlang=en&listname=rundwege).
- The LMD wiki carries *Snake*, *Snakes*, *Dotted Snake*, *Sum Snake*, *Horse Snake*,
  *Dominosnake* and *Pathfinder Snake* as separate genres
  (https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en).

## 2.23 Slalom / Gokigen Naname (ごきげんななめ)

**Rules** — Gokigen Naname (https://puzz.link/js/pzpr-samples/gokigen.js): "Draw a diagonal
line in every cell, connecting two opposite corners. 1. A number indicates how many lines
meet at that corner. 2. Lines cannot form loops." Nikoli vol. 104. Note that LMD's *Slalom*
page describes this genre — "Put a diagonal wall into every field, in a way that no
completely closed areas occur. The numbers in the circles tell you, how many walls touch
this circle" (https://wiki.logic-masters.de/index.php/Slalom/en) — while puzz.link's
`slalom` pid is a different, gate-ordering loop genre
(https://puzz.link/js/pzpr-samples/slalom.js). The name collision is real; cite carefully.

**Structure.** Decision: two states per cell (the `/` or `\` diagonal). Global: acyclicity
of the resulting graph. Clues: vertex degree counts 0..4.

**Sudoku hybrid suitability: Workable, and unusually cheap.** A binary decision per cell
with a 0..4 count clue on vertices — the same vertex real estate as Creek and Kropki, so
it costs the Sudoku nothing. The acyclicity global is a union-find check, much cheaper than
loop connectivity. The obstacle is the digit hook: a diagonal is an orientation, and
orientation does not naturally encode a quantity, so the setter must invent one ("digits in
cells with `/` are odd"). Cheap to build, moderate payoff.

**Existing hybrids:** the LMD portal carries the *Slalom* genre and a *Landvermessung* tag
(https://logic-masters.de/Raetselportal/?chlang=en). A Gokigen-style clue appears in a
Sudoku hybrid on meander lawn — "Draw a diagonal in every cell. Point clues [give] the
diagonals meeting at the point"
(http://meanderlawn.blogspot.com/search/label/puzzle). [Rules text partially recovered;
unverified.]

## 2.24 Icebarn (アイスバーン)

**Rules** (https://puzz.link/js/pzpr-samples/icebarn.js): "Draw a line that starts at the
IN arrow, and goes through every arrow before reaching the OUT arrow. 1. Two perpendicular
line segments may intersect each other only on icy cells, but the loop may not branch or
otherwise overlap. 2. The loop may not turn on icy cells. 3. The loop cannot go against the
direction of an arrow. 4. Connected icy cells are called an icebarn, and every icebarn must
be visited at least once." Nikoli vol. 108.

**Structure.** Directed path from IN to OUT; icy cells force straight travel and permit
crossings; arrows force direction.

**Sudoku hybrid suitability: Poor.** The genre's content is a movement/direction puzzle
over a given terrain of icy cells, and the terrain must be given — a Sudoku grid supplies
no terrain. Directions are not quantities. Skip.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.25 Haisu and Kaisu

**Rules** — Haisu (https://puzz.link/js/pzpr-samples/haisu.js): "Draw a path from S to G
that goes through all cells. 1. The path cannot branch off or cross itself. 2. An outlined
region can be entered and exited multiple times. A number N indicates that the path must go
through that cell on the region's Nth visit." Invented by William Hu. Kaisu
(https://puzz.link/js/pzpr-samples/kaisu.js) is the variant where "On the region's Nth
visit the line must go through exactly N circles, or go through no circles."

**Structure.** Hamiltonian path from a fixed start to a fixed goal; clues index the visit
ordinal of a region.

**Sudoku hybrid suitability: Good — the purest expression of the ordering hook.** The clue
*is* an ordinal: "this cell is on the Nth visit to its box". On a 9x9 with boxes as regions,
N lands in the digit range, and "the digit in this cell is the visit number of its box"
is a direct, native, two-way hook with no remapping. It gives the Sudoku grid a total
order over cells, which is the thing digits alone cannot express. Against it: Hamiltonian
coverage on 81 cells is very tight and the path layer will dominate the solve, so clue
counts need care. Implementation is a path propagator plus per-region visit counting.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
Haisu is a young genre (William Hu is a current-generation setter), which is a plausible
reason. This is the most interesting unexploited hybrid in the loop family. [unverified as
absence]

## 2.26 Dotchi-Loop (どっちループ)

**Rules** (https://puzz.link/js/pzpr-samples/dotchi.js): "Draw lines through orthogonally
adjacent cells to form a loop. 1. The loop cannot branch off or cross itself. 2. The loop
goes through all unshaded circles. 3. Within a region, all unshaded circles contain either
a corner or a straight line. 4. The loop cannot go through a shaded circle." Nikoli vol. 167.

**Structure.** Loop; per-region, the circles agree on turn-vs-straight. Clues: circles, some
shaded (loop-forbidden).

**Sudoku hybrid suitability: Workable.** Rule 3 is a per-region uniformity condition, which
is the same shape as a "all these cells share a property" Sudoku rule and maps onto a digit
property per box. No numeric clue, so a digit hook must be added. Middling.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, CTC, general web).
[unverified as absence]

## 2.27 Linesweeper

**Rules** (https://wpcunofficial.miraheze.org/wiki/Linesweeper, quoting the WPC 2019
instruction booklet): "Draw a closed loop into the grid that runs horizontally and
vertically and passes through each cell at most once. The loop does not pass through
numbered cells. The numbers indicate how many of the horizontally, vertically and
diagonally neighbouring cells are used by the loop." Invented and named by Jak Marshall
(UK) in 2010; the same page notes the rules are simple enough that the genre has probably
been reinvented several times, citing "Snake Pit" from WPC 1996 as an earlier appearance of
the identical clue. Appeared at WPC 2019 World Cup Round 1 (by Roland Voigt) and WPC 2017
Round 16 (by Ashish Kumar). Corroborating statements at
https://www.cross-plus-a.com/html/cros7lns.htm and
https://www.logic-puzzles.ropeko.ch/php/db/puzzle.php?id=158.

**Structure.** Decision: per-cell loop shape, the loop covering only some cells. Global: one
closed loop. Clues: an 8-neighbourhood count of loop cells, on cells the loop avoids — a
Minesweeper clue over a loop.

**Sudoku hybrid suitability: Good.** The clue is 0..8, in the digit range, strictly local,
and identical in shape to the Minesweeper clue that has the best hybrid track record in this
survey. "The digit in a clue cell counts the loop cells around it" is a direct two-way hook
needing no remapping. The loop need not cover every cell, so there is slack for pure Sudoku
deduction — the property that makes Masyu and Geradeweg work and that Yajilin and Detour
lack. The only expensive part is loop connectivity, shared with every entry in this family.

This is the same clue-over-a-loop idea as **Bosnian Road** (3.18); the two differ in that
Bosnian Road forbids the loop from touching itself while Linesweeper only forbids revisiting
a cell. Build one component and the other is a rule flag on it.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 2.28 Regional Yajilin, Every Second Turn, Loop de Loop

**Regional Yajilin** (also "Yajilin (regions)"). Rules as stated by GridPuzzle
(https://fr.gridpuzzle.com/regional-yajilin, in French; my translation): the grid is
divided into regions; shade some cells and draw a single non-intersecting loop through all
white cells; a number in a region gives the count of shaded cells in that region; a region
without a number may contain any number of shaded cells; no two shaded cells may share a
border; the loop may visit numbered cells, and numbered cells may themselves be shaded.
**Source caveat: GridPuzzle is a puzzle-play site, not a rules authority of the standing of
puzz.link, the LMD wiki, Nikoli or a WPC booklet.** Regional Yajilin appears in neither the
puzz.link corpus nor the LMD wiki, and the LMD wiki's registered Yajilin derivatives are
*Yajilin Plus* and *Majilin* instead
(https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en). Treat the statement above
as [unverified at a primary source]. It is in active circulation — Puzzle Duel ran Regional
Yajilin 9x9 and 8x8 dailies in December 2025 and January 2026
(https://www.puzzleduel.club/archive).

*If that statement is right*, the hybrid verdict is **Good, and better than plain
Yajilin (2.4)**: "a number in a region gives the shaded count in that region" is the
per-box count hook that works so well for Heyawake, Chocona and Shimaguni, in digit range,
and it replaces Yajilin's awkward directional clue on loop-excluded cells. Verify the rules
at a primary source before building.

**Every Second Turn** (also "Alternate Corners") and **Loop de Loop**: **rules not found at
a primary source.** Neither is in the puzz.link genre corpus (244 ids checked) nor has an
LMD wiki page. Both are in circulation — Puzzle Duel ran Every Second Turn 10x12 and 12x12
dailies in 2025 (https://www.puzzleduel.club/archive) and Fit For Puzzle lists both in its
tutorial catalogue (https://fitforpuzzle.com/puzzle-tutorials/) — but that catalogue page
serves only its heading index to a fetcher, no rules bodies, so no rules text was recovered
and it was not retried. Dropped rather than reconstructed from memory.

## 2.29 Others on the loop index worth naming

The puzz.link loop and line indexes carry 79 genres. Those not treated above, with their
rule cores, all at `https://puzz.link/js/pzpr-samples/<pid>.js`:

| Genre | Rule core | Hybrid note |
| --- | --- | --- |
| Nagare (`nagare`) | Directional loop; black arrows force direction, white arrows in shaded cells are fans that blow wind the loop cannot travel against and must turn into | Rich but heavily terrain-dependent. Poor for a digit grid |
| Vertex/Total Slitherlink (`vslither`, `tslither`) | Slitherlink where the clue counts visited *vertices*, or visited edges and vertices together | Same layer as Slitherlink, a different count. Workable |
| Mejilink (`mejilink`) | Loop on cell borders; a region's cell count equals the number of its surrounding borders *not* on the loop | A counting identity per region — a genuine arithmetic hook. Workable |
| Ovotovata (`ovotovata`), Mukkonn (`mukkonn`), Remlen (`remlen`) | On leaving a clued region/cell, the loop must run straight for exactly the clued number of cells, then turn | A length-in-cells clue in digit range. Workable to Good; Eric Fox and Palmer Mebane genres |
| Railpool (`railpool`) | Hamiltonian loop; every segment overlapping a region has a length drawn from that region's number list, each used at least once | A multiset-of-lengths clue per region — strong, and digit-range. Workable to Good. By Martin Ender |
| Disloop (`disloop`) | Arrows from grey cells give the lengths of the next N loop segments in order | Ordered length list; digit-range. Workable |
| Waterwalk (`waterwalk`) | Loop through numbered cells; at most 2 consecutive water cells; a number gives the length of its continuous grounded section | Two terrains plus a length clue. Workable. By Martin Ender |
| Nanameguri (`nanameguri`) | Loop visiting each region exactly once and every diagonal-marked cell, without crossing the diagonals | Country Road with a diagonal obstacle. Workable |
| Nothing (`nothing`) | If a country is visited, all its cells are visited; countries visited at most once; no two unused countries adjacent | An all-or-nothing per-region rule — clean, box-shaped. Workable. By Inaba Naoki |
| Line of Sight (`lineofsight`) | Slitherlink layer; a clue gives the length of the first straight segment seen in a direction | Visibility clue in digit range, on the Slitherlink layer. Workable. By Inaba Naoki |
| Scrin (`scrin`), Antmill (`antmill`), Reflect Link (`reflect`), Kouchoku (`kouchoku`), Angle Loop (`angleloop`), Cross Stitch (`crossstitch`), Train Stations (`trainstations`), Building Walk (`bdwalk`), Icelom/Icelom2/Icewalk/Barns/Pipelink Returns (`icelom`, `icelom2`, `icewalk`, `barns`, `pipelinkr`) | Rules at the cited URL pattern | Each either uses a non-grid geometry (angles, diagonals, floors), needs given terrain, or has no numeric hook. None recommended |
| Anglers (`anglers`) | Numbers outside the grid are anglers; each line runs from an angler to a fish, the number gives the line's length; lines may not touch or cross | Outside clue, length in digit range, no loop global — cheap. Workable. LMD: https://wiki.logic-masters.de/index.php/Anglers/en; LMD carries an Anglers tag |

---

# 3. Region-building and region-division puzzles

The decision layer is a region id per cell — equivalently, a border on/off per interior
edge. This family has the most natural digit interaction of the three, because a region
has a *size*, and size is a number. On a 9x9 the sizes that matter run 1..9, which is the
digit range, so "the digit is its region's size" needs no remapping. That single coincidence
is why the region family produces the cleanest Sudoku hybrids, and why Fillomino and
Shikaku hybrids are the ones that actually get set.

## 3.1 Fillomino (フィルオミノ; Allied Occupation, Polyominous)

**Rules** (https://puzz.link/js/pzpr-samples/fillomino.js): "Divide the grid into regions.
1. A number indicates the size of the region, in cells. Regions can have any amount of
identical numbers, or none at all. 2. Two regions of the same size cannot be orthogonally
adjacent." Nikoli vol. 47. LMD wiki: "Dissect the diagram into areas and write a number in
every field. The numbers in one area have to be the same and have to tell the number of
fields in that area. Areas of same size may not touch horizontally or vertically, but
diagonally. Given numbers may belong to the same area, and it's possible that there are
areas where no number is given — even with larger numbers than the ones shown"
(https://wiki.logic-masters.de/index.php/Fillomino/en).

**Structure.** Decision: region partition (every cell gets a region id). Global: no two
same-size regions share an edge — a colouring-style condition on the *sizes*, which is what
makes the genre. Clues: numbers that are simultaneously the region size and, in classic
Fillomino, written in every cell of the region.

**Sudoku hybrid suitability: Good — jointly the best in the survey with Yin-Yang and
Nurikabe.** Fillomino's numbers *are* digits: every cell holds a number, and that number is
its region size. A Sudoku grid already puts a number in every cell. The hybrid is therefore
not an overlay at all but an identification — "the sudoku digit is the Fillomino number" —
and rule 2 becomes a strong constraint on the digit grid directly. This is the rare case
where the two rulesets fuse instead of stacking, which is exactly the "pleasant combined
solve" criterion. This repo already has substantial Fillomino work on file:
`docs/research/fillomino-cpsat.md`, `docs/research/fillomino-prior-art.md`,
`docs/research/fillomino-isofill-transfer.md`, and a heavy test in `just check-full`.

**Existing hybrids:** the best-attested in the region family.
- *Fillomino sudoku*, LMD 000HFV, 2024-03-26
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000HFV):
  "Sudoku: Fill each row, column and 3x3 box with the digits 1-9. Fillomino: Divide the
  grid into regions of orthogonally connected cells. Two regions of the same size may not
  share an edge. Each region must contain at least one circle. Circles must contain the
  digit equal to the size of the regions they are in." Tagged "Sudoku, Fillomino", 116
  solvers at 95%, and **featured on Cracking The Cryptic**.
- *LITSomino*, LMD 000HEI
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000HEI): Fillomino x LITS.
- *Shikaku Fillomino #2 (9x9)*, LMD 000B8V
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000B8V): two region
  partitions over one grid, each cell in exactly one Fillomino and one rectangle.
- *Filtered Out (fillomino/slitherlink)* by jwsinclair, 2025-02-23, and
  *Wichtels Rätselherbst 2025 (12): Fillomino-Eckenrundweg* by wichtel, both on the LMD
  loop collection (https://logic-masters.de/Raetselportal/Suche/spezial.php?chlang=en&listname=rundwege).
- LMD carries **Fillomino and Checkered Fillomino tags** beside its Sudoku tag
  (https://logic-masters.de/Raetselportal/?chlang=en); the wiki carries *Fillomino
  Skyscrapers* and *Doppelstern-Fillomino* as registered genres
  (https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en); GM Puzzles has 158
  Fillomino posts (https://www.gmpuzzles.com/blog/category/regiondivision/fillomino/).

## 3.2 Symmetry Area (`symmarea`) — Fillomino with symmetry

**Rules** (https://puzz.link/js/pzpr-samples/symmarea.js): Fillomino's two rules plus
"3. Every region must have 180° rotational symmetry around its center."

**Sudoku hybrid suitability: Workable.** Everything Fillomino offers, plus a geometric
constraint that prunes hard. The symmetry rule is cheap to check and is the same rule
Spiral Galaxies uses, so a single symmetry propagator serves both. Build after Fillomino.

**Existing hybrids:** none found under this name (searched: LMD portal, GM Puzzles, general
web). [unverified as absence]

## 3.3 Araf (相ダ部屋, "Different Neighbors")

**Rules** (https://puzz.link/js/pzpr-samples/araf.js): "Draw lines over the dotted lines to
divide the board into several blocks. 1. Each block contains exactly two numbers. 2. The
size of the block must be between the two numbers, exclusive. 3. Question marks can be
replaced by any number." LMD wiki: "Divide the grid into some regions. Each region should
contain two numbers and the size of the region should be a number between those two"
(https://wiki.logic-masters.de/index.php/Araf/en). The wiki also registers *Different
Neighbours* as a genre (https://wiki.logic-masters.de/index.php/Different_Neighbours/en).

**Structure.** Decision: region partition. Global: exactly two clues per region. Clues: a
pair of numbers bracketing the region size strictly.

**Sudoku hybrid suitability: Good.** The clue is a strict inequality on the region size,
which is a *range*, not an equality — that looseness is valuable, because it stops the
region layer from solving independently and forces the digits to finish it. Two digits per
region bracketing that region's size is a clean, wholly native rule with everything in the
digit range. It is the natural second pick after Fillomino if you want region logic that
leans on the digits rather than replacing them.

**Existing hybrids:** none titled found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.4 Shikaku (四角に切れ, "Divide by Squares"; Number Areas, Rectangles)

**Rules** (https://puzz.link/js/pzpr-samples/shikaku.js): "Draw lines over the dotted lines
to divide the board into rectangles. 1. Each rectangle contains exactly one black circle.
2. A number indicates the size of the rectangle, in cells." Nikoli vol. 27. LMD wiki, with
the alternative names Number Areas and Divide by Box: "Divide the grid into rectangular and
square pieces so that each piece contains exactly one number, that each cell is part of one
piece and that the numbers represent the number of cells of the piece"
(https://wiki.logic-masters.de/index.php/Shikaku/en).

**Structure.** Decision: a rectangle placement per clue — a much smaller space than a free
partition. Global: the rectangles tile the grid exactly. Clues: area per rectangle.

**Sudoku hybrid suitability: Good, and the cheapest good one in this family.** Rectangles
are enumerable: for a clue at a given cell with area a, the candidate rectangles are the
divisor pairs of a that cover that cell — a small finite set, perfect for a candidate-grid
propagator, with none of Fillomino's unbounded-shape search. The digit hook is native
("the digit in the circle is the area") and areas 1..9 are exactly the digit range, giving
rectangles 1x1 through 3x3 and 1x9 — all of which have meaning on a Sudoku grid. This repo's
Renbanana rectangle catalogue is directly reusable machinery
(`docs/research/renbanana/rectangle-catalogue.json`).

**Existing hybrids:** well attested, by a strong setter.
- *Shikasudoku*, LMD 00087H, 2021-11-08 by Qodec
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=00087H), and *Shikasudoku
  2*, LMD 00093U, 2022-02-12 (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=00093U):
  "Divide the grid into rectangular regions of orthogonally connected cells. Each rectangle
  contains exactly one circle... A number in a circle represents how many cells are in the
  rectangle the circle belongs to... Every cell in the grid is part of a rectangle." The
  setter names Phistomefel's *Sudokurotto* and udukos's *Juosan Killer sudoku* as the
  inspirations — i.e. a small established line of pencil-genre x sudoku hybrids.
- *6x6 Shikaku Sudoku*, LMD 000IVK, 2024-07-10 by jinkey
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000IVK): adds
  "Shikaku rectangles of the same area may not touch each other" and "Digits do not repeat
  inside a shikaku rectangle".
- *Shikaku Fillomino #2 (9x9)*, LMD 000B8V
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000B8V).
- LMD carries a Shikaku tag (https://logic-masters.de/Raetselportal/?chlang=en); the wiki
  carries *Pentomino Shikaku* (https://wiki.logic-masters.de/index.php/Pentomino_Shikaku/en).

## 3.5 Cave — see 1.11

Cave is a region genre in spirit (the cave is one region, the walls are the rest) but the
decision layer is binary shading, so it is treated in the shading section. Its Sudoku
hybrid evidence (Cave Sums Sudoku, Twilight Cave Sudoku, Cave Sudoku +) is among the
strongest in this survey.

## 3.6 Nanro (ナンロー, "Signpost")

**Rules** (https://puzz.link/js/pzpr-samples/nanro.js): "Place a number into some of the
cells. Some numbers are given. 1. Each number must be equal to the amount of cells with
numbers inside the outlined region. 2. Every region must contain at least one number.
3. Two equal numbers from different regions cannot be orthogonally adjacent. 4. Numbers
cannot form a 2x2 square. 5. All numbers form an orthogonally contiguous area." Nikoli
vol. 92. The LMD wiki has a Nanro page but its English instructions section is empty
(https://wiki.logic-masters.de/index.php/Nanro/en), so puzz.link is the source here.

**Structure.** Decision: per cell, empty or numbered — a binary layer — plus the number
itself, which is determined by the region's filled count. Global: numbered cells connected,
no numbered 2x2, no equal numbers adjacent across region borders. Clues: some given numbers.

**Sudoku hybrid suitability: Good.** Nanro's number in a cell is a count of filled cells in
its box — in 1..9 on a 9x9 — so the identification "the sudoku digit is the Nanro number,
where the cell is filled" is direct. Rule 3 (equal numbers not adjacent across borders) is
the Fillomino-style adjacency rule that composes well with Sudoku reasoning, and rule 5's
connectivity is the one expensive part. The wrinkle: only *some* cells carry numbers, so a
hybrid must decide what the digits in unnumbered cells mean — the usual move is to shade
them, which turns Nanro into a shading-plus-count hybrid.

**Existing hybrids:** LMD carries a **Nanro tag alongside its Sudoku tag**
(https://logic-masters.de/Raetselportal/?chlang=en). No titled Nanro Sudoku found
(searched: LMD portal, GM Puzzles, general web). [unverified as absence]

## 3.7 Spiral Galaxies (天体ショー "Tentai Show", Galaxies, Tentaisho)

**Rules** (https://puzz.link/js/pzpr-samples/tentaisho.js): "Divide the grid into regions.
1. Every region contains exactly one star. 2. Lines cannot go through stars. 3. Every
region must be rotationally symmetric, with a star at the center." Nikoli vol. 96 (2001),
invented by "Gesaku" / "Robocop" — the name puns on 天体 (astronomical) and 点対称 (point
symmetry) (https://wpcunofficial.miraheze.org/wiki/Spiral_Galaxies,
https://www.gmpuzzles.com/blog/spiral-galaxies-rules-info/). GM Puzzles: "Divide the grid
along the indicated lines into connected regions – 'galaxies' – with rotational symmetry.
Each cell must belong to one galaxy, and each galaxy must have exactly one circle at its
center of rotational symmetry." Note the circle may sit on a cell, an edge or a vertex.

**Structure.** Decision: region partition. Global: 180° rotational symmetry of every region
about its given centre — a strong, purely geometric constraint that pairs cells up. Clues:
the circle positions.

**Sudoku hybrid suitability: Good.** The symmetry rule pairs cells, and a pairing is
exactly what a digit rule can bite on ("symmetric cells within a galaxy have different
parity", as the published hybrid does). The centres are given, so the clue layer is spatial
rather than numeric — which means the digit content must be supplied by the hybrid, and the
published hybrids do so with sums and parities. The symmetry propagator is cheap: knowing a
cell is in a galaxy immediately forces its mirror.

**Existing hybrids:** well attested, including at world-championship level.
- *Spiral Galaxy Sudoku with clues*, LMD 000897
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000897):
  "Standard Sudoku and Spiral Galaxy rules apply... One of the digits from 1-9 acts as the
  centre for each galaxy... The sum of the digits in each and any tail around a galaxy must
  be equal... If any 5 or more cells along a row belong to the same galaxy, the digits in
  those cells must read across in ascending order." The post records a whole community
  effort around hamslice's earlier *Spiral Galaxy Sudoku with one clue*.
- *Space Oddity - Irregular Parity Galaxy Killer Sudoku*, LMD 00045K
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=00045K): galaxies
  behave as killer cages; "Two symmetrical cells within a galaxy must have different
  parities, and cells with the same parity within a galaxy must form a single group of
  orthogonally adjacent cells."
- *Galaxies and Pentominoes* and *Galaxies and Tetrominoes*, WPC 2018 Round 6 by Jiří
  Hrdina, plus *Spiral Galaxies^2* by Rohan Rao at WPC 2017 Round 20 — the WPC unofficial
  wiki lists Spiral Galaxies appearances across WPC 2013 through 2024
  (https://wpcunofficial.miraheze.org/wiki/Spiral_Galaxies).
- LMD carries a Galaxies tag (https://logic-masters.de/Raetselportal/?chlang=en); GM
  Puzzles has 31 Spiral Galaxies posts
  (https://www.gmpuzzles.com/blog/category/regiondivision/spiral-galaxies/).

## 3.8 Pentominous

**Rules** (https://puzz.link/js/pzpr-samples/pentominous.js): "Divide the grid into
pentominoes (regions of 5 cells). You can use each pentomino any number of times (including
zero). 1. Two adjacent pentominoes cannot have the same shape, counting rotations and
reflections as the same. 2. A letter indicates the shape of the pentomino it's contained in.
A pentomino may contain any number of identical letters." A setter's phrasing adds that an
inventory may be shown but not all shapes need be used
(https://swaroopg92.blogspot.com/2021/06/puzzle-no-161-pentominous.html).

**Structure.** Decision: region partition, every region exactly 5 cells with a named shape.
Global: adjacent regions differ in shape. Clues: shape letters.

**Sudoku hybrid suitability: Workable.** A 9x9 has 81 cells, which is not divisible by 5 —
so a pure Pentominous cannot tile the Sudoku grid, and any hybrid must leave cells out (as
the published one does, placing a fixed set of pentominoes rather than tiling). That is a
real structural friction, and it is why the published hybrid is "place the twelve
pentominoes" rather than "divide the grid". The clue is a shape letter, not a number, so
the digit hook must be invented. Tetrominous (3.9) has the same problem — 81 is not
divisible by 4 either.

**Existing hybrids:**
- *Pentomino Sudoku*, LMD 000A76
  (https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000A76): "Place
  exactly one of each of the 12 pentomino shapes in the grid... A clue outside the grid
  indicates the sum of numbers not in pentominos in the row or column. Each pentomino must
  satisfy at least one of the two conditions: 1. Adjacent numbers in the pentomino must
  differ by at least 5. 2. The sum of the numbers in the pentomino is the same in each box
  of the sudoku that the pentomino is in." Tagged "Sudoku, Pentominous, German Whispers
  (Variant), Region Sum Lines (Variant)".
- *Galaxies and Pentominoes*, WPC 2018 Round 6 by Jiří Hrdina
  (https://wpcunofficial.miraheze.org/wiki/Spiral_Galaxies).
- LMD carries Pentominous and Pentopia tags
  (https://logic-masters.de/Raetselportal/?chlang=en); GM Puzzles has 109 Pentominous posts
  (https://www.gmpuzzles.com/blog/category/regiondivision/pentominous/); the wiki carries a
  dozen pentomino genres including *Pentomino Shikaku*, *Pentomino Fences* and *Pentomino
  Borders* (https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en).

## 3.9 Tetrominous, Fourcells, Fivecells, Heteromino

**Rules** — Tetrominous (https://puzz.link/js/pzpr-samples/tetrominous.js): as Pentominous
with tetrominoes. Fourcells (https://puzz.link/js/pzpr-samples/fourcells.js): "Divide the
board into tetrominoes. 1. A number indicates the amount of edges surrounding the cell which
contain a border. 2. All borders must be used to divide two blocks, there can not be any
dead-ends." Nikoli vol. 132. Fivecells (`fivecells`) is the same with pentominoes, Nikoli
vol. 133. Heteromino (https://puzz.link/js/pzpr-samples/heteromino.js): "Divide the board
into triminoes. 1. Triminoes cannot use shaded cells. 2. Two triminoes that share a border
must have different shape or different orientation." Invented by Inaba Naoki.

**Sudoku hybrid suitability: Workable for Fourcells/Fivecells, Poor for the rest.** The
Fourcells/Fivecells clue — "how many of this cell's four sides are region borders", 0..4 —
is a genuinely good hybrid clue: in digit range, purely local, and it says something about
the partition that no other genre's clue says. It is the same clue Nawabari uses (3.14).
The divisibility problem bites again for the fixed-size tilings on 81 cells; Heteromino
(3 cells) does divide 81 evenly and is the exception worth noting.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.10 Statue Park

**Rules** (https://puzz.link/js/pzpr-samples/statuepark.js): "Place every shape from the
bank into the grid. Shapes can be rotated or mirrored. 1. All shapes must be used exactly
once. There cannot be shapes in the grid that aren't present in the bank. 2. Two shapes
cannot be orthogonally adjacent. 3. Black circles must overlap a shape, while white circles
must not overlap a shape. 4. All cells not used by shapes must be connected." Invented by
Palmer Mebane. A setter's phrasing confirms the same four rules
(https://swaroopg92.blogspot.com/2021/08/puzzle-number-170-double-statue-park.html).

**Structure.** Decision: placement of a fixed bank of polyominoes. Global: exact use of the
bank, orthogonal separation, connected complement. Clues: black and white circles.

**Sudoku hybrid suitability: Workable.** The bank is a strong global that a placement
enumerator handles well, and the "connected complement" rule is the one expensive part. The
digit hook is not native — circles are binary, not numeric — so it must be added. The
documented Statue Park hybrid instead borrows Minesweeper's clue ("The number clues act as
minesweeper clues... if there is a number in a white circle it gives the number of black
circles around it"), which is exactly the move a Sudoku hybrid would make and shows the
genre takes numeric clues gracefully.

**Existing hybrids:** *Double Statue Park Twilight* by swaroop guggilam
(https://swaroopg92.blogspot.com/2021/08/puzzle-number-170-double-statue-park.html), a
Statue Park with Minesweeper clues, set in a Cracking The Cryptic Discord speed-setting
contest. GM Puzzles has 87 Statue Park posts
(https://www.gmpuzzles.com/blog/category/objectplacement/statue-park/). No titled Statue
Park x Sudoku found. [unverified as absence]

## 3.11 Tren

**Rules** (https://puzz.link/js/pzpr-samples/tren.js): "Place several 1x2 and 1x3 blocks on
the board, which don't overlap each other. 1. Each number is contained in a block. Blocks
must contain exactly one number. 2. Horizontally oriented blocks can slide left and right,
while vertically oriented blocks can slide up and down. Blocks cannot move outside the grid
or through other blocks. 3. A number inside a block indicates how many spaces the block can
move." The LMD wiki has a Tren page but no English instructions
(https://wiki.logic-masters.de/index.php/Tren/en), and registers a variant *Tren (knapp
daneben)*.

**Structure.** Decision: placements of 1x2 and 1x3 blocks. Global: non-overlap. Clues: a
sliding-freedom number — a distance, not a size.

**Sudoku hybrid suitability: Workable.** The clue is a distance in 0..8 on a 9x9 — in digit
range — and "how far could this block slide" is an unusual, appealing quantity that no other
genre in this survey uses. The pieces are tiny, so placement enumeration is cheap. Against
it: the sliding rule is a *derived* property requiring a scan per block per direction, and
the genre is obscure enough that there is no hybrid tradition to borrow from.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.12 Sashigane (さしがね, "carpenter's square")

**Rules** (https://puzz.link/js/pzpr-samples/sashigane.js): "Divide the grid into regions of
orthogonally connected cells. 1. Each region must be an L shape with a width of one cell.
2. A circle must be located in the corner of an L shape. 3. Arrows must be located on the
ends of an L shape, and point towards the corner. 4. A number indicates the amount of cells
contained in the L shape." Nikoli vol. 134. The LMD wiki gives the same four numbered rules
(https://wiki.logic-masters.de/index.php/Sashigane/en).

**Structure.** Decision: region partition into 1-wide L shapes. Global: exact tiling. Clues:
corner circles, endpoint arrows, and region sizes.

**Sudoku hybrid suitability: Good.** Three clue types on one layer — a size number (digit
range), a corner marker, and a direction — which gives a setter far more tuning room than
most genres here. L-shapes of width 1 are a small enumerable family per corner cell, so the
propagator is cheap. The size number is native and in range. Underused and worth building.

**Existing hybrids:** LMD carries a **Sashigane tag alongside its Sudoku tag**
(https://logic-masters.de/Raetselportal/?chlang=en). No titled Sashigane Sudoku found
(searched: LMD portal, GM Puzzles, general web). [unverified as absence]

## 3.13 Snake Pit (`snakepit`)

**Rules** (https://puzz.link/js/pzpr-samples/snakepit.js): "Divide the grid into regions,
where each region represents a snake. 1. A snake is a path that is at least 2 cells long and
exactly 1 cell wide, and can have any amount of turns. 2. A snake cannot loop back on itself
and visit a cell that's orthogonally or diagonally adjacent to a cell it has visited before.
3. Two snakes of the same length cannot be orthogonally adjacent. 4. A number indicates the
length of the snake, in cells. Snakes can have any amount of identical numbers. 5. A circle
indicates an endpoint of a snake, while a gray cell must not be on the endpoints of a snake."

**Structure.** Decision: region partition into self-avoiding 1-wide paths. Global: rule 3 is
Fillomino's adjacency rule on lengths. Clues: lengths and endpoint markers.

**Sudoku hybrid suitability: Good.** It is Fillomino with the regions constrained to be
snakes — so you keep Fillomino's perfect digit hook (the number in a cell is its region's
length, in range) and gain both an *ordering* along each snake and endpoint clues. The
ordering is the loop family's best property arriving in the region family without a loop's
connectivity cost. Strong, underexplored candidate.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web). LMD
carries Snake and Snake (Variant) tags but those are the shading genre
(https://logic-masters.de/Raetselportal/?chlang=en). [unverified as absence]

## 3.14 Nawabari (なわばり, "Territory")

**Rules** (https://puzz.link/js/pzpr-samples/nawabari.js): "Draw lines over the dotted lines
to divide the board into rectangles. 1. Each rectangle contains exactly one number. 2. A
number indicates the amount of edges surrounding the cell which contain a border." Nikoli
vol. 51.

**Structure.** Decision: rectangle partition (as Shikaku). Clues: a per-cell border count
0..4 — a *local* clue about the partition, not a size.

**Sudoku hybrid suitability: Good, and complementary to Shikaku.** The border count 0..4
sits in digit range and is strictly local, which makes it the cheapest region clue in the
survey to propagate: it constrains only the four edges around one cell. Combined with the
rectangle global (reusing this repo's rectangle catalogue machinery), it is a
low-implementation-cost, high-interaction hybrid. Where Shikaku's clue is global (an area),
Nawabari's is local, so the two tune differently and a component could offer both.

**Existing hybrids:** the LMD portal carries a *Landvermessung* ("land survey") tag
(https://logic-masters.de/Raetselportal/?chlang=en), which is the German-tradition
territory-division genre. No titled Nawabari x Sudoku found. [unverified as absence]

## 3.15 Tatamibari (たたみばり)

**Rules** (https://puzz.link/js/pzpr-samples/tatamibari.js): "Draw lines over the dotted
lines to divide the board into regions. 1. Each region contains exactly one clue. 2. A
vertical line indicates that the region is a rectangle where the height is larger than the
width. 3. A horizontal line indicates that the region is a rectangle where the width is
larger than the height. 4. A plus sign indicates that the region is a square. 5. Region
borders must not form 4-way intersections." Nikoli vol. 107.

**Structure.** Rectangle partition with shape-class clues (tall, wide, square) and the
tatami rule 5 forbidding four-way border crossings.

**Sudoku hybrid suitability: Workable.** Rule 5 is the distinctive part and is a purely
local check on each interior vertex — cheap and unusual. The clues are shape classes, not
numbers, so the digit hook must be added; the natural one is to let a digit's parity or
magnitude choose the clue type, which is the "ambiguous clue" idiom that hybrid setters
already use (see Colossal Nurikabe Sudoku, 1.1). Reasonable second-wave pick.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.16 Ripple Effect (波及効果 "Hakyuu")

**Rules** (https://puzz.link/js/pzpr-samples/ripple.js): "Place a number in each cell. Some
numbers are given. 1. Numbers must be between 1 and N, where N is the size of the region.
2. Each region contains exactly one of each number. 3. Two equal numbers N in the same row
or column must have at least N spaces between them." Nikoli vol. 73. LMD wiki: "Fill in each
cell with a digit so that each region with the area n contains digits from 1 to n. Same
digits in a row or column should have a distance between them, as many times as at least
themselves. For example, if there are two 4's in the same row/column, there should be at
least four cells between those"
(https://wiki.logic-masters.de/index.php/Ripple_Effect/en).

**Structure.** This is a *number-placement* genre with a given region partition, not a
region-building one. Decision: a digit per cell. Clues: givens.

**Sudoku hybrid suitability: Good — it is already a Sudoku-shaped genre.** With the nine
boxes as regions, rule 2 is exactly the Sudoku box rule, and rule 3 is a distance
constraint on repeated digits — a rule the variant-sudoku audience knows as a "Distance"
or anti-clone constraint. On a proper Sudoku, though, rule 3 is nearly vacuous for large
digits (no digit repeats in a row anyway), so a hybrid must apply it across the *whole* grid
or use irregular regions. As a standalone constraint to add to a Sudoku it is trivial to
implement and cheap: a pairwise distance check.

**Existing hybrids:** LMD carries **Hakyuu and Suguru tags alongside its Sudoku tag**
(https://logic-masters.de/Raetselportal/?chlang=en) — Suguru is the closely related
region-with-1..N genre.

## 3.17 Suraromu (スラローム)

**Rules** (https://wiki.logic-masters.de/index.php/Suraromu/en; puzz.link carries no
`suraromu` rules text): "1. Draw a single loop, starting and ending at the numbered circle...
The loop may not cross itself or branch off. 2. The dotted lines are called gates. The loop
must pass straight through every gate exactly once, by traversing exactly one cell in each
gate. (The number in the circle represents the total number of gates.) 3. A numbered black
cell represents the order in which the loop passes through the gate which touches that black
cell... A gate numbered 1 must be the first gate visited in the loop... and so forth."
Nikoli genre.

**Structure.** A loop genre, not a region one — the "regions" are gates (line segments).
Clues: gate visit ordinals.

**Sudoku hybrid suitability: Workable.** The ordinal clue is the same ordering hook as Haisu
(2.25) and sits in digit range, but the gate geometry has no natural expression on a Sudoku
grid, where every cell already means something. Lower priority than Haisu for the same idea.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.18 Bosnian Road

**Rules** (https://wiki.logic-masters.de/index.php/Bosnian_Road/en): "Draw a loop in the
grid by travelling horizontally and vertically without touching itself. The numbers in the
grid indicate the number of cells occupied by the loop in the 8 neighbouring cells."

**Structure.** A loop on cells (not edges) that may not touch itself, with an
8-neighbourhood count clue — i.e. a Minesweeper clue over a loop.

**Sudoku hybrid suitability: Good.** The clue is 0..8, in digit range, purely local, and
the same shape as the Minesweeper clue that has the best hybrid track record in this survey.
The non-self-touching rule is a king-move constraint, cheap. The only expensive part is loop
connectivity. This is the loop genre with the most Sudoku-friendly clue. Linesweeper (2.27)
is now confirmed to carry the identical clue; the two differ only in that Bosnian Road
forbids the loop from touching itself while Linesweeper forbids only revisiting a cell, so
one component with a rule flag serves both.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.19 Nondango (ノンダンゴ)

**Rules** (https://puzz.link/js/pzpr-samples/nondango.js): "You're given a grid with circles
in some of the cells. Change some of the circles from white to black. 1. Each outlined
region must contain exactly one black circle. 2. There cannot be a horizontal, vertical or
diagonal run of 3 adjacent circles of the same color." Nikoli vol. 152.

**Structure.** Decision: binary recolouring of a given circle set. Global: one black per
region; no three-in-a-line of one colour among *adjacent* circles. Clues: the circle layout.

**Sudoku hybrid suitability: Workable, and very cheap.** One black circle per box is a
Star-Battle-flavoured count over nine boxes; the no-three-in-a-row rule is local and
includes diagonals, which the Sudoku grid does not otherwise use. No numeric clue, so the
digit hook is added. Cheap enough to be worth building as a small component even though the
payoff is moderate.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.20 Toichika (とういちか) and Toichika 2

**Rules** — Toichika (https://puzz.link/js/pzpr-samples/toichika.js): "Place an arrow in one
cell of each country. Some arrows are given. 1. Two arrows which point toward each other
form a pair. All arrows must be paired. 2. Paired arrows must not be in adjacent countries.
3. All cells between a pair of arrows must be empty." Nikoli vol. 129. Toichika 2
(https://puzz.link/js/pzpr-samples/toichika2.js) replaces arrows with numbers: "4. A pair of
numbers N must have exactly N cells between them", plus a pairing rule in row or column.

**Sudoku hybrid suitability: Toichika Poor, Toichika 2 Good.** Toichika's arrows are
directions with no quantity. Toichika 2's "a pair of numbers N has exactly N cells between
them" is a *digit-determined distance* — one of the most natural digit hooks in this entire
survey, and structurally the same as the sudoku "distance" constraints already in
circulation. One number per box, in range, with a strong long-range consequence.

**Existing hybrids:** none found (searched: LMD portal, GM Puzzles, general web).
[unverified as absence]

## 3.21 Doppelblock

**Rules** (https://puzz.link/js/pzpr-samples/doppelblock.js): "Place a number in some cells,
and shade the other cells. 1. Every row and column has exactly 2 shaded cells. 2. Numbers
must be between 1 and N-2, where N is the width of the board. 3. Each row and column
contains exactly one of each number. 4. A clue outside the grid indicates the sum of the
numbers which appear between the two shaded cells in the corresponding row or column."
Invented by Inaba Naoki. The LMD wiki carries a *Doppelblock-Sudoku* page
(https://wiki.logic-masters.de/index.php/Doppelblock-Sudoku).

**Structure.** A number-placement genre with a two-shaded-per-line rule. Decision: digits
plus a binary shading. Clues: outside sums.

**Sudoku hybrid suitability: Good, and it is already half a Sudoku.** Rules 1-3 are a Latin
square with two blanks per line; rule 4 is a sandwich-sum clue, which variant sudoku uses
constantly. The 9x9 form places 1..7 plus two blanks per row and column — structurally
identical to the published Star Battle Sudoku (1..7 plus two stars). The shading layer is
trivially cheap (exactly two per line).

**Existing hybrids:** **Doppelblock-Sudoku is a registered genre on the LMD wiki**
(https://wiki.logic-masters.de/index.php/Doppelblock-Sudoku), alongside
*Doppelblock-Hochhäuser* (Doppelblock x Skyscrapers)
(https://wiki.logic-masters.de/index.php/Doppelblock-Hochh%C3%A4user). That is direct,
primary-source evidence of the hybrid existing as a named type.

## 3.22 Others on the region index worth naming

The puzz.link region-division and area-number indexes carry 54 genres. Those not treated
above, with rule cores, all at `https://puzz.link/js/pzpr-samples/<pid>.js`:

| Genre | Rule core | Hybrid note |
| --- | --- | --- |
| Compass (`compass`) | Each block holds one compass; its four numbers count the block's cells strictly further in each direction | Four numbers per clue cell; digit-range counts. **Good** — and LMD carries Compass and Compass (Variant) tags |
| Square Jam (`squarejam`) | Divide into squares; a number is its square's side length; no 4-way border intersections | Side length 1..9, native. Cheap (squares are a tiny family). **Good.** By Eric Fox |
| Fillmat (`fillmat`) | 1-wide rectangles of length 1-4; equal sizes may not share a border; no 4-way intersections | Nuribou as a partition. Workable |
| Usotatami (`usotatami`) | 1-wide rectangles; the number in a region is *different* from its size | A negative size clue — unusual, and a strong pruning shape. Workable |
| Yajitatami (`yajitatami`) | 1-wide rectangles; an arrow number gives both the region's size and how many other regions lie in the arrow direction | Two facts per clue, both in digit range. Workable to Good |
| Double Choco (`dbchoco`) | Each region splits into one white and one grey area of equal size and shape; a number gives its area's size | Congruence between two halves — an unusual and strong rule; size in range. **Good** |
| Nikoji (`nikoji`) | Same-letter regions are congruent with the letter in the same relative position; different letters differ in shape | Congruence again, but letter-clued. Workable |
| Bosnian Road (`bdblock` is a different genre: Border Block) | Border Block: identical numbers in one block, different numbers in different blocks; all branch points given | The "all dots given" completeness rule is a strong negative constraint. Workable |
| Lapaz (`lapaz`) | Shade non-adjacent cells; divide the rest into dominoes; a clue in a horizontal domino counts shaded cells in its row | Row/column counts on a domino layer — cheap, digit-range. Workable. By Shye |
| Lohkous (`lohkous`) | Blocks each carrying a cell with one or more numbers; every horizontal run in the block has a length from the clue list, and every listed number appears | A multiset-of-run-lengths clue. Rich but fiddly. Workable. By Hempuli |
| Slash Pack (`slashpack`) | Diagonal lines divide the grid; each region contains exactly one of each number on the board | A Latin-square-per-region rule on a diagonal partition. **Good** in principle, awkward geometry |
| Meandering Numbers (`meander`), Cojun (`cojun`), Makaro (`makaro`), Kazunori (`kazunori`), Sukoro Room (`sukororoom`), Renban (`renban`), Hanare (`hanare`), Putteria (`putteria`) | Region-plus-number genres: fill each region with 1..N under an adjacency, ordering or sum rule | These are *number-placement* genres, already Sudoku-adjacent. Renban's "numbers in each region form a consecutive sequence" is literally the Renban line constraint of variant sudoku; Makaro's arrows point at the largest neighbour; Meandering Numbers requires consecutive numbers to be orthogonally adjacent. All **Good** as constraint components, and several are already standard variant-sudoku rules under other names |
| Tentai Show variants, Kramma/Kramman (`kramma`, `kramman`), Shikaku Wolf (`shwolf`), Choco Block (`cbblock`), Loute (`loute`), Voxas (`voxas`), Tajmahal (`tajmahal`), Mirror Block (`mirrorbk`), Family Photo (`familyphoto`), Fractional Division (`fracdiv`), Sashikazune (`sashikazune`), Tachibk (`tachibk`), Triplace (`triplace`), Aho-ni-Narikire (`aho`), Hebi (`hebi`), Wafusuma (`wafusuma`), Tontti (`tontti`) | Rules at the cited URL pattern | Either no numeric hook, a non-grid geometry, or a rule set that duplicates a stronger entry above. None recommended now; rules are on file |

---

# 4. Sources read (continued)

Appended as the run progressed, after the initial block near the top.

- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=0003CM (LITS classic, rules)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000HEI (LITSomino)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000IKY (LITS Battle)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=0004X6 (Yin-Yang Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=0009P1 (Yin Yang Kropki Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000QNK (Yin Yang Sum Frame Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000HLV (Yin Yang Sudoku Deconstruction)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000GBW (Santa Pesto Pt. 2, nurimisaki-derived)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=0002G5 (Star Battle Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000J1E (HöhlenSTIL, Cave x LITS)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000QU3 (Cave Sums Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000ALC (Twilight Cave Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000EC2 (Cave Sudoku +)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000CW1 (Minesweeper Sudoku)
- https://www.gmpuzzles.com/blog/2022/07/minesweeper-sudoku-by-serkan-yurekli/
- https://erasablegames.com/battleship-sudoku/
- https://erasablegames.com/akari-light-up-on-sudoku/
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000H6A (Slitherlink Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000SRW (Massive Masyudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000OUD (Polysemy, Castle Wall/Masyu)
- https://logic-masters.de/Raetselportal/Suche/spezial.php?chlang=en&listname=rundwege (LMD loop collection)
- https://www.nikoli.co.jp/en/puzzles/masyu/
- https://www.gmpuzzles.com/blog/2021/08/castle-wall-masyu-by-mark-sweep/
- https://www.gmpuzzles.com/images/puzzles/190618-CastleWall-Masyu.pdf
- https://krazydad.com/masyu/tutorial/
- https://swaroopg92.blogspot.com/search/label/Total%20Puzzles (setter blog: Yajilin, Castle Wall, Tapa, Heyawake, Statue Park, Pentominous, Slitherlink, Necklace rulesets)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000HFV (Fillomino sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=000B8V (Shikaku Fillomino #2)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=00087H (Shikasudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=00093U (Shikasudoku 2)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000IVK (6x6 Shikaku Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000897 (Spiral Galaxy Sudoku with clues)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=00045K (Space Oddity, Galaxy Killer Sudoku)
- https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?chlang=en&id=000A76 (Pentomino Sudoku)
- https://wpcunofficial.miraheze.org/wiki/Spiral_Galaxies
- https://www.gmpuzzles.com/blog/spiral-galaxies-rules-info/
- https://wiki.logic-masters.de/index.php/Masyudoku/en
- https://wiki.logic-masters.de/index.php/Country_Road/en, /Simple_Loop/en, /Fillomino/en,
  /Araf/en, /Ripple_Effect/en, /Sashigane/en, /Spiral_Galaxies/en, /Suraromu/en,
  /Bosnian_Road/en, /Shikaku/en, /Anglers/en, /Arukone/en, /Snake/en, /Slalom/en
- https://wiki.logic-masters.de/index.php/Doppelblock-Sudoku
- https://wiki.logic-masters.de/index.php/Kategorie:Puzzletype/en (290 English genre pages)
- https://logic-masters.de/Raetselportal/Suche/erweitert.php?tag_id=4002 (Cave tag, 233 puzzles)

**Fetch discipline.** From the point the rate limit was set, requests ran one at a time,
at most one per host per ten seconds, with no URL retried after a failure and index pages
preferred over per-genre pages wherever an index states the rules. The bulk rules corpus was
already on disk by then; the later work was four requests in total.

**Could not reach or could not use:**
- https://puzz.link/rules.html and https://puzz.link/list.html rendered pages — JS-only.
  Worked around via the `data-pid` attributes in the raw list HTML and the per-genre
  `js/pzpr-samples/<pid>.js` data files, which is what the rules citations point at.
- https://www.gmpuzzles.com/blog/rules/ — the rules index serves only a sidebar to a
  fetcher. Individual GM Puzzles post pages and the per-genre "rules and info" pages
  (e.g. the Spiral Galaxies one above) do work, and were used where cited.
- https://gapp-puzzles.com/ has no genre or rules index; it is a daily puzzle series from
  the Cracking The Cryptic Discord. `https://gapp-puzzles.com/genres/` is a 404.
- https://wiki.logic-masters.de/index.php?title=Kategorie:Rätselart — empty; the live
  categories are `Kategorie:Haupträtselart/de` (844 German entries) and
  `Kategorie:Puzzletype/en` (290 English entries).
- The LMD advanced search (`Suche/erweitert.php`) accepts a `tag_id` filter by GET but
  ignored a title-text filter in every POST form I tried, so hybrid evidence was gathered
  by web search against the portal rather than by a tag-intersection query. A
  tag-intersection query would be a better method if someone works out the parameter.
- https://fitforpuzzle.com/puzzle-tutorials/ — a large tutorial catalogue covering ~250
  genres including Every Second Turn, Regional Yajilin and Loop de Loop, but it serves only
  its heading index to a fetcher; no rules bodies were returned. Not retried. Worth a look
  in a browser by a human.
- Puzzle Square JP (https://puzsq.logicpuzzle.app/) was not needed once the puzz.link
  corpus was in hand, and was not fetched.
- WPF Sudoku GP instruction booklets were not fetched directly; WPC evidence here comes
  from the WPC unofficial wiki and from puzzle pages citing booklets (e.g. Twilight Cave
  Sudoku citing the WPC 2019 booklet p. 48).

# 5. Summary table

Verdict key: **Good** = build it, the digit interaction is native or nearly so;
**Workable** = real hybrid, but the digit hook must be invented or the cost is high;
**Poor** = don't. "Evidence" counts distinct published Sudoku hybrids found in this run;
a "—" means none found after searching the LMD portal, GM Puzzles and the open web.

| Genre | Family | Decision layer | Global constraints | Verdict | Sudoku-hybrid evidence |
| --- | --- | --- | --- | --- | --- |
| Nurikabe | Shading | binary shade | shaded connected, no 2x2 shaded, one clue per island | Good | yes (5) |
| Hitori | Shading | binary shade | shaded non-adjacent, white connected | Poor | — |
| LITS | Shading | tetromino per region | connected, no 2x2, congruent neighbours banned | Workable | via LITS x Cave/Fillomino/Star Battle (3) |
| Tapa | Shading | binary shade | connected, no 2x2 | Good | via Tapa x Masyu/Nurikabe (2) |
| Kurodoko / Kuromasu | Shading | binary shade | shaded non-adjacent, white connected | Good | — (tag only) |
| Heyawake | Shading | binary shade | shaded non-adjacent, white connected, white run crosses ≤1 border | Good | via Starwacky (1) |
| Yin-Yang | Shading | binary colour, all cells | both colours connected, no monochrome 2x2 | Good | yes (4+) |
| Nurimisaki | Shading | binary shade | white connected, no monochrome 2x2, complete cape marking | Good | yes (1) |
| Shakashaka | Shading | 5-state per cell | white areas are rectangles (incl. 45°) | Poor | — |
| Star Battle | Shading/placement | binary star | king-move separation, exact count per row/col/region | Good | yes (3) |
| Cave / Corral | Shading | binary shade | white connected, walls reach border | Good | yes (4) |
| Canal View | Shading | binary shade | shaded connected, no 2x2 | Workable | clue type in use (2) |
| Kurotto | Shading | binary shade | none | Good | via Sudokurotto (1) |
| Mochikoro / Mochinyoro | Shading | binary shade | white regions rectangles, diagonally connected, no 2x2 | Workable | — |
| Light and Shadow | Shading | binary shade | both colours partition, one clue per area | Good | — |
| Chocona | Shading | binary shade | shaded blocks are rectangles | Good | — (repo work) |
| Stostone | Shading | binary shade | one block per region, gravity fills bottom half | Workable | — (tag only) |
| Nuribou | Shading | binary shade | shaded blocks are 1-wide bars, equal bars not diagonal | Workable | — |
| Norinori | Shading | binary shade | shaded set is dominoes, two per region | Good | — (tag only) |
| Choco Banana | Shading | binary shade | shaded groups rectangles, white groups not | Good | — (repo work) |
| Shimaguni | Shading | binary shade | one island per region, separated, neighbours differ in size | Good | — (tag only) |
| Aqre | Shading | binary shade | shaded connected, no run of 4 in either colour | Good | — |
| Aquapelago | Shading | binary shade | shaded non-adjacent but diagonally grouped, white connected, no white 2x2 | Workable | — |
| Minesweeper | Shading/placement | binary mine | total count only | Good | yes (2) |
| Battleships | Shading/placement | binary occupancy | exact fleet, king-move separation | Good | yes (2+) |
| Akari | Shading/placement | binary bulb | all white lit, bulbs don't see each other | Workable | yes (1) |
| Dominion | Shading | binary shade | shaded set is dominoes, letter-consistent white regions | Workable | — (tag only) |
| Cross the Streams | Shading | binary shade | connected, no 2x2 | Workable | — (tag only) |
| Coral | Shading | binary shade | connected, no 2x2, white reaches border | Workable | — (tag only) |
| Creek | Shading | binary shade | white connected | Workable | — |
| Tetrochain | Shading | tetromino placement | diagonal chain, orthogonal separation | Poor | — |
| Slitherlink | Loop | edge on/off | single closed loop | Good | yes (3) |
| Masyu | Loop | per-cell loop shape | single closed loop through every circle | Good | yes (3+, incl. a named genre) |
| Country Road | Loop | per-cell loop shape | one loop, each region visited once | Good | — (tag only) |
| Yajilin | Loop + shading | shade + loop | loop covers all unshaded, shaded non-adjacent | Workable | — (tag only) |
| Simple Loop | Loop | per-cell loop shape | Hamiltonian on unshaded | Workable | — |
| Castle Wall | Loop | per-cell loop shape | one loop, explicit inside/outside | Good | via Castle Wall x Masyu (3) |
| Balance Loop | Loop | per-cell loop shape | one loop through every circle | Good | — |
| Double Back | Loop | per-cell loop shape | Hamiltonian on unshaded, two visits per region | Workable | — |
| Detour | Loop | per-cell loop shape | Hamiltonian on all cells | Good | — |
| Geradeweg | Loop | per-cell loop shape | one loop through every circle | Good | — (tag only) |
| Maxi Loop | Loop | per-cell loop shape | Hamiltonian on all cells | Workable | — |
| Mid-Loop | Loop | per-cell loop shape | one loop through every circle | Workable | — (tag only) |
| Koburin | Loop + shading | shade + loop | as Yajilin | Workable | — |
| Myopia | Loop | edge on/off | single closed loop | Workable | — (tag only) |
| Onsen-Meguri | Loop | multi-loop | one loop per circle, equal visit length per room | Workable | — |
| Pipelink / Loop Special | Loop | loop shape with crossings | Hamiltonian / loop identity classes | Poor–Workable | — |
| Round Trip | Loop | loop with crossings | single loop | Workable | — |
| Tapa-Like Loop | Loop | per-cell loop shape | single closed loop | Good | via Tapa x Masyu, Necklace (2) |
| Moon or Sun | Loop | per-cell loop shape | one loop, one visit per region, moon/sun alternation | Good | — (tag only) |
| Numberlink / Arukone | Path | path id per cell | disjointness (+ coverage) | Poor | — (tag only) |
| Nagenawa / Ring-Ring | Loop | rectangle loops | non-overlap, no shared corners | Workable | — |
| Snake | Path | binary occupancy | single self-avoiding path, no diagonal contact | Good | yes (2+, tags) |
| Slalom / Gokigen | Line | binary diagonal | acyclicity | Workable | partial (1, unverified) |
| Icebarn | Path | directed path with crossings | terrain-driven | Poor | — |
| Haisu / Kaisu | Path | Hamiltonian path | region visit ordinals | Good | — |
| Dotchi-Loop | Loop | per-cell loop shape | per-region turn/straight uniformity | Workable | — |
| Linesweeper | Loop | per-cell loop shape | single closed loop, loop avoids clue cells | Good | — |
| Regional Yajilin | Loop + shading | shade + loop | loop covers all white, shaded non-adjacent, per-region shaded count | Good [unverified rules] | — |
| Bosnian Road | Loop | cell loop | non-self-touching loop, 8-neighbour count clue | Good | — |
| Fillomino | Region | region id | equal-size regions not adjacent | Good | yes (4+) |
| Symmetry Area | Region | region id | as Fillomino + 180° symmetry | Workable | — |
| Araf | Region | region id | two clues per region, size strictly between | Good | — |
| Shikaku | Region | rectangle placement | exact tiling | Good | yes (4) |
| Nanro | Region + number | filled/empty + count | connected, no 2x2, equal counts not adjacent across borders | Good | — (tag only) |
| Spiral Galaxies | Region | region id | 180° symmetry about a given centre | Good | yes (2 + WPC hybrids) |
| Pentominous | Region | pentomino tiling | adjacent shapes differ | Workable | yes (2) |
| Tetrominous / Fourcells / Fivecells | Region | fixed-size tiling | adjacent shapes differ / border-count clues | Workable | — |
| Statue Park | Region/placement | polyomino placement | exact bank, separation, connected complement | Workable | yes (1, Minesweeper-clued) |
| Tren | Region/placement | 1x2, 1x3 placements | non-overlap; clue is sliding freedom | Workable | — |
| Sashigane | Region | 1-wide L tiling | exact tiling | Good | — (tag only) |
| Snake Pit | Region | snake tiling | equal-length snakes not adjacent | Good | — |
| Nawabari | Region | rectangle tiling | per-cell border count clue | Good | — (Landvermessung tag) |
| Tatamibari | Region | rectangle tiling | shape-class clues, no 4-way border crossings | Workable | — |
| Ripple Effect / Hakyuu | Number placement | digit per cell | 1..N per region, distance rule on repeats | Good | yes (tags: Hakyuu, Suguru) |
| Suraromu | Loop | loop + gate ordinals | single loop through every gate once | Workable | — |
| Nondango | Region/placement | binary recolour | one black per region, no three-in-line | Workable | — |
| Toichika | Region/placement | arrow per region | pairing | Poor | — |
| Toichika 2 | Region + number | number per region | pair separated by exactly N cells | Good | — |
| Doppelblock | Number placement | digit + 2 blanks per line | Latin square with blanks, outside sums | Good | yes (a named LMD genre) |
| Compass | Region | region id | four directional counts per clue | Good | — (tag) |
| Square Jam | Region | square tiling | side-length clues, no 4-way intersections | Good | — |
| Double Choco | Region | region id | two congruent halves per region | Good | — |
| Renban / Makaro / Meandering Numbers / Cojun | Region + number | digit per cell | 1..N per region under an ordering/adjacency rule | Good | already standard variant-sudoku rules |

# 6. Ranked recommendations for this repo

**Build these ten, in this order.** The ranking weighs three things: how native the digit
interaction is (does the setter have to invent the hook?), implementation cost in a
SudokuMaker `update` over a candidate grid, and whether published hybrids prove the combined
solve is pleasant rather than two puzzles glued together.

1. **Yin-Yang.** No native clues, so every clue comes from the Sudoku side and the layers
   cannot decouple. Colours every cell. The most-set shading hybrid in modern variant
   sudoku, with four distinct published examples found here. Cost: two connectivity
   propagators, nothing else.
2. **Fillomino.** The only genre where the hybrid is an identification rather than an
   overlay — the Sudoku digit *is* the region size. Featured on Cracking The Cryptic. The
   repo already holds Fillomino CP-SAT, prior-art and isofill-transfer research.
3. **Shikaku.** Rectangles are a small enumerable domain, so the propagator is cheap and
   sound; area equals digit with no remapping; four published hybrids by a strong setter.
   Reuses the Renbanana rectangle catalogue.
4. **Nurikabe.** The deepest hybrid tradition in the survey (five examples, including a
   "colossal" and a setter's debut), three independent digit hooks, island size bounded by 9.
   Cost: the hardest connectivity propagator here — budget for it.
5. **Star Battle.** The cheapest Good entry. King-move separation plus exact counts is
   already SudokuMaker-shaped, and the published 9x9 form (1-7 plus two stars per house)
   balances the grid exactly.
6. **Cave.** Visibility clues are the X-sums/skyscraper machinery this repo already models,
   and the setter community's digit-sum variant solves the range overshoot. Four published
   hybrids, including a WPC-derived Twilight Cave.
7. **Geradeweg.** The first loop component worth building: segment length 1..9 equals the
   digit range exactly, one number per circle, no invented rule, and the loop need not cover
   every cell so there is slack for pure Sudoku deduction. Build the loop propagator here
   and Masyu, Country Road and Balance Loop follow almost free.
8. **Masyu.** *Masyudoku* is a registered genre and a 2026 LMD puzzle pairs it with Region
   Sum Lines. The clue is about shape at a cell, which composes with parity and length
   hooks, and unvisited cells stay free for Sudoku work.
9. **Chocona or Choco Banana.** Both are rectangle-shading with a size or count clue in
   digit range, and both reuse this repo's existing Renbanana and choco-banana propagation
   work. Pick Choco Banana if you want the anti-rectangle rule's bite, Chocona for the
   per-box count hook.
10. **Haisu.** The only genre whose clue is natively an *ordinal* — "this cell is on the Nth
    visit to its box" — which gives a Sudoku grid the one thing digits cannot express, a
    total order. No published hybrid found, which makes it the most interesting unclaimed
    idea in this survey. Build it after the loop/path propagator from #7 exists.

**Strong second wave, if the first ten land well:** Heyawake (per-box shaded count, plus the
distinctive white-run rule), Norinori (cheapest non-trivial `update` in the survey),
Nanro, Spiral Galaxies (symmetry pairs cells, two published hybrids plus a long WPC record),
Sashigane, Snake Pit, Nawabari, Aqre, Toichika 2, Square Jam, Double Choco, Light and Shadow,
Country Road, Bosnian Road, Minesweeper.

**Avoid, and why:**

- **Hitori** — rule 2 is vacuous on a completed Sudoku. The only interesting form inverts
  the puzzle and does not fit a fixed 9x9 candidate grid.
- **Shakashaka** — five-state decision layer, a geometric global no local propagator
  captures, and a triangle is an orientation, not a quantity.
- **Numberlink / Arukone** — topological routing with no count, length or order for a digit
  to carry; the one natural hook forces all nine cells of a digit into one path.
- **Icebarn and Nagare** — both need a given terrain of special cells that a Sudoku grid
  does not supply, and both encode directions rather than quantities.
- **Tetrochain** — LITS without the box partition that made LITS fit, plus a harder global.
- **Pipelink** — crossings multiply per-cell state without adding a digit hook.
- **Toichika (v1)** — arrows are directions with no quantity; use Toichika 2 instead.
- **Stostone** — the gravity rule needs an even grid height and does not express in a
  candidate-grid propagator.
- **Pentominous / Tetrominous as tilings** — 81 is divisible by neither 5 nor 4, so a pure
  tiling is impossible and every hybrid has to work around it.

**One implementation warning that applies to every entry above.** The repo's standing
invariant is that a component's `update` must never remove a candidate the true solution
needs, and the genres here fail that invariant in one specific way: connectivity. "This cell
cannot be shaded because shading it would disconnect the white region" is sound only if the
reasoning accounts for every cell still undecided, and a propagator that reasons over the
*current* partial grid instead of every completion will silently over-prune. Read
`docs/research/connectivity-techniques.md` and `docs/research/infection-shading-model.md`
before writing any of the connected-set genres, and run the soundness harness on every
change, expecting zero violations.
