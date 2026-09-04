// Message patch, no solving logic. helpers.naming is the same object the app's
// own messages go through, so wrapping getCellsDescription appends the house
// ("Red box 5") to any cell list that sits inside one — including app-built
// messages like "R7C8 and R8C9 must both be 1", which name no constraint.
// Idempotent: the editor reruns this on every edit, so a flag stops re-wrapping.
const naming = helpers.naming
if (!naming._houseSuffixPatched) {
  naming._houseSuffixPatched = true
  const orig = naming.getCellsDescription.bind(naming)
  const W = 20
  const grids = [['Red', 2, 7], ['Blue', 7, 12], ['Purple', 7, 2], ['Green', 12, 7]]
  // Boxes are 3 wide, 2 tall; box index in reading order matches the
  // "<Color> box N" names the Regions components register.
  const houseOf = cells => {
    if (cells.length < 2) return null
    for (const [color, r0, c0] of grids) {
      const local = cells.map(id => [Math.floor(id / W) - r0, (id % W) - c0])
      if (!local.every(([r, c]) => r >= 0 && r < 6 && c >= 0 && c < 6)) continue
      if (local.every(([r]) => r === local[0][0])) return color + ' row ' + (local[0][0] + 1)
      if (local.every(([, c]) => c === local[0][1])) return color + ' column ' + (local[0][1] + 1)
      const box = ([r, c]) => Math.floor(r / 2) * 2 + Math.floor(c / 3)
      if (local.every(x => box(x) === box(local[0]))) return color + ' box ' + (box(local[0]) + 1)
      return color + ' grid'
    }
    return null
  }
  naming.getCellsDescription = cells => {
    const base = orig(cells)
    try {
      const house = houseOf(Array.from(cells))
      return house ? base + ' (' + house + ')' : base
    } catch {
      return base
    }
  }
}
