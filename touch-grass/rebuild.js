// Rebuild the "Touch grass" 1x1 board from the original (damaged) link plus
// every edit made in the 2026-09-04 session. Writes board_out.json and
// PUZZLE_LINK_touch_grass.txt. See NOTES.md for the session record.
const LZ = require('./node_modules/lz-string')
const fs = require('fs')

const W = 20
const EX = '/home/caneff/orca/workspaces/sudokumaker-custom-constraints/imposter/examples/'
const readLink = f => JSON.parse(LZ.decompressFromEncodedURIComponent(
  decodeURIComponent(fs.readFileSync(f, 'utf8').trim().split(/\s+/).pop().split('puzzle=')[1])))

// --- 1. decode + repair the original link -------------------------------
// The pasted link arrived damaged; the corruption sits in one cosmetic line's
// coordinates with a single repeating garble: `9.5,"y""y":` where
// `.5},{"x":0.5,"y":` belongs.
const blob = decodeURIComponent(fs.readFileSync('link_in.txt', 'utf8').trim().split('puzzle=')[1])
let raw = LZ.decompressFromEncodedURIComponent(blob).trimEnd()
raw = raw.split('9.5,"y""y":').join('.5},{"x":0.5,"y":')
const doc = JSON.parse(raw)
const p = doc.puzzle
const tail = () => p.constraints.findIndex(c => c.type === 0)

// --- 2. clone the red house components for the other three colors -------
const FRAMES = { Red: [2, 7], Blue: [7, 12], Purple: [7, 2], Green: [12, 7] } // [r0,c0] 0-based
const R6 = [0, 1, 2, 3, 4, 5]
const id = (r, c) => r * W + c
function houseGroups (kind, [r0, c0]) {
  const gs = []
  if (kind === 'Regions') {
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 2; bc++) {
        const cells = []
        for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) cells.push(id(r0 + br * 2 + r, c0 + bc * 3 + c))
        gs.push({ cells, value: '' })
      }
    }
  } else if (kind === 'Columns') {
    for (const c of R6) gs.push({ cells: R6.map(r => id(r0 + r, c0 + c)), value: '' })
  } else {
    for (const r of R6) gs.push({ cells: R6.map(c => id(r0 + r, c0 + c)), value: '' })
  }
  return gs
}
const red = {}
for (const kind of ['Regions', 'Columns', 'Rows']) {
  red[kind] = p.constraints.find(c => c.name === kind + ' (Red)')
  const regen = houseGroups(kind, FRAMES.Red)
  if (JSON.stringify(regen.map(g => g.cells)) !== JSON.stringify(red[kind].input.groups.map(g => g.cells))) {
    throw new Error('red regen mismatch for ' + kind)
  }
}
for (const color of ['Blue', 'Purple', 'Green']) {
  for (const kind of ['Regions', 'Columns', 'Rows']) {
    const clone = JSON.parse(JSON.stringify(red[kind]))
    clone.name = `${kind} (${color})`
    clone.input.groups = houseGroups(kind, FRAMES[color])
    p.constraints.splice(tail(), 0, clone)
  }
}

// --- 3. named house backends (fixes "nameless constraint" errors) -------
const kinds = { Regions: 'box', Columns: 'column', Rows: 'row' }
for (const c of p.constraints) {
  const m = (c.name || '').match(/^(Regions|Columns|Rows) \((Red|Blue|Purple|Green)\)$/)
  if (!m) continue
  const kind = kinds[m[1]]; const color = m[2]
  c.definition.backend.code =
    `// Each group is one ${kind} of the ${color} 6x6, in reading order. Named so\n` +
    "// solver messages say which house failed instead of 'nameless constraint'.\n" +
    'for (const i in input.groups) {\n' +
    `  puzzle.addConstraintComponent(new HouseComponent(\`${color} ${kind} \${+i + 1}\`, input.groups[i].cells))\n` +
    '}\n'
}

