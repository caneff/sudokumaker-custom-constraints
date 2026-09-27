// Run from the repo root: node docs/research/619-up-to-n-live-check/typed0.mjs
// Screenshots go to .scratch/619-live/ (create it first).
// A 0 typed into an Up to N marker's Value field in the live editor (4x4).
// Tab k is the k-th drawn group: tab 1 is B0 (true clue 0), tab 2 is B1
// (true clue 7).
import { readFileSync } from 'fs'
import { chromium } from 'playwright'
import { clickIcon, clickText } from '../../../examples/_shared/app-dom.mjs'
const browser = await chromium.launch()
const lines = async (page, re) => (await page.evaluate(() => document.body.innerText)).split('\n').filter(l => re.test(l))
const svgTexts = page => page.evaluate(() => [...document.querySelectorAll('svg.SudokuSvg text')].map(t => t.textContent))

const failures = []
const check = (desc, ok) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} — ${desc}`); if (!ok) failures.push(desc) }

// Expected result per tab: the typed 0 is accepted with no setup banner, and
// the solver readout agrees with the true grid (unique on B0, whose true clue
// is 0; broken on B1, whose true clue is 7).
const EXPECT = {
  1: { readoutHas: /This is a unique solution\./ },
  2: { readoutHas: /broken/i }
}

for (const [tab, what] of [['1', 'B0, true clue 0'], ['2', 'B1, true clue 7']]) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage()
  page.on('pageerror', e => console.log('  [pageerror]', e.message.slice(0, 200)))
  await page.goto(readFileSync('examples/up-to-n/PUZZLE_LINK_4x4.txt', 'utf8').trim(), { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(2500)
  await page.getByText('Up to N', { exact: true }).click(); await page.waitForTimeout(800)
  const tabbed = await page.locator('.GroupsTabStrip .mainTabs .tab .label', { hasText: new RegExp(`^${tab}$`) }).count()
  await page.locator('.GroupsTabStrip .mainTabs .tab .label', { hasText: new RegExp(`^${tab}$`) }).click()
  await page.waitForTimeout(600)
  const input = page.locator('.groupControls input.TextInput')
  await input.click(); await page.keyboard.type('0'); await page.waitForTimeout(400); await page.keyboard.press('Enter')
  await page.waitForTimeout(2000)
  const fieldValue = await input.inputValue()
  console.log(`\n== typed 0 into tab ${tab} (${what}); tab clicked ${tabbed}; field now "${fieldValue}"`)
  await page.getByText('Up to N', { exact: true }).click(); await page.waitForTimeout(1000)
  await page.screenshot({ path: `.scratch/619-live/live-typed0-tab${tab}.png` })
  const setupBanners = await lines(page, /failed|error|whole number/i)
  console.log('  labels (panel closed):', JSON.stringify(await svgTexts(page)))
  console.log('  banners:', JSON.stringify(setupBanners))
  await clickText(page, 'Tools'); await page.waitForTimeout(300)
  console.log('  solve  :', await clickIcon(page, 'ShowCandidates'))
  await page.waitForTimeout(5000)
  const readout = await lines(page, /solution|took|contradict|invalid|broken/i)
  console.log('  readout:', JSON.stringify(readout))
  await page.screenshot({ path: `.scratch/619-live/live-typed0-tab${tab}-solved.png` })
  await page.context().close()

  check(`tab ${tab}: typed 0 registers (field reads "0")`, fieldValue === '0')
  check(`tab ${tab}: no setup refusal banner`, setupBanners.length === 0)
  check(`tab ${tab}: solver readout matches the true grid`, readout.some(l => EXPECT[tab].readoutHas.test(l)))
}
await browser.close()

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed:`)
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('\nAll checks passed.')
