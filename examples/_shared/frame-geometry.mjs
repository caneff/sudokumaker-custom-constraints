// The outside-clue frame layout shared by the recovery probes: an n x n interior
// ringed by one border cell per row/column side (W = n + 2 wide/tall, row-major
// index). Both the Hit Counts and Skyscraper recovery probes build the identical
// frame — this is that geometry, factored out so the two copies cannot drift.
//
// The all-different floor (row/column/box GAC) is not part of a clue frame, but
// every probe that builds one needs the same row/column/box cell groups, so it
// rides along here too.

export function frameGeometry (n, [bh, bw]) {
  const W = n + 2
  const idx = (r, c) => r * W + c
  const interior = (r, c) => idx(r + 1, c + 1)

  function lineCells (side, i) {
    const cells = []
    if (side === 'L') for (let c = 0; c < n; c++) cells.push(interior(i, c))
    if (side === 'R') for (let c = n - 1; c >= 0; c--) cells.push(interior(i, c))
    if (side === 'T') for (let r = 0; r < n; r++) cells.push(interior(r, i))
    if (side === 'B') for (let r = n - 1; r >= 0; r--) cells.push(interior(r, i))
    return cells
  }
  function clueCell (side, i) {
    if (side === 'L') return idx(i + 1, 0)
    if (side === 'R') return idx(i + 1, W - 1)
    if (side === 'T') return idx(0, i + 1)
    return idx(W - 1, i + 1)
  }

  // Every clued line, keyed "L0".."B{n-1}", as { key, clue cell, line cells }.
  const keys = []
  for (let i = 0; i < n; i++) for (const s of ['L', 'R', 'T', 'B']) keys.push(s + i)
  const groups = keys.map(k => {
    const side = k[0]; const i = +k.slice(1)
    return { key: k, cells: [clueCell(side, i), ...lineCells(side, i)] }
  })

  const alldiffGroups = []
  for (let r = 0; r < n; r++) alldiffGroups.push(Array.from({ length: n }, (_, c) => interior(r, c)))
  for (let c = 0; c < n; c++) alldiffGroups.push(Array.from({ length: n }, (_, r) => interior(r, c)))
  for (let br = 0; br < n; br += bh) {
    for (let bc = 0; bc < n; bc += bw) {
      const cells = []
      for (let dr = 0; dr < bh; dr++) for (let dc = 0; dc < bw; dc++) cells.push(interior(br + dr, bc + dc))
      alldiffGroups.push(cells)
    }
  }

  return { W, idx, interior, lineCells, clueCell, keys, groups, alldiffGroups }
}

// The puzzle methods main-global.js's own frame-building calls: getCellAt(r,
// c) and spec.size.width. Pass as `puzzleExtra` to recovery-lib.mjs's
// loadComponents so a probe can run the real frame-building code instead of
// handing it a pre-built `groups` list.
export function frameMock (W, idx) {
  return { getCellAt: idx, spec: { size: { width: W } } }
}
