/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
// Fillomino: divide the grid into regions of orthogonally connected cells.
// Every cell of a region of N cells holds the digit N, and two regions of the
// same size may not touch along an edge.
//
// Two words used all the way through:
//
//   ISLAND  A group of placed digits: cells holding the same digit that touch
//           along an edge. Touching cells with the same digit are always in
//           the same region, so an island of N's lies inside one region.
//   REGION  One region of the answer: N connected cells, all holding N. An
//           island of fewer than N cells is part of a region that still has
//           to grow.
//
// An EMPTY cell has no digit placed in it yet, and an empty cell COULD BE N
// while N is still among its candidates.
//
// What this tells the solver, for each island of N's with P cells:
//
//   1. Too big. P is more than N: the board is broken.
//   2. Finished. P is exactly N: the region is complete, so no empty cell
//      beside it can be N.
//   3. Room to grow. Step out from the island through cells that could be N,
//      at most N - P steps, picking up any placed N's met on the way: the
//      region lies inside the cells found. Fewer than N cells: the board is
//      broken. Exactly N: they are the region, so every empty one is N.
//   4. Cells the region can't do without. Block off one empty cell of that
//      room and step out again. If what is left is under N cells, the region
//      needs the blocked cell, so it is N.
//   5. Exits: the empty cells beside the island that could be N. An exit that
//      were N would join the island and every other island of N's it touches
//      into one. If that is over N cells, or has no room to reach N, the exit
//      is not N. And when only one exit is left, the region has to grow
//      through it, so it is N.
//
// And once for each digit N, over the whole board:
//
//   6. Pockets too small. The cells that could be N or hold N split into
//      separate pockets, and a region of N's lies inside one pocket. So a
//      pocket of fewer than N cells holds no N at all. This is the only rule
//      that finds a region with no digit placed in it yet.
//
// The other rule of fillomino, that regions of the same size may not touch,
// needs no check of its own: two such regions touching would be one island
// of 2N cells, and rule 1 and the final check both turn that down.

function getAffectedCells (cells) {
  return cells
}

// `cells` lists the board's cells row by row from the top left. The rules
// below talk about a cell by its place in that list (0, 1, 2, ...), and look
// up the app's own id for it only to read or change the cell.
function setParams (instance, cells, width, height) {
  instance.cells = cells
  instance.nbrs = cells.map((_, i) => neighbours(i, width, height))
  // Working space, reused on every call so that nothing is made while the
  // solver runs.
  instance.seen = newVisitMarks(Int32Array, cells.length)
  instance.visit = 0
  instance.islandCells = new Int16Array(cells.length)
  instance.joinedCells = new Int16Array(cells.length)
  instance.queue = new Int16Array(cells.length)
  instance.layers = [new Int16Array(cells.length), new Int16Array(cells.length)]
  // Rule 4's shortcut.
  instance.distance = new Int16Array(cells.length)
  instance.order = new Int16Array(cells.length)
  instance.bottleneck = new Int16Array(cells.length)
  instance.bottleneckDepth = new Int16Array(cells.length)
  instance.behind = new Int16Array(cells.length)
  instance.notNeeded = new Uint8Array(cells.length)
  // Rule 6's memory of the last call. -1 is no set of digits a cell can
  // have, so on the first call every cell reads as changed.
  instance.digitsNow = new Int32Array(cells.length)
  instance.digitsBefore = new Int32Array(cells.length).fill(-1)
  instance.changed = new Int16Array(cells.length)
  instance.othersThan = null
}

// #include ../_shared/dominator.js

// #include ../_shared/stamp.js

// Reading the board. `i` is a cell's place in `instance.cells`.

function holds (instance, puzzle, i, digit) {
  const cell = instance.cells[i]
  return puzzle.hasValue(cell) && puzzle.getValue(cell) === digit
}

