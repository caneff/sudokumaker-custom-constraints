# Gotchas

The expensive lessons. The first two each cost real debugging time.

## 1. `replaceComponent` only works with built-in components

`puzzle.replaceComponent(instance, new X(...))` swaps `instance` for a new
component `X`. This works when `X` is a **built-in** (e.g. `SkyscraperComponent`,
`GreaterThanComponent`, `IndexComponent`). It does **not** work when `X` is
another **custom** component from a sibling code segment — the swap silently
produces nothing, and your rule never enforces. **[verified]**

The trap is seductive because the built-in edge-clue template does exactly this:
a small wrapper watches the clue cell, then
`replaceComponent(instance, new SkyscraperComponent(name, value, cells))` once
the clue has a value. Copy that shape for your own rule and swap in
`new MyCustomComponent(...)`, and the whole constraint goes dead.

**Fix:** do not split across two custom components. Write **one self-contained
component** and register it directly in the main code. Give it both the clue
cell and the line, and let its own `update`/`validate` do everything. The
Running Start example takes this shape.

## 2. A validate-only component is inert

Defining only `validate` (no `update`) looks reasonable — the solver should call
it to reject wrong states. It does not appear to. In every working example we
found, each component that has `validate` also has `update`. Symptoms of a
validate-only component: outside/target cells keep their full candidate set, and
entering a wrong value raises no conflict. **[verified]**

**Fix:** always give the component a real `update` that removes at least some
candidates. Keep `validate` as the exact final check. See
`component-contract.md`.

## 3. Groups carry the reading direction — do not re-derive it

For an edge/line rule, the author's group already lists the line cells in the
order your rule should read them (nearest the clue first). Read `cells.slice(1)`
in the given order. Do not recompute row/column geometry and risk reading a
line backwards; trust the group order. **[verified]**

## 4. `DigitSet` is iterable but not an array

`puzzle.getCandidates(cell)` returns a `DigitSet`. Wrap it with `Array.from(...)`
before using array methods (`filter`, `includes`, spread into `Math.max`). Build
one to pass back with `SudokuDigitSet.from([...])`, or from a bitmask with
`new SudokuDigitSet(mask)` (bit `d` = digit `d`; `puzzle.getCandidatesBitMask`
reads one). The set algebra (`intersect`, `union`, `subtract`) **mutates** the
set it is called on. Members in `docs/puzzle-api.md`. **[verified]**

## 5. The puzzle ships with its full solution

An "interactive/entered" puzzle stores a value on every cell; the `given` flag
decides what the solver sees. A clue cell with `given: false` is **not** shown
to the solver — it is a blank the solver must deduce, not a clue. If you want a
visible clue, its cell must be `given: true`. **[verified]**

## 6. Order-of-evaluation for `getCellsCanHaveRepeats` / `getCellsSeeEachOther`

Both walk the exclusion groups of the constraint components registered **so
far**. The app sorts constraints by type priority (0 for all but
Nonconsecutive, so document order) and registers them one by one; a query made
in **main code** at register time sees only the constraints registered before
yours. A query made in a component's `update` runs at solve time, after every
constraint is registered, and sees them all: moving our constraint ahead of the
built-in `Rows`/`Columns` houses did not change the answer (live, 2026-08-28,
#189). Gate house rules in `update`, not in main code. **[verified]**

## 7. The whole puzzle is in the URL

There is no server store. A very large component (long code, embedded images)
can push the URL past browser/server length limits and truncate the puzzle,
which is silent data loss. Keep component code lean. **[docs]**

## 8. Encoding is lz-string

The `?puzzle=` payload is `LZString.compressToEncodedURIComponent(JSON.stringify(document))`.
Decode with `decompressFromEncodedURIComponent`. See `patterns.md`. **[verified]**
