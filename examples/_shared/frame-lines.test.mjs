// frame-lines.js: the frame it reads off a board, and the misuse framePairs
// refuses. Run:
//   node examples/_shared/frame-lines.test.mjs
//
// The file is a paste segment, not a module -- no import, no export -- so it is
// loaded through makeIo().load, the seam every other harness uses to assemble a
// paste target and eval named declarations out of it.
// global-backends.test.mjs checks it as each backend USES it; this one holds it
// on its own, which is where a refusal can be asked for.

import assert from 'assert'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { makeIo } from './harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { frameLines, framePairs } = makeIo(HERE).load('frame-lines.js', ['frameLines', 'framePairs'])

// A board of plain integer ids, the shape frameLines reads: getCellAt(col, row).
const board = (W, H) => ({
  spec: { size: { width: W, height: H } },
  getCellAt: (c, r) => r * W + c
})

// ---- the pairs of a whole frame: L_i with R_i, T_i with B_i ----
{
  const lines = frameLines(board(7, 5))
  const pairs = framePairs(lines)
  assert.strictEqual(pairs.length, lines.length / 2)
  for (const { a, b } of pairs) {
    assert.ok(['LR', 'TB'].includes(a.side + b.side), `${a.side}${b.side} is not a pair of ends`)
    assert.deepStrictEqual(b.line, a.line.slice().reverse())
  }
}

// ---- a filtered list is refused, not mispaired ----
// The misuse the guard exists for: hit-counts already has a bySide helper, so
// framePairs(bySide('L')) is a plausible edit, and pairing L0 with L1 would
// hand a joint component two clues on the same side and the wrong line.
{
  const lines = frameLines(board(7, 5))
  assert.throws(() => framePairs(lines.filter(g => g.side === 'L')), /whole frameLines output/)
  assert.throws(() => framePairs(lines.filter(g => 'LT'.includes(g.side))), /whole frameLines output/)
}

// ---- an odd-length list is refused rather than pairing with undefined ----
{
  const lines = frameLines(board(7, 5))
  assert.throws(() => framePairs(lines.slice(0, 3)), /whole frameLines output/)
}

console.log('frame-lines.test.mjs: pairs by construction, and refuses a filtered or odd-length list')
