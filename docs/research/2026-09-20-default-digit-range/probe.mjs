// Which digit range does the live app give a custom puzzle that declares no
// minDigit/maxDigit? Two comments disagree (#461): framebuild.py's _document
// says 0..9 regardless of size; bundle-solve-lib.mjs says 1..width.
//
// Probe: a custom board with only the built-in Rows & Columns constraint, no
// givens and no digit range, one per width. The candidates "Find all
// solutions and valid candidates" (Icon ShowCandidates) writes into the
// cells are the range. (A board with NO constraint at all gets no solver
// output: the app writes nothing and prints no verdict, tried first.)
//
//   node docs/research/2026-09-20-default-digit-range/probe.mjs [widths...]
//
// Runs from the repo root; uses the recorded app (examples/_shared/sudokumaker.har).
import { chromium } from 'playwright'
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { clickIcon, makeDeterministic, useRecordedApp } from '../../../examples/_shared/app-dom.mjs'
import { VERDICT_PATTERN } from '../../../examples/_shared/app-solve-lib.mjs'

// The app's own built-in "Rows & Columns" constraint (type 1000, the code
// backend the house-gac link ships) plus the type-0 entry beside it, copied
// verbatim from examples/house-gac/PUZZLE_LINK.txt. With only rows and
// columns all-different and no givens, every digit of the range survives in
// every cell, so the candidates the app writes ARE the range.
const ROWS_COLS = JSON.parse(fs.readFileSync(new URL('./rows-cols-constraints.json', import.meta.url), 'utf8'))

const widths = process.argv.slice(2).map(Number)
if (widths.length === 0) widths.push(2, 4)

function rangelessDoc (w) {
  return {
    formatVersion: '1.6.0',
    puzzle: {
      name: `rangeless ${w}x${w}`,
      author: '',
      comment: '',
      type: 'custom',
      width: w,
      height: w,
      cells: Array.from({ length: w * w }, () => ({})),
      constraints: ROWS_COLS,
      export: { sudokuPad: { useIncompleteGridAsSolution: true } }
    }
  }
}

function encode (doc) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rangeless-'))
  const json = path.join(dir, 'board.json')
  fs.writeFileSync(json, JSON.stringify(doc))
  return execFileSync('uv', ['run', '--directory', path.join(os.homedir(), 'src/gridfind'),
    'python', 'scripts/link_file.py', 'encode', json, '-'], { encoding: 'utf8' }).trim()
}

const CELL_TRANSFORM = /^translate\(\d+ \d+\) scale\(25\)$/

const browser = await chromium.launch()
const out = []
for (const w of widths) {
  const link = encode(rangelessDoc(w))
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  await useRecordedApp(context)
  const page = await context.newPage()
  await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(1200)

  await makeDeterministic(page)
  // Readout: "Find all solutions and valid candidates" (Icon ShowCandidates)
  // writes every valid candidate into every cell and prints a verdict.
  if (!await clickIcon(page, 'ShowCandidates')) throw new Error('Icon ShowCandidates not found')
  try {
    await page.waitForFunction(([src, flags]) => new RegExp(src, flags).test(document.body.innerText),
      [VERDICT_PATTERN.source, VERDICT_PATTERN.flags], { timeout: 300000 })
  } catch { /* fall through: report the board as it stands */ }
  await page.waitForTimeout(500)
  const cells = await page.evaluate(() =>
    [...document.querySelectorAll('svg text')].map(t => ({
      text: t.textContent.trim(),
      transform: t.closest('g[transform]')?.getAttribute('transform') || null
    })))
  const inCells = cells.filter(c => CELL_TRANSFORM.test(c.transform || ''))
  const byCell = new Map()
  for (const c of inCells) {
    const arr = byCell.get(c.transform) || []
    arr.push(c.text)
    byCell.set(c.transform, arr)
  }
  const first = [...byCell.entries()][0]
  const distinct = [...new Set(inCells.flatMap(c => c.text.split(/\s+/)).filter(t => /^\d+$/.test(t)))].sort((a, b) => a - b)
  const verdict = (await page.evaluate(() => document.body.innerText)).split('\n').filter(l => /took|solution|candidate|step/i.test(l)).slice(0, 4).join(' | ') || '(no verdict line)'
  out.push({ width: w, cellsWithText: byCell.size, firstCell: first ? first[1] : null, distinctDigitsOnBoard: distinct, verdict })
  await page.screenshot({ path: `docs/research/2026-09-20-default-digit-range/rangeless-${w}x${w}.png` })
  await context.close()
}
await browser.close()
console.log(JSON.stringify(out, null, 2))
