import fs from 'fs'
import { withApp, solveInApp } from '../../../examples/_shared/app-session.mjs'
const link = fs.readFileSync(process.argv[2], 'utf8').trim()
await withApp({ live: false }, async app => {
  const page = await app.newPage()
  page.on('console', m => console.log('[console:' + m.type() + '] ' + m.text().slice(0, 300)))
  page.on('pageerror', e => console.log('[pageerror] ' + e.message))
  const { verdict, text } = await solveInApp(page, link, { ringClues: true, timeoutMs: 60000 })
  if (verdict === '?') console.log('[no unique/not-unique/timeout verdict in 60s; the lines below may still name an "unable to satisfy" or error]')
  const lines = text.split('\n').filter(l => /solution|took|unable|error|candidate|probe/i.test(l))
  console.log('[verdict lines]\n' + lines.join('\n'))
})
