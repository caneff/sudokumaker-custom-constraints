// Open a no-ring link in the live app (the recorded HAR), click "Find all
// solutions", and print the app's readout and every console error. Writes a
// screenshot beside the link it was given, under .scratch/.
//
//   node docs/research/368-up-to-n-setup-throw/live-probe.mjs <link_file>
import { readFileSync, mkdirSync } from 'fs'
import { withApp, solveInApp } from '../../../examples/_shared/app-session.mjs'

const link = readFileSync(process.argv[2], 'utf8').trim()
await withApp({ live: false }, async app => {
  const page = await app.newPage()
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}]`, m.text().slice(0, 300)) })
  mkdirSync('.scratch', { recursive: true })
  const { text } = await solveInApp(page, link, {
    ringClues: true,
    timeoutMs: 8000,
    alsoWaitFor: /unable to satisfy|error/i,
    afterOpen: p => p.screenshot({ path: '.scratch/368-live-open-' + (process.argv[3] || 'a') + '.png' })
  })
  console.log(text.split('\n').filter(l => /solution|took|unique|constraint|error/i.test(l)).slice(0, 20).join('\n'))
  await page.screenshot({ path: '.scratch/368-live-solved.png' })
})
