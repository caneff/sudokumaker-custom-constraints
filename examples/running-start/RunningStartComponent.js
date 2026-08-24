function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

function runningStart (puzzle, line) {
  let count = 1
  for (let i = 1; i < line.length; i++) {
    if (puzzle.getValue(line[i]) > puzzle.getValue(line[i - 1])) count++
    else break
  }
  return count
}

// Arc-consistency for a strict "a < b" using live candidates.
function* less (puzzle, a, b) {
  const ca = Array.from(puzzle.getCandidates(a))
  const cb = Array.from(puzzle.getCandidates(b))
  const maxB = Math.max(...cb)
  const minA = Math.min(...ca)
  const rmA = ca.filter(d => d >= maxB)
  const rmB = cb.filter(d => d <= minA)
  if (rmA.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmA), a)
  if (rmB.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmB), b)
}

// Keep only clue candidates within [lb, ub].
function* boundClue (puzzle, clue, lb, ub, lo, hi) {
  if (puzzle.hasValue(clue)) return
  const bad = []
  for (let d = lo; d <= hi; d++) if (d < lb || d > ub) bad.push(d)
  if (bad.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad), clue)
}

function* update (instance, puzzle) {
  const { clue, line } = instance
  const n = line.length
  const lo = helpers.digits.minDigit
  const hi = helpers.digits.maxDigit

  // ---- Reverse: read the filled, strictly increasing leading run ----
  let i = 0
  while (i < n && puzzle.hasValue(line[i]) &&
         (i === 0 || puzzle.getValue(line[i]) > puzzle.getValue(line[i - 1]))) i++

  if (i === n) {
    yield* boundClue(puzzle, clue, n, n, lo, hi)               // whole line increases: exact n
  } else if (puzzle.hasValue(line[i])) {
    yield* boundClue(puzzle, clue, i, i, lo, hi)               // a filled cell drops: exact i
  } else {
    const lb = Math.max(i, 1)                                   // run reaches at least i
    let ub = hi
    if (i >= 1) ub = Math.min(ub, i + (hi - puzzle.getValue(line[i - 1])))
    const c0 = Array.from(puzzle.getCandidates(line[0]))        // clue <= hi - min(line[0]) + 1
    ub = Math.min(ub, hi - Math.min(...c0) + 1)
    yield* boundClue(puzzle, clue, lb, ub, lo, hi)
  }

  // ---- Forward: the clue's minimum forces a guaranteed increasing prefix ----
  const kmin = Math.min(...Array.from(puzzle.getCandidates(clue)))
  for (let j = 1; j < kmin && j < n; j++) yield* less(puzzle, line[j - 1], line[j])

  // ---- Forward: clue pinned -> static chain bounds + the descent ----
  if (puzzle.hasValue(clue)) {
    const k = puzzle.getValue(clue)
    for (let j = 0; j < k && j < n; j++) {
      const floor = lo + j
      const ceil = hi - (k - 1 - j)
      const bad = []
      for (let d = lo; d <= hi; d++) if (d < floor || d > ceil) bad.push(d)
      if (bad.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad), line[j])
    }
    if (k < n) yield* less(puzzle, line[k], line[k - 1])
  }
}

function validate (instance, puzzle) {
  const { clue, line } = instance
  if (!puzzle.getCellsAreFilled([clue, ...line])) return true
  return puzzle.getValue(clue) === runningStart(puzzle, line)
}
