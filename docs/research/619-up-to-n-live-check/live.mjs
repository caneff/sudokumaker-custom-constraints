// Run from the repo root: node docs/research/619-up-to-n-live-check/live.mjs
// Screenshots go to .scratch/619-live/ (create it first).
// Live-app check for #619: rules text and clue labels on the four committed
// Up to N boards, and a 0 typed into a marker in the editor. Loads
// sudokumaker.app itself, not the recorded HAR. The typed 0 is typed0.mjs.
import { readFileSync } from 'fs'
import { chromium } from 'playwright'
const DIR = 'examples/up-to-n/'
const BOARDS = [['PUZZLE_LINK_4x4.txt', 'gen_4x4.json'], ['PUZZLE_LINK_6x6.txt', 'gen_6x6.json'], ['PUZZLE_LINK_9x9.txt', 'gen_9x9.json'], ['PUZZLE_LINK.txt', 'gen.json']]
const browser = await chromium.launch()

async function open (linkFile) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage()
  page.on('pageerror', e => console.log('  [pageerror]', e.message.slice(0, 200)))
  await page.goto(readFileSync(DIR + linkFile, 'utf8').trim(), { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(2500)
  return page
}

// Every SVG label outside the grid, as its marker key (L/R row, T/B column).
const labels = (page, n) => page.evaluate(n => {
  const svg = document.querySelector('svg.SudokuSvg')
  const g = [...svg.querySelectorAll('rect')].map(r => r.getBoundingClientRect())
    .filter(r => r.width > 200 && Math.abs(r.width - r.height) < 2).sort((a, b) => a.width - b.width)[0]
  const cell = g.width / n
  const out = {}
  for (const t of svg.querySelectorAll('text')) {
    const r = t.getBoundingClientRect(); const x = r.x + r.width / 2; const y = r.y + r.height / 2
    const row = Math.floor((y - g.y) / cell); const col = Math.floor((x - g.x) / cell)
    let key = null
    if (x > g.right) key = 'R' + row; else if (x < g.x) key = 'L' + row
    else if (y < g.y) key = 'T' + col; else if (y > g.bottom) key = 'B' + col
    if (key) out[key] = t.textContent
  }
  return out
}, n)

const rulesText = async page => {
  await page.getByText(/^Up to N .+/).first().click()
  await page.waitForTimeout(1000)
  const v = await page.evaluate(() => [...document.querySelectorAll('textarea')].map(t => t.value).find(v => v.includes('Normal sudoku')))
  await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  return v
}

const bodyLines = async (page, re) => (await page.evaluate(() => document.body.innerText)).split('\n').filter(l => re.test(l))

// The corrected rule's worked example per size (build_size.py RULE_EXAMPLES,
// the source of truth): what the rules text must contain for that n.
const WORKED_EXAMPLE = {
  4: 'a clue of 4 at the left end of row 2 is true of the row 3124, since 3 + 1 = 4',
  6: 'a clue of 11 at the left end of row 2 is true of the row 416253, since 4 + 1 + 6 = 11',
  9: 'a clue of 12 at the left end of row 5 is true of the row 921564738, since 9 + 2 + 1 = 12'
}

const failures = []
const check = (desc, ok) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} — ${desc}`); if (!ok) failures.push(desc) }

for (const [link, gen] of BOARDS) {
  const board = JSON.parse(readFileSync(DIR + gen, 'utf8'))
  const page = await open(link)
  const shot = `.scratch/619-live/live-${link.replace('.txt', '')}.png`
  await page.screenshot({ path: shot })
  const drawn = await labels(page, board.n)
  const recorded = Object.fromEntries(board.active.map(k => [k, String(board.clue[k])]))
  const sameLabels = JSON.stringify(Object.entries(drawn).sort()) === JSON.stringify(Object.entries(recorded).sort())
  const rules = await rulesText(page)
  const banners = await bodyLines(page, /failed|error/i)
  console.log(`\n== ${link} (${board.n}x${board.n}) screenshot ${shot}`)
  console.log('  labels drawn   :', JSON.stringify(Object.fromEntries(Object.entries(drawn).sort())))
  console.log('  labels recorded:', JSON.stringify(Object.fromEntries(Object.entries(recorded).sort())))
  console.log('  rules text     :', rules)
  console.log('  banners        :', JSON.stringify(banners))
  check(`${link}: labels drawn match recorded`, sameLabels)
  check(`${link}: rules text carries the size-${board.n} worked example`, !!rules && rules.includes(WORKED_EXAMPLE[board.n]))
  check(`${link}: no failed/error banner`, banners.length === 0)
  await page.context().close()
}

await browser.close()

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed:`)
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('\nAll checks passed.')
