//! The interior's rows and columns, declared once and used twice.
//!
//! A frame board is an interior sudoku inside a one-cell clue ring. Its region
//! constraint gives BOXES ONLY -- nothing in the app makes a row or a column a
//! house -- so the interior lines have to be declared, or the board is not the
//! puzzle it looks like (#335, docs/gotchas.md #9).
//!
//! Two consumers need those lines, and `rowsAndColumns` is the single source
//! both read: the app's solver, through the components registered below, and
//! SudokuPad, through the publish-time `postprocessJSON` userscript hook.
//!
//! `| 0` on every cell id is load-bearing, not decoration. An id that comes out
//! of the app's own geometry helpers is not a plain integer, and the solver
//! runs slower on it until it is one again: these eighteen houses built
//! straight from `getAllRows()` measured 1.18x the document cages they
//! replace, and 0.97x coerced (#394, the same trap as #276).
//!
//! `houseType` is what makes a house legible to the solver's row and column
//! machinery -- its Fishes and its row/column mappings read `Row` and `Column`
//! and skip the `ExtraRegion` a bare `new HouseComponent(name, cells)` gets.

function rowsAndColumns () {
  return [
    ['row', 'Row', helpers.geometry.getAllRows()],
    ['column', 'Column', helpers.geometry.getAllColumns()]
  ].flatMap(([kind, houseType, lines]) =>
    // The ring is the first and last line, and the first and last cell of
    // every line between them.
    [...lines].slice(1, -1).map((line, i) => ({
      name: `${kind} ${i + 1}`,
      houseType,
      cells: line.slice(1, -1).map(cell => cell | 0)
    }))
  )
}

//! A house says "every digit exactly once", which is all-different PLUS "every
//! digit is used" -- and the second half is only true when the line is as long
//! as the digit range. Hit Counts runs `minDigit: 0`, so its 9x9 interior rows
//! hold nine cells and the puzzle has ten digits: a house there states a rule
//! the puzzle does not have. All-different is what the type-301 cages this
//! replaces actually registered, and it is the honest fallback.
const digitCount = helpers.digits.maxDigit - helpers.digits.minDigit + 1

for (const { name, houseType, cells } of rowsAndColumns()) {
  puzzle.addConstraintComponent(cells.length === digitCount
    ? new HouseComponent(name, cells, houseType)
    : new DifferentDigitsComponent(name, cells))
}

//! Publish-time hook, run by the Tampermonkey userscript that exports to
//! SudokuPad -- not by the app, which has no such hook (docs/patterns.md).
//!
//! `norowcol` tells SudokuPad this board's rows and columns are not houses:
//! its own duplicate checker would otherwise read each ring clue as a repeat
//! of the interior digits it shares a physical row with. That leaves the
//! interior with no line rule at all, so the same lines go back as hidden
//! `rowcol` cages -- the shape the app's own exporter writes for a unique
//! digit group (`addGlobalUniqueDigitsGroup`).
//!
//! The corners are pinned by a component, not by a given, so they hold no
//! puzzle digit; clear them out of the exported grid and out of the solution
//! string so nothing about them rides into what SudokuPad checks.
function postprocessJSON (json) { // eslint-disable-line no-unused-vars -- called by the publish userscript, not from here
  const { width: W, height: H } = helpers.cellIds
  const toRC = cell => {
    const { x, y } = helpers.cellIds.getCoordsFromId(cell)
    return [y, x]
  }

  json.metadata.norowcol = true
  json.cages.push(...rowsAndColumns().map(({ cells }) => ({
    unique: 'true', type: 'rowcol', hidden: 'true', cells: cells.map(toRC)
  })))

  const corners = [[0, 0], [0, W - 1], [H - 1, 0], [H - 1, W - 1]]
  for (const [r, c] of corners) delete json.cells[r][c].value
  const masked = new Set(corners.map(([r, c]) => r * W + c))
  json.metadata.solution = json.metadata.solution?.replace(/./g,
    (digit, index) => masked.has(index) ? '?' : digit)
}
