// The Node half of the `// #include` directive: read a paste target and splice
// in the files it names, so a test or a probe runs the same assembled source
// the link ships.
//
// The Python half is `minify_js` in examples/_shared/minify.py, which is what
// actually builds a link. This one does not strip comments -- Node runs the
// source, it does not ship it -- so the two agree on the directive and on
// nothing else. Keep the syntax identical when either changes.
//
// A directive is a whole line reading `// #include <path>`, resolved against
// the including file's own directory. A missing file, a cycle, or a directive
// naming no path throws, the way the Python side refuses them.

import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'

const INCLUDE = /^\s*\/\/\s*#include\b(.*)$/

// `readFile` reads one file's text by absolute path: the working tree by
// default, or `git show` at a commit for `loadAt` in harness-lib.mjs, so a
// pinned component splices the includes it shipped with. It throws for a file
// that does not exist.
export function assembleSource (path, stack = [], readFile = p => readFileSync(p, 'utf8')) {
  const here = resolve(path)
  if (stack.includes(here)) throw new Error(`#include cycle through ${here}`)
  return readFile(here).split('\n').map(line => {
    const m = INCLUDE.exec(line)
    if (!m) return line
    const rel = m[1].trim()
    if (!rel || rel.split(/\s+/).length !== 1) {
      throw new Error(`an #include names exactly one path, which this one does not: ${JSON.stringify(m[1])}`)
    }
    return assembleSource(resolve(dirname(here), rel), [...stack, here], readFile).replace(/\n$/, '')
  }).join('\n')
}
