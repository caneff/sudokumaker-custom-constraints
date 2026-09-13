import fs from 'fs'
let src = fs.readFileSync(process.argv[2], 'utf8')
const tail = '})();'
if (!src.trimEnd().endsWith(tail)) throw new Error('unexpected bundle tail')
src = src.trimEnd().slice(0, -tail.length) +
  '\n  globalThis.__probe = { createHelpers, OuterPosition, groupsArePolarityPair, describeDigitGroupKind, SudokuDigitSet, DigitsHelper };\n' + tail
globalThis.self = globalThis; globalThis.onmessage = null; globalThis.postMessage = () => {}; globalThis.addEventListener = () => {}
new Function(src)()
const P = globalThis.__probe
const spec = { size: { width: 9, height: 9 }, minDigit: 1, maxDigit: 9, type: 'sudoku' }
const h = P.createHelpers(spec)
console.log('== corner rays (straight, no diagonalType): outer corner -> first three cells of the ray')
for (const [name, coords] of [['TopLeft', { x: -1, y: -1 }], ['TopRight', { x: 9, y: -1 }], ['BottomRight', { x: 9, y: 9 }], ['BottomLeft', { x: -1, y: 9 }]]) {
  const id = h.outerCellIds.getIdFromCoords(coords)
  const side = P.OuterPosition[h.outerCellIds.getSide(id)]
  const ray = [...h.geometry.getCoordsPointedAtByOuterClue(id, undefined)].slice(0, 3).map(c => `(${c.x},${c.y})`).join(' ')
  console.log(`${name.padEnd(12)} outerId=${id} side=${side.padEnd(12)} ray starts ${ray}`)
}
console.log('== polarity pair on 1..9: groups low={1..4}, high={6..9}')
const low = +P.SudokuDigitSet.from([1, 2, 3, 4]), high = +P.SudokuDigitSet.from([6, 7, 8, 9])
console.log('groupsArePolarityPair([low, high]) =', P.groupsArePolarityPair([low, high], spec))
const five = +P.SudokuDigitSet.from([5]), one = +P.SudokuDigitSet.from([1])
for (const [label, g] of [['[low, low]', [low, low]], ['[high, high]', [high, high]], ['[low, {5}]', [low, five]], ['[high, {1}]', [high, one]], ['[{5}, low]', [five, low]]]) {
  console.log(`groupsArePolarityPair(${label.padEnd(12)}) = ${P.groupsArePolarityPair(g, spec)}`)
}
for (const [label, g] of [['[low, high]', [low, high]], ['[low, {5}]', [low, five]]]) {
  console.log(`describeDigitGroupKind(${label}) = ${JSON.stringify(P.describeDigitGroupKind({ groups: g, spec, short: false, adjective: false }))}`)
}
