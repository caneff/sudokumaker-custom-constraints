/* eslint-disable no-unused-vars -- setParams/validate are the component API SudokuMaker calls by name, not dead code */
//! The built-in CountDigits' own rule, ported from the bundle body
//! (bundle.claude.js:5092) so the soundness harness beside this file and
//! docs/research/count-digits-gac/bench-count-digits.mjs can run it on the
//! same states as CountDigitsGacComponent. NOT for use in a puzzle -- the app
//! already has this one, and registering it as custom code would only lose its
//! `validateDuringSolve` opt-in.
//!
//! `validate` is the whole of it: the built-in defines no `update`, so every
//! candidate removal the comparison reports for the GAC component is one this
//! rule cannot make at all.

function setParams (instance, digits, counterCell, targetCells) {
  instance.digits = +digits
  instance.counterCell = counterCell
  instance.targetCells = targetCells
}

function validate (instance, puzzle) {
  let definiteCount = 0
  let possibleCount = 0
  const counterCandidates = puzzle.getCandidatesBitMask(instance.counterCell)
  const minCount = 31 - Math.clz32(counterCandidates & -counterCandidates)
  const maxCount = 31 - Math.clz32(counterCandidates)
  for (const targetCellId of instance.targetCells) {
    const candidates = puzzle.getCandidatesBitMask(targetCellId)
    if ((instance.digits & candidates) === candidates) {
      definiteCount++
      if (definiteCount > maxCount) return false
    }
    if (candidates & instance.digits) possibleCount++
  }
  return possibleCount >= minCount
}
