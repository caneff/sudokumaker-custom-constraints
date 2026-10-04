// Backend for the sparse required-digits timing board (#541). GROUPS -- the
// generated table of {name, values, cells: [[row, col], ...]} -- is prepended
// by build_sparse_required_digits.py; it is not a clue read off the board.
// Each group registers one required-digits component directly, no wrapper.
// The script writes two links from this one file: as it stands (candidate,
// RequiredDigitsGacComponent) and with that one identifier swapped for the
// built-in RequiredDigitsComponent (baseline).
for (const g of GROUPS) {
  const cells = g.cells.map(([r, c]) => puzzle.getCellAt(c, r) | 0)
  puzzle.addConstraintComponent(new RequiredDigitsGacComponent(g.name, g.values, cells))
}
