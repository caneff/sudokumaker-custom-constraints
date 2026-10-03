/* eslint-disable no-unused-vars -- setParams/update/getAffectedCells/validate are the component API SudokuMaker calls by name, not dead code */
//! A pruning replacement for the built-in CountDigits. Same constructor as the
//! built-in:
//!
//!   puzzle.addConstraintComponent(new CountDigitsGacComponent(name, digits, counterCell, targetCells))
//!
//! The rule, the built-in's own: the digit in `counterCell` equals the number
//! of `targetCells` whose digit is one of `digits`. `digits` is a digit MASK
//! (bit d is digit d; {1,3} is 0b1010 = 10) or a SudokuDigitSet, exactly as the built-in takes it
//! (bundle.claude.js:5092 does `this.digits & candidates`).
//!
//! What the built-in does instead: nothing. It defines no `update`, so it
//! prunes no candidate ever (docs/research/bundle-api-reference.md,
//! "CountDigits"). Its `validate` runs on every state (`validateDuringSolve`)
//! and refuses the ones below, so the search learns the rule only by trying a
//! digit and being told no.
//!
//! Call a target cell a HIT when its digit is in the set. Reading candidates:
//!   - every candidate in the set  -> a definite hit;
//!   - no candidate in the set     -> a definite miss;
//!   - some of each                -> open, either way.
//! So the count is at least `definite` and at most `possible` = definite +
//! open, and every value in between is reachable by flipping open cells one at
//! a time -- the reachable counts are the whole interval.
//!
//! When the counter is also one of its targets its digit is on both sides of
//! the equation. Read the OTHER targets for `definite`/`possible`, and let
//! each counter value v pay for its own contribution: v adds `selfHits` (the
//! number of times the counter appears among its targets) to the count when v
//! is in the set, so v is supportable exactly when
//! definite <= v - selfHits*[v in set] <= possible. With the counter outside
//! its targets `selfHits` is 0 and this is the plain interval. One code path
//! covers both, so the two cases cannot drift apart.
//!
//! Three deductions follow, and they are the whole of arc consistency for this
//! constraint:
//!   1. The counter keeps only its supportable values. Anything else is
//!      unreachable however the open cells fall.
//!   2. If the largest supportable value needs exactly `definite` from the
//!      other targets, the count IS definite: no open cell may be a hit, so the
//!      in-set digits leave every open cell.
//!   3. If the smallest supportable value needs exactly `possible`, every open
//!      cell must be a hit, so the out-of-set digits leave every open cell.
//! Nothing else is removable: an open cell asked to be a hit reaches the
//! needs [definite+1, possible], which meets the counter's supportable values
//! unless (2) holds, and asked to be a miss reaches [definite, possible-1],
//! which meets them unless (3) holds. `soundness-harness.mjs` next to this file
//! checks that against a brute-force oracle, counter-in-targets shapes
//! included, rather than taking the argument's word.
//!
//! What still escapes: a NON-counter cell listed twice in `targetCells` moves the
//! count by 2 when it flips, so the interval argument no longer holds for it and
//! the component prunes less than the oracle there (still sound). A counter
//! listed any number of times is exact. Cells are compared with `===`, which
//! assumes primitive cell ids (docs/puzzle-api.md says the id type is not a
//! contract): a non-primitive id would read as no self-listing and fall back to
//! the pre-#578 strength.
//!
//! Sound: each deduction is a statement about the true solution, read off the
//! candidates the true solution is still inside. A target cell listed twice is
//! read once per listing, as the built-in counts it.

//! Counts run 0..targetCells.length and are compared against digit masks, so
//! the target list has to stay inside a 32-bit mask. A longer one is a
//! registration mistake, refused at setup where the author sees it.
const MAX_TARGETS = 30

//! The app calls this to learn which cells this component watches, and
//! re-runs `update` when any of them changes. It receives the constructor's
//! arguments after the name (digits, counterCell, targetCells): the name is
//! the constructor's first argument and is not passed on, so it is not in this
//! signature. The counter is watched as well as the targets because the count
//! moves when either side does.
function getAffectedCells (digits, counterCell, targetCells) {
  return [counterCell, ...targetCells]
}

//! The app calls this once, from the constructor. After `instance` it gets the
//! arguments of `new CountDigitsGacComponent(name, digits, counterCell,
//! targetCells)` except the name, which the app keeps as `instance.name`.
//! `instance` is the component being built: whatever is stored on it here is
//! what `update` and `validate` read later, since they get the instance, not
//! the constructor's arguments.
function setParams (instance, digits, counterCell, targetCells) {
  //! The mask is a plain number, not a list: the solver combines it with a
  //! cell's candidates using bitwise AND (`digits & candidates`), so bit d set
  //! means digit d counts. An array coerces to a number when it holds one
  //! element ([3] -> 3), which would read as the mask {0,1} and quietly count the wrong digits. Refuse it
  //! by name rather than let that through.
  if (Array.isArray(digits)) {
    throw new TypeError(`${instance.name}: CountDigitsGacComponent takes a digit mask or a SudokuDigitSet, not an array`)
  }
  const digitMask = +digits
  if (!Number.isInteger(digitMask) || digitMask <= 0) {
    throw new RangeError(`${instance.name}: CountDigitsGacComponent needs a non-empty digit mask, got ${digits}`)
  }
  if (targetCells.length > MAX_TARGETS) {
    throw new RangeError(`${instance.name}: CountDigitsGacComponent takes at most ${MAX_TARGETS} target cells, got ${targetCells.length}`)
  }
  instance.digitMask = digitMask
  instance.counterCell = counterCell
  instance.targetCells = targetCells
}

