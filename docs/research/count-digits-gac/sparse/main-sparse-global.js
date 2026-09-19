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
for (const g of GROUPS) {
  const at = ([r, c]) => puzzle.getCellAt(c, r) | 0
  const digits = g.values.reduce((mask, d) => mask | (1 << d), 0)
  puzzle.addConstraintComponent(new CountDigitsGacComponent(g.name, digits, at(g.counter), g.cells.map(at)))
}
