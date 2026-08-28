// Recovery/speed probe: is the interactive-outside Skyscraper constraint actually
// faster to SOLVE than the original wrapper, or only tighter on paper?
//
//   node examples/skyscraper/recovery-probe.mjs                 # gen_6x6.json, root recovery
//   node examples/skyscraper/recovery-probe.mjs gen_9x9.json
//   node examples/skyscraper/recovery-probe.mjs gen_6x6.json --search   # solve, count nodes
//
// It runs the ACTUAL components — the same main.js wiring SudokuMaker runs — over a
// generated puzzle's start state, on top of a Régin-strength (GAC) all-different
// floor over every row, column, and box. That floor is the honest baseline: any
// skyscraper deduction must earn its keep ON TOP of the all-different SudokuMaker
// already runs.
//
// TWO wirings, same start state:
//   - 'ours'     — main.js: one SkyscraperLineComponent per line, reading BOTH
//                  end clues and the line together (deduces blank clues), and
//                  one ExactDigitCountComponent per side (one 1 per side).
//   - 'original' — the wrapper ChinStrap shipped: one per-line component that does
//                  NOTHING while its clue is blank, and once the clue is pinned
//                  runs the built-in forward skyscraper prune. No pair, no side
//                  count.
//
// MODELLING THE ORIGINAL. The real wrapper calls replaceComponent to swap in the
// built-in SkyscraperComponent once the clue is pinned; this engine does not model
// replaceComponent, and SudokuMaker's built-in is not in this repo. So we model the
// original line as a per-line component gated to fire only when the clue is
// pinned, which then runs the forward "keep only line candidates that reach k
// visible" prune the built-in does (`forwardPrune` below). This GIVES the
// original every per-line deduction for a KNOWN clue. The only differences left
// are the features under test: blank-clue deduction, two-clue coupling, and the
// one-1-per-side count. If the real built-in is WEAKER than this forward pass,
// the original is slower still, so the comparison is conservative.
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
import { frameGeometry } from '../_shared/frame-geometry.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'gen_6x6.json'
const gen = JSON.parse(readFileSync(join(HERE, file), 'utf8'))
const { n, box: [bh, bw], grid, clue, active } = gen
const activeSet = new Set(active)
const givens = gen.givens || {}

// A skyscraper line and clue both range over 1..n (you always see at least the
// first building, at most n).
installGlobals(1, n)
globalThis.helpers.naming = { getCellsDescription: () => '', getCellName: () => '' }

// ---- geometry (mirrors build_size.py and the Hit Counts probe) ----
const { interior, clueCell, keys, groups, alldiffGroups } = frameGeometry(n, [bh, bw])

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
const { read } = makeIo(HERE)
const mainSrc = read('main.js')

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
      { file: 'SkyscraperLineComponent.js', names: ['setParams', 'update'], ctorName: 'SkyscraperLineComponent' }
    ],
    builtins: [{ ctorName: 'ExactDigitCountComponent', mod: exactDigitCount }]
  })
}

// The built-in forward prune for a KNOWN clue k: the digits to drop from each
// line cell, keeping only candidates on some path whose visible count is k.
// State (j, m) = buildings visible so far, tallest so far; F[i] reaches forward,
// C[i] holds the states after cell i from which the suffix can still finish at
// k. Distinctness is ignored, so the sets only grow: the prune is sound.
const KEY = (j, m) => j * 32 + m
function forwardPrune (puzzle, line, k) {
  const len = line.length
  const cands = line.map(c => [...puzzle.getCandidates(c)])
  const F = []
  let cur = new Set([KEY(0, 0)])
  for (let i = 0; i < len; i++) {
    const next = new Set()
    for (const key of cur) {
      const j = (key / 32) | 0; const m = key % 32
      for (const d of cands[i]) { if (d > m) next.add(KEY(j + 1, d)); else if (d < m) next.add(key) }
    }
    F.push(next); cur = next
  }
  // k unreachable: leave the line alone, as the built-in does; the solver finds
  // the contradiction at the leaf.
  if (![...cur].some(key => ((key / 32) | 0) === k)) return line.map(() => [])
  const C = new Array(len)
  C[len - 1] = new Set()
  for (let m = 0; m <= n; m++) C[len - 1].add(KEY(k, m))
  for (let i = len - 2; i >= 0; i--) {
    C[i] = new Set()
    for (let j = 0; j <= len; j++) {
      for (let m = 0; m <= n; m++) {
        for (const d of cands[i + 1]) {
          if (d > m) { if (C[i + 1].has(KEY(j + 1, d))) { C[i].add(KEY(j, m)); break } } else if (d < m) { if (C[i + 1].has(KEY(j, m))) { C[i].add(KEY(j, m)); break } }
        }
      }
    }
  }
  const bad = []
  for (let i = 0; i < len; i++) {
    const prev = i === 0 ? new Set([KEY(0, 0)]) : F[i - 1]
    bad.push(cands[i].filter(d => {
      for (const key of prev) {
        const j = (key / 32) | 0; const m = key % 32
        if (d > m) { if (C[i].has(KEY(j + 1, d))) return false } else if (d < m) { if (C[i].has(KEY(j, m))) return false }
      }
      return true
    }))
  }
  return bad
}
// The original: one gated per-line component per clued line. Nothing fires while
// the clue is blank; once pinned, the forward prune stands in for the built-in.
const gatedLine = {
  setParams (inst, clue, line) { inst.clue = clue; inst.line = line },
  * update (inst, puzzle) {
    if (!puzzle.hasValue(inst.clue)) return
    const bad = forwardPrune(puzzle, inst.line, puzzle.getValue(inst.clue))
    for (let i = 0; i < inst.line.length; i++) if (bad[i].length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad[i]), inst.line[i])
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
    const r = searchRun(build)
    seen[label.trim()] = r
    const note = r.capped ? ' CAPPED' : (r.solutions === 1 ? '' : ` (solutions=${r.solutions}!)`)
    console.log(`  ${label}: ${r.nodes} search nodes, ${r.solutions} solution${r.solutions === 1 ? '' : 's'}${note}`)
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
