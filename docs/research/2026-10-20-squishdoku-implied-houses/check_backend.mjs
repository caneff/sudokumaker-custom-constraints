// Runs backend.js against a stub puzzle and checks its houses equal the
// CP-SAT set from implied_houses.py.
//
//   node check_backend.mjs backend.js houses.json
import fs from 'node:fs'

const [code, housesJson] = process.argv.slice(2).map(f => fs.readFileSync(f, 'utf8'))
const got = []
class HouseComponent { constructor (name, cells) { got.push({ name, cells }) } }
// eslint-disable-next-line no-new-func
new Function('puzzle', 'HouseComponent', code)({ addConstraintComponent: () => {} }, HouseComponent)
const key = cells => [...cells].sort((a, b) => a - b).join(',')
const want = new Set(JSON.parse(housesJson).houses.map(key))
const have = new Set(got.map(g => key(g.cells)))
const equal = want.size === have.size && [...want].every(k => have.has(k))
console.log(`houses built: ${got.length}, distinct: ${have.size}, equal to CP-SAT set: ${equal}`)
if (!equal) process.exit(1)