//! Read every target except the counter once: how many are certainly hits, and
//! which are open. `open` is a list of positions into `targetCells`, so a
//! caller that has to filter them walks only those. `selfHits` counts how many
//! times the counter appears among its own targets; those are handled per
//! counter value in `supportableMask`, not read as candidates here.
function countHits (instance, puzzle) {
  const targetCells = instance.targetCells
  const digitMask = instance.digitMask
  const masks = []
  const open = []
  let definite = 0
  let selfHits = 0
  for (let position = 0; position < targetCells.length; position++) {
    if (targetCells[position] === instance.counterCell) {
      selfHits++
      masks.push(0)
      continue
    }
    const mask = puzzle.getCandidatesBitMask(targetCells[position])
    masks.push(mask)
    const inSet = mask & digitMask
    //! An empty cell is a dead state the app should never hand us; counting it
    //! as a definite hit would be wrong, so say so instead.
    if (mask === 0) return null
    if (inSet === mask) definite++
    else if (inSet !== 0) open.push(position)
  }
  return { masks, open, definite, possible: definite + open.length, selfHits }
}

//! The counter values the rest of the targets can support, and the smallest and
//! largest amount they would each have to supply (`need = v - selfHits` for an
//! in-set v, `v` otherwise). `need` is what the other targets must count.
function supportableMask (instance, hits, counterMask) {
  let allowed = 0
  let lowNeed = Infinity
  let highNeed = -Infinity
  //! A supportable value never exceeds the target count: need <= possible and
  //! possible + selfHits <= targetCells.length.
  for (let value = 0; value <= instance.targetCells.length; value++) {
    if (!(counterMask & (1 << value))) continue
    const need = value - ((instance.digitMask & (1 << value)) ? hits.selfHits : 0)
    if (need < hits.definite || need > hits.possible) continue
    allowed |= 1 << value
    if (need < lowNeed) lowNeed = need
    if (need > highNeed) highNeed = need
  }
  return { allowed, lowNeed, highNeed }
}

//! The app calls `update` whenever a watched cell changes, and keeps calling it
//! until a pass yields nothing new. It is a generator: each `yield` hands the
//! solver one CHANGE to apply. `puzzle` is the solver's view of the board right
//! now; `getCandidatesBitMask(cell)` reads a cell's remaining candidates as a
//! digit mask. The solver applies each yielded change before resuming here.
function * update (instance, puzzle) {
  const hits = countHits(instance, puzzle)
  if (hits === null) {
    yield puzzle.stop(`${instance.name} has a target cell with no candidates left`, instance.targetCells)
    return
  }
  const { masks, open, definite, possible } = hits

  const counterMask = puzzle.getCandidatesBitMask(instance.counterCell)
  const { allowed, lowNeed, highNeed } = supportableMask(instance, hits, counterMask)
  if (allowed === 0) {
    //! puzzle.stop is a change that says "this board state has no solution":
    //! the message says why and the cell list says which cells are to
    //! blame. It fails only the search node being tried, so the
    //! solver backs up and tries the next candidate elsewhere on the board.
    yield puzzle.stop(`${instance.name} cannot count between ${definite} and ${possible} over its other targets`, getAffectedCells(instance.digitMask, instance.counterCell, instance.targetCells))
    return
  }

  if (allowed !== counterMask) {
    //! puzzle.removeCandidatesFromCell is a change that takes the digits in the
    //! given set out of one cell's candidates. The solver applies it, then runs
    //! every component watching that cell again -- this one included -- so a
    //! removal made here can set off the next deduction.
    yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(counterMask & ~allowed), instance.counterCell)
  }

  //! At most one of these fires: both would mean definite === possible, and
  //! then there is no open cell to filter.
  const forcedOut = highNeed === definite
  const forcedIn = lowNeed === possible
  if (!forcedOut && !forcedIn) return
  for (const position of open) {
    const removed = forcedOut ? masks[position] & instance.digitMask : masks[position] & ~instance.digitMask
    yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(removed), instance.targetCells[position])
  }
}

//! The backstop: the built-in's validate, made exact -- it refuses a state
//! exactly when no counter value is supportable, which is stricter than the
//! built-in's interval-end check and still sound (the built-in never prunes). The app calls it to check a
//! board state against the rule and refuse it (return false) or accept it
//! (true); `update` above only prunes, it does not replace this check. It
//! refuses a state when none of the counter's remaining digits is supportable.
function validate (instance, puzzle) {
  const hits = countHits(instance, puzzle)
  if (hits === null) return false
  const counterMask = puzzle.getCandidatesBitMask(instance.counterCell)
  if (counterMask === 0) return false
  return supportableMask(instance, hits, counterMask).allowed !== 0
}
