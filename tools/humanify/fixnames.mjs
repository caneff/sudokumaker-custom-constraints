// Merge name maps and repair collisions so the rename preserves resolution:
//  (a) two bindings in one scope with the same new name;
//  (b) a reference whose resolution would be captured by an intermediate
//      scope declaring the same new name (or a global name being captured).
//   node fixnames.mjs <src.js> <out-names.json> <names.json...>
import { readFileSync, writeFileSync } from 'fs'
import * as acorn from 'acorn'
import * as eslintScope from 'eslint-scope'

const [srcFile, outFile, ...nameFiles] = process.argv.slice(2)
const src = readFileSync(srcFile, 'utf8')
const bindings = JSON.parse(readFileSync('bindings.json'))
const names = Object.assign({}, ...nameFiles.map(f => JSON.parse(readFileSync(f, 'utf8'))))
const RESERVED = new Set('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public await arguments eval undefined NaN Infinity'.split(' '))

const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module', ranges: true })
const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' })
const byDecl = new Map(bindings.map(b => [b.declStart, b]))
const varOf = new Map() // eslint variable -> binding
const vars = []
;(function walk (s) { for (const v of s.variables) if (v.defs.length) { const b = byDecl.get(v.defs[0].name.start); if (b) { varOf.set(v, b); vars.push(v) } } s.childScopes.forEach(walk) })(sm.globalScope)
const globals = new Set(sm.globalScope.through.map(r => r.identifier.name))
const newName = b => names[b.id] || b.name
const bumps = {}
function bump (b, why) {
  const base = (names[b.id] || b.name).replace(/\d+$/, '')
  let n = 2; while (taken(b, `${base}${n}`)) n++
  names[b.id] = `${base}${n}`; bumps[b.id] = why
}
function taken (b, cand) {
  const v = vars.find(x => varOf.get(x) === b); const scope = v.scope
  for (const x of scope.variables) if (varOf.get(x) && varOf.get(x) !== b && newName(varOf.get(x)) === cand) return true
  return globals.has(cand) || RESERVED.has(cand)
}
// sanity: reserved / global / invalid names
for (const b of bindings) { const n = names[b.id]; if (n && (RESERVED.has(n) || globals.has(n) || !/^[A-Za-z_$][\w$]*$/.test(n))) bump(b, `invalid/reserved/global name ${n}`) }
let changed = true; let rounds = 0
while (changed && rounds++ < 10) {
  changed = false
  // (a) duplicates within a scope (later declaration gets bumped); also var-scope hoisting: params vs body vars share the function scope in eslint-scope
  for (const s of allScopes()) {
    const seen = new Map()
    for (const v of s.variables) {
      const b = varOf.get(v); if (!b) continue
      const n = newName(b)
      if (seen.has(n)) { bump(b, `duplicate of #${seen.get(n).id} in ${s.type} scope`); changed = true } else seen.set(n, b)
    }
  }
  // (b) capture: reference in scope R resolving to V declared in scope D; any scope strictly between R (inclusive) and D (exclusive) declaring newName(V) captures it
  for (const v of vars) {
    const bv = varOf.get(v); const n = newName(bv)
    for (const r of v.references) {
      let s = r.from
      while (s && s !== v.scope) {
        for (const x of s.variables) { const bx = varOf.get(x); if (bx && bx !== bv && newName(bx) === n) { bump(bx, `captures #${bv.id} (${n}) referenced through ${s.type} scope`); changed = true } }
        s = s.upper
      }
    }
  }
  // (c) globals captured: a reference to a global name through scopes declaring that name
  for (const r of sm.globalScope.through) {
    let s = r.from
    while (s) { for (const x of s.variables) { const bx = varOf.get(x); if (bx && newName(bx) === r.identifier.name) { bump(bx, `captures global ${r.identifier.name}`); changed = true } } s = s.upper }
  }
}
function allScopes () { const out = []; (function w (s) { out.push(s); s.childScopes.forEach(w) })(sm.globalScope); return out }
const missing = bindings.filter(b => !names[b.id])
writeFileSync(outFile, JSON.stringify(names))
console.log('named', Object.keys(names).length, 'of', bindings.length, '| unnamed', missing.length, '| bumped', Object.keys(bumps).length, '| rounds', rounds)
if (missing.length) console.log('unnamed sample:', missing.slice(0, 20).map(b => `#${b.id}:${b.name}`).join(' '))
for (const [id, why] of Object.entries(bumps).slice(0, 15)) console.log(`  #${id} -> ${names[id]}: ${why}`)
