// Every backend must coerce the cell ids it gets from the app to plain
// integers before it registers a component (#276), and a global one must build
// the frame it says it builds: the 4n lines of the shared frameGeometry, and a
// side label that names the side its clues actually sit on (#295).
//
// Both lanes run here (docs/line-contract.md). The GLOBAL lane is
// main-global.js with no `input`: it derives every cell id from the board size,
// so it gets the frame checks as well. The LOCAL lane is main.js with
// `input.groups` supplied in the shape framebuild.frame_groups ships --
// `{ cells: [clueCell, ...line], value: '' }` -- and it gets the id checks
// alone: a drawn board is whatever its author drew, and the shapes below are
// two of the things an author can legitimately draw that a frame never is.
//
//   node examples/_shared/global-backends.test.mjs
//
// Why this matters. A drawn group carries its cell ids straight from the
// puzzle JSON; a global backend derives them from the board size, either
// through `puzzle.getCellAt` or by its own arithmetic on
// `puzzle.spec.size.width`. Both derived forms are numerically equal to the
// JSON ones and both compare `===` to them, but the app's solver runs about
// 1.3x slower on them (measured: examples/numbered-rooms/README.md, "The lane
// swap"). Coercing each id with `| 0` closes the whole gap. Rebuilding the
// arrays without coercing the values does not, so the cost travels with the
// value, not the array.
//
// This test cannot reproduce that cost -- it is a property of the JS engine's
// numeric representation, invisible from inside JS and absent in Node's mock.
// What it locks down is the coercion itself, so the `| 0` is not read as noise
// and deleted. The timing rows in each example's README are the evidence.
//
// The mock hands back a boxed `new Number(id)`: numerically the right cell,
// but not a plain number. A backend that coerces turns it back into one; a
// backend that passes it through is caught here.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, readdirSync } from 'fs'
import assert from 'assert'
import { frameGeometry } from './frame-geometry.mjs'
import { runBackend } from './backend-runner.mjs'
import { assembleSource } from './include.mjs'

const EXAMPLES = join(dirname(fileURLToPath(import.meta.url)), '..')

// A board W cells wide and H cells tall. Cell id = col + row * W, the app's
// own layout (`getIdFromCoords(e){return e.x+e.y*this.width}` in the shipped
// bundle), so `getCellAt(a, b)` is `a + b * W`. Off the board it returns
// undefined, as `getIdFromCoordsSafe` does -- and it counts those calls,
// because the coercion cannot report them: `undefined | 0` is 0, an in-range
// cell. So the backend's "every coordinate is in range" is checked here, not
// assumed. The column bound is the width and the row bound is the height, so a
// backend that reads one dimension twice walks off a rectangular board.
function mockPuzzle (W, H) {
  const registered = []
  const p = {
    registered,
    offBoard: 0,
    spec: { size: { width: W, height: H } },
    getCellAt: (a, b) => {
      if (a < 0 || b < 0 || a >= W || b >= H) { p.offBoard++; return undefined }
      return new Number(a + b * W) // eslint-disable-line no-new-wrappers -- the point of the test
    },
    getRow: c => Math.floor(c / W),
    getColumn: c => c % W,
    addConstraintComponent: comp => registered.push(comp)
  }
  return p
}

const helpers = {
  naming: {
    getCellsDescription: cells => cells.join(','),
    getCellName: cell => String(cell)
  }
}

// Walk everything a component was constructed with and report any cell id that
// is not a plain number, and any that is off the board. The second check is
// what keeps the coercion honest: `getCellAt` returns undefined off the board
// and `undefined | 0` is 0 -- a real cell -- so a backend that strayed
// off-grid would coerce a miss into a silent, wrong cell 0 rather than fail
// loud (CODING_STANDARDS.md).
function badIdsIn (value, cells, path = '') {
  if (Array.isArray(value)) return value.flatMap((v, i) => badIdsIn(v, cells, `${path}[${i}]`))
  if (value instanceof Number) return [`${path}: boxed, not coerced`]
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value < cells ? [] : [`${path}: off the board (${value})`]
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => badIdsIn(v, cells, `${path}.${k}`))
  }
  return []
}

const SIDES = ['L', 'R', 'T', 'B']
const LABELS = { left: 'L', right: 'R', top: 'T', bottom: 'B' }

