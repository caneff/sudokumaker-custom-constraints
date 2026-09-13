// Pass-1 input: one line per top-level unit, with annotated ids, truncated bodies.
import { readFileSync, writeFileSync } from 'fs'
const ann = readFileSync('annotated.js', 'utf8')
const units = JSON.parse(readFileSync('units.json'))
const bindings = JSON.parse(readFileSync('bindings.json'))
const decls = bindings.map(b => [b.declEnd, b.id]).sort((a, b) => a[0] - b[0])
function annOffset (o) { let extra = 0; for (const [at, id] of decls) { if (at <= o) extra += `/*#${id}*/`.length; else break } return o + extra }
const top = new Set(bindings.filter(b => b.scope === 'function' && units.some(u => u.start <= b.declStart && b.declEnd <= u.end && (u.type === 'ClassDeclaration' || u.type === 'FunctionDeclaration' || u.type === 'VariableDeclaration'))).map(b => b.id))
let out = ''
for (const u of units) {
  const text = ann.slice(annOffset(u.start), annOffset(u.end))
  let summary
  if (u.type === 'ClassDeclaration') {
    // header + member signatures (lines at indent 4 that look like member heads)
    const lines = text.split('\n')
    const members = lines.filter(l => /^    (static )?(async )?(\*?\s*)?[#\w$]+\s*(\(|=|;)/.test(l) && !/^\s*(return|if|for|const|let|var)\b/.test(l)).map(l => l.trim().replace(/\s*\{$/, '')).slice(0, 40)
    summary = lines[0] + '\n      ' + members.join('\n      ')
  } else {
    summary = text.length > 700 ? text.slice(0, 700) + ' …' : text
  }
  out += `// ---- unit ${u.index} (${u.type}, ${u.size} bytes)\n${summary}\n\n`
}
writeFileSync('pass1-input.js', out)
console.log('top-level bindings', bindings.filter(b => b.scope === 'function' && b.declStart >= units[0].start).length, 'summary bytes', out.length)
