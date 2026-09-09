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
// only for dimensions that happen to divide. So on a rectangle `alldiffGroups`
// throws rather than quietly using nw for both dimensions.

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
  // the same for B. The groups come off the side table below -- each side with
  // its own count, because a left/right line and a top/bottom line are
  // different lengths -- and `keys` is then their own keys, so the two cannot
  // disagree. Key order is not a contract: the frame is compared as a set of
  // lines (#295), so a caller that depends on the sequence is depending on an
  // accident.
  const groups = [['L', nh], ['R', nh], ['T', nw], ['B', nw]].flatMap(([side, count]) =>
    Array.from({ length: count }, (_, i) => ({
      key: side + i,
      cells: [clueCell(side, i), ...lineCells(side, i)]
    })))
  const keys = groups.map(g => g.key)

  function buildAlldiffGroups () {
    const out = []
    for (let r = 0; r < nw; r++) out.push(Array.from({ length: nw }, (_, c) => interior(r, c)))
    for (let c = 0; c < nw; c++) out.push(Array.from({ length: nw }, (_, r) => interior(r, c)))
    for (let br = 0; br < nw; br += bh) {
      for (let bc = 0; bc < nw; bc += bw) {
        const cells = []
        for (let dr = 0; dr < bh; dr++) for (let dc = 0; dc < bw; dc++) cells.push(interior(br + dr, bc + dc))
        out.push(cells)
      }
    }
    return out
  }

  // A getter, so the refusal fires on the ASK and not on the frame. A
  // rectangular frame is a legitimate thing to build -- global-backends.test.mjs
  // runs every backend on an 11x8 board precisely because a square frame is
  // symmetric under transpose and hides a backend that reads one dimension
  // twice (#299). Throwing in the constructor would take that board away to
  // guard a field that board never reads.
  return {
    W,
    H,
    idx,
    interior,
    lineCells,
    clueCell,
    keys,
    groups,
    get alldiffGroups () {
      if (nh !== nw) {
        throw new Error(`frameGeometry: alldiffGroups is built for a square interior only, and this one is ${nw}x${nh}`)
      }
      return buildAlldiffGroups()
    }
  }
}
