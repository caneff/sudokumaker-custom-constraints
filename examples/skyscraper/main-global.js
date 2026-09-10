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
// #include ../_shared/frame-lines.js

const lines = frameLines(puzzle)

for (const { a, b } of framePairs(lines)) {
  const name = `the skyscraper clues at ${helpers.naming.getCellName(a.clue)} and ${helpers.naming.getCellName(b.clue)}`
  puzzle.addConstraintComponent(
    new SkyscraperLineComponent(name, a.clue, b.clue, a.line))
}
