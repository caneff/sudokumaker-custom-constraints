// Recovery/speed probe: is the interactive-outside Skyscraper constraint actually
// faster to SOLVE than the original wrapper, or only tighter on paper?
//
//   node examples/skyscraper/recovery-probe.mjs                 # gen_6x6.json, root recovery
//   node examples/skyscraper/recovery-probe.mjs gen.json
//   node examples/skyscraper/recovery-probe.mjs gen_6x6.json --search   # solve, count nodes
//
// It runs the ACTUAL components — the same main-global.js wiring SudokuMaker
// runs on the shipped (frame) board — over a generated puzzle's start state, on
// top of a Régin-strength (GAC) all-different floor over every row, column, and
// box. That floor is the honest baseline: any skyscraper deduction must earn its
// keep ON TOP of the all-different SudokuMaker already runs.
//
// TWO wirings, same start state:
//   - 'ours'     — main-global.js: one SkyscraperLineComponent per line, reading BOTH
//                  end clues and the line together (deduces blank clues).
//   - 'original' — the wrapper ChinStrap shipped: one per-line component that does
//                  NOTHING while its clue is blank, and once the clue is pinned
//                  runs the built-in forward skyscraper prune. No pair.
//
// MODELLING THE ORIGINAL. The real wrapper calls replaceComponent to swap in the
// built-in SkyscraperComponent once the clue is pinned; this engine does not model
// replaceComponent, and SudokuMaker's built-in is not in this repo. So we model the
// original line as a per-line component gated to fire only when the clue is
// pinned, which then runs the forward "keep only line candidates that reach k
// visible" prune the built-in does (`forwardPrune` below). This GIVES the
// original every per-line deduction for a KNOWN clue. The only differences left
// are the features under test: blank-clue deduction and two-clue coupling. If
// the real built-in is WEAKER than this forward pass,
// the original is slower still, so the comparison is conservative.
//
// The generic engine (all-different floor, component loader, fixpoint, DFS search)
// lives in ../_shared/recovery-lib.mjs, and the frame-probe skeleton (seeding,
// report, argv, DELTA/exit) in ../_shared/frame-probe.mjs. This file is the
// Skyscraper glue only: the original wiring and the visible-count leaf check.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { makeFrameProbe } from '../_shared/frame-probe.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

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
  for (let m = 0; m <= len; m++) C[len - 1].add(KEY(k, m))
  for (let i = len - 2; i >= 0; i--) {
    C[i] = new Set()
    for (let j = 0; j <= len; j++) {
      for (let m = 0; m <= len; m++) {
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
function buildOriginal ({ groups }) {
  return groups.map(g => {
    const inst = { name: g.key }
    gatedLine.setParams(inst, g.cells[0], g.cells.slice(1))
    inst.__mod = gatedLine
    return inst
  })
}

// A full assignment is a real solution only when every line's visible count equals
// its clue. update prunes toward this but does not reject a completed line itself.
function validLeaf ({ st, groups }) {
  const visibleCount = line => {
    let cnt = 0; let max = 0
    for (const c of line) { const v = [...st.cand.get(c)][0]; if (v > max) { cnt++; max = v } }
    return cnt
  }
  for (const g of groups) {
    const clueId = g.cells[0]
    if (st.cand.get(clueId).size !== 1) return false
    if (visibleCount(g.cells.slice(1)) !== [...st.cand.get(clueId)][0]) return false
  }
  return true
}

// A skyscraper line and clue both range over 1..n (you always see at least the
// first building, at most n).
makeFrameProbe({
  here: HERE,
  clueRange: n => [1, n],
  files: [
    { file: 'SkyscraperLineComponent.js', names: ['setParams', 'update'], ctorName: 'SkyscraperLineComponent' }
  ],
  blankWord: 'blank',
  // 'original' — the wrapper ChinStrap shipped (gatedLine above); 'ours' —
  // main-global.js, one SkyscraperLineComponent per line reading both end clues.
  modes: [
    { key: 'original', label: 'original', build: buildOriginal },
    { key: 'ours', label: 'ours    ' }
  ],
  deltas: [['ours over original:', 'original', 'ours']],
  afterReport: () => console.log('  (run with --search for solve-node counts)'),
  // Branch over the interior AND every clue cell: the original can never DEDUCE a
  // blank clue, so the only way it fills one is a guess. Ours deduces most of them
  // during propagation, so it rarely has to branch a clue and prunes the interior
  // with what it deduced. Fewer nodes = the interactive deduction paid off.
  branchClues: true,
  // The original brute-forces the blank clues, so its tree is unbounded in
  // practice. Cap the nodes so a hopeless run still returns; a capped original is
  // itself the finding — it does not solve within the budget. --cap= overrides.
  nodeCap: 200000,
  afterSearch: (p, seen) => {
    if (seen.original && seen.ours && !seen.ours.capped && seen.ours.nodes > 0) {
      const ratio = (seen.original.nodes / seen.ours.nodes).toFixed(0)
      const atLeast = seen.original.capped ? '>' : ''
      console.log(`  ours explores ${atLeast}${ratio}x fewer nodes than the original${seen.original.capped ? ' (original never finished within the cap)' : ''}`)
    }
  },
  validLeaf
})
