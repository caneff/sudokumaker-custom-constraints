// Frame-probe skeleton shared by the recovery probes (Hit Counts, Skyscraper):
// load a generated puzzle onto the frame board, seed the candidate state, run
// each wiring ("mode") to a fixpoint over the all-different floor, and print
// either the root-recovery report with its DELTA lines or the search node
// counts. Each probe supplies what differs: its component files, its modes
// (an extra propagator, or a hand-built wiring), and its leaf check.
//
//   node <probe> [gen.json] [--search [--only=<mode key>] [--cap=N]] [--floor=regin|singles]
//
// Every probe callback receives the probe context `p`: { file, gen, n, st,
// floorKind, floorGroup, W, H, idx, interior, clueCell, keys, groups,
// alldiffGroups, hiddenKeys }.

import { readFileSync } from 'fs'
import { join } from 'path'
import { installGlobals, makeIo } from './harness-lib.mjs'
import {
  makeCandidateState, makeAllDifferentFloor, loadComponents,
  runToFixpoint, search, countLost, reportLine
} from './recovery-lib.mjs'
import { frameGeometry } from './frame-geometry.mjs'

const flag = (argv, name) => (argv.find(a => a.startsWith(`--${name}=`)) || '').split('=')[1]
const RANGE = (lo, hi) => { const s = new Set(); for (let d = lo; d <= hi; d++) s.add(d); return s }

// here: the probe's directory (gen JSON, main-global.js, component files).
// clueRange: n => [lo, hi], the clue cells' digit range; also the digit range
//   installGlobals hands the components.
// files: loadComponents' component list, wired by main-global.js.
// modes: [{ key, label, build?, extra?, search? }] in report order. `build(p)`
//   returns the comps (default: the main-global.js wiring); `extra(p)` is a
//   propagator run after the floor each pass; `search: false` leaves the mode
//   out of --search. `--only=<key>` picks one search mode.
// deltas: [[title, fromKey, toKey]] — one DELTA line each, `to - from`.
// blankWord: the header's word for clues not shown ('hidden', 'blank').
// headerNote(p), beforeReport(p), afterReport(p), afterSearch(p, byKey):
//   optional extra output at those points; beforeReport sees the fresh start
//   state, which it may prune (every report run reseeds).
// branchClues: search also branches over the clue cells.
// nodeCap: the search's default node cap; --cap= overrides.
// validLeaf(p): true when a full assignment is a real solution.
export function makeFrameProbe ({
  here, clueRange, files, modes, deltas, blankWord, validLeaf,
  headerNote = () => '', beforeReport = () => {}, afterReport = () => {}, afterSearch = () => {},
  branchClues = false, nodeCap, argv = process.argv.slice(2)
}) {
  const file = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'gen_6x6.json'
  const gen = JSON.parse(readFileSync(join(here, file), 'utf8'))
  const { n, box: [bh, bw], grid, clue, active } = gen
  const activeSet = new Set(active)
  const givens = gen.givens || {}
  const [clueLo, clueHi] = clueRange(n)

  installGlobals(clueLo, n)
  globalThis.helpers.naming = { getCellsDescription: () => '', getCellName: () => '' }

  const geometry = frameGeometry(n, [bh, bw])
  const { W, H, idx, interior, clueCell, keys, alldiffGroups } = geometry
  // The all-different groups are the board's houses: the line components gate
  // on them through getCellsCanHaveRepeats (docs/line-contract.md).
  const st = makeCandidateState({ houses: alldiffGroups })
  const floorKind = flag(argv, 'floor') || 'regin'
  const floorGroup = makeAllDifferentFloor(st, { kind: floorKind, maxDigit: n })
  const hiddenKeys = keys.filter(k => !activeSet.has(k))
  const p = { file, gen, n, st, floorKind, floorGroup, hiddenKeys, ...geometry }

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
      st.cand.set(clueCell(side, i), activeSet.has(k) ? new Set([clue[k]]) : RANGE(clueLo, clueHi))
    }
  }

  // main-global.js builds the frame itself (no groups input), so it needs the
  // puzzle mock's getCellAt/spec.size -- `frame: { W, H, idx }` ties those
  // to the same W/idx this probe already uses, so main-global.js's own
  // frame-building produces the identical `groups` list frameGeometry gives.
  const mainSrc = makeIo(here).read('main-global.js')
  const buildMain = () => loadComponents({ here, mainSrc, input: {}, frame: { W, H, idx }, files })
  const comps = mode => (mode.build ? mode.build(p) : buildMain())
  const extraOf = mode => (mode.extra ? () => mode.extra(p) : null)

  function report (mode) {
    freshState()
    const start = st.total()
    const passes = runToFixpoint(st, comps(mode), alldiffGroups, floorGroup, { init: true, extra: extraOf(mode) })
    const hiddenRecovered = hiddenKeys.filter(k => st.cand.get(clueCell(k[0], +k.slice(1))).size === 1).length
    let interiorSolved = 0
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (st.cand.get(interior(r, c)).size === 1) interiorSolved++
    // soundness: every true value must survive
    const truth = []
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) truth.push([interior(r, c), grid[r][c]])
    for (const k of keys) truth.push([clueCell(k[0], +k.slice(1)), clue[k]])
    const lost = countLost(st, truth)
    const removed = start - st.total()
    console.log(reportLine(mode.label, { extra: `hidden ${hiddenRecovered}/${hiddenKeys.length}, interior ${interiorSolved}/${n * n}, `, removed, passes, lost }))
    return { hiddenRecovered, interiorSolved, removed, lost }
  }

  const branch = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) branch.push(interior(r, c))
  if (branchClues) for (const k of keys) branch.push(clueCell(k[0], +k.slice(1)))
  const cap = +flag(argv, 'cap') || nodeCap
  function searchRun (mode) {
    freshState()
    const built = comps(mode)
    const extra = extraOf(mode)
    runToFixpoint(st, built, alldiffGroups, floorGroup, { init: true, extra })
    return search(st, { interior: branch, comps: built, alldiffGroups, floorGroup, extra, validLeaf: () => validLeaf(p), nodeCap: cap })
  }

  console.log(`${file}: n=${n}, box ${bh}x${bw}, ${active.length}/${keys.length} clues shown, ${hiddenKeys.length} ${blankWord}, ${Object.keys(givens).length} interior givens${headerNote(p)}`)

  if (argv.includes('--search')) {
    const only = flag(argv, 'only')
    const byKey = {}
    for (const mode of modes.filter(m => m.search !== false && (!only || m.key === only))) {
      const r = byKey[mode.key] = searchRun(mode)
      const note = r.capped ? ' CAPPED' : (r.solutions === 1 ? '' : ` (solutions=${r.solutions}!)`)
      console.log(`  ${mode.label}: ${r.nodes} search nodes, ${r.solutions} solution${r.solutions === 1 ? '' : 's'}${note}`)
    }
    afterSearch(p, byKey)
  } else {
    freshState()
    beforeReport(p)
    const byKey = {}
    for (const mode of modes) byKey[mode.key] = report(mode)
    for (const [title, from, to] of deltas) {
      const a = byKey[from]; const b = byKey[to]
      console.log(`  DELTA ${title} hidden +${b.hiddenRecovered - a.hiddenRecovered}, interior +${b.interiorSolved - a.interiorSolved}, removed +${b.removed - a.removed}`)
    }
    afterReport(p)
    if (Object.values(byKey).some(r => r.lost)) { console.log('  FAIL: a true value was removed'); process.exit(1) }
  }
}
