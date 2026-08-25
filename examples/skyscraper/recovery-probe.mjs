// Recovery/speed probe: is the interactive-outside Skyscraper constraint actually
// faster to SOLVE than the original wrapper, or only tighter on paper?
//
//   node examples/skyscraper/recovery-probe.mjs                 # gen_6.json, root recovery
//   node examples/skyscraper/recovery-probe.mjs gen_9.json
//   node examples/skyscraper/recovery-probe.mjs gen_6.json --search   # solve, count nodes
//
// It runs the ACTUAL components — the same main.js wiring SudokuMaker runs — over a
// generated puzzle's start state, on top of a Régin-strength (GAC) all-different
// floor over every row, column, and box. That floor is the honest baseline: any
// skyscraper deduction must earn its keep ON TOP of the all-different SudokuMaker
// already runs.
//
// TWO wirings, same start state:
//   - 'ours'     — main.js: one SkyscraperComponent per line (deduces a BLANK
//                  clue and the line together), the pair coupling L + R <= n + 1,
//                  and one ExactDigitCountComponent per side (one 1 per side).
//   - 'original' — the wrapper ChinStrap shipped: one per-line component that does
//                  NOTHING while its clue is blank, and once the clue is pinned
//                  runs the built-in forward skyscraper prune. No pair, no side
//                  count.
//
// MODELLING THE ORIGINAL. The real wrapper calls replaceComponent to swap in the
// built-in SkyscraperComponent once the clue is pinned; this engine does not model
// replaceComponent, and SudokuMaker's built-in is not in this repo. So we model the
// original line as OUR component gated to fire only when the clue is pinned — at
// which point our update skips its reverse pass and runs exactly the forward
// "keep only line candidates that reach k visible" prune the built-in does. This
// GIVES the original every per-line deduction ours has for a KNOWN clue. The only
// differences left are the three features under test: blank-clue deduction, pair
// coupling, and the one-1-per-side count. If the real built-in is WEAKER than our
// forward pass, the original is slower still, so this comparison is conservative.
//
// The generic engine (all-different floor, component loader, fixpoint, DFS search)
// lives in ../_shared/recovery-lib.mjs. This file is the Skyscraper glue only.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { installGlobals, makeIo } from '../_shared/harness-lib.mjs'
import {
  makeCandidateState, makeAllDifferentFloor, loadComponents,
  runToFixpoint, search, countLost, reportLine
} from '../_shared/recovery-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'gen_6.json'
const gen = JSON.parse(readFileSync(join(HERE, file), 'utf8'))
const { n, box: [bh, bw], grid, clue, active } = gen
const activeSet = new Set(active)
const givens = gen.givens || {}

// A skyscraper line and clue both range over 1..n (you always see at least the
// first building, at most n). minDigit=1 also feeds the pair component's line run.
installGlobals(1, n)
globalThis.helpers.naming = { getCellsDescription: () => '', getCellName: () => '' }

// ---- geometry (mirrors build_size.py and the Hit Counts probe) ----
const W = n + 2
const idx = (r, c) => r * W + c
const interior = (r, c) => idx(r + 1, c + 1)

function lineCells (side, i) {
  const cells = []
  if (side === 'L') for (let c = 0; c < n; c++) cells.push(interior(i, c))
  if (side === 'R') for (let c = n - 1; c >= 0; c--) cells.push(interior(i, c))
  if (side === 'T') for (let r = 0; r < n; r++) cells.push(interior(r, i))
  if (side === 'B') for (let r = n - 1; r >= 0; r--) cells.push(interior(r, i))
  return cells
}
function clueCell (side, i) {
  if (side === 'L') return idx(i + 1, 0)
  if (side === 'R') return idx(i + 1, W - 1)
  if (side === 'T') return idx(0, i + 1)
  return idx(W - 1, i + 1)
}

const keys = []
for (let i = 0; i < n; i++) for (const s of ['L', 'R', 'T', 'B']) keys.push(s + i)
const groups = keys.map(k => {
  const side = k[0]; const i = +k.slice(1)
  return { key: k, cells: [clueCell(side, i), ...lineCells(side, i)] }
})

