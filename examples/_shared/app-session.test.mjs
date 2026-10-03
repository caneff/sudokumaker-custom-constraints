// solveInApp against the recorded app (the HAR replay adapter): a real
// browser opens a committed link and the readout comes back as one record.
// Run: node examples/_shared/app-session.test.mjs
//
// Needs Playwright's Chromium (`npx playwright install chromium`); CI's check
// leg installs it. The recorded app pins the version, so the version string
// is the HAR's own.

import assert from 'assert'
import fs from 'fs'
import { withApp, solveInApp } from './app-session.mjs'

const link = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8').trim()

await withApp({ live: false }, async app => {
  // A 9x9 whose search runs for seconds: the first "took" prints long before
  // the verdict, so a wait that ends on the first readout, or no wait at all,
  // reads a null sum here. The default options also run both guards below
  // (stripped board, "already entered" verdict) on a board that passes them.
  const page = await app.newPage()
  const r = await solveInApp(page, link('up-to-n/PUZZLE_LINK_9x9.txt'))
  assert.strictEqual(r.verdict, 'unique')
  assert.ok(r.sum > 3000, `the sum spans the whole search, got ${r.sum}`)
  assert.ok(r.unique > 0 && r.first >= 0, `both readouts read, got ${r.first}, ${r.unique}`)
  assert.match(r.version, /^v\d{4}\.\d{2}\.\d{2}-[0-9a-f]+$/)
  assert.match(r.text, /unique solution/i)

  // A board holding entered values is refused before it is solved: the
  // solver would verify, not search, and the time would mean nothing.
  const clued = await app.newPage()
  await assert.rejects(solveInApp(clued, link('numbered-rooms/PUZZLE_LINK_clued.txt')), /entered values on the board/)
})

console.log('app-session.test.mjs: all seams pass')