function couldBe (instance, puzzle, i, digit) {
  const cell = instance.cells[i]
  return !puzzle.hasValue(cell) && hasCandidate(puzzle, cell, digit)
}

function holdsOrCouldBe (instance, puzzle, i, digit) {
  const cell = instance.cells[i]
  return puzzle.hasValue(cell) ? puzzle.getValue(cell) === digit : hasCandidate(puzzle, cell, digit)
}

// Whether `digit` is still among the cell's candidates. Read straight off the
// app's own record of them, one number with a bit for each digit: asking for
// the candidates as a set builds a new set on every call, and this is the
// question the solver asks most.
function hasCandidate (puzzle, cell, digit) {
  return (puzzle.getCandidatesBitMask(cell) & (1 << digit)) !== 0
}

// The digits the cell holds or could hold, in the same one-number form, so
// that rule 6 can tell whether a cell changed with one comparison.
function possibleDigits (puzzle, cell) {
  return puzzle.hasValue(cell) ? 1 << puzzle.getValue(cell) : puzzle.getCandidatesBitMask(cell)
}

function allows (digits, digit) {
  return (digits & (1 << digit)) !== 0
}

// The change that leaves `digit` as the only candidate in the app's cell
// `cell`.
function keepOnly (instance, puzzle, cell, digit) {
  return puzzle.removeCandidatesFromCell(otherDigits(instance, digit), cell)
}

// Every digit of the puzzle but `digit`. The puzzle's digits are only known
// once the solver runs, so the list is made on first use.
function otherDigits (instance, digit) {
  if (instance.othersThan === null) instance.othersThan = []
  let others = instance.othersThan[digit]
  if (others === undefined) {
    others = 0
    for (let d = helpers.digits.minDigit; d <= helpers.digits.maxDigit; d++) {
      if (d !== digit) others |= 1 << d
    }
    instance.othersThan[digit] = others
  }
  return others
}

// Start a search: until the next one starts, `instance.seen[i] === visit`
// says whether this search has reached cell i.
function newSearch (instance) {
  instance.visit = nextVisit(instance.seen, instance.visit)
  return instance.visit
}

// Grow `list`, which holds `length` cells, by every placed `digit` touching a
// cell in it from place `from` on, and every placed `digit` touching those,
// and so on, marking each one seen by `visit`. Stops once the list has more
// than `limit` cells. Returns the new length.
function addTouchingPlaced (instance, puzzle, list, from, length, digit, visit, limit) {
  const { nbrs, seen } = instance
  for (let k = from; k < length && length <= limit; k++) {
    for (const nb of nbrs[list[k]]) {
      if (seen[nb] !== visit && holds(instance, puzzle, nb, digit)) {
        seen[nb] = visit
        list[length++] = nb
      }
    }
  }
  return length
}

// The island that cell `start` belongs to, or would belong to if it held
// `digit`, written into `list`. Stops once it has more than `limit` cells.
// Returns its size.
function islandAt (instance, puzzle, start, digit, limit, list) {
  const visit = newSearch(instance)
  instance.seen[start] = visit
  list[0] = start
  return addTouchingPlaced(instance, puzzle, list, 0, 1, digit, visit, limit)
}

// Every island on the board, as { digit, seed, size }: `seed` is the island's
// first cell, `size` its number of cells.
function findIslands (instance, puzzle) {
  const { cells, seen, queue } = instance
  const visit = newSearch(instance)
  const islands = []
  for (let i = 0; i < cells.length; i++) {
    if (seen[i] === visit || !puzzle.hasValue(cells[i])) continue
    const digit = puzzle.getValue(cells[i])
    seen[i] = visit
    queue[0] = i
    const size = addTouchingPlaced(instance, puzzle, queue, 0, 1, digit, visit, Infinity)
    islands.push({ digit, seed: i, size })
  }
  return islands
}

