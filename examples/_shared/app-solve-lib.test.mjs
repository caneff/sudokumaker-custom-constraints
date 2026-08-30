// Focused tests of the readout parser and print-line formats used by
// app-solve.mjs, independent of a real browser run. Run: node
// examples/_shared/app-solve-lib.test.mjs

import assert from 'assert'
import { parseReadout, parseVersion, repLine, medianLine, marksRejected, countEnteredValues } from './app-solve-lib.mjs'

// ---- first "took" only, no verdict yet: all three times report null ----
// The solve phase printed its "took" but the uniqueness search has not
// finished, so there is no verdict -- a partial "took" is not a time.
{
  const text = '✨ Solved took 2.3s'
  const r = parseReadout(text)
  assert.strictEqual(r.first, null)
  assert.strictEqual(r.unique, null)
  assert.strictEqual(r.sum, null)
  assert.strictEqual(r.verdict, '?')
}

// ---- both "took"s plus a unique verdict ----
{
  const text = '✨ Solved took 2.3s\nThis is a unique solution. took 0.4s'
  const r = parseReadout(text)
  assert.strictEqual(r.first, 2300)
  assert.strictEqual(r.unique, 400)
  assert.strictEqual(r.sum, 2700)
  assert.strictEqual(r.verdict, 'unique')
}

// ---- no verdict within the cap: both "took"s absent, times report null ----
{
  const text = 'still solving...'
  const r = parseReadout(text)
  assert.strictEqual(r.first, null)
  assert.strictEqual(r.unique, null)
  assert.strictEqual(r.sum, null)
  assert.strictEqual(r.verdict, '?')
}

// ---- a timeout after a first solve: first reports its time, unique and sum stay null ----
// The uniqueness search never finished, so unique and sum are not times -- but
// the solve phase already printed its "took", and a timeout row should not
// hide that.
{
  const text = '✨ Solved took 6.8s\nStopped solving (time limit 300s)'
  const r = parseReadout(text)
  assert.strictEqual(r.first, 6800)
  assert.strictEqual(r.unique, null)
  assert.strictEqual(r.sum, null)
  assert.strictEqual(r.verdict, 'timeout')
}

// ---- a not-unique verdict still reports both times ----
{
  const text = '✨ Solved took 100ms\nThis puzzle has multiple solutions. took 50ms'
  const r = parseReadout(text)
  assert.strictEqual(r.first, 100)
  assert.strictEqual(r.unique, 50)
  assert.strictEqual(r.sum, 150)
  assert.strictEqual(r.verdict, 'not-unique')
}

// ---- rep line prints first, unique, sum, and verdict ----
{
  const line = repLine({ first: 2300, unique: 400, sum: 2700, verdict: 'unique' })
  assert.strictEqual(line, '  first 2300ms  unique 400ms  sum 2700ms  [unique]')
}

// ---- rep line for a rep with no verdict prints null times and a ? verdict ----
{
  const line = repLine({ first: null, unique: null, sum: null, verdict: '?' })
  assert.strictEqual(line, '  first nullms  unique nullms  sum nullms  [?]')
}

// ---- rep line for a timeout with a first-solve time names the time, not three nulls ----
{
  const line = repLine({ first: 6800, unique: null, sum: null, verdict: 'timeout' })
  assert.strictEqual(line, '  first 6800ms, no verdict  [timeout]')
}

// ---- rep line for a timeout with no first-solve time either ----
{
  const line = repLine({ first: null, unique: null, sum: null, verdict: 'timeout' })
  assert.strictEqual(line, '  no first solve, no verdict  [timeout]')
}

// ---- median line reports the median of each of the three numbers, over reps with a verdict ----
{
  const rows = [
    { first: 100, unique: 10, sum: 110, verdict: 'unique' },
    { first: 200, unique: 20, sum: 220, verdict: 'unique' },
    { first: 300, unique: 30, sum: 330, verdict: 'unique' },
    { first: null, unique: null, sum: null, verdict: '?' }
  ]
  const line = medianLine(rows)
  assert.strictEqual(line, '  MEDIAN first 200ms  unique 20ms  sum 220ms  over 3/4 reps')
}

