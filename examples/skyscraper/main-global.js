//! Skyscrapers with interactive outside clues, GLOBAL variant. No groups are
//! drawn: build all 4n frame lines from the board size -- interior n = W-2
//! ringed by one clue cell per side. `puzzle.getCellAt(row, col)` =
//! row*W+col [verified 2026-08-28 via a [probe] log in the app].
//!
//! A frame line is clued at both ends, which is what the two-clue DP in
//! SkyscraperLineComponent reads: the line, both clues, and every way the
//! digits can lie between them. The DP is a decision procedure for one line, so
//! it subsumes the one-sided DP the local variant registers per drawn group and
//! global registers it alone per line (docs/line-contract.md).
//!
//! On top of that goes the one component that only makes sense across a whole
//! side of the frame: the one-1-per-side count.
function frameGroups () {
  const W = puzzle.spec.size.width
  const n = W - 2
  const at = (r, c) => puzzle.getCellAt(r, c)
  const range = (from, to) => Array.from({ length: n }, (_, k) => from + (to > from ? k : -k))
  const groups = []
  for (let i = 1; i <= n; i++) {
    groups.push({ side: 'L', cells: [at(i, 0), ...range(1, n).map(c => at(i, c))] })
    groups.push({ side: 'R', cells: [at(i, W - 1), ...range(n, 1).map(c => at(i, c))] })
    groups.push({ side: 'T', cells: [at(0, i), ...range(1, n).map(r => at(r, i))] })
    groups.push({ side: 'B', cells: [at(W - 1, i), ...range(n, 1).map(r => at(r, i))] })
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
    const name = `skyscraper line ${helpers.naming.getCellName(groups[i].clue)}/${helpers.naming.getCellName(groups[j].clue)}`
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
