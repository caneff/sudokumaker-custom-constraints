//! Hit Counts. An outside clue k on a line counts the "hits": read inward, a
//! cell is a hit when its digit equals its distance from the clue. So line[i]
//! (0-based) is a hit when line[i] === i + 1, and k is the number of hits. The
//! cells are independent, so k is a plain count of booleans; k can be 0. A line
//! is a permutation, so k is never n - 1: fixing n - 1 cells forces the nth.

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

function hitCount (puzzle, line) {
  let count = 0
  for (let i = 0; i < line.length; i++) {
    if (puzzle.getValue(line[i]) === i + 1) count++
  }
  return count
}

// Read each cell once. A cell "can hit" while its target digit i+1 is still a
// candidate; it is a "forced hit" once it is pinned to that target. So the true
// number of hits is at least the forced count and at most the possible count.
function scan (puzzle, line) {
  let forced = 0            // cells pinned to their target: a hit no matter what
  let possible = 0          // cells whose target is still a candidate
  const free = []           // can-hit cells not yet forced: their line indices
  for (let i = 0; i < line.length; i++) {
    const target = i + 1
    const cands = Array.from(puzzle.getCandidates(line[i]))
    if (!cands.includes(target)) continue          // this cell can never hit
    possible++
    if (cands.length === 1) forced++               // pinned to the target
    else free.push(i)
  }
  return { forced, possible, free }
}

// The naive [forced, possible] counts each cell alone, so it over-counts: it can
// promise more hits than any one permutation of the line delivers. Tighten it
// with a matching. The line is a permutation of 1..n, so a legal state is a
// perfect matching of positions to values, each position taking a value from its
// candidates. A hit is the edge (position i, value i+1). Return the least and
// most hit edges over any such matching — the true hit count lies in that range.
// Return null when no perfect matching exists (a dead state); the caller then
// keeps the naive bound rather than acting on a contradiction.
//
// n <= 9, so a bitmask pass over the used-value set is small and exact. dp[mask]
// holds the [min, max] hits when the first i positions fill exactly the values in
// mask (popcount(mask) === i). Each position adds one value not yet used.
function matchingBounds (puzzle, line) {
  const n = line.length
  const cands = line.map(cell =>
    Array.from(puzzle.getCandidates(cell)).filter(v => v >= 1 && v <= n))
  const SIZE = 1 << n
  let curMin = new Array(SIZE).fill(Infinity)
  let curMax = new Array(SIZE).fill(-Infinity)
  curMin[0] = 0
  curMax[0] = 0
  for (let i = 0; i < n; i++) {
    const nextMin = new Array(SIZE).fill(Infinity)
    const nextMax = new Array(SIZE).fill(-Infinity)
    for (let mask = 0; mask < SIZE; mask++) {
      if (curMax[mask] === -Infinity) continue        // position i-1 never reached this mask
      for (const v of cands[i]) {
        const bit = 1 << (v - 1)
        if (mask & bit) continue                      // value already used
        const nextMask = mask | bit
        const add = v === i + 1 ? 1 : 0               // a hit edge
        nextMin[nextMask] = Math.min(nextMin[nextMask], curMin[mask] + add)
        nextMax[nextMask] = Math.max(nextMax[nextMask], curMax[mask] + add)
      }
    }
    curMin = nextMin
    curMax = nextMax
  }
  const full = SIZE - 1
  if (curMax[full] === -Infinity) return null         // no perfect matching
  return { min: curMin[full], max: curMax[full] }
}

function* update (instance, puzzle) {
  const { clue, line } = instance
  const { forced, possible, free } = scan(puzzle, line)

  // ---- Reverse: the clue is the hit count, so it lies in [min, max] ----
  // The matching bound is at least as tight as [forced, possible]: a forced cell
  // hits in every matching, so min >= forced, and no matching beats possible.
  if (!puzzle.hasValue(clue)) {
    const bound = matchingBounds(puzzle, line) || { min: forced, max: possible }
    const bad = Array.from(puzzle.getCandidates(clue)).filter(d => d < bound.min || d > bound.max)
    if (bad.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad), clue)
  }

  // ---- Forward: the clue's range bounds how many free cells may hit ----
  const cc = Array.from(puzzle.getCandidates(clue))
  const cmin = Math.min(...cc)
  const cmax = Math.max(...cc)

  // No more hits allowed: every free cell must miss, so drop its target.
  if (cmax - forced <= 0) {
    for (const i of free) yield puzzle.removeCandidateFromCell(i + 1, line[i])
  }

  // Every free cell is needed as a hit: pin each to its target.
  if (cmin - forced >= free.length && free.length > 0) {
    for (const i of free) {
      const drop = Array.from(puzzle.getCandidates(line[i])).filter(d => d !== i + 1)
      if (drop.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(drop), line[i])
    }
  }
}

// A line is a permutation, so it can never have exactly n - 1 hits: fix n - 1
// cells on their target and the last value has only its home left, forcing an
// nth hit. So n - 1 is never a legal clue. Drop it once at load; this bites on a
// hidden clue and flows through to the side-sum and pair via the shared cell.
function* initialize (instance, puzzle) {
  const n = instance.line.length
  if (n >= 2 && Array.from(puzzle.getCandidates(instance.clue)).includes(n - 1)) {
    yield puzzle.removeCandidateFromCell(n - 1, instance.clue)
  }
}

function validate (instance, puzzle) {
  const { clue, line } = instance
  if (puzzle.hasValue(clue) && puzzle.getValue(clue) === line.length - 1) return false
  if (!puzzle.getCellsAreFilled([clue, ...line])) return true
  return puzzle.getValue(clue) === hitCount(puzzle, line)
}
