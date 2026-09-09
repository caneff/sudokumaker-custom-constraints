//! Skyscrapers with interactive outside clues, on a whole-grid frame. No
//! groups are drawn: the frame lines come from the shared reader below, one
//! { side, clue, line } per clued line (examples/_shared/frame-lines.js).
//!
//! Every line is clued at both ends, which is what the two-clue DP in
//! SkyscraperLineComponent reads: the line, both clues, and every way the
//! digits can lie between them. One of those is registered per line, and it
//! decides that line on its own -- a value survives only if some full line
//! consistent with the candidates and both clues uses it. `framePairs` hands
//! over the two ends of each line by construction, so no line can come out
//! with one clue and no component.
//!
//! One further component runs across each side of the frame, over that side's
//! clue cells together: the one-1-per-side count.
// #include ../_shared/frame-lines.js

const lines = frameLines(puzzle)

for (const { a, b } of framePairs(lines)) {
  const name = `the skyscraper clues at ${helpers.naming.getCellName(a.clue)} and ${helpers.naming.getCellName(b.clue)}`
  puzzle.addConstraintComponent(
    new SkyscraperLineComponent(name, a.clue, b.clue, a.line))
}

// Exactly one clue of 1 per side. The component gets the side's clues and the
// side's lines, clue by clue, and checks for itself that each line and the
// nearest rank -- the lines' own first cells -- is a full house of {1..n}
// (docs/line-contract.md); it prunes nothing until they all prove out.
const sides = {}
for (const g of lines) {
  if (!sides[g.side]) sides[g.side] = []
  sides[g.side].push(g)
}
for (const s of Object.keys(sides)) {
  puzzle.addConstraintComponent(new SkyscraperSideComponent(
    `one 1 on side ${s}`, sides[s].map(g => g.clue), sides[s].map(g => g.line)))
}
