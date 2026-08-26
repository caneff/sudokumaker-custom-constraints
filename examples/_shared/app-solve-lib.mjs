// Readout parsing and print formats for app-solve.mjs, split out so they run
// under node:assert without a browser. See docs/real-app-timing.md.

// The app prints "✨ Solved took 3.7s" for the first solution, then "This is
// a unique solution. took 0.4s" once the uniqueness search finishes.
export function readVerdict (text) {
  if (/unique solution/i.test(text)) return 'unique'
  if (/multiple solutions|not unique|no solution/i.test(text)) return 'not-unique'
  return '?'
}

// Split the two "took" readouts into first-solve time and uniqueness-search
// time, plus their sum. No verdict means the search never finished, so a
// partial "took" is not a time -- all three report null.
export function parseReadout (text) {
  const verdict = readVerdict(text)
  if (verdict === '?') return { first: null, unique: null, sum: null, verdict }
  const ms = [...text.matchAll(/took\s+([\d.]+)\s*(ms|s)\b/gi)]
    .map(m => (m[2].toLowerCase() === 's' ? parseFloat(m[1]) * 1000 : parseFloat(m[1])))
  const first = ms.length > 0 ? Math.round(ms[0]) : null
  const unique = ms.length > 1 ? Math.round(ms[1]) : null
  const sum = ms.length ? Math.round(ms.reduce((a, b) => a + b, 0)) : null
  return { first, unique, sum, verdict }
}

export const median = xs => {
  const s = xs.filter(x => x != null).sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : null
}

export function repLine (r) {
  return `  first ${r.first}ms  unique ${r.unique}ms  sum ${r.sum}ms  [${r.verdict}]`
}

// Medians of first, unique, and sum over the reps that returned a verdict.
// A rep with no verdict already carries null first/unique/sum, so `median`
// (which drops nulls) excludes it automatically.
export function medianLine (rows) {
  const n = rows.filter(r => r.verdict !== '?').length
  const first = median(rows.map(r => r.first))
  const unique = median(rows.map(r => r.unique))
  const sum = median(rows.map(r => r.sum))
  return `  MEDIAN first ${first}ms  unique ${unique}ms  sum ${sum}ms  over ${n}/${rows.length} reps`
}

// The app footer prints its own version, e.g. "v2026.08.14-d47fc4b". The
// timing driver (time_example.py) puts it in every printed row so a stale
// number is traceable to the app build that produced it.
export function parseVersion (text) {
  const m = text.match(/\bv\d{4}\.\d{2}\.\d{2}-[0-9a-f]+\b/)
  return m ? m[0] : null
}
