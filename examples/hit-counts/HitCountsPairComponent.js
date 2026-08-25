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

//! Two Hit Counts clues on opposite ends of one line couple as A + B <= n (n even)
//! or n + 1 (n odd): a left hit (value = distance from the left) and a right hit
//! (value = distance from the right) share a cell only at the exact center. When
//! A + B hits that cap, every cell is a hit, so cell j (0-based) is pinned to
//! {j+1, n-j}.

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
  const cap = n + (n % 2 === 1 ? 1 : 0)
  const ca = Array.from(puzzle.getCandidates(clueA))
  const cb = Array.from(puzzle.getCandidates(clueB))
  const minA = Math.min(...ca)
  const minB = Math.min(...cb)

  // Cap each clue by the other's smallest remaining value.
  const rmA = ca.filter(d => d > cap - minB)
  const rmB = cb.filter(d => d > cap - minA)
  if (rmA.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmA), clueA)
  if (rmB.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmB), clueB)

  // minA + minB === cap forces A = minA, B = minB and A + B = cap: every cell is
  // a hit. Cell j (0-based) is a left hit (j+1) or a right hit (n-j); pin to those.
  if (minA + minB === cap) {
    for (let j = 0; j < n; j++) {
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
