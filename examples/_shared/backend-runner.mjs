// Run a constraint backend segment under Node, the way the app runs it.
//
// SudokuMaker evaluates a backend as a bare script with `input`, `puzzle`,
// `helpers`, the API globals it injects, and each component constructor already
// in scope. A `new Function` body is the closest Node equivalent, so every test
// that exercises a backend needs the same three moves: scrape the constructor
// names the source calls, stand up a recorder for each one, and build the
// function with those names as parameters. This is that, once.
//
// The constructors are RECORDED, not run: each recorder keeps the arguments it
// was handed on `args` and its own name on `ctor`, so a test can assert which
// component was built and with what, without a working implementation of it.

// Scrape the component constructors `src` calls, in first-use order.
function componentNames (src) {
  return [...new Set([...src.matchAll(/new (\w+Component)\(/g)].map(m => m[1]))]
}

// Evaluate `src` against `puzzle` and `helpers`.
//
// `globals` names any further API global the backend reads (`SudokuDigitSet`,
// say), by name. `returns` is an expression evaluated after the backend body
// and handed back as `value` -- the way to reach a function the backend
// declares but never calls itself, such as `postprocessJSON`.
export function runBackend (src, { puzzle, helpers, globals = {}, returns = null }) {
  const ctorNames = componentNames(src)
  const ctors = ctorNames.map(name => {
    const Recorder = function (...args) { this.args = args; this.ctor = name }
    Object.defineProperty(Recorder, 'name', { value: name })
    return Recorder
  })
  const globalNames = Object.keys(globals)
  const body = returns === null ? src : `${src}\n;return (${returns})`
  const fn = new Function('input', 'puzzle', 'helpers', ...globalNames, ...ctorNames, body) // eslint-disable-line no-new-func
  const value = fn(undefined, puzzle, helpers, ...globalNames.map(n => globals[n]), ...ctors)
  return { ctorNames, value }
}
