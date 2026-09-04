function* initialize (instance, puzzle) /* : Generator<Change> */ {
  const { cells } = instance
  instance.cells_set = new Set(cells)
}

function* update (instance, puzzle) /* : Generator<Change> */ {
  const { cells, cells_set } = instance
  function bfs(source, passable) {
    const queue = [source]
    const visited = new Set()

    while (queue.length > 0) {
      // console.log(queue)
      // debugger
      const cell = queue.shift()
      visited.add(cell)
      for (const neighbor of puzzle.getCellsOrthogonallyAdjacentToCell(cell)) {
        if (!cells.includes(neighbor)) {
          continue
        }
        const value = puzzle.getValue(neighbor)
        if (!visited.has(neighbor)) {
          if (passable(neighbor)) {
            queue.push(neighbor)
          }
        }
      }
    }
    return visited
  }
  const processed = new Set()
  const islands = []
  for (const cell of cells) {
    if (!processed.has(cell) && puzzle.hasValue(cell)) {
      const digit = puzzle.getValue(cell)
      // console.log(`digit`, digit)
      const island = bfs(cell, (cell) => puzzle.getValue(cell) == digit)
      islands.push(island)
      for (const cell2 of island) {
        processed.add(cell2)
      }
    }
  }
  for (const island of islands) {
    const frontier = []
    let digit = null
    let first_cell = null
    for (const cell of island) {
      if (digit == null) {
        digit = puzzle.getValue(cell)
        first_cell = cell
      }
      for (const neighbor of puzzle.getCellsOrthogonallyAdjacentToCell(cell)) {
        if (!puzzle.hasValue(neighbor) && !frontier.includes(neighbor) && puzzle.getCandidates(neighbor).has(digit) && cells_set.has(neighbor)) {
          frontier.push(neighbor)
        }
      }
    }
    // console.log(island)
    const name = helpers.naming.getCageName("region", Array.from(island))
    if (island.size > digit) {
      yield puzzle.stop(`${name} is too large`)
      return
    }
    if (island.size == digit) {
      yield puzzle.removeCandidateFromCells(digit, frontier)
      continue
    }

    const reachable = bfs(first_cell, (cell) => puzzle.getCandidates(cell).has(digit))
    if (reachable.size < digit) {
      yield puzzle.stop(`${name} has not enough space`)
      return
    }
    if (reachable.size == digit) {
      yield puzzle.filterCandidatesInCells(SudokuDigitSet.from([digit]), reachable)
      continue
    }
    if (frontier.length == 1) {
      yield puzzle.filterCandidatesInCells(SudokuDigitSet.from([digit]), frontier)
    } else {
      for (const potential_cell of frontier) {
        const new_island = bfs(potential_cell, (cell) => puzzle.getValue(cell) == digit || cell == potential_cell)
        if (new_island.size > digit) {
          yield puzzle.removeCandidateFromCell(digit, potential_cell)
        }
      }
    }
  }
}
