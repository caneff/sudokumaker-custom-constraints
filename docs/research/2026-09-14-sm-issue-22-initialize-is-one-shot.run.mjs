import fs from 'fs'
import { solveDocument } from '/home/caneff/src/sudokumaker-custom-constraints/examples/_shared/bundle-solve-lib.mjs'
const S = process.argv[2]
const load = f => JSON.parse(fs.readFileSync(`${S}/issue22-${f}.patched.json`, 'utf8'))
const custom = d => d.puzzle.constraints.find(c => c.type === 1000).definition.components
const variants = []
variants.push(['repro1 as filed (initialize + hasValue)', load('2yv3bp22')])
{ const d = load('2yv3bp22'); custom(d)[0].code = custom(d)[0].code.replace('function* initialize', 'function* update'); variants.push(['repro1, check moved to update', d]) }
{ const d = load('2yv3bp22'); custom(d)[0].code = custom(d)[0].code.replace('puzzle.hasValue(cellIds[0])', 'puzzle.getCandidates(cellIds[0]).size == 1'); variants.push(['repro1, initialize + candidates.size==1', d]) }
variants.push(['repro2 as filed (replace -> initialize-only component)', load('2y3g23a8')])
{ const d = load('2y3g23a8'); const c = custom(d).find(c => c.name === 'AnotherBrokenComponent'); c.code = c.code.replace('function* initialize', 'function* update'); variants.push(['repro2, replacement checks in update', d]) }
{ const d = load('2y3g23a8'); const c = custom(d).find(c => c.name === 'AnotherBrokenComponent'); c.code = 'function* initialize({ name, cellIds }, puzzle) { yield puzzle.stop("abort from replacement initialize") }'; variants.push(['repro2, replacement aborts unconditionally in initialize', d]) }
for (const [label, d] of variants) {
  try {
    const { solutions, ms } = await solveDocument(d)
    console.log(`${String(solutions.length).padStart(6)} solutions  ${label}`)
  } catch (e) {
    console.log(`  REJECTED at initial grid  ${label}  [${String(e.message).slice(0, 60)}]`)
  }
}
