// The one way to load the app's renamed solver bundle
// (examples/_shared/vendor/bundle.claude.js) into Node (#660).
//
// The bundle is one `(function () { ... })();`, so nothing inside it is
// reachable from outside. `loadBundle` appends `__expose.<name> = <name>`
// lines before the closing `})();`, evaluates the result with the worker
// globals bound as parameters (a load never clobbers another load in the same
// process), and returns the exposed bindings. Agents call this rather than
// hand-rolling a loader; docs/research/bundle-api-reference.md lists the names.

import { readFileSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'

export const BUNDLE_PATH = join(import.meta.dirname, 'vendor', 'bundle.claude.js')
// sha256 of the bundle every caller was written against. A different file
// means the line numbers and binding names the callers cite may have moved.
const BUNDLE_SHA = '312461e131246b041caf73b9c53258b940ecc002a85bef3bcf7b0d50bb437066'

const TAIL = '})();'

// `expose`: binding names to read out of the bundle's scope; a name the bundle
// does not define throws a ReferenceError at load. `countNodes`: also expose
// SolverState and count its `clone` calls (a search node) on this load only;
// `nodes()` throws on a load without it, never a silent 0.
// Returns `{ onmessage, drain, exposed, nodes }`: `onmessage` is the bundle's
// own worker dispatcher and `drain()` empties what it posted.
export function loadBundle ({ expose = [], countNodes = false, bundlePath = BUNDLE_PATH } = {}) {
  const raw = readFileSync(bundlePath, 'utf8')
  const sha = createHash('sha256').update(raw).digest('hex')
  if (sha !== BUNDLE_SHA) throw new Error(`bundle changed (${sha}); re-read it before trusting a caller`)
  if (!raw.trimEnd().endsWith(TAIL)) throw new Error('unexpected bundle tail')

  const names = [...new Set([...expose, ...(countNodes ? ['SolverState'] : [])])]
  for (const name of names) {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw new Error(`not an identifier: ${name}`)
  }
  const src = raw.trimEnd().slice(0, -TAIL.length) +
    names.map(name => `\n  __expose.${name} = ${name}`).join('') + '\n' + TAIL

  const posted = []
  const exposed = {}
  // `new Function` runs in global scope, so the bundle's bare `onmessage` and
  // `postMessage` resolve against these parameters, not `globalThis`.
  const fn = new Function('self', 'onmessage', 'postMessage', 'addEventListener', '__expose', // eslint-disable-line no-new-func
    src + '\nreturn onmessage')
  const onmessage = fn({}, null, (msg) => posted.push(msg), () => {}, exposed)

  let count = 0
  if (countNodes) {
    const clone = exposed.SolverState.prototype.clone
    exposed.SolverState.prototype.clone = function (...args) { count++; return clone.apply(this, args) }
  }
  const nodes = () => {
    if (!countNodes) throw new Error('nodes(): load with countNodes: true')
    return count
  }
  return { onmessage, drain: () => posted.splice(0), exposed, nodes }
}
