// Extract the app bundle's public API surface into a checked-in Markdown
// index (#410).
//
//   node examples/_shared/bundle-index.mjs
//
// Reads the tracked HAR (`sudokumaker.har`), picks the JS bundle entries
// whose body contains `getCellsCanHaveRepeats` -- the app's solver/main/query
// bundles, de-duplicated by content -- and writes
// `docs/research/bundle-api-index.md`.
//
// Parses each bundle with `acorn` and extracts off the resulting AST, rather
// than scanning the minified text for brackets/braces. The three bundles are
// the same library under different mangled names (a Vite chunk duplicated
// per entry point); `bundle-index.test.mjs` asserts they agree, and this
// script reads its structural detail from one of them (the `solver-*`
// bundle, which carries the fullest component + solve surface) and its
// built-in component registrations from all of them, unioned.
//
// Nothing here is anchored to a mangled name -- every lookup starts from a
// public marker (a method name, a decorator string, a namespace-object key)
// and only then follows references to find the class/function that defines
// it. A bundle that changes these shapes produces an empty or partial
// section, not a hand-tuned identifier that quietly goes stale;
// `bundle-index.test.mjs`'s known-name assertions are what catches that.

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import * as acorn from 'acorn'

const HERE = dirname(fileURLToPath(import.meta.url))
const HAR_PATH = join(HERE, 'sudokumaker.har')
export const OUTPUT_PATH = join(HERE, '..', '..', 'docs', 'research', 'bundle-api-index.md')

const MARKER = 'getCellsCanHaveRepeats'

// helpers.* namespace -> the factory's own key, in the order the factory
// object literal declares them (the doc's helpers section follows this).
const HELPER_KEYS = [
  'cellIds', 'cornerIds', 'edgeIds', 'outerCellIds', 'geometry',
  'sums', 'xSums', 'digits', 'naming', 'connectivity'
]

// DigitSet methods verified (docs/puzzle-api.md) to mutate `this` in place,
// vs. read-only. Not derivable from the AST alone (`intersect` mutates,
// `intersects` and `isSubsetOf` do not) -- recorded here from that doc so
// the two docs cannot silently disagree; a mismatch is a prompt to update
// whichever is stale, not a bug in either.
const DIGITSET_MUTATOR_NAMES = ['add', 'delete', 'clear', 'union', 'intersect', 'xor', 'subtract']
const DIGITSET_MUTATORS = new Map(DIGITSET_MUTATOR_NAMES.map(name => [name, 'yes']))

// The change-object type enum names the shape, not the fields; the fields
// are read here off the app's own factory functions (see docs/research/
// bundle-api-index.md's Change objects section for the source read), keyed
// on the enum's own public names so a renumbering can't desync this table.
const CHANGE_PAYLOADS = {
  SetValue: 'value, cell',
  FilterCandidatesAtCell: 'value, cell',
  FilterCandidatesAtCells: 'value, cells',
  RemoveCandidatesFromCell: 'value, cell',
  RemoveCandidatesFromCells: 'value, cells',
  AbortSolver: 'message, cells',
  ReplaceComponent: 'with'
}

function loadBundleSources () {
  const har = JSON.parse(readFileSync(HAR_PATH, 'utf8'))
  const urlForText = new Map()
  for (const entry of har.log.entries) {
    const text = entry.response.content.text || ''
    if (!text.includes(MARKER)) continue
    if (!urlForText.has(text)) urlForText.set(text, entry.request.url)
  }
  // solver-* first: the structural source of record (see file header)
  const entries = [...urlForText.entries()]
  entries.sort((a, b) => Number(!a[1].includes('solver-')) - Number(!b[1].includes('solver-')))
  return new Map(entries.map(([text, url]) => [url, text]))
}

function parseBundle (src) {
  return acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module' })
}

// Walk the whole AST collecting every node for which `predicate` is true.
// Not a full-generality visitor -- it doesn't need one -- just a recursive
// walk over own enumerable properties that hold a node or array of nodes.
function collect (node, predicate, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const item of node) collect(item, predicate, out)
    return out
  }
  if (typeof node.type === 'string') {
    if (predicate(node)) out.push(node)
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue
      collect(node[key], predicate, out)
    }
  }
  return out
}

function memberName (key, computed) {
  if (key.type === 'PrivateIdentifier') return '#' + key.name
  if (computed) return `[${exprText(key)}]`
  return key.name !== undefined ? key.name : String(key.value)
}

