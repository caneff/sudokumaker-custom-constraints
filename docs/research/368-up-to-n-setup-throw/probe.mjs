// What the real solver bundle does with Up to N's committed 4x4 link, and with
// the same link after main.js is made to throw at setup
// (docs/research/368-up-to-n-setup-throw.md).
//
//   node docs/research/368-up-to-n-setup-throw/probe.mjs examples/up-to-n/PUZZLE_LINK.txt
import { decodeLinkFile, solveDocument } from '../../../examples/_shared/bundle-solve-lib.mjs'

const base = decodeLinkFile(process.argv[2])
const upToN = d => d.puzzle.constraints.find(c => c.definition?.name === 'Up to N')

const variants = {
  shipped: d => d,
  // A three-cell group: main.js refuses the marker and throws.
  malformed: d => { upToN(d).input.groups[0].cells.push(upToN(d).input.groups[0].cells[1] + 1); return d },
  // Every marker empty: main.js registers nothing and does not throw.
  allEmpty: d => { for (const g of upToN(d).input.groups) g.value = ''; return d }
}

// solveDocument turns console.error into a throw so a batch run fails loud.
// This probe wants the app's own behaviour -- log and carry on -- so it pins
// console.error to a recorder the lib's assignment cannot replace.
let errors = []
Object.defineProperty(console, 'error', {
  get: () => (...args) => errors.push(args.map(String).join(' ').slice(0, 160)),
  set: () => {}
})

for (const [name, edit] of Object.entries(variants)) {
  errors = []
  const { solutions } = await solveDocument(edit(structuredClone(base)))
  console.log(`${name}: ${solutions.length} solutions; console.error x${errors.length}${errors.length ? ': ' + errors[0] : ''}`)
}
