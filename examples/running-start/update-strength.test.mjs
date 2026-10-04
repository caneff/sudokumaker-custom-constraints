import { installGlobals, makeIo, makeRng, fixpoint, randomCandidates, strengthSweep } from '../_shared/harness-lib.mjs'

const HERE = import.meta.dirname
const { load, loadAt } = makeIo(HERE)

// The floor: the components at the commit that pins this test. Every state
// below declares a HOUSE: the floor compares neighbours strictly everywhere,
// which is sound on a house and unsound on a drawn line that may repeat. On a
// house the floor holds the ties work to no loss of strength on the frame
// lines every shipped board uses, while leaving the component free to push
// less hard on a bare line. Soundness on the other kinds is the soundness
// harness's job.
const REF_COMMIT = 'db93523'
const NAMES = ['setParams', 'update']
const curLine = load('RunningStartComponent.js', NAMES)
const refLine = loadAt(REF_COMMIT, 'RunningStartComponent.js', NAMES)
const curPair = load('RunningStartPairComponent.js', NAMES)
const refPair = loadAt(REF_COMMIT, 'RunningStartPairComponent.js', NAMES)

const { rnd } = makeRng(4104)
const randomSet = (lo, hi) => randomCandidates(rnd, lo, hi)

function fuzzLine (cur, ref, clues, setUp, label) {
  for (const m of [4, 6, 9]) {
    installGlobals(1, m)
    const LINE = Array.from({ length: m }, (_, i) => i)
    strengthSweep(`running-start ${label} ${m}`, {
      cur,
      ref,
      apply: (mod, p) => {
        const inst = {}
        setUp(mod, inst, clues, LINE)
        fixpoint(mod, inst, p)
      },
      opts: { houses: [LINE] },
      * states () {
        for (let rep = 0; rep < 10000; rep++) {
          const start = new Map()
          for (const c of clues) start.set(c, randomSet(1, m))
          for (const c of LINE) start.set(c, randomSet(1, m))
          yield start
        }
      }
    })
  }
}

fuzzLine(curLine, refLine, [100], (mod, inst, [ca], line) => mod.setParams(inst, ca, line), 'line')
fuzzLine(curPair, refPair, [100, 101], (mod, inst, [ca, cb], line) => mod.setParams(inst, ca, cb, line), 'pair')

console.log('PASS')