// ---- the shared candidate state ----
const RANGE = (lo, hi) => { const s = new Set(); for (let d = lo; d <= hi; d++) s.add(d); return s }
const st = makeCandidateState()

function freshState () {
  st.cand = new Map()
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const g = givens[`${r},${c}`]
      st.cand.set(interior(r, c), g != null ? new Set([g]) : RANGE(1, n))
    }
  }
  for (const k of keys) {
    const side = k[0]; const i = +k.slice(1)
    st.cand.set(clueCell(side, i), activeSet.has(k) ? new Set([clue[k]]) : RANGE(1, n))
  }
}

// ---- the two wirings ----
const { read, load } = makeIo(HERE)
const mainSrc = read('main.js')
const skyMod = load('SkyscraperComponent.js', ['setParams', 'update'])

// The built-in count constraint SudokuMaker ships: `value` appears exactly `count`
// times among `cells`. Modelled here so main.js can construct it.
const exactDigitCount = {
  setParams (inst, value, count, cells) { inst.value = value; inst.count = count; inst.cells = cells },
  * update (inst, puzzle) {
    const { value, count, cells } = inst
    const isVal = c => puzzle.hasValue(c) && puzzle.getValue(c) === value
    const pinned = cells.filter(isVal).length
    const canHave = cells.filter(c => puzzle.getCandidates(c).has(value))
    if (pinned === count) {
      for (const c of canHave) if (!isVal(c)) yield puzzle.removeCandidateFromCell(value, c)
    } else if (canHave.length === count) {
      for (const c of canHave) {
        const rm = [...puzzle.getCandidates(c)].filter(d => d !== value)
        if (rm.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rm), c)
      }
    }
  }
}

function buildOurs () {
  return loadComponents({
    here: HERE,
    mainSrc,
    input: { groups },
    files: [
      { file: 'SkyscraperComponent.js', names: ['setParams', 'update'], ctorName: 'SkyscraperComponent' },
      { file: 'SkyscraperPairComponent.js', names: ['setParams', 'update'], ctorName: 'SkyscraperPairComponent' }
    ],
    builtins: [{ ctorName: 'ExactDigitCountComponent', mod: exactDigitCount }]
  })
}

// The original: one gated per-line component per clued line. Nothing fires while
// the clue is blank; once pinned, our forward prune stands in for the built-in.
const gatedLine = {
  setParams: skyMod.setParams,
  * update (inst, puzzle) {
    if (!puzzle.hasValue(inst.clue)) return
    yield * skyMod.update(inst, puzzle)
  }
}
function buildOriginal () {
  return groups.map(g => {
    const inst = { name: g.key }
    gatedLine.setParams(inst, g.cells[0], g.cells.slice(1))
    inst.__mod = gatedLine
    return inst
  })
}

// ---- Régin (GAC) all-different floor over rows, columns, boxes ----
const floorGroup = makeAllDifferentFloor(st, { kind: 'regin', maxDigit: n })
const alldiffGroups = []
for (let r = 0; r < n; r++) alldiffGroups.push(Array.from({ length: n }, (_, c) => interior(r, c)))
for (let c = 0; c < n; c++) alldiffGroups.push(Array.from({ length: n }, (_, r) => interior(r, c)))
for (let br = 0; br < n; br += bh) {
  for (let bc = 0; bc < n; bc += bw) {
    const cells = []
    for (let dr = 0; dr < bh; dr++) for (let dc = 0; dc < bw; dc++) cells.push(interior(br + dr, bc + dc))
    alldiffGroups.push(cells)
  }
}

