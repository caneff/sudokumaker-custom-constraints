const pc = m => { let c = 0; while (m) { m &= m - 1; c++ } return c }
function makeSubsets (N) {
  return function (masks) {
    const m = masks.slice(); const LIM = 1 << N
    for (let pass = 0; pass < 60; pass++) {
      let ch = false
      for (let s = 1; s < LIM; s++) {
        const k = pc(s)
        if (k === N) continue
        let u = 0
        for (let i = 0; i < N; i++) if (s >> i & 1) u |= m[i]
        if (pc(u) !== k) continue
        for (let i = 0; i < N; i++) if (!(s >> i & 1) && (m[i] & u)) { m[i] &= ~u; ch = true }
      }
      if (!ch) break
    }
    return m
  }
}
function makeGac (N) {
  const owner = new Int32Array(64), seen = new Uint8Array(64)
  const perfect = m => {
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
  return function (masks) {
    const m = masks.slice()
    if (!perfect(m)) return m
    for (let i = 0; i < N; i++) {
      let x = m[i]
      while (x) {
        const bit = x & -x; x &= x - 1
        const save = m[i]; m[i] = bit
        const ok = perfect(m); m[i] = save
        if (!ok) m[i] &= ~bit
      }
    }
    return m
  }
}
let seed = 7
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
console.log('house  states   subsets 2^n      matching GAC     ratio')
for (const N of [9, 10, 12, 14, 16]) {
  const reps = N <= 10 ? 4000 : N <= 12 ? 800 : N === 14 ? 200 : 40
  const states = []
  for (let t = 0; t < reps; t++) {
    const perm = [...Array(N)].map((_, i) => i + 1)
    for (let i = N - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]] }
    const m = []
    for (let i = 0; i < N; i++) {
      let x = 1 << perm[i]
      for (let v = 1; v <= N; v++) if (rnd() < 0.35) x |= 1 << v
      m.push(x)
    }
    states.push(m)
  }
  const S = makeSubsets(N); const G = makeGac(N)
  S(states[0]); G(states[0])
  let t0 = process.hrtime.bigint(); for (const s of states) S(s)
  const a = Number(process.hrtime.bigint() - t0) / reps / 1000
  t0 = process.hrtime.bigint(); for (const s of states) G(s)
  const b = Number(process.hrtime.bigint() - t0) / reps / 1000
  console.log(`${String(N).padStart(4)}  ${String(reps).padStart(6)}  ${a.toFixed(1).padStart(12)} us  ${b.toFixed(1).padStart(12)} us   ${(a / b).toFixed(1)}x`)
}
