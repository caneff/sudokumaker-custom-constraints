// Greedy clue removal with the live SudokuMaker app as the uniqueness oracle,
// loading the puzzle link ONCE instead of once per trial.
//
// A throwaway prototype does the same greedy walk by rebuilding a link and
// launching a fresh Chromium per trial -- several seconds of reload overhead
// every removal. This driver opens the link, then drives the app's own
// puzzle EDITOR by clicking cells and pressing keys: delete a given, click
// the solve button, read the app's own verdict, and either leave the cell
// empty (unique) or restore the given (anything else).
//
//   node examples/_shared/app-strip.mjs <link_file> <out.json> [seed] --grid <puzzle.json>
//
// `--grid` supplies the full grid (for the output JSON) and the starting
// clue set (the cells to try removing) in the same shape build_link.py reads
// -- the link itself only carries which cells are given, not a grid array.
//
// A 'unique' verdict keeps the removal. Anything else (not-unique, timeout,
// or a '?' that still has no verdict after one retry) restores the digit AS
// A GIVEN -- never as an entered (played) value, which is what plain
// keyboard digit entry would produce outside the app's "Given digits"
// editing mode.
//
// A 'timeout' rung (the app's own solve limit, no verdict) keeps the given
// and is also written to <out>.timeout-<n>.json: that rung is a candidate
// hard grid, worth a CP-SAT uniqueness check later.
//
// The puzzle link opens directly in SudokuMaker's puzzle EDITOR, not a
// player view: the "Given digits" element is already the selected editing
// target in the left Elements panel, so clicking a cell and pressing a digit
// key (or Delete) sets or clears a GIVEN outright -- no separate "givens
// mode" toggle exists to find or click.
//
// A cell is addressed by transforming its local SVG coordinate (cellCenter in
// app-solve-lib.mjs) through the grid <g>'s getScreenCTM() (cellScreenPoint in
// app-dom.mjs), so this survives the app's zoom/pan without hardcoded pixel
// math. The driver runs inside app-session's withApp.
//
// The solve button (the ShowCandidates icon, same as app-solve.mjs) starts a
// background search that keeps running after the first verdict text appears
// -- clicking "Stop solving" cancels it. Left running, that search overwrites
// the grid with live per-cell candidate digits, and those change WHICH TOOL
// keyboard input is aimed at: after a solve, digit keys stop setting the
// given and start toggling those candidate marks instead. Restoring a given
// after a solve therefore takes an extra step: select the whole grid
// (Icon SelectAll) and clear it (Icon ClearAll). That clears entered values
// and candidate marks only -- givens are untouched (verified: a given cell
// elsewhere on the board survives it) -- and it also puts digit-key input
// back to setting givens, so the restore keystroke that follows works again.
// This runs after every solve attempt, including a retry, so no trial ever
// reads a verdict off a board still carrying the previous attempt's marks.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { isBlack } from './app-solve-lib.mjs'
import { withApp, openLink, readVerdict } from './app-session.mjs'
import { clickText, clickIcon, openWidePad, enterDigit, readCells, cellScreenPoint } from './app-dom.mjs'
import { parseArgs, seededShuffle, outputJson } from './app-strip-lib.mjs'

// The cell the app draws a digit in at (row, col), as readCells returns it,
// or undefined when it holds none.
async function cellDigit (page, row, col) {
  return (await readCells(page)).find(c => c.row === row && c.col === col && c.content.trim() !== '')
}

async function selectCell (page, row, col) {
  const p = await cellScreenPoint(page, row, col)
  await page.mouse.click(p.x, p.y)
  await page.waitForTimeout(150)
}

