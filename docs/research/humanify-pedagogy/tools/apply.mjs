// Apply a {bindingId: newName} map to a source file through the AST bindings
// (bindings.json from enumerate.mjs, computed on the SAME source file).
//   node apply.mjs <src.js> <names.json...> > out.js
import { readFileSync } from 'fs'
import * as acorn from 'acorn'

const [srcFile, ...nameFiles] = process.argv.slice(2)
const src = readFileSync(srcFile, 'utf8')
const bindings = JSON.parse(readFileSync('bindings.json'))
const names = Object.assign({}, ...nameFiles.map(f => JSON.parse(readFileSync(f, 'utf8'))))

// Shorthand properties: `{ e }` (object literal or destructuring pattern) must
// become `{ e: newName }`; `{ e = 1 }` in a pattern becomes `{ e: newName = 1 }`.
// Collect the identifier start of every shorthand property's key.
const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module' })
const shorthandKeys = new Map() // key.start -> property node
;(function walk (n) {
  if (!n || typeof n !== 'object') return
  if (Array.isArray(n)) { n.forEach(walk); return }
  if (n.type === 'Property' && n.shorthand) shorthandKeys.set(n.key.start, n)
  for (const k in n) if (k !== 'type' && k !== 'start' && k !== 'end') walk(n[k])
})(ast)

const edits = [] // [start, end, text]
for (const b of bindings) {
  const nn = names[b.id]
  if (!nn) continue
  if (!/^[A-Za-z_$][\w$]*$/.test(nn)) throw new Error(`bad name for #${b.id}: ${nn}`)
  for (const [s, e] of b.identifiers) {
    const sh = shorthandKeys.get(s)
    if (sh) {
      // one edit covering the whole property: `key` or `key = default`
      edits.push([sh.start, sh.end, `${b.name}: ${src.slice(sh.value.start, sh.value.end).replace(/^[A-Za-z_$][\w$]*/, nn)}`])
    } else {
      edits.push([s, e, nn])
    }
  }
}
edits.sort((a, b) => a[0] - b[0])
let out = ''; let pos = 0
for (const [s, e, t] of edits) {
  if (s < pos) continue // duplicate (shorthand value identifier already covered by the key edit)
  out += src.slice(pos, s) + t; pos = e
}
out += src.slice(pos)
process.stdout.write(out)
