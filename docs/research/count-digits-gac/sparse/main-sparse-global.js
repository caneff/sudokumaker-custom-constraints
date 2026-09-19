// Backend for the sparse count-digits timing board (#543). GROUPS -- the
// generated table of {name, values, counter: [row, col], cells: [[row, col],
// ...]} -- is prepended by build_sparse_count_digits.py; it is not a clue read
// off the board. Each group registers one count-digits component directly, no
// wrapper. The script writes two links from this one file: as it stands
// (candidate, CountDigitsGacComponent) and with that one identifier swapped for
// the built-in CountDigitsComponent (baseline).
//
// `values` becomes a digit mask because that is what both classes take: the
// built-in uses its `digits` argument raw, as `this.digits & candidates`
// (docs/research/bundle-api-reference.md, "CountDigits").
//
// What this file is, for a reader meeting the app cold: the backend, code that
// runs once at setup (not while solving) to register the board's constraint.
// `puzzle` is the app's model of the board and `puzzle.addConstraintComponent`
// hands it one component to run during the solve -- here 20, one per group in
// GROUPS. The board draws none of them: which cells a group holds exists only
// in the table above. `puzzle.getCellAt(x, y)` turns a column and row into a
// cell id, and each group's [row, col] pairs are written row-first, so `at`
// swaps them. `| 0` turns the id into a plain number (undefined off the board
// becomes 0).
for (const g of GROUPS) {
  const at = ([r, c]) => puzzle.getCellAt(c, r) | 0
  // Bit d of the mask is digit d: the digits {1,3} become 0b1010.
  const digits = g.values.reduce((mask, d) => mask | (1 << d), 0)
  puzzle.addConstraintComponent(new CountDigitsGacComponent(g.name, digits, at(g.counter), g.cells.map(at)))
}