// The side a component's name claims, or null when it names no side. Backends
// that name a component after its cells ("12,13,14") claim nothing.
function labelledSide (name) {
  const word = /\b(left|right|top|bottom)\b/i.exec(name)
  if (word) return LABELS[word[1].toLowerCase()]
  const letter = /\bside ([LRTB])\b/.exec(name)
  return letter ? letter[1] : null
}

// Every array of in-range cell ids reachable from a component's arguments
// whose length is one of the frame's group lengths. A bare number argument is
// not a cell group: a component takes a length or a digit that way, and a
// length is indistinguishable from a cell id. On a rectangular board a line
// across the board and a line down it have different lengths, so `lengths`
// holds both.
function cellGroupsIn (value, cells, lengths) {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) {
    const ids = value.every(v => Number.isInteger(v) && v >= 0 && v < cells)
    if (ids && lengths.has(value.length)) return [value]
    return value.flatMap(v => cellGroupsIn(v, cells, lengths))
  }
  return Object.values(value).flatMap(v => cellGroupsIn(v, cells, lengths))
}

// Every in-range cell id reachable from a component's arguments as a bare
// number that is one of the frame's ring cells. A pair component takes its two
// clues that way, one argument each, not as a group.
function ringIdsIn (value, ringCells) {
  if (typeof value === 'number') return ringCells.has(value) ? [value] : []
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(v => ringIdsIn(v, ringCells))
}

const dirs = readdirSync(EXAMPLES, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name !== '_shared')
  .map(d => d.name)
  .filter(name => existsSync(join(EXAMPLES, name, 'main-global.js')))
  .sort()

assert.ok(dirs.length > 0, 'found no global backends to check')

