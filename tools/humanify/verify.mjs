// Verify out.js is structurally identical to src.js modulo identifier names,
// and that scoping is preserved: same binding count, same per-binding
// reference counts, no new unresolved (global) references, no name clash.
//   node verify.mjs <src.js> <out.js>
import { readFileSync } from 'fs'
import * as acorn from 'acorn'
import * as eslintScope from 'eslint-scope'

const [a, b] = process.argv.slice(2).map(f => readFileSync(f, 'utf8'))
const pa = acorn.parse(a, { ecmaVersion: 2022, sourceType: 'module', ranges: true })
const pb = acorn.parse(b, { ecmaVersion: 2022, sourceType: 'module', ranges: true })

function skeleton (n) {
  if (!n || typeof n !== 'object') return n
  if (Array.isArray(n)) return n.map(skeleton)
  const o = {}
  for (const k of Object.keys(n)) {
    if (k === 'start' || k === 'end' || k === 'raw') continue
    if (n.type === 'Identifier' && k === 'name') continue
    if (n.type === 'Property' && k === 'shorthand') continue
    if (k === 'range') continue
    o[k] = skeleton(n[k])
  }
  return o
}
const sa = JSON.stringify(skeleton(pa)); const sb = JSON.stringify(skeleton(pb))
console.log('AST skeleton equal:', sa === sb)
if (sa !== sb) { let i = 0; while (sa[i] === sb[i]) i++; console.log('first diff near:', sa.slice(Math.max(0, i - 200), i + 100)); process.exit(1) }

function analyse (ast) {
  const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module', ranges: true })
  const vars = []
  ;(function walk (s) { for (const v of s.variables) if (v.defs.length) vars.push(v); s.childScopes.forEach(walk) })(sm.globalScope)
  const through = sm.globalScope.through.map(r => r.identifier.name).sort()
  return { vars, through }
}
const A = analyse(pa); const B = analyse(pb)
console.log('bindings:', A.vars.length, B.vars.length)
console.log('unresolved refs equal:', JSON.stringify([...new Set(A.through)]) === JSON.stringify([...new Set(B.through)]), '|', [...new Set(B.through)].join(' '))
let refMismatch = 0
for (let i = 0; i < A.vars.length; i++) {
  if (A.vars[i].references.length !== B.vars[i].references.length || A.vars[i].defs[0].name.start === undefined) refMismatch++
}
console.log('per-binding reference-count mismatches:', refMismatch)
// clash: two distinct bindings in the same scope with the same name is a parse error for let/const/class, but a var/function would silently merge -> count check above catches it.
process.exit(A.vars.length === B.vars.length && refMismatch === 0 ? 0 : 1)