// --- 4. the four outside-clue families ----------------------------------
function fullGroups ([r0, c0]) {
  const gs = []
  for (const r of R6.map(k => r0 + k)) {
    gs.push({ cells: [id(r, c0 - 1), ...R6.map(j => id(r, c0 + j))], value: '' })
    gs.push({ cells: [id(r, c0 + 6), ...R6.map(j => id(r, c0 + 5 - j))], value: '' })
  }
  for (const c of R6.map(k => c0 + k)) {
    gs.push({ cells: [id(r0 - 1, c), ...R6.map(j => id(r0 + j, c))], value: '' })
    gs.push({ cells: [id(r0 + 6, c), ...R6.map(j => id(r0 + 5 - j, c))], value: '' })
  }
  return gs
}
function windowGroups ([r0, c0]) { // outside sudoku: first 3 cells, rows and columns alike
  const gs = []
  for (const r of R6.map(k => r0 + k)) {
    gs.push({ cells: [id(r, c0 - 1), id(r, c0), id(r, c0 + 1), id(r, c0 + 2)], value: '' })
    gs.push({ cells: [id(r, c0 + 6), id(r, c0 + 5), id(r, c0 + 4), id(r, c0 + 3)], value: '' })
  }
  for (const c of R6.map(k => c0 + k)) {
    gs.push({ cells: [id(r0 - 1, c), id(r0, c), id(r0 + 1, c), id(r0 + 2, c)], value: '' })
    gs.push({ cells: [id(r0 + 6, c), id(r0 + 5, c), id(r0 + 4, c), id(r0 + 3, c)], value: '' })
  }
  return gs
}
const protoOf = (file) => {
  const d = readLink(file)
  const cs = d.puzzle.constraints.filter(c => c.type === 1000 && (c.input.groups || []).length)
  if (cs.length !== 1) throw new Error(file + ': ambiguous proto')
  return cs[0]
}
const label = (rule, g) => [
  `const dir = puzzle.getRow(${g}clue) === puzzle.getRow(${g}line[0])`,
  `    ? (puzzle.getColumn(${g}line[0]) > puzzle.getColumn(${g}clue) ? 'right' : 'left')`,
  `    : (puzzle.getRow(${g}line[0]) > puzzle.getRow(${g}clue) ? 'down' : 'up')`,
  `  const name = \`${rule}, clue \${helpers.naming.getCellsDescription([${g}clue])} reading \${dir}\``
].join('\n')
const plan = [
  ['Numbered Rooms (Blue)', EX + 'numbered-rooms/PUZZLE_LINK_6x6_local.txt', fullGroups(FRAMES.Blue),
    'const name = helpers.naming.getCellsDescription(cells)', label('Blue Numbered Rooms', '')],
  ['Skyscrapers (Red)', EX + 'skyscraper/PUZZLE_LINK_6x6_local.txt', fullGroups(FRAMES.Red),
    'const name = helpers.naming.getCellsDescription([g.clue, ...g.line])', label('Red Skyscraper', 'g.')],
  ['Running Start (Purple)', EX + 'running-start/PUZZLE_LINK_local.txt', fullGroups(FRAMES.Purple),
    'const name = helpers.naming.getCellsDescription([g.clue, ...g.line])', label('Purple Running Start', 'g.')],
  ['Outside Sudoku (Green)', EX + 'outside-sudoku/PUZZLE_LINK_local.txt', windowGroups(FRAMES.Green),
    'const name = helpers.naming.getCellsDescription(cells)', label('Green Outside Sudoku', '')]
]
for (const [name, file, groups, anchor, named] of plan) {
  const clone = JSON.parse(JSON.stringify(protoOf(file)))
  clone.name = name
  clone.input.groups = groups
  if (!clone.definition.backend.code.includes(anchor)) throw new Error(name + ': name anchor missing')
  clone.definition.backend.code = clone.definition.backend.code.replace(anchor, named)
  p.constraints.splice(tail(), 0, clone)
}

// --- 5. message patch: house names in app-built cell lists --------------
const patchCode = fs.readFileSync('patch.js', 'utf8')
p.constraints.splice(tail(), 0, {
  name: 'Named messages (patch)',
  type: 1000,
  definition: { name: 'Named messages', input: [], backend: { type: 'code', code: patchCode }, components: [] },
  input: {},
  style: {}
})

// --- 6. cell fixes ------------------------------------------------------
for (const [r, c] of [[9, 9], [9, 10], [10, 9], [10, 10], [13, 1]]) {
  const i = id(r, c)
  if (p.cells[i].given || Object.keys(p.cells[i]).length) throw new Error(`cell r${r}c${c} not empty`)
  p.cells[i] = { given: true, value: 1 }
}
const masks = p.constraints.find(c => c.type === 2002 && !c.name)
const short = masks.symbols.findIndex(s => s.length === 2)
if (short < 0) throw new Error('malformed mask entry not found')
masks.symbols[short] = [1.5, 13.5, 0, 'foreground']

// --- 7. checks + encode -------------------------------------------------
for (const c of p.constraints) {
  if (c.type !== 1000 || !c.input || !c.input.groups) continue
  for (const g of c.input.groups) {
    for (const i of g.cells) if (p.cells[i].given) throw new Error(c.name + ' uses given cell ' + i)
  }
}
let entered = 0
for (const c of p.cells) if (!c.given && Object.keys(c).length) entered++
if (entered) throw new Error('entered cells: ' + entered)
fs.writeFileSync('board_out.json', JSON.stringify(doc, null, 2))
const link = 'https://sudokumaker.app/?puzzle=' + LZ.compressToEncodedURIComponent(JSON.stringify(doc))
if (JSON.stringify(JSON.parse(LZ.decompressFromEncodedURIComponent(link.split('puzzle=')[1]))) !== JSON.stringify(doc)) {
  throw new Error('round trip failed')
}
fs.writeFileSync('PUZZLE_LINK_touch_grass.txt', link + '\n')
console.log('rebuilt. constraints:', p.constraints.map(c => c.name || c.type).join(' | '))
console.log('link chars:', link.length)