// Run one backend against a board W wide and H tall, and check the frame it
// builds against the one truthful copy of the geometry.
//
// `groups` switches lanes: null runs the global backend with no `input` at all
// and checks the whole frame; an array runs a local backend on those drawn
// groups and checks the cell ids alone. `file` and `note` only name the run in
// an assertion message.
function checkBackend (name, src, W, H, { groups = null, file = 'main-global.js', note = '' } = {}) {
  const p = mockPuzzle(W, H)
  // The app runs a backend segment as a bare script with `input` in scope;
  // backend-runner.mjs is that setup, shared with the frame backends' own tests.
  runBackend(src, { puzzle: p, helpers, input: groups ? { groups } : undefined })

  const where = `${name}/${file} on ${W}x${H}${note}`
  assert.ok(p.registered.length > 0, `${where}: registered nothing`)
  assert.strictEqual(p.offBoard, 0,
    `${where} asked for a cell off the board; \`| 0\` would turn that miss into cell 0`)
  const cells = W * H
  const bad = p.registered.flatMap((c, i) => badIdsIn(c.args, cells, `${name} component ${i} arg`))
  assert.deepStrictEqual(bad.slice(0, 5), [],
    `${where} must hand components plain in-range integer cell ids (${bad.length} bad)`)

  // The two checks below describe a WHOLE FRAME -- all 4n lines, and a ring
  // cell per row and column. A drawn board owes neither: it ships the groups
  // its author drew and nothing else.
  if (groups) return

  // Every cell group a backend hands a component is either a line (all
  // interior) or a side's clues (all ring), so the two are told apart by their
  // cells, not by the component's argument order -- which differs per example.
  const nw = W - 2
  const nh = H - 2
  const geom = frameGeometry(nw, [3, 3], nh)
  const ring = new Map()
  for (const side of SIDES) {
    const count = side === 'L' || side === 'R' ? nh : nw
    ring.set(side, Array.from({ length: count }, (_, i) => geom.clueCell(side, i)))
  }
  const ringCells = new Set([...ring.values()].flat())
  const lengths = new Set([nw, nh])
  const registeredGroups = p.registered.flatMap(c => cellGroupsIn(c.args, cells, lengths))

  // 1. The line set: every line the backend registers is a frame line, and it
  // registers all nw + nh of them. A square frame is symmetric under
  // transpose, so on a square board this set is the same whichever way round
  // the coordinates are read and it pins the frame, not the reading (#295). A
  // rectangular board breaks that symmetry: a backend that reads one dimension
  // twice builds the wrong lines and this check catches it on its own (#299).
  // The off-board count above usually reports the same backend first, since
  // reading one dimension twice also walks off the short side.
  //
  // Lines are compared UNDIRECTED -- each one canonicalized to the smaller of
  // its two readings. `frameGeometry` states each line twice, once read inward
  // from each of its two clues, and a backend owes the line, not both readings
  // of it: a component that reads both end clues at once takes one line per
  // pair (#404). A reading that is not one of the two the geometry states
  // still fails here, since neither of its orientations canonicalizes to a
  // frame line.
  const undirected = g => {
    const fwd = g.join(',')
    const rev = [...g].reverse().join(',')
    return fwd < rev ? fwd : rev
  }
  const lines = registeredGroups.filter(g => g.every(id => !ringCells.has(id)))
  assert.deepStrictEqual(
    [...new Set(lines.map(undirected))].sort(),
    [...new Set(geom.groups.map(g => undirected(g.cells.slice(1))))].sort(),
    `${where} must register the frame lines of frameGeometry`)

  // 1b. Coverage, clue by clue. Comparing lines undirected is what lets a
  // both-ends component register one line per pair, and on its own it would
  // stop seeing whether every CLUE got a component: a backend registering one
  // component per clue could drop half the frame's clues and still register
  // the whole line set (#404). So every one of the 4n (clue, line) pairs the
  // geometry states must be covered by some single component that was handed
  // that clue AND that line -- which a both-ends component does for two pairs
  // at once, and a one-clue component for one.
  const covered = new Set()
  for (const c of p.registered) {
    const own = cellGroupsIn(c.args, cells, lengths).filter(g => g.every(id => !ringCells.has(id)))
    for (const clue of new Set(ringIdsIn(c.args, ringCells))) {
      for (const g of own) covered.add(`${clue}:${undirected(g)}`)
    }
  }
  const uncovered = geom.groups
    .filter(g => !covered.has(`${g.cells[0]}:${undirected(g.cells.slice(1))}`))
    .map(g => g.cells[0])
  assert.deepStrictEqual(uncovered.slice(0, 5), [],
    `${where} leaves ${uncovered.length} of ${geom.groups.length} frame clues with no component holding both that clue and its line`)

  // 2. The labels: a component named for a side holds that side's clues. This
  // is the check that pins the reading on a square board, since a transposed
  // `getCellAt` puts the top ring under the name "left" (#295). It reaches only
  // a backend that names a side -- where every component is named after its own
  // cells, a transposed frame carries the same names and nothing here can see
  // it.
  for (const c of p.registered) {
    const side = typeof c.args[0] === 'string' ? labelledSide(c.args[0]) : null
    if (!side) continue
    const clues = cellGroupsIn(c.args, cells, lengths).filter(g => g.every(id => ringCells.has(id)))
    for (const g of clues) {
      assert.deepStrictEqual([...g].sort((a, b) => a - b), ring.get(side),
        `${where}: "${c.args[0]}" does not hold side ${side}'s clue cells`)
    }
  }

  // 3. The pairs: a component given ONE line and TWO clue cells is a pair
  // component, and its two clues must be the ones at the two ends of THAT
  // line. Nothing above sees this -- a backend that pairs every clue with some
  // other clue's opposite still registers the right line set and the right
  // side labels, and the puzzle it builds is a different puzzle.
  const clueOfLine = new Map(geom.groups.map(g => [g.cells.slice(1).join(','), g.cells[0]]))
  for (const c of p.registered) {
    const ownLines = cellGroupsIn(c.args, cells, lengths).filter(g => g.every(id => !ringCells.has(id)))
    const ownClues = [...new Set(ringIdsIn(c.args, ringCells))]
    if (ownLines.length !== 1 || ownClues.length !== 2) continue
    const line = ownLines[0]
    const ends = [clueOfLine.get(line.join(',')), clueOfLine.get([...line].reverse().join(','))]
    assert.deepStrictEqual([...ownClues].sort((a, b) => a - b), ends.sort((a, b) => a - b),
      `${where}: "${c.args[0]}" pairs clues that are not the two ends of the line it was given`)
  }
}

// 11x11 is the shipped board size. 11x8 is the same width with a shorter
// board: it ships in no example, and it is here to give the line-set check an
// asymmetric frame to bite on.
const BOARDS = [[11, 11], [11, 8]]

for (const name of dirs) {
  const src = assembleSource(join(EXAMPLES, name, 'main-global.js'))
  for (const [W, H] of BOARDS) checkBackend(name, src, W, H)
}

