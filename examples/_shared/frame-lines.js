/* eslint-disable no-unused-vars -- frameLines and framePairs are called by the main-global.js that includes this file, not from here */
// The outside-clue frame, read off the board. One copy, spliced into every
// global backend by `// #include ../_shared/frame-lines.js`
// (examples/_shared/minify.py). Not a module: no import, no export -- the app
// runs the assembled main-global.js as a bare script, so these are plain
// function declarations that land in the same scope as the rest of the paste.
//
// The frame is an interior nw = W-2 wide and nh = H-2 tall, ringed by one clue
// cell per row and per column. A left or right clue reads one interior ROW, so
// it has nw cells and there are nh such lines; a top or bottom clue reads one
// interior COLUMN, so it has nh cells and there are nw of them. Reading one
// dimension twice walks off a rectangular board, which is what the 11x8 case in
// global-backends.test.mjs is there to catch.
//
// `puzzle.getCellAt(a, b)` is the cell at column a, row b (docs/puzzle-api.md),
// so `at(r, c)` hands it the arguments the other way round: it reads row r,
// column c, the cell its own name says.

// Every clued line of the frame, as { side, clue, line }: the side letter it
// leaves from, the ring cell holding the clue, and the interior cells read
// INWARD from the cell next to the clue -- the group order every line
// component expects (gotcha 3). Order is fixed: each row's L then R, by row,
// then each column's T then B, by column, and the index within a side is that
// row's or column's own. Nothing carries a key: the order is the index, and a
// field no caller reads still ships in every link (gotcha 7).
function frameLines (puzzle) {
  const W = puzzle.spec.size.width
  const H = puzzle.spec.size.height
  const nw = W - 2
  const nh = H - 2
  // `| 0` is load-bearing, not decoration: an id derived from the board size
  // costs the app's solver ~1.3x per candidate read until it is a plain
  // integer again (docs/puzzle-api.md, `getCellAt`; #276). Every coordinate
  // here is in range, so getCellAt never returns undefined -- and it must stay
  // that way, because `undefined | 0` is 0, a real cell.
  const at = (r, c) => puzzle.getCellAt(c, r) | 0
  const lines = []
  for (let i = 0; i < nh; i++) {
    const row = []
    for (let c = 1; c <= nw; c++) row.push(at(i + 1, c))
    lines.push({ side: 'L', clue: at(i + 1, 0), line: row })
    lines.push({ side: 'R', clue: at(i + 1, W - 1), line: row.slice().reverse() })
  }
  for (let i = 0; i < nw; i++) {
    const col = []
    for (let r = 1; r <= nh; r++) col.push(at(r, i + 1))
    lines.push({ side: 'T', clue: at(0, i + 1), line: col })
    lines.push({ side: 'B', clue: at(H - 1, i + 1), line: col.slice().reverse() })
  }
  return lines
}

// The opposite-end pairs of `frameLines`, as { a, b }: L_i with R_i, T_i with
// B_i. They come off the order above two at a time, so this is construction,
// not a search -- there is no scan comparing every line against every other,
// and no line that can come out unpaired. A list filtered by side, or one of
// odd length, is refused rather than mispaired. `a.line` is the line as read inward
// from clue `a`; clue `b` reads its reverse, which is the order a pair
// component is given (docs/line-contract.md).
function framePairs (lines) {
  const pairs = []
  for (let i = 0; i < lines.length; i += 2) {
    const a = lines[i]
    const b = lines[i + 1]
    // Construction only holds for the list frameLines produced whole. This
    // catches the two misuses that reach here: a list filtered by side
    // (framePairs(lines.filter(g => g.side === 'L'))) would otherwise pair L0
    // with L1 and hand a joint component two clues on one side and the wrong
    // line, and an odd-length one would pair the last entry with undefined and
    // throw inside the app at solve time. It does not check that a and b are
    // the two ends of the same line. The two strings are the opposite-side
    // table, read as a lookup; kept to one throw because this ships in every
    // link of five examples (gotcha 7).
    if (!b || b.side !== 'RLBT'['LRTB'.indexOf(a.side)]) {
      throw new Error('framePairs takes whole frameLines output')
    }
    pairs.push({ a, b })
  }
  return pairs
}
