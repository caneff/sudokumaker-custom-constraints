//! Skyscrapers with interactive outside clues. Each group is one clued line:
//! cell 0 is the outside clue cell, the rest is the line read inward from the
//! cell next to the clue. One self-contained component per line — the built-in
//! SkyscraperComponent only fires once the clue holds a value and never reads
//! the clue off the line, so it cannot help an interactive clue.

const groups = input.groups.map(g => ({ clue: g.cells[0], line: g.cells.slice(1) }))

for (const g of groups) {
  const name = helpers.naming.getCellsDescription([g.clue, ...g.line])
  puzzle.addConstraintComponent(new SkyscraperComponent(name, g.clue, g.line))
}

// Opposite-end coupling: two clues that read the same line reversed satisfy
// L + R <= n + 1 (only the tallest building is visible from both ends).
function sameReversed (a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[a.length - 1 - i]) return false
  return true
}
for (let i = 0; i < groups.length; i++) {
  for (let j = i + 1; j < groups.length; j++) {
    if (!sameReversed(groups[i].line, groups[j].line)) continue
    const name = `skyscraper pair ${helpers.naming.getCellName(groups[i].clue)}/${helpers.naming.getCellName(groups[j].clue)}`
    puzzle.addConstraintComponent(
      new SkyscraperPairComponent(name, groups[i].clue, groups[j].clue, groups[i].line))
  }
}

// Exactly one clue of 1 per side. A clue of 1 means the cell next to it is the
// tallest building. Each side's nearest rank is a house (a full row or column),
// so the tallest building sits under exactly one clue on that side. The built-in
// count constraint states it directly, coupling all the clues on a side.
const W = groups[0].line.length + 2 // board is the n x n grid plus a clue ring
function side (ci) {
  if (ci < W) return 'T'
  if (ci >= W * (W - 1)) return 'B'
  if (ci % W === 0) return 'L'
  return 'R'
}
const sides = {}
for (const g of groups) {
  const s = side(g.clue)
  if (!sides[s]) sides[s] = []
  sides[s].push(g.clue)
}
for (const s of Object.keys(sides)) {
  puzzle.addConstraintComponent(new ExactDigitCountComponent(`one 1 on side ${s}`, 1, 1, sides[s]))
}