function exprText (node) {
  if (node.type === 'Identifier') return node.name
  if (node.type === 'MemberExpression') return `${exprText(node.object)}.${exprText(node.property)}`
  return '?'
}

function classMembers (classNode) {
  const members = []
  for (const el of classNode.body.body) {
    if (el.type === 'PropertyDefinition') {
      members.push({ name: memberName(el.key, el.computed), kind: 'field', static: el.static })
    } else if (el.type === 'MethodDefinition') {
      const kind = el.kind === 'get' || el.kind === 'set'
        ? `accessor-${el.kind}`
        : (el.value.generator ? 'generator' : 'method')
      members.push({
        name: memberName(el.key, el.computed),
        kind,
        arity: el.value.params.length,
        static: el.static
      })
    }
  }
  return members
}

// name -> ClassDeclaration/ClassExpression node, covering both `class X{}`
// and the `let X=class extends Y{}` shape this bundle also uses.
function classesByName (ast) {
  const map = new Map()
  for (const cls of collect(ast, n => n.type === 'ClassDeclaration' && n.id)) {
    map.set(cls.id.name, cls)
  }
  for (const decl of collect(ast, n => n.type === 'VariableDeclarator' && n.init && n.init.type === 'ClassExpression')) {
    if (decl.id.type === 'Identifier') map.set(decl.id.name, decl.init)
  }
  return map
}

function findFunctionsReturningObject (ast) {
  return collect(ast, n =>
    (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression') &&
    n.body && n.body.type === 'BlockStatement' &&
    n.body.body.length > 0 &&
    n.body.body[n.body.body.length - 1].type === 'ReturnStatement' &&
    n.body.body[n.body.body.length - 1].argument &&
    n.body.body[n.body.body.length - 1].argument.type === 'ObjectExpression'
  )
}

// Read the `helpers` factory (`function NAME(s){const a=new ClassA(...),...;
// return{cellIds:a,...}}`), identified by its return object carrying a
// `cellIds` key -- a public name, not a mangled one. Takes the already-
// collected candidate functions (shared with extractDigitSetClassName)
// rather than re-walking the AST for the same node shape.
function extractHelperClassNames (fns) {
  for (const fn of fns) {
    const ret = fn.body.body[fn.body.body.length - 1]
    if (!ret.argument.properties.some(p => p.key && p.key.name === 'cellIds')) continue

    const varToClass = new Map()
    for (const stmt of fn.body.body) {
      if (stmt.type !== 'VariableDeclaration') continue
      for (const decl of stmt.declarations) {
        if (decl.init && decl.init.type === 'NewExpression' && decl.init.callee.type === 'Identifier') {
          varToClass.set(decl.id.name, decl.init.callee.name)
        }
      }
    }

    const result = {}
    for (const prop of ret.argument.properties) {
      const key = prop.key.name
      const varName = prop.value.type === 'Identifier' ? prop.value.name : null
      if (varName && varToClass.has(varName)) result[key] = varToClass.get(varName)
    }
    return result
  }
  throw new Error('helpers factory (return object with a cellIds key) not found')
}

// Read the DigitSet class name off a namespace factory's `SudokuDigitSet`
// key (same idea as the digits above; the app's own `zs()`-shaped
// `function(){return{...,SudokuDigitSet:X,...}}`). Same shared `fns`.
function extractDigitSetClassName (fns) {
  for (const fn of fns) {
    const ret = fn.body.body[fn.body.body.length - 1]
    for (const prop of ret.argument.properties) {
      if (prop.key && prop.key.name === 'SudokuDigitSet' && prop.value.type === 'Identifier') {
        return prop.value.name
      }
    }
  }
  throw new Error('SudokuDigitSet: key not found in any namespace factory')
}

// Main code's `createExtendedHelpers` (docs/puzzle-api.md's "Two helpers
// objects") spreads the base `createHelpers` result and overrides `geometry`
// with a region-aware subclass, adding `lines` and `misc` -- keys the base
// factory never has. Found by shape (a SpreadElement alongside a `geometry`
// property in the same object literal), not by a mangled name, so a bundle
// update that drops the override empties this instead of throwing.
const EXTENDED_ONLY_KEYS = ['geometry', 'lines', 'misc']

function findExtendedHelpersLiteral (ast) {
  const literals = collect(ast, n =>
    n.type === 'ObjectExpression' &&
    n.properties.some(p => p.type === 'SpreadElement') &&
    n.properties.some(p => p.type === 'Property' && p.key && p.key.name === 'geometry'))
  return literals[0] || null
}

function extractExtendedHelperClassNames (ast) {
  const literal = findExtendedHelpersLiteral(ast)
  if (!literal) return {}
  const result = {}
  for (const prop of literal.properties) {
    if (prop.type !== 'Property' || !prop.key) continue
    if (!EXTENDED_ONLY_KEYS.includes(prop.key.name)) continue
    if (prop.value.type === 'NewExpression' && prop.value.callee.type === 'Identifier') {
      result[prop.key.name] = prop.value.callee.name
    }
  }
  return result
}

// Find the class defining a method with this public name.
function findClassDefiningMethod (byName, methodName) {
  for (const [name, cls] of byName) {
    if (cls.body.body.some(el => el.type === 'MethodDefinition' && el.key.name === methodName)) {
      return name
    }
  }
  return null
}

function superClassName (cls) {
  return cls.superClass && cls.superClass.type === 'Identifier' ? cls.superClass.name : null
}

// byName.get(x) for a class this script's own logic expects to exist --
// a missing one means an earlier lookup (extractHelperClassNames,
// findClassDefiningMethod, extractDigitSetClassName, superClassName) found
// a name the bundle doesn't actually declare as a class, which is a bug in
// this script or a bundle shape it no longer recognizes. Naming which
// lookup failed beats the generic TypeError that follows from indexing
// into `undefined`.
function requireClass (byName, name, context) {
  const cls = byName.get(name)
  if (!cls) throw new Error(`${context}: no class named ${name}`)
  return cls
}

// A component param's type node comes in three shapes in this bundle:
// `f.CellArray` (a type-enum member), a bare string literal ("CellId[][]"
// on DifferentCombinations), or an object literal carrying `type` plus
// extra constraints (`{type:f.CellArray,amount:2}` on Between's
// `endPoints`, `{type:f.ObjectArray,fields:{...}}` on SameSum's `groups`).
// Reading only the first shape silently drops the param on the other two --
// which is what this function existed to fix (see #410 review).
function describeParamType (node) {
  if (node.type === 'MemberExpression' && node.property.type === 'Identifier') {
    return node.property.name
  }
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value
  }
  if (node.type === 'ObjectExpression') {
    const type = node.properties.find(p => p.key && p.key.name === 'type')
    const base = type && type.value.type === 'MemberExpression' ? type.value.property.name : 'Object'
    const fields = node.properties.find(p => p.key && p.key.name === 'fields')
    if (fields && fields.value.type === 'ObjectExpression') {
      const names = fields.value.properties.map(p => (p.key.type === 'Identifier' ? p.key.name : p.key.value))
      return `${base} of {${names.join(', ')}}`
    }
    const extras = node.properties.filter(p => p !== type).map(p => `${p.key.name}: ${p.value.value}`)
    return extras.length ? `${base} (${extras.join(', ')})` : base
  }
  return null
}