// Rule 3's search. Start from the first `count` cells of `start`, which all
// hold `digit`, and step outward: each step takes every cell that could be
// `digit` beside the cells found so far, plus the placed `digit`s touching
// those, which are in the region already and cost no step. At most `steps`
// steps, never through `blocked` (rule 4), and no further once more than
// `digit` cells are found, since no rule needs a bigger count. Returns the
// number of cells found; they stay marked in `instance.seen` until the next
// search.
function roomToGrow (instance, puzzle, start, count, digit, steps, blocked = -1) {
  const { nbrs, seen } = instance
  const visit = newSearch(instance)
  let [edge, nextEdge] = instance.layers
  let edgeLength = 0
  for (let k = 0; k < count; k++) {
    seen[start[k]] = visit
    edge[edgeLength++] = start[k]
  }
  let found = edgeLength
  for (let step = 0; step < steps && edgeLength > 0 && found <= digit; step++) {
    let nextLength = 0
    for (let k = 0; k < edgeLength; k++) {
      for (const nb of nbrs[edge[k]]) {
        if (seen[nb] === visit || nb === blocked) continue
        if (couldBe(instance, puzzle, nb, digit)) {
          seen[nb] = visit
          nextEdge[nextLength++] = nb
        }
      }
    }
    nextLength = addTouchingPlaced(instance, puzzle, nextEdge, 0, nextLength, digit, visit, Infinity)
    found += nextLength
    const done = edge
    edge = nextEdge
    nextEdge = done
    edgeLength = nextLength
  }
  return found
}

// What each island's rules return to `update`.
const BROKEN = 0 // the board cannot be solved from here
const DONE = 1 // nothing more for this island on this call
const MORE = 2 // the next rule may still find something

// The rules each check for themselves that they apply: none of them counts on
// another having run first.
function * update (instance, puzzle) {
  for (const island of findIslands(instance, puzzle)) {
    const result = yield * islandRules(instance, puzzle, island)
    if (result === BROKEN) return
    if (result === DONE) continue
    if ((yield * neededCellsRule(instance, puzzle, island)) === DONE) continue
    yield * exitRules(instance, puzzle, island)
  }
  yield * smallPocketsRule(instance, puzzle)
}

// `update` hands each change to the solver as soon as it is made, so by the
// time an island's turn comes, a rule for an earlier island may have placed a
// digit right beside it. So the island is measured again when its rules first
// look at it, from its first cell (a placed digit stays placed), and all its
// rules read that one measurement: its cells, in `instance.islandCells`, and
// its room to grow (rule 3).
function measure (instance, puzzle, island) {
  const { digit, seed } = island
  if (island.count === undefined) {
    island.count = islandAt(instance, puzzle, seed, digit, digit, instance.islandCells)
  }
  if (island.room === undefined && island.count < digit) {
    island.room = roomToGrow(instance, puzzle, instance.islandCells, island.count, digit, digit - island.count)
    // the empty cells of the room, top left first
    island.emptyInRoom = []
    for (let i = 0; i < instance.cells.length; i++) {
      if (instance.seen[i] === instance.visit && !puzzle.hasValue(instance.cells[i])) island.emptyInRoom.push(i)
    }
  }
  return island
}

// Rules 1, 2 and 3.
function * islandRules (instance, puzzle, island) {
  const { cells, nbrs, islandCells } = instance
  const { digit, seed, count } = measure(instance, puzzle, island)

  // 1. Too big: an island of more than N cells does not fit in a region of N.
  // The solver learns that the board is broken when a cell has no candidate
  // left, so the island's first cell loses its digit.
  if (count > digit) {
    yield puzzle.removeCandidateFromCell(digit, cells[seed])
    return BROKEN
  }

  // 2. Finished: the island is its whole region, and an N beside it would
  // make the region one cell too big.
  if (count === digit) {
    for (let k = 0; k < count; k++) {
      for (const nb of nbrs[islandCells[k]]) {
        if (couldBe(instance, puzzle, nb, digit)) yield puzzle.removeCandidateFromCell(digit, cells[nb])
      }
    }
    return DONE
  }

  // 3. Room to grow. The region lies inside the room and has N cells, so a
  // room of fewer than N cells means the board is broken...
  if (island.room < digit) {
    yield puzzle.removeCandidateFromCell(digit, cells[seed])
    return BROKEN
  }

  // ...and a room of exactly N cells is the region itself.
  if (island.room === digit) {
    for (const i of island.emptyInRoom) yield keepOnly(instance, puzzle, cells[i], digit)
    return DONE
  }
  return MORE
}

