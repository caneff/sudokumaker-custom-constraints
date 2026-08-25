// Cross-constraint deduction for two Hit Counts clues on opposite ends of one
// line. The left clue A counts cells whose value equals their distance from the
// left; the right clue B counts cells whose value equals their distance from the
// right. On the same line (0-based index j, length n) a left hit is value j+1 and
// a right hit is value n-j. Those two are equal only at the exact center (n odd,
// j = (n-1)/2), so the left-hit cells and right-hit cells are disjoint apart from
// that one shared center cell. A counts the first set, B the second, so
//     A + B <= n        (n even)
//     A + B <= n + 1    (n odd, the center can be a hit from both sides).
// This couples the two clues: neither can exceed the cap minus the other's
// smallest remaining value. It fires whenever either clue's candidates shrink.
//
// When A + B is forced to exactly the cap, every cell is a hit (left or right),
// so cell j is pinned to just {j+1, n-j} — a single value at the odd-n center.
// That is a strong per-cell cut driven by the two clues alone, before any
// interior digit is known.

//! Two Hit Counts clues on opposite ends of one line couple as A + B <= cap: a
//! left hit (value = distance from the left) and a right hit (value = distance
//! from the right) share a cell only at the exact center. The cap starts at n
//! (n even) or n + 1 (n odd) and drops as cells lose the power to hit either way.
//! When A + B hits the cap, every cell that can still hit must hit, so cell j
//! (0-based) is pinned to {j+1, n-j}.

function getAffectedCells (clueA, clueB, line) {
  return [clueA, clueB, ...line]
}

function setParams (instance, clueA, clueB, line) {
  instance.clueA = clueA
  instance.clueB = clueB
  instance.line = line
  instance.n = line.length
}

function* update (instance, puzzle) {
  const { clueA, clueB, line, n } = instance
  const ca = Array.from(puzzle.getCandidates(clueA))
  const cb = Array.from(puzzle.getCandidates(clueB))
  const minA = Math.min(...ca)
  const minB = Math.min(...cb)

  // Live per-cell hit ability. Cell j (0-based) can left-hit while j+1 is a
  // candidate and right-hit while n-j is. Those coincide only at the center. As
  // interior cells fill in, a cell that can do neither can never hit again, so the
  // true cap on A + B drops below the static n (+1). Sum each cell's contribution:
  // the center can hit for both clues at once, any other cell at most once.
  const center = n % 2 === 1 ? (n - 1) / 2 : -1
  const canHit = new Array(n)
  let cap = 0
  for (let j = 0; j < n; j++) {
    const cand = Array.from(puzzle.getCandidates(line[j]))
    const canL = cand.includes(j + 1)
    const canR = cand.includes(n - j)
    canHit[j] = canL || canR
    cap += j === center ? (canL ? 2 : 0) : (canHit[j] ? 1 : 0)
  }

  // Cap each clue by the other's smallest remaining value under A + B <= cap.
  const rmA = ca.filter(d => d > cap - minB)
  const rmB = cb.filter(d => d > cap - minA)
  if (rmA.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmA), clueA)
  if (rmB.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmB), clueB)

  // minA + minB === cap forces A = minA, B = minB and A + B = cap: every cell that
  // can still hit must hit. Restrict each such cell to its hit value(s) {j+1, n-j}.
  // A cell that can hit neither is a forced miss; leave it alone (do not empty it).
  if (minA + minB === cap) {
    for (let j = 0; j < n; j++) {
      if (!canHit[j]) continue
      const keep = new Set([j + 1, n - j])
      const drop = Array.from(puzzle.getCandidates(line[j])).filter(d => !keep.has(d))
      if (drop.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(drop), line[j])
    }
  }
}

// Run once at creation: two given opposite clues can pin the whole line at load.
function* initialize (instance, puzzle) {
  yield* update(instance, puzzle)
}
