# Can the app's Fishes deduction strip a candidate off a frame board's ring?

**No, on this app version — and not because the deduction is sound there.**
The app never builds the step for a frame board at all. The gate is the
puzzle's spec `type`, not anything in `frame-rowcol.js`.

Probed against v2026.08.14-d47fc4b (`examples/_shared/sudokumaker.har`),
2026-09-09, as fix round 1 on #394.

## The worry

`frame-rowcol.js` gives each interior line a `houseType` of `Row` or `Column`.
In the shipped bundle the fish step reads that field:

```js
// solver-Bv75x3BJ.js, class Ke
const i = t.filter(o => o.houseType === y.Row && o.cells.length <= this.groupSize)
           .map(o => ({ ...o, y: m.cellIds.getY(o.cells[0]) }))
for (const o of ce(i, this.groupSize)) {
  const r = bs(o, l => m.cellIds.getX(l))
  if (z(r) === this.groupSize) {
    const l = []
    for (let a = 0; a < h.size.height; a++)      // EVERY board row
      if (!o.some(c => c.y === a))
        for (const c of Ce(r)) l.push(c + a * h.size.width)
    yield { changes: [L(e, l)], ... }            // L = remove candidate e
  }
}
```

It walks board rows `0 .. height - 1` — it assumes `Row` houses partition the
board. On a frame board they do not: the `Row` houses cover interior rows
`1 .. H - 2` only, so the eliminations would land on ring rows `0` and `H - 1`,
whose cells belong to no house and hold clue values unrelated to the interior
column beneath them. That is the soundness invariant, failing silently.

Before #394 the interior lines were `type: 301` cages, which register as the
default `ExtraRegion` and the `houseType === Row` filter skips. So the
exposure, if real, was new.

## The gate

Same bundle, where the solver picks its logic steps:

```js
const qn = new Set([R.NakedSets, R.HiddenSets, R.PointingSets,
                    R.UnorthodoxNakedSet, R.SimpleSums, R.ConsecutiveSets,
                    R.KropkiDots, R.CountingCircles, R.ByContradiction])
class En { constructor (e) { e = { ...e, stepTypes: e.stepTypes.filter(t => qn.has(t)) }, ... } }
...
s.type === be.Sudoku ? new Ns(i).setLogicSteps(J)
                     : s.type === be.Custom && new En(i).setLogicSteps(J)
```

`qn` holds neither `R.XWings` nor `R.Fishes` (nor `R.AlmostXWings`, which
filters on `houseType` the same way). A `custom`-spec puzzle therefore never
constructs `Ke`. Every frame link in this repo is `"type": "custom"` — that is
the same fact as "a region constraint gives BOXES ONLY" (#335,
`docs/gotchas.md` #9).

## The live A/B

Two boards, each carrying a `PredefinedCandidatesComponent` that forces a Row
X-wing on one digit, driven through `app-dom.mjs` and the app's own AutoStep to
its fixpoint. The app prints its step log, so it says what it did.

**Frame board** (6x6, interior 4x4, digits 1..4, `type: "custom"`, shipping the
real `frame-rowcol.js` and `frame-corners.js`). Interior rows 1 and 3 keep a 4
only in interior columns 1 and 2 — a live Row X-wing. The ring clue cells carry
no constraint at all, so every digit must survive in each of them and any
elimination there is unsound.

```
✨ Naked single at R1C1; set R1C1 to 1        <- the pinned corners
✨ Naked single at R1C6; set R1C6 to 1
✨ Naked single at R6C1; set R6C1 to 1
✨ Naked single at R6C6; set R6C6 to 1
👉 Pointing pair in region 2: R3C4 and R3C5; removed 4 from R3C2 and R3C3
👉 Pointing pair in region 4: R5C4 and R5C5; removed 4 from R5C2 and R5C3
No logical steps found.
```

Final board: all 16 ring clue cells still read `1234`. **No candidate left a
ring cell**, and the X-wing was still standing when the app gave up.

Two things worth reading off that log. The pointing pairs reach `R3C2`/`R3C3`
from `R3C4`/`R3C5` — cells in a different box — which is only possible through
the row `HouseComponent`. So the custom houses *are* live in the solver's house
machinery; the fish's absence is not the houses failing to register. And
`getCellsSeenByCells`, which every step in `qn` eliminates through, is
house-membership based, so those steps cannot reach a ring cell.

**Control** (standard 9x9, `type: "sudoku"`, same forced-X-wing trick on 9):

```
🐟 X-Wing on 9s in rows 1 and 4; removed 9 from R2C1, R2C2, R3C1, R3C2, R5C1,
   R5C2, R6C1, R6C2, R7C1, R7C2, R8C1, R8C2, R9C1 and R9C2
No logical steps found.
```

Same construction, fish fires. The difference between the two runs is the spec
`type`.

## What this does and does not settle

- **Settled:** on v2026.08.14-d47fc4b, `houseType` on a frame board's lines
  cannot produce an unsound elimination through Fishes, X-Wings or
  Almost-X-Wings, because those steps are not built for a `custom` puzzle.
- **Not settled:** whether `houseType` should stay. It buys nothing from the
  three steps that read it, so the header note in `frame-rowcol.js` — "its
  Fishes and its row/column mappings read `Row` and `Column`" — overstates the
  Fishes half for boards this repo ships.
- **The trip wire:** the day SudokuMaker adds `XWings`/`Fishes` to `qn`, or a
  frame board is built with `type: "sudoku"`, this becomes a live soundness
  break with no error message. Re-run the probe after a SudokuMaker release
  that changes the solver.

## Reproducing

The probe builders and the Playwright driver are small and self-contained; they
are reproduced from this document rather than committed, since they are pinned
to one bundle version. Build a `custom` frame board that forces a Row X-wing,
build the same forced X-wing on a `type: "sudoku"` board, load each through
`useRecordedApp`, click `Icon AutoStep`, and read `document.body.innerText` for
the step log and the grid's `svg text` for the candidates.
