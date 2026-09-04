// Build the 2x2-overlap FULL-RING variant from board_out.json: red down 1,
// green up 1, purple right 1, blue left 1 (every neighbor pair shares a 2x2),
// all four clue families on full 24-line rings (provably infeasible — kept
// for hand-editing clue subsets). Writes board_2x2_full.json + link.
const LZ = require('./node_modules/lz-string')
const fs = require('fs')

const W = 20
const OLD = { Red: [2, 7], Blue: [7, 12], Purple: [7, 2], Green: [12, 7] }
const NEW = { Red: [3, 7], Blue: [7, 11], Purple: [7, 3], Green: [11, 7] }
const DELTA = {}
for (const k in OLD) DELTA[k] = [NEW[k][0] - OLD[k][0], NEW[k][1] - OLD[k][1]] // [dy,dx]

const doc = JSON.parse(fs.readFileSync('board_out.json', 'utf8'))
const p = doc.puzzle
p.name = 'Touch grass (2x2, full rings)'

// --- cells: empty = grids ∪ rings, else given 1 -------------------------
const empty = new Set()
for (const [r0, c0] of Object.values(NEW)) {
  for (let r = r0; r < r0 + 6; r++) for (let c = c0; c < c0 + 6; c++) empty.add(r * W + c)
  for (let k = 0; k < 6; k++) {
    empty.add((r0 + k) * W + c0 - 1)
    empty.add((r0 + k) * W + c0 + 6)
    empty.add((r0 - 1) * W + c0 + k)
    empty.add((r0 + 6) * W + c0 + k)
  }
}
p.cells = Array.from({ length: 400 }, (_, i) => empty.has(i) ? {} : { given: true, value: 1 })

// --- house components ---------------------------------------------------
const R6 = [0, 1, 2, 3, 4, 5]
const cellId = (r, c) => r * W + c
function houseGroups (kind, [r0, c0]) {
  const gs = []
  if (kind === 'Regions') {
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 2; bc++) {
        const cells = []
        for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) cells.push(cellId(r0 + br * 2 + r, c0 + bc * 3 + c))
        gs.push({ cells, value: '' })
      }
    }
  } else if (kind === 'Columns') {
    for (const c of R6) gs.push({ cells: R6.map(r => cellId(r0 + r, c0 + c)), value: '' })
  } else {
    for (const r of R6) gs.push({ cells: R6.map(c => cellId(r0 + r, c0 + c)), value: '' })
  }
  return gs
}
function fullGroups ([r0, c0]) {
  const gs = []
  for (const r of R6.map(k => r0 + k)) {
    gs.push({ cells: [cellId(r, c0 - 1), ...R6.map(j => cellId(r, c0 + j))], value: '' })
    gs.push({ cells: [cellId(r, c0 + 6), ...R6.map(j => cellId(r, c0 + 5 - j))], value: '' })
  }
  for (const c of R6.map(k => c0 + k)) {
    gs.push({ cells: [cellId(r0 - 1, c), ...R6.map(j => cellId(r0 + j, c))], value: '' })
    gs.push({ cells: [cellId(r0 + 6, c), ...R6.map(j => cellId(r0 + 5 - j, c))], value: '' })
  }
  return gs
}
function windowGroups ([r0, c0]) {
  const gs = []
  for (const r of R6.map(k => r0 + k)) {
    gs.push({ cells: [cellId(r, c0 - 1), cellId(r, c0), cellId(r, c0 + 1), cellId(r, c0 + 2)], value: '' })
    gs.push({ cells: [cellId(r, c0 + 6), cellId(r, c0 + 5), cellId(r, c0 + 4), cellId(r, c0 + 3)], value: '' })
  }
  for (const c of R6.map(k => c0 + k)) {
    gs.push({ cells: [cellId(r0 - 1, c), cellId(r0, c), cellId(r0 + 1, c), cellId(r0 + 2, c)], value: '' })
    gs.push({ cells: [cellId(r0 + 6, c), cellId(r0 + 5, c), cellId(r0 + 4, c), cellId(r0 + 3, c)], value: '' })
  }
  return gs
}
for (const c of p.constraints) {
  const m = (c.name || '').match(/^(Regions|Columns|Rows) \((Red|Blue|Purple|Green)\)$/)
  if (m) { c.input.groups = houseGroups(m[1], NEW[m[2]]); continue }
  if (c.name === 'Numbered Rooms (Blue)') c.input.groups = fullGroups(NEW.Blue)
  if (c.name === 'Skyscrapers (Red)') c.input.groups = fullGroups(NEW.Red)
  if (c.name === 'Running Start (Purple)') c.input.groups = fullGroups(NEW.Purple)
  if (c.name === 'Outside Sudoku (Green)') c.input.groups = windowGroups(NEW.Green)
}

