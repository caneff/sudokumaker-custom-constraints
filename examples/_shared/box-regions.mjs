// A mock puzzle's box layout: 3x3 boxes filling the interior of a one-cell
// ring on a W-wide, H-tall board. Ring cells have no region (-1). The interior
// must tile into whole boxes, or region ids come out fractional.
export function boxRegions (W, H) {
  if ((W - 2) % 3 !== 0 || (H - 2) % 3 !== 0) {
    throw new Error(`box mock: the ${W}x${H} interior is not a whole number of 3x3 boxes`)
  }
  const across = (W - 2) / 3
  return {
    getRegion: c => {
      const r = Math.floor(c / W) - 1
      const k = (c % W) - 1
      if (r < 0 || k < 0 || r >= H - 2 || k >= W - 2) return -1
      return Math.floor(r / 3) * across + Math.floor(k / 3)
    },
    getRegionCells: reg => {
      const cells = []
      for (let dr = 0; dr < 3; dr++) {
        for (let dk = 0; dk < 3; dk++) cells.push((Math.floor(reg / across) * 3 + dr + 1) * W + (reg % across) * 3 + dk + 1)
      }
      return cells
    }
  }
}