// 4. Cells the region can't do without. For each empty cell of the room,
// block it off and search again from the island: if fewer than N cells are
// left, the region cannot avoid that cell, so it is N.
//
// Every check here reads the board as it was when the island was measured,
// so the cells found are collected first and changed together at the end.
// Changing one at once would put an N beside the island, and every check
// after it would be measuring an island that is no longer the right size.
function * neededCellsRule (instance, puzzle, island) {
  const { cells, islandCells } = instance
  const { digit, count } = measure(instance, puzzle, island)
  if (count >= digit || island.room <= digit) return MORE
  const notNeeded = cellsRegionCanSkip(instance, puzzle, island)
  const needed = []
  for (const i of island.emptyInRoom) {
    if (notNeeded[i]) continue
    if (roomToGrow(instance, puzzle, islandCells, count, digit, digit - count, i) < digit) needed.push(i)
  }
  if (needed.length === 0) return MORE
  for (const i of needed) yield keepOnly(instance, puzzle, cells[i], digit)
  // The island has grown, so the exit rules would be reading an old
  // measurement. The next call measures it again.
  return DONE
}

// A shortcut for rule 4 that clears most cells at once, so that they need no
// search of their own: it returns a list with 1 at each empty cell of the
// room that the region can certainly do without. It searches out from the
// island one step per cell, placed N's included, through the cells that hold
// or could be N, at most N - P steps. Every cell it finds, rule 3's search
// finds too (that search steps over placed N's for free), so its counts are
// never too high, and then it uses the bottleneck count described above.
function cellsRegionCanSkip (instance, puzzle, island) {
  const { nbrs, order, distance, islandCells } = instance
  const { digit, count } = island
  const steps = digit - count
  distance.fill(-1)
  let reached = 0
  for (let k = 0; k < count; k++) {
    const start = islandCells[k]
    if (distance[start] < 0) {
      distance[start] = 0
      order[reached++] = start
    }
  }
  for (let k = 0; k < reached; k++) {
    const from = order[k]
    if (distance[from] >= steps) continue
    for (const nb of nbrs[from]) {
      if (distance[nb] < 0 && holdsOrCouldBe(instance, puzzle, nb, digit)) {
        distance[nb] = distance[from] + 1
        order[reached++] = nb
      }
    }
  }
  findBottlenecks(instance, reached, distance)
  markCellsNotNeeded(instance, reached, distance, island.emptyInRoom, digit)
  return instance.notNeeded
}

// 5. Exits: the empty cells beside the island that could be N. The island is
// short of its region, so the region grows through one of them.
function * exitRules (instance, puzzle, island) {
  const { cells, nbrs, seen, islandCells, joinedCells } = instance
  const { digit, count } = measure(instance, puzzle, island)
  if (count >= digit || island.room <= digit) return MORE
  // each exit listed once
  const exits = []
  const visit = newSearch(instance)
  for (let k = 0; k < count; k++) {
    for (const nb of nbrs[islandCells[k]]) {
      if (seen[nb] !== visit && couldBe(instance, puzzle, nb, digit)) {
        seen[nb] = visit
        exits.push(nb)
      }
    }
  }

  for (const x of exits) {
    // If x were N, it would join the island and every other island of N's
    // it touches into one.
    const joined = islandAt(instance, puzzle, x, digit, digit, joinedCells)

    // Too big together: then x is not N.
    if (joined > digit) {
      yield puzzle.removeCandidateFromCell(digit, cells[x])
      continue
    }

    // No room together: the joined island's region would lie inside its room
    // to grow (rule 3), so a room under N cells means x is not N.
    if (roomToGrow(instance, puzzle, joinedCells, joined, digit, digit - joined) < digit) {
      yield puzzle.removeCandidateFromCell(digit, cells[x])
    }
  }

  // Only one exit left: the region has to grow through it.
  const left = exits.filter(x => couldBe(instance, puzzle, x, digit))
  if (left.length === 1) yield keepOnly(instance, puzzle, cells[left[0]], digit)
  return MORE
}

