// Up to N — main (backend) code segment. There is no global variant: every
// clue lives in a drawn group's typed value, and there is no ring to read one
// from.
//
// Each drawn group is a MARKER: two adjacent cells at one end of a whole row
// or column. The border cell is the reading end. The marked line's 1-based
// index is the TARGET DIGIT N (column 3 aims at 3, row 5 at 5), and the typed
// value is the clue: read inward from the marked end, the digits before the
// first N sum to it, N itself not added. An empty value draws the slot and
// clues nothing.
//
// Every marker is checked before any component is registered. A throw in main
// code shows the author a "Registering custom constraint 'Up to N' failed"
// banner with the message, and the puzzle solves as if the constraint were
// absent (docs/research/368-up-to-n-setup-throw.md); checking first means a
// refusal never leaves the constraint half-registered.

const W = puzzle.spec.size.width
const H = puzzle.spec.size.height
const lo = helpers.digits.minDigit
const hi = helpers.digits.maxDigit
// Every digit once: what a whole house sums to. A line aiming at N reads at
// most TOTAL - N (N last) and at least 0 (N first).
const TOTAL = ((lo + hi) * (hi - lo + 1)) / 2

const cellNames = cells => cells.map(c => helpers.naming.getCellName(c)).join(' and ')

//! A marker's line, its reading end, and its target digit, or a throw naming
//! the group's cells.
function readMarker (cells) {
  if (cells.length !== 2) {
    throw new Error(`Up to N: the marker at ${cellNames(cells)} must be exactly two cells`)
  }
  const [a, b] = cells
  const ax = a % W
  const ay = (a / W) | 0
  const bx = b % W
  const by = (b / W) | 0
  const where = cellNames(cells)
  let line
  let key
  let target
  if (ay === by && Math.abs(ax - bx) === 1) {
    const edge = Math.min(ax, bx) === 0 ? 0 : Math.max(ax, bx) === W - 1 ? W - 1 : -1
    if (edge < 0) throw new Error(`Up to N: the marker at ${where} is not at either end of its row`)
    line = []
    for (let i = 0; i < W; i++) line.push((ay * W + (edge === 0 ? i : W - 1 - i)) | 0)
    key = `R${ay}${edge === 0 ? 'L' : 'R'}`
    target = ay + 1
  } else if (ax === bx && Math.abs(ay - by) === 1) {
    const edge = Math.min(ay, by) === 0 ? 0 : Math.max(ay, by) === H - 1 ? H - 1 : -1
    if (edge < 0) throw new Error(`Up to N: the marker at ${where} is not at either end of its column`)
    line = []
    for (let i = 0; i < H; i++) line.push(((edge === 0 ? i : H - 1 - i) * W + ax) | 0)
    key = `C${ax}${edge === 0 ? 'T' : 'B'}`
    target = ax + 1
  } else {
    throw new Error(`Up to N: the marker at ${where} must be two adjacent cells in one row or column`)
  }
  return { line, key, target, where }
}

const markers = []
const seen = new Set()
for (const g of input.groups) {
  const m = readMarker(g.cells)
  if (seen.has(m.key)) {
    throw new Error(`Up to N: the marker at ${m.where} is a second marker on the same line and end`)
  }
  seen.add(m.key)
  const text = String(g.value ?? '').trim()
  if (text === '') continue
  if (!/^(0|[1-9][0-9]*)$/.test(text)) {
    throw new Error(`Up to N: the marker at ${m.where} holds "${text}", not a whole number 0 or above`)
  }
  if (m.target < lo || m.target > hi) {
    throw new Error(`Up to N: the marker at ${m.where} aims at target digit ${m.target}, outside ${lo}..${hi}`)
  }
  const clue = Number(text)
  if (clue > TOTAL - m.target) {
    throw new Error(`Up to N: the marker at ${m.where} holds ${clue}, above ${TOTAL - m.target}, the most a line aiming at ${m.target} can read`)
  }
  markers.push({ ...m, clue })
}

for (const m of markers) {
  const name = `the Up to N clue at ${m.where}`
  puzzle.addConstraintComponent(new UpToNComponent(name, m.line, m.target, m.clue))
}