// ---- median line excludes a timeout row even though it now carries a first time ----
// A timeout row's first time is real (it prints in repLine), but it must not
// enter the median or the "over n/N" count -- the app never proved a verdict
// on that rep, so the number is not comparable to a rep that finished.
{
  const rows = [
    { first: 100, unique: 10, sum: 110, verdict: 'unique' },
    { first: 200, unique: 20, sum: 220, verdict: 'unique' },
    { first: 300, unique: 30, sum: 330, verdict: 'unique' },
    { first: 6800, unique: null, sum: null, verdict: 'timeout' }
  ]
  const line = medianLine(rows)
  assert.strictEqual(line, '  MEDIAN first 200ms  unique 20ms  sum 220ms  over 3/4 reps')
}

// ---- after the app's own logical pass: the verdict carries a parenthetical ----
// With --after-logical the driver runs the app's logical solver first, so the
// board holds values and marks when the timed search starts and the app says
// so inside the verdict sentence. The readout is otherwise the cold one: two
// "took"s and a unique verdict.
{
  const text = '\u2728 Solved\ntook 1.2s\n This is a unique solution (based on already entered values and pencil marks.)\ntook 0.4s'
  const r = parseReadout(text)
  assert.strictEqual(r.first, 1200)
  assert.strictEqual(r.unique, 400)
  assert.strictEqual(r.sum, 1600)
  assert.strictEqual(r.verdict, 'unique')
}

// ---- the marks rule and its one exception ----
// A run with marks present is never a timing, so the phrase is an error --
// except in the two modes that put the marks there on purpose: --ring-clues
// (an edge-clue puzzle stores its clues as ring values) and --after-logical
// (marks the app's own logical solver made in this same run).
{
  const marks = ' This is a unique solution (based on already entered values and pencil marks.)'
  assert.strictEqual(marksRejected(marks, false), true)
  assert.strictEqual(marksRejected(marks, true), false)
  assert.strictEqual(marksRejected('This is a unique solution. took 0.4s', false), false)
}

console.log('app-solve-lib.test.mjs: all seams pass')

// ---- app version from the footer ----
assert.strictEqual(parseVersion('SudokuMaker v2026.08.14-d47fc4b  Solved took 1s'), 'v2026.08.14-d47fc4b')
assert.strictEqual(parseVersion('no footer here'), null)

// ---- entered-value count reads cell digits, not every colored SVG text ----
// A cell's digit (given or entered) is an <svg text> whose immediate parent
// <g> sits at a cell center: `translate(<25+50*col> <25+50*row>) scale(25)`
// (see app-strip.mjs's cellFill). A constraint's own decoration -- e.g. Hit
// Counts' ring total, a white "00" -- renders at some other transform, so it
// must not count as an entered value even though its fill is not black.
// Fixture: 35 black given digits at cell transforms, plus one white "00"
// decoration at a fractional transform, matching the real Hit Counts board
// from #231.
{
  const givenOnly = [
    ...Array.from({ length: 35 }, (_, i) => ({ fill: '#000', transform: `translate(${25 + 50 * (i % 9)} ${25 + 50 * Math.floor(i / 9)}) scale(25)` })),
    { fill: 'rgb(255, 255, 255)', transform: 'translate(1.045 1.036) scale(0.02)' }
  ]
  assert.strictEqual(countEnteredValues(givenOnly), 0)
}

// ---- a real entered value at a cell transform is still counted ----
// A ring-clue puzzle's entered digits render blue, at the same cell-center
// transform as a given -- this must still count so the guard still refuses
// a link that carries a real played value.
{
  const withEntered = [
    { fill: '#000', transform: 'translate(25 25) scale(25)' },
    { fill: 'rgb(82, 116, 234)', transform: 'translate(75 25) scale(25)' }
  ]
  assert.strictEqual(countEnteredValues(withEntered), 1)
}