function isNameLiteral (n) {
  return n.type === 'Literal' && typeof n.value === 'string' && /^[A-Z]/.test(n.value)
}

// `defineComponent` takes either one display name (`"House"`) or an array
// of names (`["Pair","AsymmetricalPair"]`) registering every name as an
// alias of the first.
function isNameArg (n) {
  return isNameLiteral(n) ||
    (n.type === 'ArrayExpression' && n.elements.length > 0 && n.elements.every(el => el && isNameLiteral(el)))
}

// The message is usually a plain string, but a multi-line message (a
// trailing "**Note:**" paragraph) is written as a template literal instead
// -- still with no `${...}` in this bundle, but a future one could add one,
// so an expression is rendered as a `${...}` placeholder rather than
// silently dropping the row.
function extractMessage (node) {
  if (node.type === 'Literal') return node.value
  let out = ''
  node.quasis.forEach((quasi, i) => {
    out += quasi.value.cooked
    if (i < node.expressions.length) out += '$' + '{...}'
  })
  return out
}

// `IDENT("Title"|["Title","Alias",...],"message {template}"|`template`,
// [["param",<type>],...])` -- every built-in component's registration
// decorator.
function extractComponents (ast) {
  const calls = collect(ast, n =>
    n.type === 'CallExpression' &&
    n.arguments.length >= 3 &&
    isNameArg(n.arguments[0]) &&
    (n.arguments[1].type === 'TemplateLiteral' ||
      (n.arguments[1].type === 'Literal' && typeof n.arguments[1].value === 'string')) &&
    n.arguments[2].type === 'ArrayExpression'
  )
  const out = new Map()
  for (const call of calls) {
    const nameArg = call.arguments[0]
    const names = nameArg.type === 'ArrayExpression' ? nameArg.elements.map(el => el.value) : [nameArg.value]
    const primary = names[0]
    const message = extractMessage(call.arguments[1])
    const params = []
    for (const el of call.arguments[2].elements) {
      if (!el || el.type !== 'ArrayExpression' || el.elements.length !== 2) continue
      const [pname, ptype] = el.elements
      const typeDesc = pname && pname.type === 'Literal' ? describeParamType(ptype) : null
      if (typeDesc) params.push([pname.value, typeDesc])
    }
    for (const name of names) {
      out.set(name, { message, params, alias: name === primary ? null : primary })
    }
  }
  return out
}

