// build-ref.mjs --public-only drops the app's private internals from the
// published reference page. Fixture only: a small reference with public and
// non-public entries is built by a copy of the real script (it reads
// page.json, guide.md and vt/ beside itself), never the real reference.
//
// nonPublicNames' rules are pinned here, because the residual guard re-scans
// the page with the same list: a name the list misses leaks silently and this
// test is the only witness.
//
//   node tools/humanify/build-ref.test.mjs

import assert from 'assert'
import { execFileSync } from 'child_process'
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
// The directory holding `marked`, which Node resolves from the script's own folder.
const nodeModules = dirname(dirname(fileURLToPath(import.meta.resolve('marked'))).replace(/(node_modules\/marked).*/, '$1'))

const PREAMBLE = `# Fixture reference

Caveats:

- Access. **public**: handed to custom code. **reachable, not documented**: you can
  reach it; not for calling.
  Entries in the internals sections also carry where the body was
  read in full.
`

const CORE = `## Core

Core intro.

### PublicThing (class PublicThing extends SecretEngine)

Access: **public** — handed to custom code by name.

PublicThing holds data. It wraps a \`SecretEngine\` for speed. Call \`publicMethod\` freely.

- Keep \`publicMethod\` cheap.
- Never touch \`SecretEngine\` directly.
- Prefer \`removeCandidate\` over a rebuild.
- A kept item.
  - A nested item about \`secretMethod\`.

| Name | Note |
|---|---|
| publicMethod | fine |
| rowhider | uses \`secretMethod\` |

#### \`publicMethod(solverState)\`

Pass \`solverState\` here. Then see \`puzzle.state\` for more.

#### \`removeCandidateFromCell(x)\`

Removes one digit.
`

const HOOD = `## Hood

Hood intro.

### SecretEngine (class SecretEngine)

Access: **internal** — a helper.

The engine.

#### \`secretMethod(a)\`

Secret.

#### \`goNow()\`

Short camelCase.

#### \`goTo()\`

Too short to redact.

#### \`plainmethod()\`

No camel case, so not redacted.

#### \`removeCandidate(x)\`

A stem of a public method.

### Tiny (class Tiny)

Access: **internal** — a helper.

### Hidden helper (class HiddenHelper, global LegacyAlias)

Access: **internal** — a helper.
`

const FIXTURE_REF = PREAMBLE + '\n' + CORE + '\n' + HOOD
const PAGE = { sectionOrder: ['Core'], underTheHood: ['Hood'], componentFamilies: [], tasks: [] }
const GUIDE = '## Guide: fixture\n\nStart with `publicMethod`. The `SecretEngine` does the rest.\n'

const root = mkdtempSync(join(tmpdir(), 'build-ref-test-'))
process.on('exit', () => rmSync(root, { recursive: true, force: true }))
const tool = join(root, 'tool')
mkdirSync(tool)
copyFileSync(join(here, 'build-ref.mjs'), join(tool, 'build-ref.mjs'))
symlinkSync(join(here, 'vt'), join(tool, 'vt'))
symlinkSync(nodeModules, join(root, 'node_modules'))
writeFileSync(join(tool, 'page.json'), JSON.stringify(PAGE))
writeFileSync(join(tool, 'guide.md'), GUIDE)

let n = 0
// Build a reference; returns {ok, html (the page's visible text), stderr}.
function build (ref, publicOnly = true) {
  const src = join(root, `ref-${n}.md`); const out = join(root, `out-${n++}.html`)
  writeFileSync(src, ref)
  try {
    execFileSync('node', [join(tool, 'build-ref.mjs'), src, out, ...(publicOnly ? ['--public-only'] : [])], { stdio: 'pipe' })
  } catch (e) {
    return { ok: false, stderr: String(e.stderr) }
  }
  const html = readFileSync(out, 'utf8')
  const text = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/ ([.,)])/g, '$1')
  return { ok: true, text, html }
}

const pub = build(FIXTURE_REF)
assert.ok(pub.ok, 'the fixture reference builds public-only: ' + pub.stderr)
const t = pub.text
const gone = (s, why) => assert.ok(!t.includes(s), `public-only page still holds "${s}": ${why}`)
const kept = (s, why) => assert.ok(t.includes(s), `public-only page lost "${s}": ${why}`)

// A sentence, list item and table row naming a non-public class or method go.
gone('wraps a', 'sentence naming a non-public class must be cut whole')
gone('Never touch', 'list item naming a non-public class must be cut')
gone('rowhider', 'table row naming a non-public method must be cut')
gone('nested item', 'a flagged nested item goes')
gone('The engine', 'a non-public entry is not built')
gone('SecretEngine', 'no non-public class name survives anywhere, the guide included')
gone('puzzle.state', '`puzzle.state` is always redacted')
gone('extends', 'an `extends <non-public class>` is cut from a heading')

