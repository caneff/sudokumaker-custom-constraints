// Cost per house-filter call: naked-subset enumeration vs matching-based GAC.
const N = 9, ALL = 0x3fe
const pc = m => { let c = 0; while (m) { m &= m - 1; c++ } return c }

// (a) naked subsets k=1..8, bitmask enumeration over all 511 subsets, to fixpoint
function subsets (masks) {
  const m = masks.slice()
  for (let pass = 0; pass < 60; pass++) {
    let ch = false
    for (let s = 1; s < 512; s++) {
      const k = pc(s)
      if (k === 0 || k === N) continue
      let u = 0
      for (let i = 0; i < N; i++) if (s >> i & 1) u |= m[i]
      if (pc(u) !== k) continue
      for (let i = 0; i < N; i++) if (!(s >> i & 1) && (m[i] & u)) { m[i] &= ~u; ch = true }
    }
    if (!ch) break
  }
  return m
}

// (b) naive GAC: for every (cell, value) edge, re-test a perfect matching.
//     This is what AllDiffGacComponent ships.
const owner = new Int32Array(32), seen = new Uint8Array(32)
function perfect (m) {
  owner.fill(-1)
  const aug = i => {
    let x = m[i]
    while (x) {
      const d = 31 - Math.clz32(x & -x); x &= x - 1
      if (seen[d]) continue
      seen[d] = 1
      if (owner[d] === -1 || aug(owner[d])) { owner[d] = i; return true }
    }
    return false
  }
  for (let i = 0; i < N; i++) { seen.fill(0); if (!aug(i)) return false }
  return true
}
function gac (masks) {
  const m = masks.slice()
  if (!perfect(m)) return m
  for (let i = 0; i < N; i++) {
    let x = m[i]
    while (x) {
      const bit = x & -x; x &= x - 1
      const save = m[i]; m[i] = bit
      const ok = perfect(m)
      m[i] = save
      if (!ok) m[i] &= ~bit
    }
  }
  return m
}

let seed = 99
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const states = []
for (let t = 0; t < 20000; t++) {
  const perm = [...Array(9)].map((_, i) => i + 1)
  for (let i = 8; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]] }
  const m = []
  for (let i = 0; i < N; i++) {
    let x = 1 << perm[i]
    for (let v = 1; v <= 9; v++) if (rnd() < 0.35) x |= 1 << v
    m.push(x)
  }
  states.push(m)
}
for (const [name, fn] of [['naked subsets k=1..8', subsets], ['matching GAC (shipped)', gac]]) {
  fn(states[0]); // warm
  const t0 = process.hrtime.bigint()
  for (const s of states) fn(s)
  const ns = Number(process.hrtime.bigint() - t0) / states.length
  console.log(`${name.padEnd(24)} ${ns.toFixed(0).padStart(6)} ns/house-call`)
}
