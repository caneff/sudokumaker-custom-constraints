//! ISOFILL inside an interactive Skyscrapers ring, on a whole-grid frame. No
//! groups are drawn: the frame lines come from the shared reader below.
//!
//! One IsofillComponent holds the interior. It finds neighbours by index
//! arithmetic, so its cell list must be the interior row-major: the left-clue
//! lines are exactly that, each interior row read left to right, in row order.
//!
//! One SkyscraperOneSidedComponent per ring clue reads that clue's line inward.
//! An ISOFILL row repeats digits, so the line is no house, and the one-sided
//! DP is the component that assumes nothing about its line (ties hidden: its
//! ALLOW_TIES = false).
// #include ../_shared/frame-lines.js

const nw = puzzle.spec.size.width - 2
const nh = puzzle.spec.size.height - 2
// Thrown before anything registers, so a bad board never half-registers.
if (nw !== nh) throw new Error(`ISOFILL: needs a square interior, got ${nw} x ${nh}`)

const lines = frameLines(puzzle)
const interior = lines.filter(g => g.side === 'L').flatMap(g => g.line)
puzzle.addConstraintComponent(new IsofillComponent('ISOFILL', interior))

for (const { clue, line } of lines) {
  const name = `the skyscraper clue at ${helpers.naming.getCellName(clue)}`
  puzzle.addConstraintComponent(new SkyscraperOneSidedComponent(name, clue, line))
}
