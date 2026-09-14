// Run the app's real solver in Node, on a decoded puzzle document, without a
// browser (#429). Loads the renamed solver bundle
// (docs/research/humanify-pedagogy/bundle.claude.js) the way
// docs/research/humanify-pedagogy/tools/bugcheck.mjs does: stub the worker
// globals, `new Function` the trimmed source, then drive it through its own
// `onmessage` wire protocol -- the same "start" then "findAll" messages the
// real worker gets, read straight from the bundle body
// (bundle.claude.js:11461-11591; docs/research/bundle-api-reference.md
// "Worker handler for..." entries), never guessed.

import { readFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE_PATH = join(HERE, '..', '..', 'docs', 'research', 'humanify-pedagogy', 'bundle.claude.js')
const DECODE_CLI = join(HERE, 'link_codec_cli.py')

// The worker's own sentinel for "no value in this cell"
// (bundle.claude.js:4860, `EmptyValueSentinel = 4294967295`).
const EMPTY_VALUE = 4294967295

// Every LogicStepType string, read off the live bundle at load time
// (loadWorker's `__expose.LogicStepType`) rather than hand-copied here, so a
// bundle refresh can never drift this out of sync with bundle.claude.js:4752-
// 4768. The search itself (`Solver.findSolutions`) is correct with any subset
// enabled or none at all -- these only pick which cheap deductions run
// between branch points (bundle-api-reference.md "Solver internals") -- so
// running every step is the safe, fast default; nothing here trades
// correctness for speed. Kept only as the default `buildStartMessage` falls
// back to when called without a bundle-derived list (its unit tests).
const FALLBACK_STEP_TYPES = [
  'nakedSets', 'hiddenSets', 'pointingSets', 'xWings', 'fishes', 'yWings',
  'skyscrapers', 'unorthodoxNakedSets', 'simpleSumsLogic', 'consecutiveSetsLogic',
  'kropkiDotsLogic', 'unorthodoxFishes', 'countingCircles', 'byContradiction'
]

// Decodes a SudokuMaker link into its puzzle document. There is no JS
// LZString decoder in this repo -- `pyproject.toml`'s `lzstring` (used by
// examples/_shared/link_codec.py) is the only codec dependency (#429) -- so
// this shells out to the existing Python codec (link_codec_cli.py) rather
// than adding one.
export function decodeLinkFile (linkFile) {
  const out = execFileSync('uv', ['run', DECODE_CLI, linkFile], { encoding: 'utf8' })
  return JSON.parse(out)
}

// Maps a decoded puzzle document straight onto the worker's "start" message
// (bundle.claude.js:11511 `handleStartMessage({ spec, grid, constraints,
// strategy, verbose })`). `stepTypes` defaults to FALLBACK_STEP_TYPES for
// standalone/test use; solveDocument passes the live bundle's own list.
export function buildStartMessage (doc, { stepTypes = FALLBACK_STEP_TYPES } = {}) {
  const p = doc.puzzle
  const cellCount = p.width * p.height
  if (p.cells.length !== cellCount) {
    throw new Error(`${p.cells.length} cells for a ${p.width}x${p.height} board`)
  }

  // spec: puzzle-api.md "spec" -- size, minDigit, maxDigit, type. A document
  // that does not declare minDigit/maxDigit defaults to 1..width: every
  // shipped board that omits them (docs/research/406-gac-demo's demo pair,
  // examples/house-gac's standalone link) is a plain 1..width sudoku, and
  // examples/_shared/frame-rowcol.js:40's comment ("Hit Counts runs minDigit
  // 0") names that as the one exception, not the rule -- the default is not
  // 0-based. Confirmed against CP-SAT on the without-GAC link
  // (bundle-solve.test.mjs).
  const minDigit = p.minDigit ?? 1
  const maxDigit = p.maxDigit ?? p.width
  const spec = {
    size: { width: p.width, height: p.height },
    minDigit,
    maxDigit,
    // puzzle-api.md's spec section: digitCount is read straight off `spec`
    // (bundle.claude.js:1651 `setPuzzleSpec` deep-clones the object handed
    // to it, it is not derived from minDigit/maxDigit inside the bundle).
    digitCount: maxDigit - minDigit + 1,
    type: p.type
  }

  // grid: two words per cell, value then candidate-filter mask
  // (bundle.claude.js:11479 applyInitialGridToState). A cell carries its
  // value whenever it has one, `given` or not: outside clues on a frame
  // board live in the cell array as a non-given value
  // (examples/numbered-rooms/build_clued.py's `fill_ring`,
  // docs/real-app-timing.md "Numbered Rooms, Skyscraper"), and the worker
  // protocol itself makes no given/non-given distinction -- only the
  // document does, for the app's own display and export. A cell with
  // neither carries EMPTY_VALUE and no extra filter; component `initialize`
  // supplies its starting candidates.
  const grid = []
  for (const cell of p.cells) {
    grid.push(cell.value ?? EMPTY_VALUE, 0)
  }

  // constraints: setupPuzzle reads `constraint.config.type`
  // (bundle.claude.js:9349-9351), so each raw constraint record from the
  // document is wrapped, unchanged, as one `{ config }` entry -- the numeric
  // `type` codes in a saved link already match `ConstraintType`
  // (bundle.claude.js:9395-9450) one for one.
  const constraints = p.constraints.map(config => ({ config }))

  return {
    type: 'start',
    spec,
    grid,
    constraints,
    strategy: { stepTypes, useRandomness: false },
    verbose: false
  }
}

// Loads the trimmed solver bundle into stubbed worker globals and returns
// `{ onmessage, handleStartMessage, LogicStepType, drain }`. `onmessage` is
// the bundle's own dispatcher (bundle.claude.js:11461), used for "findAll" (a
// plain, blocking function -- bundle.claude.js:11578 -- so a thrown-and-
// caught component error surfaces synchronously through the console.error
// override in solveDocument). `handleStartMessage` and `LogicStepType` are
// exposed separately, the way bugcheck.mjs exposes internals with a trailing
// `globalThis.__probe = ...` before the bundle's closing `})();`:
// `handleStartMessage` is itself `async` with no internal `await`
// (bundle.claude.js:11511), so calling it through `onmessage`'s fire-and-
// forget dispatch turns a thrown error into an unobserved rejected promise
// instead of a catchable throw -- awaiting it directly avoids that; and
// `LogicStepType` is module-local (bundle.claude.js:4752), so this is the
// only way to build a `strategy.stepTypes` list pinned to the loaded bundle.
function loadWorker () {
  let src = readFileSync(BUNDLE_PATH, 'utf8')
  const tail = '})();'
  if (!src.trimEnd().endsWith(tail)) throw new Error('unexpected bundle tail')
  src = src.trimEnd().slice(0, -tail.length) +
    '\n  __expose.handleStartMessage = handleStartMessage\n' +
    '\n  __expose.LogicStepType = LogicStepType\n' + tail

  const posted = []
  const expose = {}
  // `new Function` runs in global scope (bundle-api-reference.md:1577), so
  // `onmessage = ...` and `postMessage(...)` in the bundle resolve as bare
  // identifiers against whichever globals are in scope when it runs -- bind
  // the names as parameters instead of relying on `globalThis`, so this
  // bundle load never clobbers another one running in the same process.
  const fn = new Function('self', 'onmessage', 'postMessage', 'addEventListener', '__expose', // eslint-disable-line no-new-func
    src + '\nreturn onmessage')
  const self = {}
  const onmessage = fn(self, null, (msg) => posted.push(msg), () => {}, expose)
  return {
    onmessage,
    handleStartMessage: expose.handleStartMessage,
    LogicStepType: expose.LogicStepType,
    drain: () => posted.splice(0)
  }
}

// Runs a decoded puzzle document through the real solver: a "start" message,
// then "findAll" (bundle.claude.js:11578 handleFindAllMessage), and returns
// every solution found plus the wall-clock time of the whole run.
export async function solveDocument (doc) {
  const worker = loadWorker()
  const start = buildStartMessage(doc, { stepTypes: Object.values(worker.LogicStepType) })

  // Every error path in the bundle -- a bad initial grid, a custom
  // component's `initialize`/`update`/`validate` throwing, the main backend
  // code throwing -- is caught internally and only `console.error`'d
  // (`logConstraintError`, bundle.claude.js:9911); nothing propagates to the
  // worker's own postMessage protocol. A batch scorer cannot afford that: a
  // broken constraint would silently score every puzzle as "no solutions"
  // instead of failing loud. So `console.error` is made to throw for the
  // duration of the run, restored after. This is a process-global patch, so
  // two overlapping `solveDocument` calls in the same process are not safe;
  // fine for this CLI's one-run-at-a-time use, not for a worker pool.
  const realConsoleError = console.error
  console.error = (error) => { throw error instanceof Error ? error : new Error(String(error)) }

  const t0 = process.hrtime.bigint()
  try {
    // Awaited directly, not through onmessage's fire-and-forget dispatch --
    // see loadWorker's comment: handleStartMessage is `async` with no
    // internal `await`, so a thrown error only surfaces this way.
    await worker.handleStartMessage(start)
    const initMessages = worker.drain()
    const init = initMessages.find(m => m.type === 'init')
    if (!init) throw new Error('no init message from the bundle')
    // Success and failure are told apart by which fields are present, not by
    // `changed` (bundle.claude.js:11518-11537): success always posts
    // `sudoku` (`changed` there is a legitimate `false`, meaning setup
    // changed nothing -- not a failure); failure never does, and its
    // `error` can itself be `undefined` (`createFailedResultForCell` builds
    // a failed result with no message, bundle-api-reference.md:3659-3663).
    // Keying on `sudoku`'s absence catches that case instead of letting a
    // message-less failure through to a silent zero-solutions `findAll`.
    if (!('sudoku' in init)) {
      throw new Error(`solver rejected the initial grid: ${init.error ?? '(no message)'}`)
    }

    worker.onmessage({ data: { type: 'findAll' } })
    const updates = worker.drain()
    const ms = Number(process.hrtime.bigint() - t0) / 1e6

    const solutions = updates
      .filter(m => m.type === 'update' && m.sudokuData)
      .map(m => gridBufferToDigits(m.sudokuData, doc.puzzle.width * doc.puzzle.height, start.spec.maxDigit))
    return { solutions, ms }
  } finally {
    console.error = realConsoleError
  }
}

// A solved grid's two-word buffer, read back as a plain digit string (one
// digit per cell, row-major) -- the same shape as a CP-SAT solution string,
// so a test can compare the two directly. One character per cell only holds
// for a single-digit domain; a two-digit `maxDigit` would make two distinct
// solutions stringify the same, so this fails loud instead.
function gridBufferToDigits (buffer, cellCount, maxDigit) {
  if (maxDigit > 9) throw new Error(`gridBufferToDigits: maxDigit ${maxDigit} is not a single digit`)
  let out = ''
  for (let i = 0; i < cellCount; i++) out += String(buffer[i * 2])
  return out
}