// The change-object `type` enum, matched on the TS-enum-to-object shape
// `s[s.SetValue=0]="SetValue",s[s.FilterCandidatesAtCell=1]="...",...` --
// read off the app's own numbering rather than hand-copied, so a
// renumbering shows up as a diff here instead of going unnoticed.
//
// The bundle declares several enums in exactly this shape (component
// message ids, direction enums, ...), so matching the per-entry shape
// alone is not enough -- it silently merges every such enum into one
// number->name map. Each enum's entries live together in one
// SequenceExpression (the comma-joined IIFE body), so entries are grouped
// by that first, and only the group containing the public marker name
// `SetValue` is kept.
function extractChangeTypeEnum (ast) {
  const isEnumAssignment = n =>
    n.type === 'AssignmentExpression' &&
    n.left.type === 'MemberExpression' && n.left.computed &&
    n.left.property.type === 'AssignmentExpression' &&
    n.left.property.left.type === 'MemberExpression' &&
    n.left.property.left.property.type === 'Identifier' &&
    n.left.property.right.type === 'Literal' &&
    n.right.type === 'Literal' &&
    n.left.property.left.property.name === n.right.value

  // The sequence's last element is often the bare identifier being built
  // up (`(a,b,c,s)` returns `s`), not another assignment -- only the
  // assignment-shaped entries are kept from each candidate sequence.
  const sequences = collect(ast, n =>
    n.type === 'SequenceExpression' && n.expressions.filter(isEnumAssignment).length >= 2)

  for (const seq of sequences) {
    const entries = {}
    for (const a of seq.expressions.filter(isEnumAssignment)) {
      entries[a.left.property.right.value] = a.left.property.left.property.name
    }
    if (Object.values(entries).includes('SetValue')) return entries
  }
  throw new Error('change-object type enum (containing SetValue) not found')
}

function buildIndex (sources) {
  const [primaryUrl, primaryText] = sources.entries().next().value
  const ast = parseBundle(primaryText)
  const byName = classesByName(ast)
  const functionsReturningObject = findFunctionsReturningObject(ast)

  const helperClasses = extractHelperClassNames(functionsReturningObject)
  const helperMembers = {}
  for (const key of HELPER_KEYS) {
    if (!(key in helperClasses)) continue
    helperMembers[key] = classMembers(requireClass(byName, helperClasses[key], `helpers.${key}`))
  }

  const extendedHelperClasses = extractExtendedHelperClassNames(ast)
  const extendedHelperMembers = {}
  for (const key of EXTENDED_ONLY_KEYS) {
    if (!(key in extendedHelperClasses)) continue
    extendedHelperMembers[key] = classMembers(
      requireClass(byName, extendedHelperClasses[key], `helpers.${key} (main code only)`))
  }

  const puzzleClassName = findClassDefiningMethod(byName, 'getCandidatesBitMask')
  if (!puzzleClassName) throw new Error('no class defines getCandidatesBitMask')
  const puzzleClass = requireClass(byName, puzzleClassName, 'puzzle/state')
  const puzzleBaseName = superClassName(puzzleClass)
  if (!puzzleBaseName) throw new Error(`puzzle/state: ${puzzleClassName} does not extend a named base class`)
  const puzzleBaseClass = requireClass(byName, puzzleBaseName, 'puzzle/state base')

  const digitSetClassName = extractDigitSetClassName(functionsReturningObject)
  const digitSetClass = requireClass(byName, digitSetClassName, 'DigitSet')
  const digitSetBaseName = superClassName(digitSetClass)
  if (!digitSetBaseName) throw new Error(`DigitSet: ${digitSetClassName} does not extend a named base class`)
  const digitSetBaseClass = requireClass(byName, digitSetBaseName, 'DigitSet base')

  const components = new Map()
  for (const text of sources.values()) {
    for (const [name, info] of extractComponents(parseBundle(text))) {
      components.set(name, info)
    }
  }
  const sortedComponents = new Map([...components.entries()].sort())

  const changeTypes = extractChangeTypeEnum(ast)

  return {
    sources,
    primaryUrl,
    helperClasses,
    helperMembers,
    extendedHelperClasses,
    extendedHelperMembers,
    puzzleClassName,
    puzzleMembers: classMembers(puzzleClass),
    puzzleBaseName,
    puzzleBaseMembers: classMembers(puzzleBaseClass),
    digitSetClassName,
    digitSetMembers: classMembers(digitSetClass),
    digitSetBaseName,
    digitSetBaseMembers: classMembers(digitSetBaseClass),
    components: sortedComponents,
    changeTypes
  }
}

