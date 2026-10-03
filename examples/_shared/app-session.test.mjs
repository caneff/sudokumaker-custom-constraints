// solveInApp against the recorded app (the HAR replay adapter): a real
// browser opens a committed link and the readout comes back as one record.
// Run: node examples/_shared/app-session.test.mjs
//
// The link is a 4x4 whose solve takes well under a second, so the test stays
// in the fast gate. The recorded app pins the version, so the version string
// is the HAR's own.

import assert from 'assert'
import fs from 'fs'
import { withApp, solveInApp } from './app-session.mjs'

const link = fs.readFileSync(new URL('../up-to-n/PUZZLE_LINK_4x4.txt', import.meta.url), 'utf8').trim()

await withApp({ live: false }, async app => {
  const page = await app.newPage()
  const r = await solveInApp(page, link, { ringClues: true })
  assert.strictEqual(r.verdict, 'unique')
  assert.ok(Number.isInteger(r.sum) && r.sum >= 0, `sum is the app's own readout, got ${r.sum}`)
  assert.ok(Number.isInteger(r.unique), `unique-search time read, got ${r.unique}`)
  assert.match(r.version, /^v\d{4}\.\d{2}\.\d{2}-[0-9a-f]+$/)
  assert.match(r.text, /unique solution/i)
})

console.log('app-session.test.mjs: all seams pass')
