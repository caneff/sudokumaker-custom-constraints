// solveInApp against the recorded app (the HAR replay adapter): a real
// browser opens a committed link and the readout comes back as one record.
// Run: node examples/_shared/app-session.test.mjs
//
// Needs Playwright's Chromium (`npx playwright install chromium`); CI's check
// leg installs it. The recorded app pins the version, so the version string
// is the HAR's own.

import assert from 'assert'
import fs from 'fs'
import { withApp, solveInApp, readVerdict } from './app-session.mjs'
import { readTrialVerdict } from './app-strip.mjs'

// readVerdict against a stub page: it waits for the verdict pattern (plus an
// extra pattern when given), then reads the readout and refuses a verdict the
// app judged from marks unless marks are expected, with the caller's message.
// app-strip's trial read refuses one too, with its own diagnosis.
{
  const stub = text => {
    const waits = []
    return {
      waits,
      waitForFunction: async (fn, arg, opts) => { waits.push({ arg, opts }) },
      waitForTimeout: async () => {},
      evaluate: async () => text
    }
  }
  const ok = 'Solved took 1.0s\nThis is a unique solution. Solutions took 2.0s'
  const page = stub(ok)
  const r = await readVerdict(page, { refusal: 'unused', timeout: 1234, alsoWaitFor: /rejected/ })
  assert.strictEqual(r.verdict, 'unique')
  assert.strictEqual(r.text, ok)
  assert.strictEqual(page.waits[0].opts.timeout, 1234)
  assert.match(page.waits[0].arg[0], /\|rejected$/)

  const marked = stub(ok + ' (based on already entered values and pencil marks.)')
  await assert.rejects(readVerdict(marked, { refusal: 'cell (1,2): refused' }), /^Error: cell \(1,2\): refused$/)
  assert.strictEqual((await readVerdict(marked, { refusal: 'unused', marksExpected: true })).verdict, 'unique')
  await assert.rejects(readTrialVerdict(marked, 1, 2), /^Error: \(1,2\): verdict was judged "based on already entered values and pencil marks" -- .*settleAfterSolve should have caught this$/)
  assert.strictEqual((await readTrialVerdict(stub(ok), 1, 2)).verdict, 'unique')

  // a wait that times out reads '?', never throws
  const slow = { ...stub('nothing yet'), waitForFunction: async () => { throw new Error('timeout') } }
  assert.strictEqual((await readVerdict(slow, { refusal: 'unused' })).verdict, '?')
}

const link = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8').trim()

await withApp({ live: false }, async app => {
  // A 9x9 whose search runs for seconds: the first "took" prints long before
  // the verdict, so a wait that ends on the first readout, or no wait at all,
  // reads a null sum here. The default options also run both guards below
  // (searchable link, "already entered" verdict) on a board that passes them.
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

  // The app's own "already entered values" verdict is refused too: a board
  // with pencil marks and no entered value passes the searchable-link check, so this
  // is the refusal's only guard. The phrase is planted into the page, since
  // no committed link carries marks only.
  const marked = await app.newPage()
  await marked.addInitScript(() => {
    setInterval(() => {
      if (document.body && !document.getElementById('planted')) {
        const d = document.createElement('div')
        d.id = 'planted'
        d.textContent = 'This is a unique solution. (based on already entered values and pencil marks.)'
        document.body.appendChild(d)
      }
    }, 50)
  })
  await assert.rejects(solveInApp(marked, link('up-to-n/PUZZLE_LINK_4x4.txt'), { name: '4x4' }),
    /^Error: 4x4: the app judged "based on already entered values" -- .*so it is no timing; strip the link first$/)
})

console.log('app-session.test.mjs: all seams pass')