// ---- root recovery (cheap) + soundness ----
const hiddenKeys = keys.filter(k => !activeSet.has(k))
function visibleCount (line) {
  let cnt = 0; let max = 0
  for (const c of line) { const v = [...st.cand.get(c)][0]; if (v > max) { cnt++; max = v } }
  return cnt
}
function report (label, build) {
  freshState()
  const startTotal = st.total()
  const comps = build()
  const passes = runToFixpoint(st, comps, alldiffGroups, floorGroup, { init: true })
  const hiddenRecovered = hiddenKeys.filter(k => st.cand.get(groups.find(g => g.key === k).cells[0]).size === 1).length
  let interiorSolved = 0
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (st.cand.get(interior(r, c)).size === 1) interiorSolved++
  const truth = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) truth.push([interior(r, c), grid[r][c]])
  for (const k of keys) truth.push([groups.find(g => g.key === k).cells[0], clue[k]])
  const lost = countLost(st, truth)
  const removed = startTotal - st.total()
  console.log(reportLine(label, { extra: `hidden ${hiddenRecovered}/${hiddenKeys.length}, interior ${interiorSolved}/${n * n}, `, removed, passes, lost }))
  return { hiddenRecovered, interiorSolved, removed, lost }
}

// ---- search: does deducing the blank clues cut backtracking? ----
// Branch over the interior AND every clue cell: the original can never DEDUCE a
// blank clue, so the only way it fills one is a guess. Ours deduces most of them
// during propagation, so it rarely has to branch a clue and prunes the interior
// with what it deduced. Fewer nodes = the interactive deduction paid off.
const INT = []
for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) INT.push(interior(r, c))
for (const k of keys) INT.push(groups.find(g => g.key === k).cells[0])

// A full assignment is a real solution only when every line's visible count equals
// its clue. update prunes toward this but does not reject a completed line itself.
function validLeaf () {
  for (const g of groups) {
    const clueId = g.cells[0]
    if (st.cand.get(clueId).size !== 1) return false
    if (visibleCount(g.cells.slice(1)) !== [...st.cand.get(clueId)][0]) return false
  }
  return true
}
// The original brute-forces the blank clues, so its tree is unbounded in
// practice. Cap the nodes so a hopeless run still returns; a capped original is
// itself the finding — it does not solve within the budget. --cap= overrides.
const NODE_CAP = +((process.argv.find(a => a.startsWith('--cap=')) || '').split('=')[1]) || 200000
function searchRun (build) {
  freshState()
  const comps = build()
  runToFixpoint(st, comps, alldiffGroups, floorGroup, { init: true })
  return search(st, { interior: INT, comps, alldiffGroups, floorGroup, validLeaf, nodeCap: NODE_CAP })
}

console.log(`${file}: n=${n}, box ${bh}x${bw}, ${active.length}/${keys.length} clues shown, ${hiddenKeys.length} blank, ${Object.keys(givens).length} interior givens`)

if (process.argv.includes('--search')) {
  const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1]
  const modes = [['original', buildOriginal], ['ours    ', buildOurs]].filter(([m]) => !only || m.trim() === only)
  const seen = {}
  for (const [label, build] of modes) {
    const t = Date.now()
    const r = searchRun(build)
    seen[label.trim()] = r
    const note = r.capped ? ' CAPPED' : (r.solutions === 1 ? '' : ` (solutions=${r.solutions}!)`)
    console.log(`  ${label}: ${r.nodes} search nodes, ${r.solutions} solution${r.solutions === 1 ? '' : 's'}, ${Date.now() - t}ms${note}`)
  }
  if (seen.original && seen.ours && !seen.ours.capped && seen.ours.nodes > 0) {
    const ratio = (seen.original.nodes / seen.ours.nodes).toFixed(0)
    const atLeast = seen.original.capped ? '>' : ''
    console.log(`  ours explores ${atLeast}${ratio}x fewer nodes than the original${seen.original.capped ? ' (original never finished within the cap)' : ''}`)
  }
} else {
  const original = report('original', buildOriginal)
  const ours = report('ours    ', buildOurs)
  console.log(`  DELTA ours over original: hidden +${ours.hiddenRecovered - original.hiddenRecovered}, interior +${ours.interiorSolved - original.interiorSolved}, removed +${ours.removed - original.removed}`)
  console.log('  (run with --search for solve-node counts)')
  if (ours.lost || original.lost) { console.log('  FAIL: a true value was removed'); process.exit(1) }
}
