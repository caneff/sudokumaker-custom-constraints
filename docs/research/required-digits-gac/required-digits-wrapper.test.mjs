// RequiredDigitsWrapperComponent.js and RequiredDigitsWrapperComponentBuiltin.js
// (#534): both are pure `puzzle.replaceComponent` delegates -- update never
// calls removeCandidatesFromCell itself, so it cannot be unsound on its own
// (docs/component-contract.md's invariant transfers whole to whichever class
// it swaps itself for: the app's own built-in RequiredDigits, or
// RequiredDigitsGacComponent, which carries its own 28,000-state
// soundness-harness.mjs). What this file checks instead: the wrapper idles
// on a blank clue, and once the clue fills it swaps for the right class with
// the right (value, window) -- window sized exactly as
// examples/outside-sudoku/OutsideSudokuComponent.js's own windowLength (a
// verbatim copy, per this file's header) -- and, per docs/gotchas.md #1,
// that the GAC variant spells its sibling custom class as
// `customComponents.Name`, never a bare name.
//
// Not part of `just test` (docs/research is not gated, #413) -- run by hand:
//
//   node docs/research/required-digits-gac/required-digits-wrapper.test.mjs

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import assert from 'assert'
import { makeIo } from '../../../examples/_shared/harness-lib.mjs'
import { gridGeometry } from '../../../examples/outside-sudoku/grid-geometry.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)

// The two swap targets the wrapper's `update` can reach: a bare built-in
// global, and a custom sibling reached only through `customComponents`
// (docs/gotchas.md #1). Recording constructor calls is enough here --
// neither target's own logic is under test -- but the two targets must be
// DISTINCT classes: a shared recorder would pass `next instanceof
// TargetClass` no matter which one `update` actually called, so a wrapper
// that spells the sibling as a bare `RequiredDigitsGacComponent` (the
// gotcha this file's header names) would still read as correct here.
class BuiltinRecorder {
  constructor (name, values, cells) { this.name = name; this.values = values; this.cells = cells }
}
class GacRecorder {
  constructor (name, values, cells) { this.name = name; this.values = values; this.cells = cells }
}
globalThis.RequiredDigitsComponent = BuiltinRecorder
globalThis.customComponents = { RequiredDigitsGacComponent: GacRecorder }

const g = gridGeometry(9, 3, 3) // 3x3 boxes: window = 3 cells

function run (mod, line, clueValue) {
  const replaced = []
  const p = {
    ...g.api,
    hasValue: () => clueValue !== undefined,
    getValue: () => clueValue,
    replaceComponent: (instance, next) => { replaced.push(next); return { type: 'ReplaceComponent', next } }
  }
  const inst = {}
  mod.setParams(inst, g.clue, line)
  const changes = [...mod.update(inst, p)]
  return { changes, replaced }
}

for (const [label, file, TargetClass] of [
  ['ours (RequiredDigitsWrapperComponent.js -> customComponents.RequiredDigitsGacComponent)', 'RequiredDigitsWrapperComponent.js', GacRecorder],
  ['original (RequiredDigitsWrapperComponentBuiltin.js -> RequiredDigitsComponent)', 'RequiredDigitsWrapperComponentBuiltin.js', BuiltinRecorder]
]) {
  const mod = load(file, ['setParams', 'update'])
  const line = g.rowLine(0, 0, 9)

  // ---- idle while the clue is blank: no replaceComponent, no change at all
  {
    const { changes, replaced } = run(mod, line, undefined)
    assert.deepStrictEqual(changes, [], `${label}: idle run yielded a change`)
    assert.strictEqual(replaced.length, 0, `${label}: idle run replaced a component`)
  }

  // ---- once filled: exactly one replaceComponent, over the 3-cell window,
  // required to hold the clue's own value
  {
    const { changes, replaced } = run(mod, line, 7)
    assert.strictEqual(changes.length, 1, `${label}: filled run should yield exactly one change`)
    assert.strictEqual(replaced.length, 1, `${label}: filled run should replace exactly once`)
    const next = replaced[0]
    assert.ok(next instanceof TargetClass, `${label}: swap target is not the expected class`)
    assert.deepStrictEqual(next.values, [7], `${label}: required value should be the clue's own digit`)
    assert.deepStrictEqual(next.cells, line.slice(0, 3), `${label}: window should be the first 3 cells (3x3 box)`)
  }

  // ---- a line shorter than the window still gets a window, capped at its
  // own length, same as OutsideSudokuComponent.js
  {
    const shortLine = g.rowLine(0, 0, 2)
    const { replaced } = run(mod, shortLine, 4)
    assert.deepStrictEqual(replaced[0].cells, shortLine, `${label}: window should cap at the line's own length`)
  }
}

console.log('ok')
