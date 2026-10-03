// Open a Dutch Flatmates link in the app once, and print what it shows: the
// rules text, the verdict of "Find all solutions and valid candidates", and the
// grid the solver reached ('.' for a cell it did not fill). Compare the grid
// with gen.json's solution.
//
//   node examples/dutch-flatmates/app-open.mjs [link_file] [--live]
//
// Default: the recorded app (examples/_shared/sudokumaker.har, replay), which
// holds no play page, so the rules text is not read. --live loads
// sudokumaker.app itself, reads the rules text too, and records nothing, so the
// HAR stays as it is.
// The link is read from disk and sent as the page's own URL; it is never printed.

import fs from 'fs'
import { join } from 'path'
import { readGrid } from '../_shared/app-dom.mjs'
import { withApp, solveInApp } from '../_shared/app-session.mjs'

const HERE = import.meta.dirname
const live = process.argv.includes('--live')
const linkFile = process.argv.slice(2).find(a => !a.startsWith('--')) ?? join(HERE, 'PUZZLE_LINK.txt')
const link = fs.readFileSync(linkFile, 'utf8').trim()
const gen = JSON.parse(fs.readFileSync(join(HERE, 'gen.json'), 'utf8'))

await withApp({ live }, async app => {
  const page = await app.newPage()
  page.on('pageerror', e => console.error('PAGEERROR', e.message))

  let opening, title, rules
  const readOpening = async openPage => {
    opening = await readGrid(openPage)
    title = await openPage.title()

    // The rules text shows on the play page, which "Playtest" opens in a new tab.
    // The recorded app holds no play page (replay aborts it), so only --live reads it.
    rules = null
    if (live) {
      const [play] = await Promise.all([openPage.context().waitForEvent('page'), openPage.getByText('Playtest', { exact: true }).click()])
      await play.waitForLoadState('networkidle')
      await play.waitForTimeout(1500)
      rules = (await play.evaluate(() => document.body.innerText)).match(/Normal sudoku rules apply\.[^\n]*/)?.[0] ?? null
      await play.close()
    }
  }

  const { first, unique, sum, verdict, version } = await solveInApp(page, link, { afterOpen: readOpening, ringClues: true, deterministic: false, name: linkFile })
  if (verdict === '?') throw new Error('no verdict from the app')
  const solved = await readGrid(page)

  console.log(JSON.stringify({
    source: live ? 'live sudokumaker.app' : 'recorded app',
    version,
    title,
    rules,
    givensShown: opening.join('').replace(/\./g, '').length,
    readout: { first, unique, sum, verdict },
    grid: solved,
    matchesGenSolution: solved.join() === gen.grid.join()
  }, null, 1))
})