// ---- the local lane
//
// An example has a local lane exactly when it has both paste targets: main.js
// reading the author's drawn groups and main-global.js building the frame
// itself (docs/example-layout.md). `dirs` is already that list. fillomino and
// isofill have no main-global.js and so appear in neither -- each is a
// whole-grid constraint with no outside frame at all, and its lone main.js
// builds its cell list from the board size rather than from drawn groups.
for (const name of dirs) {
  assert.ok(existsSync(join(EXAMPLES, name, 'main.js')),
    `${name} has a main-global.js and must have the main.js that is its other lane`)
  // The assembled text, like every other read of a paste target here: a body
  // delivered through an `// #include` is still the lane's body.
  assert.ok(assembleSource(join(EXAMPLES, name, 'main.js')).includes('input.groups'),
    `${name}/main.js is the local lane and must read the drawn groups`)
}

// A drawn group as framebuild.frame_groups ships it: the clue's ring cell,
// then that line's cells inward, and the empty value the app stores on a group
// the author has not typed into.
const drawn = cells => ({ cells, value: '' })

// The three drawn shapes. The frame is what every example's own local board
// ships; the other two are shapes a frame never has and an author can still
// draw, so a backend that quietly assumes a frame is caught here.
//
//  - LONE CLUE: one line clued at ONE end. A frame clues both, and a backend
//    that pairs ends must still do something sane with a single one -- the
//    author may be halfway through drawing the other.
//  - BENT PATH: an L, `a` cells straight in from the clue then a turn and
//    n - a across, n in all. That is the shape framebuild.make_paths generates
//    and the local boards of the bare-line examples ship. A bent path spans more
//    than one row and more than one column, so it is not a house and the line
//    kind checks in a component must not assume one (docs/line-contract.md).
function localCases (W, H) {
  const nw = W - 2
  const nh = H - 2
  const geom = frameGeometry(nw, [3, 3], nh)
  const frame = geom.groups.map(g => drawn(g.cells))

  // The bent path leaves the L0 clue: `a` cells along interior row 0, then a
  // turn down that column for the remaining nw - a. `a` is the shortest first
  // leg whose second leg still fits the board's height, and never under 2 --
  // the range make_paths draws from -- so both legs stay non-empty and the
  // path really does span more than one row and more than one column.
  const a = Math.max(2, nw - nh + 1)
  const straight = Array.from({ length: a }, (_, c) => geom.interior(0, c))
  const across = Array.from({ length: nw - a }, (_, k) => geom.interior(k + 1, a - 1))
  const bent = [geom.clueCell('L', 0), ...straight, ...across]
  assert.strictEqual(bent.length, nw + 1, 'the bent path must hold as many cells as a straight one')
  assert.ok(nw - a <= nh - 1, 'the bent path\'s second leg must fit the board')

  return [
    { note: ', drawn frame', groups: frame },
    { note: ', lone clue', groups: [frame[0]] },
    // Only the bent path may be refused, and only by BENT_REFUSER: a rule can
    // genuinely need a straight line. A drawn frame and a lone clue are shapes
    // every local lane owes an answer to, so a throw there is a failure.
    { note: ', bent path', groups: [drawn(bent)], bentPath: true }
  ]
}

// The one local lane allowed to refuse a bent path, and the refusal it must
// give: outside-sudoku's window is a box's extent along the line's DIRECTION,
// which a bent path has none of, so its main.js throws rather than size a
// window from nothing. Named, not a blanket allowance -- a TypeError out of
// any other main.js is a real crash in a shipped lane, and must fail here.
const BENT_REFUSER = 'outside-sudoku'
const BENT_REFUSAL = /is not one row or column/

let localRuns = 0
let localRefusals = 0
for (const name of dirs) {
  const src = assembleSource(join(EXAMPLES, name, 'main.js'))
  for (const [W, H] of BOARDS) {
    for (const { note, groups, bentPath } of localCases(W, H)) {
      try {
        checkBackend(name, src, W, H, { groups, file: 'main.js', note })
        localRuns++
      } catch (e) {
        // Anywhere else, on any other shape, and for an assertion from the
        // checks above, the throw IS the failure.
        if (!bentPath || name !== BENT_REFUSER || e instanceof assert.AssertionError) throw e
        assert.match(e.message, BENT_REFUSAL,
          `${name}/main.js may refuse a bent path, but only by saying so: ${e.message}`)
        localRefusals++
      }
    }
  }
}

console.log(`PASS (${dirs.length} global backends, ${dirs.length} local backends, ${localRuns} local runs, ${localRefusals} bent-path refusals, ${BOARDS.length} board shapes)`)
