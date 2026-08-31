/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Skyscrapers, one 1 per side. A clue of 1 says the building next to it hides
//! every other building on its line, which happens exactly when that building
//! is the tallest one there. Take the n lines that leave one side of a frame:
//! their first cells are the NEAREST RANK, a house of its own, so the tallest
//! building of the whole side stands on exactly one of them. So exactly one of
//! the side's n clues is a 1 -- the rule this component states over the clue
//! cells, coupling clues no single line ever sees together.
//!
//! The proof needs both halves, and `update` asks the app for both at solve
//! time: every line of the side must be a full house of {1..n}, so the tallest
//! digit a line can hold is n and a clue of 1 means its first cell holds n;
//! and the nearest rank must be a full house of {1..n} too, so exactly one
//! first cell holds n. Take either half away and the count is
//! wrong: on lines that may repeat, two sides can both start with their own
//! tallest building. The rank is the lines' own first cells, so the caller
//! hands over the lines and the component reads the rank off them.
//!
//! There is no tie flag here. A full house holds each digit once, so no two
//! buildings on a line are ever the same height.

// The gate reads every line cell, so a digit leaving a line has to wake this
// component -- otherwise the gate opens and nothing asks again.
function getAffectedCells (clues, lines) {
  return [...clues, ...lines.flat()]
}

function setParams (instance, clues, lines) {
  instance.clues = clues
  instance.lines = lines
  instance.rank = lines.map(line => line[0])
}

//! A full house of {1..cells.length}: the cells never repeat a digit and their
//! live candidates union to exactly the digits 1..n, so no cell can hold a 0.
//! Query the cells alone -- a clue cell in the list flips the repeats answer.
function fullHouseOfOneToN (puzzle, cells) {
  if (puzzle.getCellsCanHaveRepeats(cells)) return false
  let mask = 0
  for (const cell of cells) mask |= puzzle.getCandidatesBitMask(cell)
  return mask === (1 << (cells.length + 1)) - 2 // bits 1..n set, bit 0 clear
}

//! The gate: every line of the side, and the nearest rank they start on, must
//! be a full house of {1..n}. Until all of them are, the component removes
//! nothing.
// Asked at solve time, because main code runs before the built-in row and
// column houses are registered (gotcha 6) and a board that starts its digits at
// 0 keeps a 0 on a line until something else takes it away. A house never
// repeats again and a shrinking union never regains a digit, so the answer is
// cached once it turns true -- and only then, or a line still carrying a 0
// would lock the gate shut for good.
function gateOpen (instance, puzzle) {
  if (instance.gateOpen) return true
  const { clues, lines, rank } = instance
  const n = clues.length
  if (lines.length !== n || !lines.every(line => line.length === n)) return false
  if (!lines.every(line => fullHouseOfOneToN(puzzle, line))) return false
  if (!fullHouseOfOneToN(puzzle, rank)) return false
  instance.gateOpen = true
  return true
}

function * update (instance, puzzle) {
  if (!gateOpen(instance, puzzle)) return
  const clues = instance.clues
  const isOne = cell => puzzle.hasValue(cell) && puzzle.getValue(cell) === 1
  const pinned = clues.filter(isOne).length
  const canBeOne = clues.filter(cell => puzzle.getCandidates(cell).has(1))
  if (pinned === 1) {
    // The side's 1 is placed: no other clue may be one.
    for (const cell of canBeOne) if (!isOne(cell)) yield puzzle.removeCandidateFromCell(1, cell)
  } else if (canBeOne.length === 1) {
    // Only one clue can still be the 1, so it is.
    const cell = canBeOne[0]
    const rest = Array.from(puzzle.getCandidates(cell)).filter(d => d !== 1)
    if (rest.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rest), cell)
  }
}

function validate (instance, puzzle) {
  const clues = instance.clues
  if (!puzzle.getCellsAreFilled(clues)) return true
  if (!gateOpen(instance, puzzle)) return true
  return clues.filter(cell => puzzle.getValue(cell) === 1).length === 1
}
