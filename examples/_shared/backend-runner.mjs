// Run a constraint backend segment under Node, the way the app runs it.
//
// SudokuMaker evaluates a backend as a bare script with `input`, `puzzle`,
// `helpers`, the API globals it injects, and each component constructor already
// in scope. A `new Function` body is the closest Node equivalent, so every test
// that exercises a backend needs the same three moves: scrape the constructor
// names the source calls, stand up a recorder for each one, and build the
// function with those names as parameters. This is that, once.
//
// The constructors are RECORDED, not run, unless the caller hands in real ones
// by name (`ctors`): each recorder keeps the arguments it was handed on `args`
// and its own name on `ctor`, so a test can assert which component was built
// and with what, without a working implementation of it.
//
// `mockBoard` is the `puzzle` those tests hand it: one board mock, so the cell
// layout is stated once. `mockRegistrar` is the same mock with no geometry, for
// a backend that only registers: a geometry read there throws instead of
// answering for a board the backend never asked about.

// A board with only `addConstraintComponent`; whatever the backend registers
// lands on `registered`.
export function mockRegistrar () {
  const registered = []
  return { registered, addConstraintComponent: comp => registered.push(comp) }
}

// A `width` x `height` board as a backend reads it. Cell id = col + row * width,
// the app's own layout (`getIdFromCoords(e){return e.x+e.y*this.width}` in the
// shipped bundle), so `getCellAt` takes the COLUMN first: `getCellAt(col, row)`.
// `regions`, when given, is what `getRegions()` answers: one cell list per
// region. Whatever the backend registers lands on `registered`. A caller that
// needs another shape of a method (boxed ids, an off-board count) spreads this
// and overrides that one.
export function mockBoard ({ width, height = width, regions = undefined }) {
  const board = {
    ...mockRegistrar(),
    spec: { size: { width, height } },
    getCellAt: (col, row) => col + row * width,
    getRow: cell => Math.floor(cell / width),
    getColumn: cell => cell % width
  }
  if (regions !== undefined) board.getRegions = () => regions
  return board
}

// Scrape the component constructors `src` calls, in first-use order.
function componentNames (src) {
  return [...new Set([...src.matchAll(/new (\w+Component)\(/g)].map(m => m[1]))]
}

// Evaluate `src` against `puzzle` and `helpers`.
//
// `input` is the segment's own `input` -- what the app hands a LOCAL lane as
// `{ groups }` and a global one not at all, so it defaults to undefined.
// `globals` names any further API global the backend reads (`SudokuDigitSet`,
// say), by name. `returns` is an expression evaluated after the backend body
// and handed back as `value` -- the way to reach a function the backend
// declares but never calls itself, such as `postprocessJSON`. `ctors` maps a
// constructor name to a real constructor, run in place of its recorder; a name
// in `ctors` the source never calls is still put in scope.
export function runBackend (src, { puzzle, helpers, input = undefined, globals = {}, returns = null, ctors: real = {} }) {
  const ctorNames = [...new Set([...componentNames(src), ...Object.keys(real)])]
  const ctors = ctorNames.map(name => {
    if (real[name]) return real[name]
    const Recorder = function (...args) { this.args = args; this.ctor = name }
    Object.defineProperty(Recorder, 'name', { value: name })
    return Recorder
  })
  const globalNames = Object.keys(globals)
  const body = returns === null ? src : `${src}\n;return (${returns})`
  const fn = new Function('input', 'puzzle', 'helpers', ...globalNames, ...ctorNames, body) // eslint-disable-line no-new-func
  const value = fn(input, puzzle, helpers, ...globalNames.map(n => globals[n]), ...ctors)
  return { ctorNames, value }
}
