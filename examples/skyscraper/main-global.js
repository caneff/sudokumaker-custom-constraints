//! Skyscrapers with interactive outside clues, GLOBAL variant. No groups are
//! drawn: build every frame line from the board size -- an interior nw = W-2
//! wide and nh = H-2 tall, ringed by one clue cell per row and per column. A
//! left or right clue reads one interior row, so it has nw cells and there are
//! nh such lines; a top or bottom clue reads one interior column, so it has nh
//! cells and there are nw of them. `puzzle.getCellAt(a, b)` is the cell at
//! column a, row b, so `at(r, c)` hands it the arguments the other way round:
//! it reads row r, column c, the cell its own name says. The L/R/T/B labels
//! below are the real sides.
//!
//! A frame line is clued at both ends, which is what the two-clue DP in
//! SkyscraperLineComponent reads: the line, both clues, and every way the
//! digits can lie between them. The DP is a decision procedure for one line, so
//! it subsumes the one-clue rule a single end would give: this variant
//! registers the two-clue DP alone, once per line.
//!
//! On top of that goes the one component that only makes sense across a whole
//! side of the frame: the one-1-per-side count.
function frameGroups () {
  const W = puzzle.spec.size.width
  const H = puzzle.spec.size.height
  const nw = W - 2
  const nh = H - 2
  // `| 0` is load-bearing, not decoration: an id derived from the board size
  // costs the app's solver ~1.3x per candidate read until it is a plain
  // integer again (docs/puzzle-api.md, `getCellAt`; #276). Every coordinate
  // here is in range, so getCellAt never returns undefined -- and it must
  // stay that way, because `undefined | 0` is 0, a real cell.
  const at = (r, c) => puzzle.getCellAt(c, r) | 0
  const range = (from, to) => Array.from({ length: Math.abs(to - from) + 1 }, (_, k) => from + (to > from ? k : -k))
  const groups = []
  // Clue rank i: a left and a right clue while the interior has an i-th row, a
  // top and a bottom clue while it has an i-th column.
  for (let i = 1; i <= Math.max(nh, nw); i++) {
    if (i <= nh) {
      groups.push({ side: 'L', cells: [at(i, 0), ...range(1, nw).map(c => at(i, c))] })
      groups.push({ side: 'R', cells: [at(i, W - 1), ...range(nw, 1).map(c => at(i, c))] })
    }
    if (i <= nw) {
      groups.push({ side: 'T', cells: [at(0, i), ...range(1, nh).map(r => at(r, i))] })
      groups.push({ side: 'B', cells: [at(H - 1, i), ...range(nh, 1).map(r => at(r, i))] })
    }
  }
  return groups
}

const groups = frameGroups().map(g => ({ side: g.side, clue: g.cells[0], line: g.cells.slice(1) }))

function sameReversed (a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[a.length - 1 - i]) return false
  return true
}
const paired = new Set()
for (let i = 0; i < groups.length; i++) {
  for (let j = i + 1; j < groups.length; j++) {
    if (!sameReversed(groups[i].line, groups[j].line)) continue
    const name = `the skyscraper clues at ${helpers.naming.getCellName(groups[i].clue)} and ${helpers.naming.getCellName(groups[j].clue)}`
    puzzle.addConstraintComponent(
      new SkyscraperLineComponent(name, groups[i].clue, groups[j].clue, groups[i].line))
    paired.add(i).add(j)
  }
}
// Every line needs both end clues; a lone clue would get no component and no
// error, so fail loud instead.
for (let i = 0; i < groups.length; i++) {
  if (!paired.has(i)) throw new Error(`skyscraper: clue ${helpers.naming.getCellName(groups[i].clue)} has no opposite clue on its line`)
}

// Exactly one clue of 1 per side. The component gets the side's clues and the
// side's lines, clue by clue, and checks for itself that each line and the
// nearest rank -- the lines' own first cells -- is a full house of {1..n}
// (docs/line-contract.md); it prunes nothing until they all prove out.
const sides = {}
for (const g of groups) {
  if (!sides[g.side]) sides[g.side] = []
  sides[g.side].push(g)
}
for (const s of Object.keys(sides)) {
  puzzle.addConstraintComponent(new SkyscraperSideComponent(
    `one 1 on side ${s}`, sides[s].map(g => g.clue), sides[s].map(g => g.line)))
}
