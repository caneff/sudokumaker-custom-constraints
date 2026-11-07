// solveLogically against a stub page: the logic pass is finished only when the
// "Stop solving" button has gone for several samples in a row, however still
// the board is meanwhile (#881).
// Run: node examples/_shared/app-dom.test.mjs

import assert from 'assert'
import { solveLogically, readCells, readGrid, cellScreenPoint } from './app-dom.mjs'

// A page whose DOM answers the queries solveLogically makes. `stopAt(n)`
// says whether "Stop solving" shows at the n-th sample; the board is never read, as the stalled fillomino pass shows it is no signal.
function stubPage (stopAt) {
  let samples = 0
  let clock = 0
  const doc = {
    querySelectorAll (sel) {
      if (sel === 'svg') {
        return [{ getAttribute: () => 'Icon AutoStep', closest: () => ({ click () {} }) }]
      }
      if (sel === 'button') {
        samples++
        // The label gains " (Esc)" after a keypress in the real app.
        return stopAt(samples) ? [{ textContent: samples % 2 ? ' Stop solving ' : 'Stop solving (Esc)' }] : []
      }
      return []
    }
  }
  return {
    samples: () => samples,
    now: () => clock,
    evaluate: async (fn, arg) => { globalThis.document = doc; return fn(arg) },
    waitForTimeout: async ms => { clock += ms }
  }
}

// Stop solving shows for 40 samples (both labels): settling on a still board
// would return after 4 samples, mid-pass.
const stalled = stubPage(n => n <= 40)
await solveLogically(stalled, { now: stalled.now })
assert.strictEqual(stalled.samples(), 43)

// A flicker (gone for two samples, then back) is not the end of the pass.
const flicker = stubPage(n => n <= 10 || (n >= 13 && n <= 20))
await solveLogically(flicker, { now: flicker.now })
assert.strictEqual(flicker.samples(), 23)

// A pass still running at the timeout throws, never returns a time.
const endless = stubPage(() => true)
await assert.rejects(solveLogically(endless, { now: endless.now }), /did not settle within 300000ms/)

// The board reader against a stub DOM: digits come from `svg text` under a cell
// transform, any board size, and the click point goes through the grid's CTM.
{
  const text = (content, fill, transform) => ({
    textContent: content,
    getAttribute: a => (a === 'fill' ? fill : null),
    closest: () => (transform ? { getAttribute: () => transform } : null)
  })
  const texts = [
    text('4', '#000', 'translate(25 25) scale(25)'),
    text('8', 'rgb(82, 116, 234)', 'translate(275 75) scale(25)'),
    text('2', '#fff', 'translate(1 1) scale(0.02)'),
    text('6', '#000', null),
    // no fill attribute: the reader falls back to the computed style
    text('3', null, 'translate(125 75) scale(25)')
  ]
  const outerG = { getScreenCTM: () => 'ctm' }
  const svg = {
    getAttribute: () => 'SudokuSvg',
    querySelector: () => outerG,
    createSVGPoint: () => ({ matrixTransform (m) { assert.strictEqual(m, 'ctm'); return { x: this.x * 2, y: this.y * 2 } } })
  }
  const doc = {
    querySelectorAll: sel => (sel === 'svg text' ? texts : sel === 'svg' ? [svg] : [])
  }
  const page = { evaluate: async (fn, arg) => { globalThis.document = doc; globalThis.window = { getComputedStyle: t => ({ fill: t.textContent === '3' ? 'rgb(0, 0, 0)' : '' }) }; return fn(arg) } }

  const cells = await readCells(page)
  assert.deepStrictEqual(cells.map(c => [c.row, c.col, c.content, c.fill]), [[0, 0, '4', '#000'], [1, 5, '8', 'rgb(82, 116, 234)'], [1, 2, '3', 'rgb(0, 0, 0)']])
  // a 7-wide board whose last row and column are empty reads whole
  assert.deepStrictEqual(await readGrid(page, 7), ['4......', '..3..8.', '.......', '.......', '.......', '.......', '.......'])
  assert.deepStrictEqual(await cellScreenPoint(page, 1, 5), { x: 550, y: 150 })
}

console.log('app-dom.test.mjs: all seams pass')
