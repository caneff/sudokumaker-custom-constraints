// The outside-clue frame layout shared by the recovery probes: an interior nw
// cells wide and nh cells tall, ringed by one border cell per row and per
// column (W = nw + 2 wide, H = nh + 2 tall, row-major index with W as the row
// stride). Both the Hit Counts and Skyscraper recovery probes build the
// identical frame — this is that geometry, factored out so the two copies
// cannot drift.
//
// A left or right clue reads one interior row, so it has nw cells and there is
// one such line per interior row: nh of them. A top or bottom clue reads one
// interior column, so it has nh cells and there are nw of them. The frame
// therefore holds 2 * nh + 2 * nw clued lines.
//
// The all-different floor (row/column/box GAC) is not part of a clue frame, but
// every probe that builds one needs the same row/column/box cell groups, so it
// rides along here too. It is built for a square interior only: on a rectangle
// no one digit set fits both a row of nw and a column of nh, and boxes tile
// only for dimensions that happen to divide.

export function frameGeometry (nw, [bh, bw], nh = nw) {
  const W = nw + 2
  const H = nh + 2
  const idx = (r, c) => r * W + c
  const interior = (r, c) => idx(r + 1, c + 1)

  function lineCells (side, i) {
    const cells = []
    if (side === 'L') for (let c = 0; c < nw; c++) cells.push(interior(i, c))
    if (side === 'R') for (let c = nw - 1; c >= 0; c--) cells.push(interior(i, c))
    if (side === 'T') for (let r = 0; r < nh; r++) cells.push(interior(r, i))
    if (side === 'B') for (let r = nh - 1; r >= 0; r--) cells.push(interior(r, i))
    return cells
  }
  function clueCell (side, i) {
    if (side === 'L') return idx(i + 1, 0)
    if (side === 'R') return idx(i + 1, W - 1)
    if (side === 'T') return idx(0, i + 1)
    return idx(H - 1, i + 1)
  }

  // Every clued line, as { key, clue cell, line cells }. A key is its side
  // plus its index: "L0".."L{nh-1}" and the same for R, "T0".."T{nw-1}" and
  // the same for B. The keys group by side — every L, then every R, then every
  // T, then every B — because the sides have different counts. Key order is
  // not a contract: the frame is compared as a set of lines (#295), so a
  // caller that depends on the sequence is depending on an accident.
  const keys = []
  for (const s of ['L', 'R']) for (let i = 0; i < nh; i++) keys.push(s + i)
  for (const s of ['T', 'B']) for (let i = 0; i < nw; i++) keys.push(s + i)
  const groups = keys.map(k => {
    const side = k[0]; const i = +k.slice(1)
    return { key: k, cells: [clueCell(side, i), ...lineCells(side, i)] }
  })

  const alldiffGroups = []
  for (let r = 0; r < nw; r++) alldiffGroups.push(Array.from({ length: nw }, (_, c) => interior(r, c)))
  for (let c = 0; c < nw; c++) alldiffGroups.push(Array.from({ length: nw }, (_, r) => interior(r, c)))
  for (let br = 0; br < nw; br += bh) {
    for (let bc = 0; bc < nw; bc += bw) {
      const cells = []
      for (let dr = 0; dr < bh; dr++) for (let dc = 0; dc < bw; dc++) cells.push(interior(br + dr, bc + dc))
      alldiffGroups.push(cells)
    }
  }

  return { W, H, idx, interior, lineCells, clueCell, keys, groups, alldiffGroups }
}
