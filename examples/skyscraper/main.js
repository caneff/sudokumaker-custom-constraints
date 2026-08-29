//! Skyscrapers with interactive outside clues, LOCAL variant. Each group is
//! one clued line: cell 0 is the outside clue cell, the rest is the line
//! read inward from the cell next to the clue. The two groups that read one
//! line from opposite ends share one SkyscraperLineComponent, which reads
//! both clues and the whole line together — the built-in SkyscraperComponent
//! only fires once the clue holds a value and never reads the clue off the
//! line, so it cannot help an interactive clue.
//!
//! The one-1-per-side count needs a whole side of clues, which only exists
//! once every frame line is drawn — see main-global.js.

const groups = input.groups.map(g => ({ clue: g.cells[0], line: g.cells.slice(1) }))

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
