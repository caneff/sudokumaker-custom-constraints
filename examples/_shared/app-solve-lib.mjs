// Readout parsing and print formats for app-solve.mjs, split out so they run
// under node:assert without a browser. See docs/real-app-timing.md.

// The app prints "✨ Solved took 3.7s" for the first solution, then "This is
// a unique solution. took 0.4s" once the uniqueness search finishes.
// "Found 10,000 solutions" is the app's cap: many solutions, search ended.
// "Stopped solving/counting (time limit ...)" is the app's own timeout: no
// verdict, though a "took" the app printed before stopping still names the
// first-solve time.
// The driver's command line:
// `<link_file> [reps] [icon_name] [--ring-clues] [--after-logical]`.
//
// --ring-clues allows entered values, for edge-clue puzzles whose clues are
// stored as non-given values in the outer ring; without it a link that is not
// stripped to its givens is refused (see checkStripped in app-solve.mjs).
// --after-logical runs the app's logical solver to its fixpoint before the
// timed search, so the row measures the search a player still faces. Both
// flags may sit anywhere on the line, so they are removed before the
// positionals are read off. Split out here because it is the one branchy part
// of app-solve.mjs a browser is not needed to exercise (#315).
export function parseArgs (argv) {
  const flags = ['--ring-clues', '--after-logical']
  const args = argv.filter(a => !flags.includes(a))
  const linkFile = args[0]
  if (!linkFile) {
    throw new Error('usage: app-solve.mjs <link_file> [reps] [icon_name] [--ring-clues] [--after-logical]')
  }
  return {
    linkFile,
    // 7 reps: the solve time swings more than 10x run to run, so the default
    // has to be wide enough for a median to mean something.
    reps: parseInt(args[1] || '7', 10),
    // ShowCandidates is "Find all solutions and valid candidates" -- the full
    // search that proves uniqueness, and the only one worth timing by default.
    iconName: args[2] || 'ShowCandidates',
    ringClues: argv.includes('--ring-clues'),
    afterLogical: argv.includes('--after-logical')
  }
}

export function readVerdict (text) {
  if (/stopped (solving|counting)/i.test(text)) return 'timeout'
  if (/unique solution/i.test(text)) return 'unique'
  if (/multiple solutions|not unique|no solution|found [\d,]+ solutions/i.test(text)) return 'not-unique'
  return '?'
}

// Split the two "took" readouts into first-solve time and uniqueness-search
// time, plus their sum. No verdict means the uniqueness search never
// finished, so a partial "took" is not a time for unique/sum -- both report
// null. A timeout still names the first-solve time when the app printed it,
// so a [timeout] row does not hide whether the app found a first solution.
export function parseReadout (text) {
  const verdict = readVerdict(text)
  if (verdict === '?') return { first: null, unique: null, sum: null, verdict }
  const ms = [...text.matchAll(/took\s+([\d.]+)\s*(ms|s)\b/gi)]
    .map(m => (m[2].toLowerCase() === 's' ? parseFloat(m[1]) * 1000 : parseFloat(m[1])))
  const first = ms.length > 0 ? Math.round(ms[0]) : null
  if (verdict === 'timeout') return { first, unique: null, sum: null, verdict }
  const unique = ms.length > 1 ? Math.round(ms[1]) : null
  const sum = ms.length ? Math.round(ms.reduce((a, b) => a + b, 0)) : null
  return { first, unique, sum, verdict }
}

export const median = xs => {
  const s = xs.filter(x => x != null).sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : null
}

export function repLine (r) {
  if (r.verdict === 'timeout') {
    return r.first != null
      ? `  first ${r.first}ms, no verdict  [timeout]`
      : '  no first solve, no verdict  [timeout]'
  }
  return `  first ${r.first}ms  unique ${r.unique}ms  sum ${r.sum}ms  [${r.verdict}]`
}

// Medians of first, unique, and sum over the reps that returned a verdict
// ('unique' or 'not-unique'). A timeout rep now carries a real first-solve
// time (see parseReadout), so it is excluded by verdict here, not by a null
// check -- the app never proved that rep's uniqueness, so its numbers are
// not comparable to a rep that finished.
export function medianLine (rows) {
  const verdicts = rows.filter(r => r.verdict === 'unique' || r.verdict === 'not-unique')
  const n = verdicts.length
  const first = median(verdicts.map(r => r.first))
  const unique = median(verdicts.map(r => r.unique))
  const sum = median(verdicts.map(r => r.sum))
  return `  MEDIAN first ${first}ms  unique ${unique}ms  sum ${sum}ms  over ${n}/${rows.length} reps`
}

// The JSON line's aggregate for time_example.py: the median sum over reps
// with a verdict (medianLine's number, unlabeled), plus how many reps ran and
// how many hit the driver's fixed 300s per-rep wait -- a rep whose sum is
// null, whether the app printed its own "stopped solving" ([timeout]) or
// never showed a recognized verdict at all (?). Counting by null sum, not by
// verdict, keeps this in lockstep with median: every rep behind a null
// median is one of these, so repsTimedOut always equals repsRun there.
export function solveSummary (rows) {
  return {
    median: median(rows.map(r => r.sum)),
    repsRun: rows.length,
    repsTimedOut: rows.filter(r => r.sum === null).length
  }
}

// The app footer prints its own version, e.g. "v2026.08.14-d47fc4b". The
// timing driver (time_example.py) puts it in every printed row so a stale
// number is traceable to the app build that produced it.
export function parseVersion (text) {
  const m = text.match(/\bv\d{4}\.\d{2}\.\d{2}-[0-9a-f]+\b/)
  return m ? m[0] : null
}

// The app appends "(based on already entered values and pencil marks.)" to
// its verdict when it solved from a board that already held values or marks.
// That times a verification of a part-filled grid, not a search, so it is not
// a timing. Two modes put those marks there on purpose and pass
// `marksExpected`: --ring-clues, for an edge-clue puzzle whose clues live as
// ring values, and --after-logical, for marks the app's own logical solver
// made earlier in the same driver run.
export function marksRejected (text, marksExpected) {
  return /based on already entered values/i.test(text) && !marksExpected
}

// A cell's own digit -- given or entered -- renders as an <svg text> whose
// closest ancestor <g> carrying a `transform` sits at that cell's center:
// `translate(<25+50*col> <25+50*row>) scale(25)`, col and row non-negative
// integers (see app-strip.mjs's cellFill; some boards wrap the text in an
// untransformed styling <g> first, so this must walk up to the nearest
// transformed one, not just the direct parent). A constraint's own
// decoration -- e.g. Hit Counts' white ring total -- can also draw a
// non-black <svg text>, but never at this exact transform.
const CELL_TRANSFORM = /^translate\(\d+ \d+\) scale\(25\)$/
const isBlack = fill => /^(#000|black|rgb\(0, 0, 0\))$/i.test(fill)

// Count entered (non-given) cell values. `cells` is [{ fill, transform }],
// one per <svg text> found on the page: `fill` is that text's own fill, and
// `transform` is the `transform` attribute of its closest ancestor <g> that
// has one (or null/undefined when there is no such ancestor).
export function countEnteredValues (cells) {
  return cells.filter(c => CELL_TRANSFORM.test(c.transform || '') && !isBlack(c.fill)).length
}