function sig (member) {
  const prefix = member.static ? 'static ' : ''
  if (member.kind === 'field') return `${prefix}${member.name}`
  if (member.kind.startsWith('accessor-')) return `${prefix}${member.kind.slice('accessor-'.length)} ${member.name}`
  const star = member.kind === 'generator' ? '*' : ''
  const args = Array.from({ length: member.arity }, (_, i) => `arg${i}`).join(', ')
  return `${prefix}${star}${member.name}(${args})`
}

const MAIN_CODE_ONLY = 'main code only'

// `notes` maps a member name to the text shown in the third column --
// `yes` for a DigitSet mutator, `main code only` for a member that comes
// from `createExtendedHelpers`'s override rather than the base factory.
function membersTable (members, notes = new Map(), column = 'Mutates') {
  const lines = [`| Member | Kind | ${column} |`, '|-|-|-|']
  for (const m of members) {
    if (m.name === 'constructor') continue
    lines.push(`| \`${sig(m)}\` | ${m.kind} | ${notes.get(m.name) || ''} |`)
  }
  return lines.join('\n')
}

function markAll (members, note) {
  return new Map(members.map(m => [m.name, note]))
}

function render (index) {
  const lines = []
  lines.push('# Bundle API index')
  lines.push('')
  lines.push(
    'Generated by `examples/_shared/bundle-index.mjs` from the tracked ' +
    '`examples/_shared/sudokumaker.har`. Do not hand-edit -- ' +
    '`bundle-index.test.mjs` asserts this file is byte-equal to a fresh run ' +
    'of the script, so a hand edit is a failing test, not a fix. Regenerate ' +
    'with:\n\n    node examples/_shared/bundle-index.mjs'
  )
  lines.push('')
  lines.push(
    'Built from these HAR bundle entries (de-duplicated by body; same ' +
    'library, different mangled names per Vite chunk):'
  )
  lines.push('')
  for (const url of index.sources.keys()) {
    lines.push(`- ${url}${url === index.primaryUrl ? ' (structural source)' : ''}`)
  }
  lines.push('')
  lines.push(
    'Mangled class/method names are internal to one build of the bundle ' +
    'and are expected to change on the app\'s next release. Only the public ' +
    'names -- method names, decorator display names, parameter names -- are ' +
    'load-bearing here; a mangled class name is printed once per section as ' +
    'a secondary column, to find the class in the bundle, not to be relied ' +
    'on across app versions.'
  )
  lines.push('')

  lines.push('## Mask conventions')
  lines.push('')
  lines.push(
    'A digit mask is a bitmask where bit `d` represents digit `d` (`1 << ' +
    'd`). `allDigitsMask = (1 << (maxDigit + 1)) - (1 << minDigit)`. There ' +
    'is no cell-set mask type: a set of cells is always a plain array or ' +
    '`Set` of cell ids, never a bitmask.'
  )
  lines.push('')

  lines.push('## helpers')
  lines.push('')
  lines.push(
    '`helpers.<key>` for each key below; mangled class name from the app\'s ' +
    '`helpers` factory function shown alongside. Rows marked ' +
    `\`${MAIN_CODE_ONLY}\` come from \`createExtendedHelpers\` ` +
    '(docs/puzzle-api.md\'s "Two helpers objects"), not the base factory a ' +
    'custom component\'s `helpers` is built from.'
  )
  lines.push('')
  for (const key of Object.keys(index.helperMembers)) {
    const overrideMembers = index.extendedHelperMembers[key] || []
    lines.push(`### helpers.${key} (\`${index.helperClasses[key]}\`)`)
    lines.push('')
    lines.push(membersTable(
      [...index.helperMembers[key], ...overrideMembers],
      markAll(overrideMembers, MAIN_CODE_ONLY),
      'Note'
    ))
    lines.push('')
  }
  for (const key of EXTENDED_ONLY_KEYS) {
    if (key in index.helperMembers) continue // already rendered above, merged
    if (!(key in index.extendedHelperMembers)) continue
    lines.push(`### helpers.${key} (\`${index.extendedHelperClasses[key]}\`)`)
    lines.push('')
    lines.push(membersTable(
      index.extendedHelperMembers[key],
      markAll(index.extendedHelperMembers[key], MAIN_CODE_ONLY),
      'Note'
    ))
    lines.push('')
  }

  lines.push('## puzzle / state')
  lines.push('')
  lines.push(
    'The object reachable as `puzzle` inside a component\'s `update`. ' +
    `Mangled class \`${index.puzzleClassName} extends ${index.puzzleBaseName}\`; ` +
    'the base class supplies board geometry and region reads, the subclass ' +
    'adds candidate reads/writes and solver control.'
  )
  lines.push('')
  lines.push(`### base (\`${index.puzzleBaseName}\`)`)
  lines.push('')
  lines.push(membersTable(index.puzzleBaseMembers))
  lines.push('')
  lines.push(`### candidate + solver control (\`${index.puzzleClassName}\`)`)
  lines.push('')
  lines.push(membersTable(index.puzzleMembers))
  lines.push('')

  lines.push('## DigitSet (`SudokuDigitSet`)')
  lines.push('')
  const mutatorList = DIGITSET_MUTATOR_NAMES.map(m => `\`${m}\``).join(', ')
  lines.push(
    `Mangled class \`${index.digitSetClassName} extends ${index.digitSetBaseName}\`. ` +
    `${mutatorList} mutate \`this\` in place and return it; everything else ` +
    '(including `intersects`, `isSubsetOf`) is a read (verified in ' +
    '`docs/puzzle-api.md`).'
  )
  lines.push('')
  lines.push(`### base (\`${index.digitSetBaseName}\`)`)
  lines.push('')
  lines.push(membersTable(index.digitSetBaseMembers, DIGITSET_MUTATORS))
  lines.push('')
  lines.push(`### own (\`${index.digitSetClassName}\`)`)
  lines.push('')
  lines.push(membersTable(index.digitSetMembers, DIGITSET_MUTATORS))
  lines.push('')

  lines.push('## Built-in components')
  lines.push('')
  const aliasCount = [...index.components.values()].filter(info => info.alias).length
  lines.push(
    `${index.components.size} registered component names ` +
    `(${index.components.size - aliasCount} constructors, ${aliasCount} of them aliasing ` +
    'another name in the same registration call), read off their ' +
    '`("Name"|["Name","Alias",...],"message template",[[param,Type],...])` ' +
    'decorator call, unioned across every bundle entry (a given build may ' +
    'omit a component its chunk has no use for).'
  )
  lines.push('')
  lines.push('| Component | Params | Message template |')
  lines.push('|-|-|-|')
  for (const [name, info] of index.components) {
    const label = info.alias ? `${name} (alias of ${info.alias})` : name
    const params = info.params.map(([pname, ptype]) => `${pname}: ${ptype}`).join(', ')
    const message = info.message.replace(/\|/g, '\\|').replace(/\n/g, '<br>')
    lines.push(`| ${label} | ${params} | ${message} |`)
  }
  lines.push('')

  lines.push('## Change objects')
  lines.push('')
  lines.push(
    'The `{type: N, ...}` objects a component\'s `update`/`initialize` ' +
    'yields, read off the app\'s own type enum. `fields` beyond `type` is ' +
    'read off the app\'s factory functions, keyed on the enum\'s own names.'
  )
  lines.push('')
  lines.push('| type | name | fields |')
  lines.push('|-|-|-|')
  for (const num of Object.keys(index.changeTypes).map(Number).sort((a, b) => a - b)) {
    const name = index.changeTypes[num]
    lines.push(`| ${num} | ${name} | ${CHANGE_PAYLOADS[name] || ''} |`)
  }
  lines.push('')

  return lines.join('\n') + '\n'
}

export function generate () {
  return render(buildIndex(loadBundleSources()))
}

function main () {
  const markdown = generate()
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, markdown)
  console.log(`wrote ${OUTPUT_PATH}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