// What stays: public prose, headings, Access lines, and `solverState` as `state`.
kept('PublicThing holds data.', 'the sentence beside a cut one stays')
kept('Call publicMethod freely.', 'a public name stays')
kept('Keep publicMethod cheap.', 'a public list item stays')
kept('A kept item.', 'the sibling of a flagged nested item stays')
kept('publicMethod(state)', 'solverState reads state in a heading')
kept('Pass state here.', 'solverState reads state in prose')
assert.ok(/<p class="access"><span class="vt-pill dot good">public<\/span>/.test(pub.html), 'the public entry keeps its Access line')
kept('removeCandidateFromCell(x)', 'a public method heading stays')
kept('Start with publicMethod.', 'the guide keeps its public sentence')

// nonPublicNames' rules, one at a time. A name of a rule that does NOT redact
// stays in the page, so a change to which names are redacted is deliberate.
const ruleRef = (pubProse, hood) => build(
  PREAMBLE + '\n## Core\n\nIntro.\n\n### Pub (class Pub)\n\nAccess: **public** — by name.\n\n' + pubProse + '\n\n#### `pubMethod(x)`\n\nBody.\n\n## Hood\n\nIntro.\n\n' + hood
)
const hoodEntry = (heading, methods = []) => `### ${heading}\n\nAccess: **internal** — a helper.\n\n` + methods.map(m => `#### \`${m}()\`\n\nBody.\n`).join('\n')

// classes of 5+ characters are redacted; a 4-character class is not
let r = ruleRef('A line naming `Tiny`. A line naming `Larger`.', hoodEntry('Tiny (class Tiny)') + '\n' + hoodEntry('Larger (class Larger)'))
assert.ok(r.ok, r.stderr)
assert.ok(r.text.includes('A line naming Tiny.'), 'a class under 5 characters is not redacted')
assert.ok(!r.text.includes('Larger'), 'a class of 5 characters is redacted')
// aliases of a non-public class are redacted like the class
r = ruleRef('A line naming `LegacyAlias`. A kept line.', hoodEntry('Hidden (class Hidden, global LegacyAlias)'))
assert.ok(r.ok, r.stderr)
assert.ok(!r.text.includes('LegacyAlias') && r.text.includes('A kept line.'), 'a non-public class alias is redacted')
// methods: camelCase and 5+ characters only
r = ruleRef('Uses `goNow`. Uses `goTo`. Uses `plainmethod`. Uses `secretMethod`.', hoodEntry('Eng (class Eng)', ['goNow', 'goTo', 'plainmethod', 'secretMethod']))
assert.ok(r.ok, r.stderr)
assert.ok(!r.text.includes('Uses goNow.'), 'a 5-character camelCase method is redacted')
assert.ok(r.text.includes('Uses goTo.'), 'a method under 5 characters is not redacted')
assert.ok(r.text.includes('Uses plainmethod.'), 'a method with no camelCase is not redacted')
assert.ok(!r.text.includes('secretMethod'), 'a camelCase method of 5+ characters is redacted')
// the public-stem exemption: `removeCandidate` is the stem of a public method
r = build(PREAMBLE + '\n## Core\n\nIntro.\n\n### Pub (class Pub)\n\nAccess: **public** — by name.\n\nUses `removeCandidate`.\n\n#### `removeCandidateFromCell(x)`\n\nBody.\n\n## Hood\n\nIntro.\n\n' + hoodEntry('Eng (class Eng)', ['removeCandidate']))
assert.ok(r.ok, r.stderr)
assert.ok(r.text.includes('Uses removeCandidate.'), 'a method that is the stem of a public one is exempt')
// a name public in one entry and non-public in another is not redacted
r = ruleRef('Uses `Shared`.', hoodEntry('Shared (class Shared)') + '\n### Shared (class Shared)\n\nAccess: **public** — by name.\n')
assert.ok(r.ok, r.stderr)
assert.ok(r.text.includes('Uses Shared.'), 'a class public anywhere is not redacted')

// The full build keeps what the public one cut: the filter is what removes it.
const full = build(FIXTURE_REF, false)
assert.ok(full.ok, 'the fixture builds in full: ' + full.stderr)
assert.ok(full.text.includes('wraps a SecretEngine for speed'), 'the full page keeps the sentence the public page cuts')

// The residual guard: a non-public name scrub leaves alone (fences are kept
// verbatim) is caught on the rendered page and fails the build.
const planted = build(FIXTURE_REF.replace('#### `removeCandidateFromCell(x)`\n\nRemoves one digit.', '#### `removeCandidateFromCell(x)`\n\nRemoves one digit.\n\n```js\nnew SecretEngine()\n```'))
assert.ok(!planted.ok, 'a non-public name surviving in a fence must fail the build')
assert.ok(/public-only: non-public names survive in the page/.test(planted.stderr) && /SecretEngine/.test(planted.stderr),
  'the residual guard names the planted leak: ' + planted.stderr)

console.log('build-ref public-only: ok')