// --- message patch grid table -------------------------------------------
const patch = p.constraints.find(c => c.name === 'Named messages (patch)')
const oldTable = "[['Red', 2, 7], ['Blue', 7, 12], ['Purple', 7, 2], ['Green', 12, 7]]"
const newTable = "[['Red', 3, 7], ['Blue', 7, 11], ['Purple', 7, 3], ['Green', 11, 7]]"
if (!patch.definition.backend.code.includes(oldTable)) throw new Error('patch table anchor missing')
patch.definition.backend.code = patch.definition.backend.code.replace(oldTable, newTable)

// --- per-color cosmetics shift ------------------------------------------
const shiftLines = (lines, [dy, dx]) => lines.map(line => line.map(pt => ({ ...pt, x: pt.x + dx, y: pt.y + dy })))
for (const c of p.constraints) {
  const m = (c.name || '').match(/^(Red|Blue|Purple|Green) (grid|regions|outside|frame)$/)
  if (m) c.lines = shiftLines(c.lines, DELTA[m[1]])
}

// --- clue labels ride with their grid -----------------------------------
const labels = p.constraints.find(c => c.name === 'Clue Labels')
const labelColor = ['Purple', 'Red', 'Blue', 'Green'] // running start, skyscrapers, numbered rooms, outside
labels.symbols = labels.symbols.map(([x, y, idx, layer]) => {
  const [dy, dx] = DELTA[labelColor[idx]]
  return [x + dx, y + dy, idx, layer]
})

// --- ring-corner white masks: only over grass corners -------------------
const masks = p.constraints.find(c => c.type === 2002 && !c.name)
const inAnyGrid = (r, c) => Object.values(NEW).some(([r0, c0]) => r >= r0 && r < r0 + 6 && c >= c0 && c < c0 + 6)
const corners = []
for (const [r0, c0] of Object.values(NEW)) {
  for (const [r, c] of [[r0 - 1, c0 - 1], [r0 - 1, c0 + 6], [r0 + 6, c0 - 1], [r0 + 6, c0 + 6]]) {
    if (!inAnyGrid(r, c) && !empty.has(r * W + c)) corners.push([c + 0.5, r + 0.5, 0, 'foreground'])
  }
}
masks.symbols = corners

// --- overlap ticks: diagonal across each 2x2 overlap --------------------
const ticks = p.constraints.find(c => c.type === 2000 && !c.name)
const spare = ticks.lines[4]
ticks.lines = [
  [{ x: 7, y: 7 }, { x: 8, y: 8 }, { x: 9, y: 9 }],
  [{ x: 13, y: 7 }, { x: 12, y: 8 }, { x: 11, y: 9 }],
  [{ x: 7, y: 13 }, { x: 8, y: 12 }, { x: 9, y: 11 }],
  [{ x: 13, y: 13 }, { x: 12, y: 12 }, { x: 11, y: 11 }],
  spare.map(pt => ({ x: pt.x + DELTA.Red[1], y: pt.y + DELTA.Red[0] }))
]

// --- checks + encode ----------------------------------------------------
for (const c of p.constraints) {
  if (c.type !== 1000 || !c.input || !c.input.groups) continue
  for (const g of c.input.groups) {
    for (const i of g.cells) if (p.cells[i].given) throw new Error(c.name + ' uses given cell ' + i)
  }
}
fs.writeFileSync('board_2x2_full.json', JSON.stringify(doc, null, 2))
const link = 'https://sudokumaker.app/?puzzle=' + LZ.compressToEncodedURIComponent(JSON.stringify(doc))
if (JSON.stringify(JSON.parse(LZ.decompressFromEncodedURIComponent(link.split('puzzle=')[1]))) !== JSON.stringify(doc)) {
  throw new Error('round trip failed')
}
fs.writeFileSync('PUZZLE_LINK_touch_grass_2x2_full.txt', link + '\n')
console.log('2x2 full rebuilt; masks:', corners.length, '; link chars:', link.length)