// 6. Pockets too small, once for each digit N: the cells that hold or could
// be N split into separate pockets, a region of N's lies inside one pocket,
// so every cell of a pocket under N cells loses N.
//
// Remembering the last call. Flooding every pocket of every digit on every
// call would be most of this component's work, so it keeps, for each cell,
// the digits it held or could hold when this rule last finished
// (`digitsBefore`), and floods only around the cells that have changed since.
// A pocket whose cells, and the cells around it, all read as they did last
// time is last time's pocket, and last time's answer for it still stands.
//
// Why that is safe. The solver tries a digit, backs out, and tries another,
// and never says when it backs out, so the component cannot keep track of
// its own changes. It compares the board now with the board last time
// instead, which is right whichever way the board moved. And `digitsBefore`
// is only written after the last change below, so a call the solver stops
// half-way leaves the older copy in place, and the next call sees more cells
// as changed, never fewer.
function * smallPocketsRule (instance, puzzle) {
  const { cells, nbrs, seen, queue, digitsNow, digitsBefore, changed } = instance
  const marked = newSearch(instance)
  let nChanged = 0
  for (let i = 0; i < cells.length; i++) {
    digitsNow[i] = possibleDigits(puzzle, cells[i])
    if (digitsNow[i] === digitsBefore[i]) continue
    // a changed cell can only join or split the pockets it touches, so the
    // cell and its neighbours are where the floods start
    if (seen[i] !== marked) {
      seen[i] = marked
      changed[nChanged++] = i
    }
    for (const nb of nbrs[i]) {
      if (seen[nb] !== marked) {
        seen[nb] = marked
        changed[nChanged++] = nb
      }
    }
  }
  if (nChanged === 0) return

  for (let digit = helpers.digits.minDigit; digit <= helpers.digits.maxDigit; digit++) {
    const visit = newSearch(instance)
    for (let s = 0; s < nChanged; s++) {
      const start = changed[s]
      if (seen[start] === visit || !allows(digitsNow[start], digit)) continue
      // The whole pocket, even past N cells: a cell left unmarked would read
      // as a pocket of its own when a later start reaches it.
      seen[start] = visit
      queue[0] = start
      let size = 1
      for (let k = 0; k < size; k++) {
        for (const nb of nbrs[queue[k]]) {
          if (seen[nb] !== visit && allows(digitsNow[nb], digit)) {
            seen[nb] = visit
            queue[size++] = nb
          }
        }
      }
      if (size >= digit) continue
      for (let k = 0; k < size; k++) {
        // A pocket this small with an N already placed in it means the board
        // is broken, and that placed cell losing its digit is how the solver
        // learns it.
        digitsNow[queue[k]] &= ~(1 << digit)
        yield puzzle.removeCandidateFromCell(digit, cells[queue[k]])
      }
    }
  }
  digitsBefore.set(digitsNow)
}

// The final check on a filled grid: every island is exactly its digit's size.
function validate (instance, puzzle) {
  if (!puzzle.getCellsAreFilled(instance.cells)) return true
  return findIslands(instance, puzzle).every(({ digit, size }) => size === digit)
}
