// frameGeometry: the frame it lays out, and the one thing it refuses.
//
//   node examples/_shared/frame-geometry.test.mjs

import assert from 'assert'
import { frameGeometry } from './frame-geometry.mjs'

{
  const nw = 5
  const nh = 3
  const g = frameGeometry(nw, [3, 3], nh)

  // A left or right clue reads one interior ROW: nw cells, nh such lines. A
  // top or bottom clue reads one interior COLUMN: nh cells, nw of them.
  const byKey = new Map(g.groups.map(x => [x.key, x]))
  assert.strictEqual(g.groups.length, 2 * nh + 2 * nw)
  for (const s of ['L', 'R']) {
    for (let i = 0; i < nh; i++) assert.strictEqual(byKey.get(s + i).cells.length, nw + 1)
  }
  for (const s of ['T', 'B']) {
    for (let i = 0; i < nw; i++) assert.strictEqual(byKey.get(s + i).cells.length, nh + 1)
  }

  // `keys` is the groups' own keys, not a separate list the groups are parsed
  // back out of: the two cannot disagree.
  assert.deepStrictEqual(g.keys, g.groups.map(x => x.key))

  // Each group is its clue cell then its line, and both are still reachable on
  // their own -- the recovery probes and hit-counts' soundness harness call
  // them (`clueCell`, `lineCells`).
  for (const x of g.groups) {
    const side = x.key[0]
    const i = +x.key.slice(1)
    assert.deepStrictEqual(x.cells, [g.clueCell(side, i), ...g.lineCells(side, i)])
  }

  // A right clue reads the same row a left clue does, from the other end.
  assert.deepStrictEqual(byKey.get('R1').cells.slice(1), byKey.get('L1').cells.slice(1).reverse())
}

{
  const g = frameGeometry(4, [2, 2])
  assert.strictEqual(g.alldiffGroups.length, 4 + 4 + 4)
  for (const grp of g.alldiffGroups) assert.strictEqual(grp.length, 4)

  // The boxes (the last four groups) are the 2x2 blocks of the interior, by
  // cell id: the interior of a 4-wide board starts at id 7 (W = 6).
  assert.deepStrictEqual(g.alldiffGroups.slice(8), [
    [7, 8, 13, 14], [9, 10, 15, 16],
    [19, 20, 25, 26], [21, 22, 27, 28]
  ])
}

{
  // 6x6 with 2-row x 3-column boxes: six boxes, each two interior rows and
  // three interior columns. A swapped [3, 2] would give 3-row x 2-column boxes.
  const g = frameGeometry(6, [2, 3])
  const boxes = g.alldiffGroups.slice(12)
  assert.strictEqual(boxes.length, 6)
  assert.deepStrictEqual(boxes[0], [g.interior(0, 0), g.interior(0, 1), g.interior(0, 2), g.interior(1, 0), g.interior(1, 1), g.interior(1, 2)])
  assert.deepStrictEqual(boxes[1], [g.interior(0, 3), g.interior(0, 4), g.interior(0, 5), g.interior(1, 3), g.interior(1, 4), g.interior(1, 5)])
  // together the boxes cover every interior cell exactly once
  const all = boxes.flat().sort((a, b) => a - b)
  assert.deepStrictEqual(all, Array.from({ length: 36 }, (_, i) => g.interior(Math.floor(i / 6), i % 6)).sort((a, b) => a - b))
}

{
  // It is built for a square interior only -- it uses nw for both dimensions,
  // so on a rectangle it would hand back rows of the wrong length and boxes
  // that tile nothing, with no complaint. Asking for it is the error.
  const g = frameGeometry(5, [3, 3], 3)
  assert.throws(() => g.alldiffGroups, /square/)

  // The refusal is lazy: building the geometry of a rectangular frame is
  // fine, and global-backends.test.mjs does exactly that on its 11x8 board.
  assert.strictEqual(g.groups.length, 2 * 3 + 2 * 5)
  assert.strictEqual(typeof g.clueCell('L', 0), 'number')
}

console.log('PASS')