// Cancel any still-running background search, then clear stray candidate
// marks (SelectAll + ClearAll) -- both a no-op when there is nothing to
// clear. This also resets keyboard digit input back to setting givens (see
// the header comment). Both icon clicks are load-bearing -- a silent miss
// (icon renamed; the app is pre-release) leaves the next digit keystroke
// toggling a candidate mark instead of setting a given, corrupting every
// later trial -- so this fails loud rather than continuing on a board it
// cannot confirm is clean.
async function settleAfterSolve (page) {
  await clickText(page, 'Stop solving') // best-effort: absent once solving has finished
  await page.waitForTimeout(200)
  if (!await clickIcon(page, 'SelectAll')) throw new Error('SelectAll icon not found')
  await page.waitForTimeout(150)
  if (!await clickIcon(page, 'ClearAll')) throw new Error('ClearAll icon not found')
  await page.waitForTimeout(200)
}

// Delete cell (row, col)'s given, click the solve button, and read the
// verdict + timing off the app's own readout (parseReadout, the same
// convention app-solve.mjs uses) -- not a wall clock, which would fold in
// click/DOM overhead. Throws if the verdict is a "unique solution" that the
// app itself says is judged from leftover entered values or pencil marks:
// that is not a real uniqueness proof for the board as this driver intends
// it, and a silent pass here would drop clues the puzzle actually needs.
// Does not restore or settle -- callers decide that from the result.
async function trySolveWithout (page, row, col) {
  await selectCell(page, row, col)
  await page.keyboard.press('Delete')
  await page.waitForTimeout(200)

  if (!await clickIcon(page, 'ShowCandidates')) throw new Error('solve button not found: Icon ShowCandidates')
  return readTrialVerdict(page, row, col)
}

// One trial's verdict for removing (row, col)'s given. A missing verdict
// within the 30 s cap reads as '?'. A verdict judged from entered values or
// marks is refused: settleAfterSolve clears them before every trial.
export function readTrialVerdict (page, row, col) {
  return readVerdict(page, {
    timeout: 30000,
    settleMs: 200,
    name: `(${row},${col})`
  })
}

async function restoreGiven (page, row, col, digit) {
  await selectCell(page, row, col)
  await enterDigit(page, digit)
  await page.waitForTimeout(150)
  const restored = await cellDigit(page, row, col)
  if (!restored || restored.content !== String(digit) || !isBlack(restored.fill)) {
    throw new Error(`(${row},${col}): restore failed -- expected given "${digit}" (a black fill), ` +
      `got ${JSON.stringify(restored ?? null)}`)
  }
}

async function main () {
  const { linkFile, outFile, gridFile, seed } = parseArgs(process.argv.slice(2))
  const link = fs.readFileSync(linkFile, 'utf8').trim()
  const spec = JSON.parse(fs.readFileSync(gridFile, 'utf8'))
  const grid = spec.grid
  const startClues = spec.clues.map(([r, c]) => [r, c])
  const order = seededShuffle(startClues, seed)
  const kept = order.slice()
  const outPath = path.resolve(outFile)

  await withApp({ live: false }, async app => {
    const page = await app.newPage()
    await openLink(page, link)
    if (grid.some(row => row.some(v => v > 9))) await openWidePad(page)

    for (let i = 0; i < kept.length;) {
      const [row, col] = kept[i]
      const digit = grid[row][col]

      let readout = await trySolveWithout(page, row, col)
      let verdict = readout.verdict
      if (verdict === '?') {
        await settleAfterSolve(page)
        readout = await trySolveWithout(page, row, col)
        // the retry's verdict is final, whatever it is: never a second retry
        verdict = readout.verdict
      }

      if (verdict === 'unique') {
        kept.splice(i, 1)
        console.log(`${kept.length} givens  ${verdict}  ${readout.sum} ms`)
        fs.writeFileSync(outPath, outputJson(grid, kept))
      } else {
        await settleAfterSolve(page)
        await restoreGiven(page, row, col, digit)
        console.log(`keep (${row},${col})  (${verdict})`)
        if (verdict === 'timeout') {
          const timeoutPath = outPath.replace(/\.json$/, `.timeout-${kept.length}.json`)
          fs.writeFileSync(timeoutPath, outputJson(grid, kept))
        }
        i++
        continue
      }

      await settleAfterSolve(page)
    }

    console.log(`minimum ${kept.length} givens`)
  })
}

if (fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) await main()
