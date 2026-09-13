// Enumerate every binding in a JS file with a stable id (acorn + eslint-scope),
// split the IIFE body into units, and write annotated chunks for reading.
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import * as acorn from 'acorn'
import * as eslintScope from 'eslint-scope'

const file = process.argv[2] || 'bundle.pretty.js'
const src = readFileSync(file, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module', ranges: true })
const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' })

const bindings = []
const seen = new Set()
function walkScope (scope) {
  for (const v of scope.variables) {
    if (seen.has(v) || v.defs.length === 0) continue
    seen.add(v)
    const def = v.defs[0]
    bindings.push({
      id: bindings.length,
      name: v.name,
      kind: def.type,
      scope: scope.type,
      declStart: def.name.start,
      declEnd: def.name.end,
      refs: v.references.length,
      identifiers: [...new Set([...v.identifiers, ...v.references.map(r => r.identifier)])]
        .map(n => [n.start, n.end]).sort((a, b) => a[0] - b[0])
    })
  }
  for (const c of scope.childScopes) walkScope(c)
}
walkScope(sm.globalScope)

// Descend through `(function(){...})()` wrappers to the real statement list.
let body = ast.body
while (body.length === 1 && body[0].type === 'ExpressionStatement' &&
  body[0].expression.type === 'CallExpression' &&
  (body[0].expression.callee.type === 'FunctionExpression' || body[0].expression.callee.type === 'ArrowFunctionExpression')) {
  body = body[0].expression.callee.body.body
}
const units = body.map((stmt, i) => ({
  index: i, type: stmt.type, start: stmt.start, end: stmt.end, size: stmt.end - stmt.start,
  bindings: bindings.filter(b => b.declStart >= stmt.start && b.declEnd <= stmt.end).map(b => b.id)
}))
writeFileSync('bindings.json', JSON.stringify(bindings))
writeFileSync('units.json', JSON.stringify(units))

// Annotated source: `/*#id*/` after every declaration identifier.
const decls = bindings.map(b => [b.declEnd, b.id]).sort((a, b) => a[0] - b[0])
let out = ''; let pos = 0
for (const [at, id] of decls) { out += src.slice(pos, at) + `/*#${id}*/`; pos = at }
out += src.slice(pos)
writeFileSync('annotated.js', out)

// Chunk units into ~TARGET bytes of annotated source (unit boundaries only).
const TARGET = 22000
mkdirSync('chunks', { recursive: true })
const chunks = []; let cur = []; let curSize = 0
for (const u of units) {
  if (curSize + u.size > TARGET && cur.length) { chunks.push(cur); cur = []; curSize = 0 }
  cur.push(u); curSize += u.size
}
if (cur.length) chunks.push(cur)
// map original offsets -> annotated offsets
function annOffset (o) { let extra = 0; for (const [at, id] of decls) { if (at <= o) extra += `/*#${id}*/`.length; else break } return o + extra }
const manifest = []
chunks.forEach((us, i) => {
  const s = annOffset(us[0].start); const e = annOffset(us[us.length - 1].end)
  const name = `chunks/chunk-${String(i).padStart(2, '0')}.js`
  writeFileSync(name, out.slice(s, e) + '\n')
  manifest.push({ chunk: i, file: name, units: [us[0].index, us[us.length - 1].index], bindings: us.flatMap(u => u.bindings).length, bytes: e - s })
})
writeFileSync('chunks/manifest.json', JSON.stringify(manifest, null, 1))
console.log('bindings', bindings.length, 'units', units.length, 'chunks', chunks.length)
console.log(manifest.map(m => `${m.chunk}:${m.bytes}b/${m.bindings}ids`).join(' '))
const unassigned = bindings.filter(b => !units.some(u => u.bindings.includes(b.id)))
console.log('bindings outside units:', unassigned.map(b => b.name).join(' '))
