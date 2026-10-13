// Focused tests of the readout parser and print-line formats used by
// app-solve.mjs, independent of a real browser run. Run: node
// examples/_shared/app-solve-lib.test.mjs

import assert from 'assert'
import { execFileSync, spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { VERDICT_PATTERN, parseArgs, parseReadout, parseVersion, repLine, medianLine, marksRejected, countEnteredValues, solveSummary, busyThreshold, readLoad, busyMessage, isBusy, timeReps, loadSummary } from './app-solve-lib.mjs'

// first "took" only, no verdict yet: all three times report null
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

// both "took"s plus a unique verdict
{
  const text = '✨ Solved took 2.3s\nThis is a unique solution. took 0.4s'
  const r = parseReadout(text)
  assert.strictEqual(r.first, 2300)
  assert.strictEqual(r.unique, 400)
  assert.strictEqual(r.sum, 2700)
  assert.strictEqual(r.verdict, 'unique')
}

// no verdict within the cap: both "took"s absent, times report null
{
  const text = 'still solving...'
  const r = parseReadout(text)
  assert.strictEqual(r.first, null)
  assert.strictEqual(r.unique, null)
  assert.strictEqual(r.sum, null)
  assert.strictEqual(r.verdict, '?')
}

// a timeout after a first solve: first reports its time, unique and sum stay null
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

// a not-unique verdict still reports both times
{
  const text = '✨ Solved took 100ms\nThis puzzle has multiple solutions. took 50ms'
  const r = parseReadout(text)
  assert.strictEqual(r.first, 100)
  assert.strictEqual(r.unique, 50)
  assert.strictEqual(r.sum, 150)
  assert.strictEqual(r.verdict, 'not-unique')
}

// rep line prints first, unique, sum, and verdict
{
  const line = repLine({ first: 2300, unique: 400, sum: 2700, verdict: 'unique' })
  assert.strictEqual(line, '  first 2300ms  unique 400ms  sum 2700ms  [unique]')
}

// rep line for a rep with no verdict: no time is printed as "null"
{
  const line = repLine({ first: null, unique: null, sum: null, verdict: '?' })
  assert.strictEqual(line, '  first n/a  unique n/a  sum n/a  [?]')
}

// rep line for a timeout with a first-solve time names the time, not three nulls
{
  const line = repLine({ first: 6800, unique: null, sum: null, verdict: 'timeout' })
  assert.strictEqual(line, '  first 6800ms, no verdict  [timeout]')
}

// rep line for a timeout with no first-solve time either
{
  const line = repLine({ first: null, unique: null, sum: null, verdict: 'timeout' })
  assert.strictEqual(line, '  no first solve, no verdict  [timeout]')
}

// median line reports the median of each of the three numbers, over reps with a verdict
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

// median line with no rep that finished: no time is printed as "null"
{
  const line = medianLine([{ first: 6800, unique: null, sum: null, verdict: 'timeout' }])
  assert.strictEqual(line, '  MEDIAN first n/a  unique n/a  sum n/a  over 0/1 reps')
}

// median line excludes a timeout row even though it carries a first time
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

// after the app's own logical pass: the verdict carries a parenthetical
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

// the marks rule and its one exception
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

// solveSummary: every rep times out, median null, both counts named
// The JSON line's aggregate carries the rep counts alongside the median, so
// the driver can name the timeout rather than reading a bare null.
{
  const rows = [
    { first: 6800, unique: null, sum: null, verdict: 'timeout' },
    { first: 7100, unique: null, sum: null, verdict: 'timeout' },
    { first: 6950, unique: null, sum: null, verdict: 'timeout' }
  ]
  const s = solveSummary(rows)
  assert.strictEqual(s.median, null)
  assert.strictEqual(s.repsRun, 3)
  assert.strictEqual(s.repsTimedOut, 3)
}

// solveSummary: a rep with no verdict at all ('?', the driver's own
// 300s wait ran out with no recognized text -- not even the app's own
// "stopped solving" message) counts toward repsTimedOut too, same as an
// explicit [timeout] verdict. Both leave sum null, and both are reps that
// never produced a comparable time within the fixed per-rep wait -- a rep
// counted in the null median must be reflected in the count, or the
// timeout message can claim "all N reps timed out (M < N timed out)".
{
  const rows = [
    { first: null, unique: null, sum: null, verdict: '?' },
    { first: 6800, unique: null, sum: null, verdict: 'timeout' },
    { first: null, unique: null, sum: null, verdict: '?' }
  ]
  const s = solveSummary(rows)
  assert.strictEqual(s.median, null)
  assert.strictEqual(s.repsRun, 3)
  assert.strictEqual(s.repsTimedOut, 3)
}

// solveSummary: mixed outcome keeps median-over-finishers, still names
// the timeout count for the reps that did not
{
  const rows = [
    { first: 100, unique: 10, sum: 110, verdict: 'unique' },
    { first: 200, unique: 20, sum: 220, verdict: 'unique' },
    { first: 6800, unique: null, sum: null, verdict: 'timeout' }
  ]
  const s = solveSummary(rows)
  assert.strictEqual(s.median, 220)
  assert.strictEqual(s.repsRun, 3)
  assert.strictEqual(s.repsTimedOut, 1)
}

// app version from the footer
assert.strictEqual(parseVersion('SudokuMaker v2026.08.14-d47fc4b  Solved took 1s'), 'v2026.08.14-d47fc4b')
assert.strictEqual(parseVersion('no footer here'), null)

// entered-value count reads cell digits, not every colored SVG text
// A cell's digit (given or entered) is an <svg text> whose closest
// transformed ancestor <g> sits at a cell center: `translate(<25+50*col>
// <25+50*row>) scale(25)` (see app-strip.mjs's cellFill). A constraint's own
// decoration -- e.g. Hit Counts' ring total, a white "00" -- renders at some
// other transform, so it must not count as an entered value even though its
// fill is not black. Fixture: 35 black given digits at cell transforms, plus
// one white "00" decoration at a fractional transform, matching the real Hit
// Counts board.
{
  const givenOnly = [
    ...Array.from({ length: 35 }, (_, i) => ({ fill: '#000', transform: `translate(${25 + 50 * (i % 9)} ${25 + 50 * Math.floor(i / 9)}) scale(25)` })),
    { fill: 'rgb(255, 255, 255)', transform: 'translate(1.045 1.036) scale(0.02)' }
  ]
  assert.strictEqual(countEnteredValues(givenOnly), 0)
}

// a real entered value at a cell transform is still counted
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

// parseArgs: the driver's command line
{
  // link file alone: 7 reps and the uniqueness-proving icon by default, both
  // flags off
  assert.deepStrictEqual(parseArgs(['link.txt']), {
    linkFile: 'link.txt',
    reps: 7,
    iconName: 'ShowCandidates',
    ringClues: false,
    afterLogical: false,
    refuseBusy: false
  })

  // all three positionals given
  assert.deepStrictEqual(parseArgs(['link.txt', '3', 'CheckSolution']), {
    linkFile: 'link.txt',
    reps: 3,
    iconName: 'CheckSolution',
    ringClues: false,
    afterLogical: false,
    refuseBusy: false
  })

  // a flag never becomes a positional, wherever it sits -- this is the one
  // that matters: `app-solve.mjs link.txt --ring-clues 3` must time 3 reps of
  // link.txt, not 7 reps with '--ring-clues' read as the rep count
  assert.deepStrictEqual(parseArgs(['link.txt', '--ring-clues', '3']), {
    linkFile: 'link.txt',
    reps: 3,
    iconName: 'ShowCandidates',
    ringClues: true,
    afterLogical: false,
    refuseBusy: false
  })
  assert.deepStrictEqual(parseArgs(['--after-logical', 'link.txt', '3']), {
    linkFile: 'link.txt',
    reps: 3,
    iconName: 'ShowCandidates',
    ringClues: false,
    afterLogical: true,
    refuseBusy: false
  })

  // both flags together, the shape time_example.py's driver call uses
  const both = parseArgs(['link.txt', '5', '--ring-clues', '--after-logical'])
  assert.strictEqual(both.ringClues, true)
  assert.strictEqual(both.afterLogical, true)
  assert.strictEqual(both.reps, 5)

  // no link file is a usage error, flags alone included
  assert.throws(() => parseArgs([]), /usage: app-solve.mjs/)
  assert.throws(() => parseArgs(['--ring-clues']), /usage: app-solve.mjs/)

  // an unknown flag is refused, not read as a positional or ignored: a typo
  // like --after-logic would otherwise run the cold row and print it as asked
  assert.throws(() => parseArgs(['link.txt', '--after-logic']), /usage: app-solve.mjs/)
  assert.throws(() => parseArgs(['link.txt', '3', '--bogus']), /usage: app-solve.mjs/)
}

// VERDICT_PATTERN: the one readout the drivers wait for
// app-solve.mjs and app-strip.mjs both wait in the page for a verdict. Every
// readout readVerdict classifies must end that wait, and nothing else may: a
// wait that ends on a first-solve "took" times half the run.
{
  const readouts = {
    unique: 'This is a unique solution. took 0.4s',
    'not-unique': 'Found 10,000 solutions',
    timeout: 'Stopped solving (time limit reached)'
  }
  for (const [want, text] of Object.entries(readouts)) {
    assert.ok(VERDICT_PATTERN.test(text), `the wait must end on a ${want} readout`)
    assert.strictEqual(parseReadout(text).verdict, want)
  }
  assert.ok(!VERDICT_PATTERN.test('\u2728 Solved took 3.7s'), 'a first solve is no verdict')
  // the source travels into the page as a string and is rebuilt there
  assert.ok(new RegExp(VERDICT_PATTERN.source, VERDICT_PATTERN.flags).test('multiple solutions'))
}

// The pattern is written once. A probe that waits for a verdict imports
// VERDICT_PATTERN (or calls solveInApp); one that spells the alternation out
// again drifts the next time the app words a verdict differently. Any tracked
// script that spells the not-unique or timeout verdict phrases is named here.
{
  const files = execFileSync('git', ['grep', '-lEi', 'multiple solutions|stopped \\(solving', '--', '*.mjs', '*.js', '*.py'],
    { cwd: fileURLToPath(new URL('../..', import.meta.url)), encoding: 'utf8' }).split('\n').filter(Boolean).sort()
  assert.deepStrictEqual(files, ['examples/_shared/app-solve-lib.mjs', 'examples/_shared/app-solve-lib.test.mjs'])
}

// An unknown flag stops app-solve.mjs itself, not only parseArgs: the CLI
// exits non-zero with the usage line before any browser opens.
{
  const run = spawnSync('node', [fileURLToPath(new URL('./app-solve.mjs', import.meta.url)), 'link.txt', '--after-logic'], { encoding: 'utf8' })
  assert.notStrictEqual(run.status, 0)
  assert.match(run.stderr, /usage: app-solve.mjs/)
  assert.match(run.stderr, /after-logic/, 'the message names the flag that was refused')
}

// --refuse-busy is a known flag, anywhere on the line.
assert.strictEqual(parseArgs(['--refuse-busy', 'link.txt']).refuseBusy, true)
assert.strictEqual(parseArgs(['link.txt']).refuseBusy, false)

// Machine load (#387): the busy threshold is half the core count, a load
// reader is stubbable, and a busy box names itself in a warning.
assert.strictEqual(busyThreshold(32), 16)
assert.strictEqual(readLoad({ APP_SOLVE_LOADAVG: '27.7' }), 27.7)
assert.strictEqual(typeof readLoad({}), 'number', 'the real reader answers when no stub is set')
// A stub that is not a number is refused by name, never read as a quiet box.
assert.throws(() => readLoad({ APP_SOLVE_LOADAVG: 'abc' }), /APP_SOLVE_LOADAVG must be a number, got 'abc'/)

// The #384 reading: 27.7 on 32 cores, under 1 per core, is already busy.
const warn = busyMessage(27.7, 'before rep 1', 32)
assert.match(warn, /27\.70/)
assert.match(warn, /before rep 1/)
assert.match(warn, /16/, 'names the threshold')
assert.match(warn, /--refuse-busy/)
// At the threshold is quiet: only a load above it warns.
assert.strictEqual(busyMessage(16, 'before rep 1', 32), null)
assert.strictEqual(isBusy(16.01, 32), true)

// timeReps reads the load before and after every rep, in order, and puts
// both on the rep's row. A noteLoad that throws (the refusal) stops the run
// before the next rep starts.
{
  const seen = []
  const noteLoad = when => { seen.push(when); return seen.length }
  const rows = await timeReps(2, noteLoad, async k => ({ sum: 100 + k }))
  assert.deepStrictEqual(seen, ['before rep 1', 'after rep 1', 'before rep 2', 'after rep 2'])
  assert.deepStrictEqual(rows.map(r => [r.sum, r.loadBefore, r.loadAfter]), [[100, 1, 2], [101, 3, 4]])

  const ran = []
  const refuse = when => { if (when === 'before rep 2') throw new Error('refused') }
  await assert.rejects(timeReps(3, refuse, async k => { ran.push(k); return {} }), /refused/)
  assert.deepStrictEqual(ran, [0], 'rep 2 never started')
}

// The JSON line's load fields: every rep's before and after, the threshold,
// and busy when any reading in the run (not only a rep's) was above it.
{
  const rows = [{ loadBefore: 1, loadAfter: 2 }, { loadBefore: 3, loadAfter: 4 }]
  const quiet = loadSummary(rows, [{ when: 'x', load: 1 }, { when: 'y', load: 16 }], 32)
  assert.deepStrictEqual(quiet, {
    cpus: 32,
    loadThreshold: 16,
    loads: [{ before: 1, after: 2 }, { before: 3, after: 4 }],
    busy: false
  })
  assert.strictEqual(loadSummary(rows, [{ when: 'before the run', load: 17 }], 32).busy, true)
}

// A rep row carries its load before and after; a row with no load
// reading prints no load suffix.
assert.strictEqual(
  repLine({ first: 2300, unique: 400, sum: 2700, verdict: 'unique', loadBefore: 1.25, loadAfter: 3.5 }),
  '  first 2300ms  unique 400ms  sum 2700ms  [unique]  load 1.25->3.50'
)
assert.strictEqual(
  repLine({ first: 6800, unique: null, sum: null, verdict: 'timeout', loadBefore: 0, loadAfter: 0.1 }),
  '  first 6800ms, no verdict  [timeout]  load 0.00->0.10'
)

// The driver, on a stubbed load above the threshold: --refuse-busy exits
// non-zero before any browser opens; without it the warning is printed.
{
  const driver = fileURLToPath(new URL('./app-solve.mjs', import.meta.url))
  const env = { ...process.env, APP_SOLVE_LOADAVG: '9999' }
  const refused = spawnSync('node', [driver, 'link.txt', '1', '--refuse-busy'], { encoding: 'utf8', env })
  // Exit 2 is the refusal itself: any other non-zero exit is the driver
  // failing later, on the missing link file.
  assert.strictEqual(refused.status, 2)
  assert.doesNotMatch(refused.stderr, /ENOENT/)
  assert.match(refused.stderr, /busy/i)
  assert.match(refused.stderr, /9999/)
  // No flag: warns, then goes on (here to fail on the missing link file).
  const warned = spawnSync('node', [driver, 'no-such-link.txt', '1'], { encoding: 'utf8', env })
  // It carried on past the warning: the failure is the missing link file.
  assert.notStrictEqual(warned.status, 2)
  assert.match(warned.stderr, /ENOENT/)
  assert.match(warned.stderr, /WARNING.*busy/is)
  assert.match(warned.stderr, /9999/)
}

console.log('app-solve-lib.test.mjs: all seams pass')
