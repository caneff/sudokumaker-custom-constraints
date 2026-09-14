// Build the single-page HTML view of docs/research/bundle-api-reference.md.
//   node build-ref.mjs <reference.md> <out.html>
//
// The page is a teaching view of the reference, in three parts:
//   Guide          ./guide.md, a reading order for a first-time author; every
//                  link in it must resolve to an id in the reference, or the
//                  build fails.
//   Reference      the markdown's h2 sections, reordered by ./page.json, with a
//                  "What do I call to…" task table first and the built-in
//                  components regrouped by family (page.json again) behind a
//                  generated index table.
//   Under the hood the internals sections, collapsed by default.
// Rendering is done here in Node with marked, so ids, links and the nav are
// fixed at build time; the browser script only filters, spies and toggles.
//
// Ids are stable and class-scoped: an h3 is the class it describes
// (`solverpuzzleview`), an h4 is class-method (`solverpuzzleview-getvalue`),
// an h2 is a slug of its title. Any `identifier` in backticks that names a
// class, or a method of the class whose entry it sits in (or a method unique
// across the page), becomes a link to that entry.
//
// Styling comes from the visual-teach component set inlined from ./vt/. The
// renderer maps the reference's conventions onto the components:
//   "Access: **tier** — reason"  → a colour chip; when the reason is the
//                                  section's default it shows the chip alone
//   **[inferred]**               → a small outline pill
//   > Discrepancy … / > Note …   → risk / info callouts
//   tables                       → .vt-table.compact in a scroll wrapper
//   fenced code                  → .vt-code with a copy button
//   fenced mermaid               → <pre class="mermaid"> in a .vt-diagram panel
//                                  (the artifact host renders mermaid itself)
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { marked } from 'marked'

const here = dirname(fileURLToPath(import.meta.url))
const vt = (name) => readFileSync(join(here, 'vt', name), 'utf8')
const page = JSON.parse(readFileSync(join(here, 'page.json'), 'utf8'))
const guideMd = readFileSync(join(here, 'guide.md'), 'utf8')

// ---------------------------------------------------------------- markdown prep
// The markdown keeps bundle line citations for readers with the bundle in
// hand; the page is for readers without it, so they are stripped here.
function stripLineRefs (text) {
  return text
    // the intro paragraph that explains the citations
    .replace(/\nLine citations \(`bundle\.claude\.js:<line>`\)[^\n]*(\n[^\n]+)*\n/, '\n')
    // "(`bundle.claude.js:123`)", "(`bundle.claude.js:123`, `bundle.claude.js:456`)", "(`bundle.claude.js:1985` and `:1988`)"
    .replace(/ ?\((?:`bundle\.claude\.js:\d+(?:-\d+)?`|`:\d+`)(?:(?:, | and | or )(?:`bundle\.claude\.js:\d+(?:-\d+)?`|`:\d+`))*\)/g, '')
    // "`bundle.claude.js:9318`. " leading a paragraph, and "at `bundle.claude.js:627`"
    .replace(/`bundle\.claude\.js:\d+(?:-\d+)?`\. ?/g, '')
    .replace(/ (?:at|from|in|near|around) `bundle\.claude\.js:\d+(?:-\d+)?`/g, '')
    .replace(/,? ?`bundle\.claude\.js:\d+(?:-\d+)?`(?: and `:\d+`)?/g, '')
    // bare "(9349)", "(1183, 1195)", "(10031-10034)", "(9994/1614)" after a name
    .replace(/ \(\d{3,5}(?:-\d{3,5})?(?:(?:, |\/)\d{3,5}(?:-\d{3,5})?)*\)/g, '')
    // "lines 10049-10062", "line 8802", "at 9201", "(base at 2686)"
    .replace(/,? (?:at |base at )?lines? \d{3,5}(?:-\d{3,5})?(?: and \d{3,5})?/g, '')
    .replace(/ \((?:base )?at \d{3,5}(?:-\d{3,5})?\)/g, '')
    // line-initial "(9349) " and ", 8802)" / "(9911, a bare" / "(e.g. 10237)" forms
    .replace(/\n\(\d{3,5}(?:-\d{3,5})?\) ?/g, '\n')
    .replace(/, \d{3,5}(?:-\d{3,5})?\)/g, ')')
    .replace(/\(\d{3,5}(?:-\d{3,5})?, /g, '(')
    .replace(/ \(e\.g\. \d{3,5}\)/g, '')
    // the two mentions of the renamed file itself
    .replace(/ in `bundle\.claude\.js`,/, ',')
    .replace(/ Everything here is read from `bundle\.claude\.js`\./, '')
    .replace(/\(\)/g, '')
    .replace(/ \.(?=\s)/g, '.')
    // a heading whose citation was its tail: "#### `f(x)` — "
    .replace(/^(#{2,4} .*?) —\s*$/gm, '$1')
    // a paragraph that opened with the citation: ", extends PairComponent." → "Extends PairComponent."
    .replace(/^, ([a-z])/gm, (m, c) => c.toUpperCase())
    // a sentence whose citation sat on its own line before the full stop
    .replace(/\n\.(?=\s)/g, '.')
}
// Mermaid fences are left alone: their labels carry no citations and the
// stripper would eat the empty parens of a method name.
function prepare (text) {
  return text
    .split(/(```mermaid\n[\s\S]*?\n```)/)
    .map((part, i) => (i % 2 ? part : stripLineRefs(part)))
    .join('')
}

// Split markdown into [preamble, {title, body}...] on h2 lines. Fenced blocks
// never start with "## ", so a plain line scan is enough.
function splitSections (md) {
  const lines = md.split('\n')
  const out = []
  let cur = { title: null, lines: [] }
  let fence = false
  for (const line of lines) {
    if (/^```/.test(line)) fence = !fence
    if (!fence && /^## /.test(line)) { out.push(cur); cur = { title: line.slice(3).trim(), lines: [] }; continue }
    cur.lines.push(line)
  }
  out.push(cur)
  return out.map(s => ({ title: s.title, body: s.lines.join('\n') }))
}
// Same for h3 entries inside one section: [intro, {heading, body}...].
function splitEntries (body) {
  const lines = body.split('\n')
  const out = []
  let cur = { heading: null, lines: [] }
  let fence = false
  for (const line of lines) {
    if (/^```/.test(line)) fence = !fence
    if (!fence && /^### /.test(line)) { out.push(cur); cur = { heading: line.slice(4).trim(), lines: [] }; continue }
    cur.lines.push(line)
  }
  out.push(cur)
  return out.map(e => ({ heading: e.heading, body: e.lines.join('\n') }))
}

// ------------------------------------------------------------------------- ids
const used = new Map()
function unique (id) {
  const n = (used.get(id) || 0) + 1
  used.set(id, n)
  return n === 1 ? id : id + '-' + n
}
function slug (t) {
  return t.toLowerCase().replace(/`/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
// The class an h3 describes, from the heading's own conventions.
function classKey (heading) {
  let m = /class `?([A-Z][A-Za-z0-9]+)/.exec(heading)
  if (m) return m[1]
  m = /^`?([A-Z][A-Za-z0-9]+)`?\s*\(/.exec(heading)
  if (m) return m[1]
  m = /\(([A-Z][A-Za-z0-9]+)\)/.exec(heading)
  if (m) return m[1]
  m = /^`?helpers\.([A-Za-z]+)`?/.exec(heading)
  if (m) return m[1]
  return null
}
function h3Id (heading) {
  const k = classKey(heading)
  return unique(k ? k.toLowerCase() : slug(heading.split(' (')[0]))
}
// The first method name in an h4 (marked hands the heading without its
// backticks): "*getCells(x) / getOther(y)" → getCells
function methodName (heading) {
  const m = /^\*?(?:static |get |set )?([\w$]+(?:\.[\w$]+)?|\[Symbol\.iterator\])\s*(?:\(|$)/.exec(heading)
  if (!m) return null
  return m[1] === '[Symbol.iterator]' ? 'symbol-iterator' : m[1].split('.').pop()
}
// The display name of a component h3: "Between (`class BetweenComponent …`)" → Between
function componentName (heading) { return heading.split(' (')[0].trim() }
function baseOf (heading) { const m = /extends ([A-Za-z]+)/.exec(heading); return m ? m[1] : null }
const SHAPE = { ConstraintComponent: 'leaf', CompositeComponent: 'composite', PairComponent: 'pair' }

// ---------------------------------------------------------------- renderer
const TIER = { public: 'good', 'reachable, not documented': 'warn', internal: 'neutral' }
const TIERKEY = { public: 'public', 'reachable, not documented': 'reachable', internal: 'internal' }
const ACCESS = /^Access: \*\*([^*]+)\*\*\s*[—-]\s*([\s\S]*)$/
function esc (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
// The same text whether it arrived as markdown (backticks) or as rendered
// inline HTML (tags and entities), so the two can be compared.
function plainKey (s, isHtml) {
  if (isHtml) s = s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  return s.replace(/`/g, '').replace(/\s+/g, ' ').trim()
}

// Rendering context, set by the caller per chunk.
const ctx = { h2: null, h3: null, h3Text: '', defaultReason: null, idPrefix: null }
const headings = [] // {level, id, text, h2, h3, tier}
const methodIndex = new Map() // method name → [{id, h3}]
const classIndex = new Map() // ClassName → h3 id
const helperIndex = new Map() // helpers.x → h3 id

const r = new marked.Renderer()
r.heading = function (text, level, raw) {
  const plain = raw.replace(/`/g, '')
  let id
  if (ctx.idPrefix) id = unique(level === 2 ? ctx.idPrefix : ctx.idPrefix + '-' + slug(plain))
  else if (level === 2) id = unique(slug(plain))
  else if (level === 3) {
    id = h3Id(raw); ctx.h3 = id; ctx.h3Text = plain
    const k = classKey(raw); if (k && !classIndex.has(k)) classIndex.set(k, id)
    const hm = /^`?helpers\.([A-Za-z]+)/.exec(raw); if (hm) helperIndex.set(hm[1], id)
    const alias = /global `?([A-Z][A-Za-z0-9]+)`?(?:, aliased `?([A-Z][A-Za-z0-9]+)`?)?/.exec(raw)
    if (alias) { for (const a of [alias[1], alias[2]]) if (a && !classIndex.has(a)) classIndex.set(a, id) }
  } else {
    const m = methodName(raw)
    id = unique((ctx.h3 || 'x') + '-' + (m ? m.toLowerCase() : slug(plain)))
    if (m) { if (!methodIndex.has(m)) methodIndex.set(m, []); methodIndex.get(m).push({ id, h3: ctx.h3 }) }
  }
  headings.push({ level, id, text: plain.replace(/\s+/g, ' '), h2: ctx.h2, h3: level === 4 ? ctx.h3 : null })
  const anchor = level >= 2 ? '<a class="anchor" href="#' + id + '" aria-label="Link to this section" title="Copy link">#</a>' : ''
  return '<h' + level + ' id="' + id + '">' + text + anchor + '</h' + level + '>\n'
}
r.paragraph = function (text) {
  const raw = text.replace(/<strong>/g, '**').replace(/<\/strong>/g, '**')
  const m = ACCESS.exec(raw)
  if (m) {
    const tone = TIER[m[1]] || 'neutral'
    const reason = m[2].trim()
    const isDefault = ctx.defaultReason && plainKey(reason, true) === plainKey(ctx.defaultReason, false)
    return '<p class="access"><span class="vt-pill dot ' + tone + '">' + esc(m[1]) + '</span>' +
      (isDefault ? '' : '<span>' + marked.parseInline(reason) + '</span>') + '</p>\n'
  }
  return '<p>' + text + '</p>\n'
}
r.blockquote = function (quote) {
  const plain = quote.replace(/<[^>]+>/g, '')
  const tone = /^\s*Discrepancy/.test(plain) ? 'risk' : /^\s*Note/.test(plain) ? 'info' : 'warn'
  return '<div class="vt-callout ' + tone + '">' + quote + '</div>\n'
}
r.table = function (header, body) {
  return '<div class="vt-table-wrap"><table class="vt-table compact"><thead>' + header + '</thead><tbody>' + body + '</tbody></table></div>\n'
}
r.code = function (code, lang) {
  if (lang === 'mermaid') return '<div class="vt-diagram"><pre class="mermaid">' + esc(code) + '</pre></div>\n'
  return '<div class="vt-code"><div class="vt-code-head"><span>' + esc(lang || 'code') + '</span><button class="vt-code-copy" type="button" aria-label="Copy code"></button></div><pre><code>' + esc(code) + '</code></pre></div>\n'
}
marked.use({ renderer: r, gfm: true })

function render (md) {
  return marked.parse(md)
    .replace(/<strong>\[inferred\]<\/strong>/g, '<span class="vt-pill outline warn tag">inferred</span>')
    .replace(/<strong>\[read\]<\/strong>/g, '')
}
function tierOf (body) {
  const m = /^Access: \*\*([^*]+)\*\*/m.exec(body)
  return m ? (TIERKEY[m[1]] || 'other') : 'other'
}
function firstSentence (body) {
  const paras = body.split(/\n\s*\n/).map(p => p.trim()).filter(p => p && !/^Access:/.test(p) && !/^[-|>#`]/.test(p))
  if (!paras.length) return ''
  let p = paras[0].replace(/\s+/g, ' ')
  const opener = /^(?:Extends|A) [A-Za-z]+Component(?: —[^.]*)?\.\s*/.exec(p)
  if (opener) p = p.slice(opener[0].length) || p
  const m = /^(.*?[.!?])(\s|$)/.exec(p)
  return (m ? m[1] : p)
}
// The most common Access reason in a section, if it repeats enough to be the default.
function defaultReasonOf (body) {
  const counts = new Map()
  for (const m of body.matchAll(/^Access: \*\*[^*]+\*\*\s*[—-]\s*(.+)$/gm)) counts.set(m[1].trim(), (counts.get(m[1].trim()) || 0) + 1)
  let best = null
  for (const [k, v] of counts) if (v >= 5 && (!best || v > best[1])) best = [k, v]
  return best ? best[0] : null
}
function defaultNote (body) {
  const m = /^Access: \*\*([^*]+)\*\*\s*[—-]\s*(.+)$/m.exec(body)
  const reason = ctx.defaultReason
  if (!reason) return ''
  let tier = null
  for (const mm of body.matchAll(/^Access: \*\*([^*]+)\*\*\s*[—-]\s*(.+)$/gm)) if (mm[2].trim() === reason) { tier = mm[1]; break }
  if (!tier || !m) return ''
  return '<p class="access default"><span class="vt-pill dot ' + (TIER[tier] || 'neutral') + '">' + esc(tier) + '</span><span>Unless an entry says otherwise: ' + marked.parseInline(reason) + '</span></p>\n'
}

// Render one h2 section: intro, then each h3 entry wrapped in a tiered section.
function renderSection (sec, opts = {}) {
  ctx.h2 = sec.title; ctx.h3 = null
  ctx.defaultReason = defaultReasonOf(sec.body)
  const entries = splitEntries(sec.body)
  let html = render('## ' + sec.title + '\n' + entries[0].body)
  html += defaultNote(sec.body)
  if (opts.after) html += opts.after(entries.slice(1))
  for (const e of entries.slice(1)) html += renderEntry(e)
  return html
}
function renderEntry (e) {
  const tier = tierOf(e.body)
  const inner = render('### ' + e.heading + '\n' + e.body)
  return '<section class="entry" data-tier="' + tier + '">' + inner + '</section>\n'
}

// --------------------------------------------------------------- assemble
const refMd = prepare(readFileSync(process.argv[2], 'utf8'))
const sections = splitSections(refMd)
const preamble = sections[0].body
const byTitle = new Map(sections.slice(1).map(s => [s.title, s]))
for (const t of [...page.sectionOrder, ...page.underTheHood]) if (!byTitle.has(t)) throw new Error('page.json names a section the reference lacks: ' + t)
const placed = new Set([...page.sectionOrder, ...page.underTheHood])
const unplaced = sections.slice(1).filter(s => !placed.has(s.title)).map(s => s.title)
if (unplaced.length) throw new Error('sections missing from page.json: ' + unplaced.join(', '))

// Guide part
ctx.idPrefix = 'guide'; ctx.h2 = 'Guide'
const guideHtml = render(guideMd)
ctx.idPrefix = null

// Reference preamble (h1 + caveats)
ctx.h2 = null
let refHtml = render(preamble)
// Task table
refHtml += '<!--TASKS-->'
refHtml += '<section class="tasks"><h2 id="what-do-i-call">What do I call to…<a class="anchor" href="#what-do-i-call" aria-label="Link to this section" title="Copy link">#</a></h2>' +
  '<div class="vt-table-wrap"><table class="vt-table compact"><thead><tr><th>I want to…</th><th>Entry</th></tr></thead><tbody><!--TASKROWS--></tbody></table></div></section>\n'
headings.push({ level: 2, id: 'what-do-i-call', text: 'What do I call to…', h2: null })

// Sections in page order; the components section is regrouped by family.
const COMPONENTS = 'Built-in components'
for (const title of page.sectionOrder) {
  const sec = byTitle.get(title)
  if (title !== COMPONENTS) { refHtml += renderSection(sec); continue }
  const entries = splitEntries(sec.body)
  const intro = entries[0].body
  const members = entries.slice(1)
  const byName = new Map(members.map(e => [componentName(e.heading), e]))
  const families = page.componentFamilies.map(f => ({ ...f, entries: f.members.map(n => { const e = byName.get(n); if (!e) throw new Error('page.json family member not in reference: ' + n); byName.delete(n); return e }) }))
  if (byName.size) families.push({ name: 'Other', blurb: 'Components no family claims.', entries: [...byName.values()] })
  // ids for the index table must match what renderEntry will assign; compute
  // them the same way but without consuming the uniqueness counter
  const idOf = (e) => { const k = classKey(e.heading); return k ? k.toLowerCase() : slug(componentName(e.heading)) }
  ctx.h2 = title; ctx.h3 = null; ctx.defaultReason = defaultReasonOf(sec.body)
  refHtml += render('## ' + title + '\n' + intro) + defaultNote(sec.body)
  let index = '<div class="vt-table-wrap"><table class="vt-table compact components"><thead><tr><th>Component</th><th>Shape</th><th>What it constrains</th></tr></thead><tbody>'
  for (const f of families) {
    index += '<tr class="family"><th colspan="3">' + esc(f.name) + ' <span>' + esc(f.blurb) + '</span></th></tr>'
    for (const e of f.entries) {
      const base = baseOf(e.heading)
      index += '<tr><td><a href="#' + idOf(e) + '"><code>' + esc(componentName(e.heading)) + '</code></a></td><td>' + (base ? esc(SHAPE[base] || base) : '') + '</td><td>' + marked.parseInline(firstSentence(e.body)) + '</td></tr>'
    }
  }
  index += '</tbody></table></div>\n'
  refHtml += index
  for (const f of families) {
    const ftitle = 'Components: ' + f.name
    ctx.h2 = ftitle; ctx.h3 = null
    refHtml += render('## ' + ftitle + '\n' + f.blurb + '\n')
    for (const e of f.entries) refHtml += renderEntry(e)
  }
}

// Under the hood
let hoodHtml = ''
for (const title of page.underTheHood) hoodHtml += renderSection(byTitle.get(title))

// ------------------------------------------------------------ autolinking
// Link `identifier` code spans to entries. Scope is the enclosing h3; a method
// resolves to the current class first, then to a page-unique method.
const ids = new Set(headings.map(h => h.id))
function resolve (name, scope) {
  if (classIndex.has(name)) return classIndex.get(name)
  const dm = /^([A-Za-z]+)\.([A-Za-z_$]+)$/.exec(name)
  if (dm) {
    let cls = null
    if (dm[1] === 'helpers') return helperIndex.get(dm[2]) || null
    if (classIndex.has(dm[1])) cls = classIndex.get(dm[1])
    else if (helperIndex.has(dm[1])) cls = helperIndex.get(dm[1])
    if (!cls) return null
    const hits = (methodIndex.get(dm[2]) || []).filter(h => h.h3 === cls)
    return hits.length === 1 ? hits[0].id : null
  }
  const hits = methodIndex.get(name) || []
  const local = hits.filter(h => h.h3 === scope)
  if (local.length === 1) return local[0].id
  // Outside its own class a method links only when its name is unique on the
  // page and specific enough not to be a common word (`size`, `add`, `has`).
  const specific = /[a-z][A-Z]/.test(name) || name.length >= 8
  if (hits.length === 1 && !local.length && specific) return hits[0].id
  return null
}
function autolink (html) {
  // Walk the HTML in segments split at headings and pre blocks, tracking the
  // current h3 scope; skip heading text, pre blocks and existing links.
  const parts = html.split(/(<h[2-4] id="[^"]+"[^>]*>[\s\S]*?<\/h[2-4]>|<pre[\s\S]*?<\/pre>|<a [^>]*>[\s\S]*?<\/a>)/)
  let scope = null
  return parts.map((p, i) => {
    if (i % 2) {
      const m = /^<h([23]) id="([^"]+)"/.exec(p)
      if (m) scope = m[1] === '3' ? m[2] : null
      return p
    }
    return p.replace(/<code>([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)(\(\))?<\/code>/g, (whole, name, parens) => {
      const id = resolve(name, scope)
      if (!id || id === scope) return whole
      return '<a class="ref" href="#' + id + '"><code>' + name + (parens || '') + '</code></a>'
    })
  }).join('')
}
let body = autolink(guideHtml) + '<hr class="part">' + autolink(refHtml) +
  '<details class="hood" id="under-the-hood"><summary><h2>Under the hood<a class="anchor" href="#under-the-hood" aria-label="Link to this section" title="Copy link">#</a></h2><p>The solver machinery a custom constraint never calls: internal component pieces, state and change application, the app\'s own logic steps, the free functions behind the utility globals, and the built-in constraint handlers. Described so behaviour can be understood, not for calling.</p></summary>' + autolink(hoodHtml) + '</details>'

// The task table names each target by its heading, with the class for a method.
const headById = new Map(headings.map(h => [h.id, h]))
const taskRows = page.tasks.map(([what, href]) => {
  const h = headById.get(href.slice(1))
  if (!h) throw new Error('page.json task points at a missing id: ' + href)
  const cls = h.level === 4 && h.h3 ? headById.get(h.h3) : null
  const clsName = cls ? (classKey(cls.text) || cls.text.split(' (')[0]) : null
  const label = h.level === 4 ? h.text.split(' / ')[0] : (classKey(h.text) || h.text.split(' (')[0])
  return '<tr><td>' + esc(what) + '</td><td><a href="' + href + '"><code>' + esc(label) + '</code></a>' + (clsName ? ' <span class="where">' + esc(clsName) + '</span>' : '') + '</td></tr>'
}).join('')
body = body.replace('<!--TASKS-->', '').replace('<!--TASKROWS-->', taskRows)

// Every internal link must land on an id.
const missing = new Set()
for (const m of body.matchAll(/href="#([^"]+)"/g)) if (!ids.has(m[1]) && m[1] !== 'under-the-hood') missing.add(m[1])
if (missing.size) throw new Error('links to ids that do not exist: ' + [...missing].join(', '))

// ------------------------------------------------------------------ nav
const hoodTitles = new Set(page.underTheHood)
const isGuide = (h) => h.id === 'guide' || h.id.startsWith('guide-')
const navHeads = headings.filter(h => h.level >= 2)
const guideHeads = navHeads.filter(h => isGuide(h) && h.level >= 3)
const refHeads = navHeads.filter(h => !isGuide(h) && !hoodTitles.has(h.h2))
const hoodHeads = navHeads.filter(h => hoodTitles.has(h.h2))
const tierById = new Map()
for (const m of body.matchAll(/<section class="entry" data-tier="([^"]+)">\s*<h3 id="([^"]+)"/g)) tierById.set(m[2], m[1])
function navTree (heads) {
  // Build the h2 › h3 › h4 tree first so an h3 without members can be marked a leaf.
  const roots = []
  let h2 = null, h3 = null
  for (const h of heads) {
    const node = { ...h, kids: [] }
    if (h.level === 2) { roots.push(node); h2 = node; h3 = null } else if (h.level === 3) { (h2 ? h2.kids : roots).push(node); h3 = node } else { (h3 || h2 ? (h3 || h2).kids : roots).push(node) }
  }
  const label = (n) => n.level === 3 ? n.text.split(' (')[0] : n.text.split(' / ')[0]
  const li = (n) => {
    const cls = n.level === 2 ? 'h2' : n.level === 3 ? (n.kids.length ? 'h3' : 'h3 leaf') : 'h4'
    const tier = n.level === 3 ? ' data-tier="' + (tierById.get(n.id) || '') + '"' : ''
    return '<li class="' + cls + '"' + tier + '><a href="#' + n.id + '">' + esc(label(n)) + '</a>' + (n.kids.length ? '<ul>' + n.kids.map(li).join('') + '</ul>' : '') + '</li>'
  }
  return roots.map(li).join('')
}
const nav = '<li class="part"><span>Guide</span></li>' + navTree(guideHeads) +
  '<li class="part"><span>Reference</span></li>' + navTree(refHeads) +
  '<li class="part hood"><a href="#under-the-hood">Under the hood</a></li>' + navTree(hoodHeads)

// ------------------------------------------------------------------ page
const html = `<title>SudokuMaker Constraint API</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600&family=Source+Sans+3:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
${vt('tokens.css')}
${vt('callout.css')}
${vt('chip.css')}
${vt('table.css')}
${vt('code.css')}
:root{--vt-ui-font:"Source Sans 3",system-ui,sans-serif;--vt-mono-font:"JetBrains Mono",ui-monospace,Menlo,monospace;--vt-serif-font:"Source Serif 4",Georgia,serif}
*{box-sizing:border-box}
body{background:var(--vt-paper);color:var(--vt-ink);font-family:var(--vt-ui-font);font-size:16.5px;line-height:1.55;padding-block:0 60px;padding-inline:16px}
.shell{display:grid;grid-template-columns:360px minmax(0,1fr);gap:40px;max-width:1400px;margin:0}
nav{position:sticky;top:0;height:100vh;overflow-y:auto;padding-block:24px 40px;border-right:1px solid var(--vt-rule);padding-right:14px;font-size:.88rem}
nav .brand{font-family:var(--vt-serif-font);font-weight:600;font-size:1.05rem;margin-bottom:10px}
nav input{width:100%;padding:7px 10px;border:1px solid var(--vt-rule);border-radius:6px;background:var(--vt-paper);color:var(--vt-ink);font:inherit;margin-bottom:12px}
nav input:focus{outline:2px solid var(--vt-accent);outline-offset:1px}
nav ul{list-style:none;padding:0;margin:0}
nav li{margin:0}
nav a{display:block;color:var(--vt-ink);text-decoration:none;padding:3px 8px;border-radius:4px;line-height:1.3}
nav a:hover,nav a:focus-visible{background:var(--vt-accent-soft);outline:none}
nav .part{margin-top:18px;padding:0 8px 4px;font-family:var(--vt-serif-font);font-weight:600;font-size:.95rem;border-bottom:1px solid var(--vt-rule)}
nav .part a{padding:0;display:inline}
nav .h2>a{font-weight:600;margin-top:10px;color:var(--vt-accent);text-transform:uppercase;letter-spacing:.06em;font-size:.72rem}
nav .h3>a{padding-left:16px}
nav .h4>a{padding-left:30px;font-family:var(--vt-mono-font);font-size:.74rem;color:var(--vt-muted)}
nav li[hidden]{display:none}
nav li.h3>ul{display:none}
nav li.open>ul,nav li.match>ul{display:block}
nav li.active>a{background:var(--vt-accent-soft)}
nav .h3>a::before{content:'▸';display:inline-block;width:.9em;color:var(--vt-muted);font-size:.8em}
nav .h3.open>a::before,nav .h3.match>a::before{content:'▾'}
nav .h3.leaf>a::before{content:''}
nav .tiers{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px}
nav .tiers button{font:inherit;font-size:.72rem;line-height:1.4;padding:1px 9px;border-radius:999px;border:1px solid var(--vt-rule);background:var(--vt-paper);color:var(--vt-muted);cursor:pointer}
nav .tiers button[aria-pressed="true"]{background:var(--vt-accent-soft);color:var(--vt-accent);border-color:var(--vt-accent)}
nav .tiers button:focus-visible{outline:2px solid var(--vt-accent);outline-offset:1px}
section.entry[hidden]{display:none}
nav .count{color:var(--vt-muted);font-size:.75rem;margin:4px 8px 8px}
main{padding-block:28px;min-width:0;max-width:940px}
main h1{font-family:var(--vt-serif-font);font-weight:600;font-size:2.2rem;line-height:1.1;margin:0 0 .6rem;text-wrap:balance}
main h2{font-family:var(--vt-serif-font);font-weight:600;font-size:1.6rem;margin:3rem 0 .8rem;padding-top:1.2rem;border-top:2px solid var(--vt-rule);text-wrap:balance}
main h3{font-family:var(--vt-serif-font);font-weight:600;font-size:1.2rem;margin:2.4rem 0 .5rem;padding-top:1rem;border-top:1px solid var(--vt-rule)}
main h2+h3,main h2+p+h3{border-top:0;padding-top:0}
main>h2:first-child{margin-top:0;border-top:0;padding-top:0}
main h2,main h3,main h4{position:relative;scroll-margin-top:12px}
.anchor{position:absolute;left:-1.4em;top:0;bottom:0;display:flex;align-items:center;padding-right:.4em;color:var(--vt-muted);text-decoration:none;font-family:var(--vt-ui-font);font-weight:400;font-size:.9em;opacity:0;transition:opacity .12s}
main h4 .anchor{left:auto;right:.5em;bottom:auto;top:50%;transform:translateY(-50%);padding:0}
h2:hover .anchor,h3:hover .anchor,h4:hover .anchor,.anchor:focus-visible{opacity:1}
.anchor.copied::after{content:'copied';font-size:.7em;margin-left:.4em;color:var(--vt-good)}
main h4{font-family:var(--vt-mono-font);font-weight:600;font-size:.92rem;margin:1.6rem 0 .3rem;padding:6px 10px;background:var(--vt-accent-soft);border-left:3px solid var(--vt-accent);border-radius:0 6px 6px 0}
main h4 code{background:none;padding:0;font-size:inherit}
main p,main li{max-width:none}
main p{margin:0 0 .8rem}
main ul{padding-left:1.2rem;margin:0 0 .8rem}
main li{margin-bottom:.3rem}
main li>p{margin-bottom:.3rem}
code{font-family:var(--vt-mono-font);font-size:.85em;background:var(--vt-soft);padding:.1em .35em;border-radius:4px}
a.ref{text-decoration:none;border-bottom:1px dotted var(--vt-accent)}
a.ref code{color:var(--vt-accent)}
p.access{display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap;font-size:.92rem;color:var(--vt-muted);margin:0 0 1rem}
p.access .vt-pill{flex:none;font-weight:600;letter-spacing:.02em}
p.access.default{border:1px dashed var(--vt-rule);border-radius:8px;padding:.5rem .8rem;margin:0 0 1.4rem}
.vt-pill.tag{font-family:var(--vt-mono-font);font-size:.68rem;padding:.02rem .45rem;vertical-align:baseline}
.vt-callout{max-width:none;font-family:var(--vt-ui-font)}
.vt-callout p{margin:0}
.vt-callout p+p{margin-top:.5rem}
.vt-table-wrap{max-width:100%}
.vt-table{font-size:.9rem}
.vt-table tr.family th{text-align:left;background:var(--vt-soft);font-family:var(--vt-serif-font);font-size:1rem;padding-top:.7rem}
.vt-table td .where{color:var(--vt-muted);font-size:.8rem;margin-left:.5rem}
.vt-table tr.family th span{display:block;font-family:var(--vt-ui-font);font-weight:400;font-size:.85rem;color:var(--vt-muted)}
.vt-code{max-width:100%}
.vt-diagram{background:var(--vt-soft);border:1px solid var(--vt-rule);border-radius:12px;padding:1.5rem;margin:1.4rem 0;overflow-x:auto}
.vt-diagram pre.mermaid{margin:0;display:flex;justify-content:safe center;font-family:var(--vt-mono-font);font-size:.8rem}
.vt-diagram svg{display:block;max-width:100%;height:auto}
figure.fig{margin:1.2rem 0 1.4rem;padding:1rem 1rem .6rem;background:var(--vt-soft);border:1px solid var(--vt-rule);border-radius:12px;overflow-x:auto}
figure.fig svg{display:block}
figure.fig figcaption{margin-top:.5rem;font-size:.85rem;color:var(--vt-muted)}
hr.part{border:0;border-top:3px double var(--vt-rule);margin:4rem 0 1rem}
details.hood{margin-top:4rem;border-top:3px double var(--vt-rule)}
details.hood>summary{list-style:none;cursor:pointer}
details.hood>summary::-webkit-details-marker{display:none}
details.hood>summary h2{margin-top:2rem;border-top:0;padding-top:0}
details.hood>summary h2::before{content:'▸ ';color:var(--vt-muted);font-size:.8em}
details.hood[open]>summary h2::before{content:'▾ '}
details.hood>summary p{color:var(--vt-muted)}
a{color:var(--vt-accent)}
@media (max-width:880px){.shell{grid-template-columns:1fr;gap:0}nav{position:static;height:auto;border-right:0;border-bottom:1px solid var(--vt-rule);padding-right:0;max-height:40vh}}
</style>
<div class="shell">
<nav aria-label="Contents"><div class="brand">Constraint API</div><input id="q" type="search" placeholder="Filter entries… ( / )" aria-label="Filter entries"><div class="tiers" role="group" aria-label="Show tiers in the reference"><button type="button" data-tier="public" aria-pressed="true">public</button><button type="button" data-tier="reachable" aria-pressed="true">reachable</button><button type="button" data-tier="internal" aria-pressed="false">internal</button></div><div class="count" id="count"></div><ul id="toc">${nav}</ul></nav>
<main id="doc">
${body}
</main>
</div>
<script>
(function(){
  var doc=document.getElementById('doc'),nav=document.querySelector('nav'),toc=document.getElementById('toc');
  var COPY='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  doc.querySelectorAll('.vt-code').forEach(function(block){var btn=block.querySelector('.vt-code-copy'),pre=block.querySelector('pre');btn.innerHTML=COPY;
    btn.addEventListener('click',function(){if(!(navigator.clipboard&&navigator.clipboard.writeText))return;navigator.clipboard.writeText(pre.textContent||'').then(function(){btn.innerHTML=CHECK;setTimeout(function(){btn.innerHTML=COPY},2000)}).catch(function(){})})});
  doc.querySelectorAll('a.anchor').forEach(function(a){a.addEventListener('click',function(){
    // Artifacts render on their own origin inside the claude.ai page, so
    // location.href there is the frame's URL, not the shareable
    // claude.ai/code/artifact/... URL. When embedded, use the parent
    // document's URL (document.referrer) instead; otherwise fall back to
    // location.href as before.
    var base=(window.top!==window&&document.referrer)?document.referrer:location.href;
    var url=base.split('#')[0]+a.getAttribute('href');if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(function(){a.classList.add('copied');setTimeout(function(){a.classList.remove('copied')},1500)}).catch(function(){})}})});
  // A link into the collapsed internals opens them first.
  var hood=document.getElementById('under-the-hood');
  function reveal(id){var t=id&&document.getElementById(id);if(t&&hood&&hood.contains(t)&&!hood.open){hood.open=true;return true}return false}
  document.addEventListener('click',function(e){var a=e.target.closest('a[href^="#"]');if(!a)return;if(reveal(a.getAttribute('href').slice(1))){e.preventDefault();location.hash=a.getAttribute('href')}});
  window.addEventListener('hashchange',function(){if(reveal(location.hash.slice(1)))document.getElementById(location.hash.slice(1)).scrollIntoView()});
  if(location.hash&&reveal(location.hash.slice(1)))setTimeout(function(){document.getElementById(location.hash.slice(1)).scrollIntoView()},0);
  // Nav model from the prebuilt tree.
  function firstPara(h){var n=h.nextElementSibling;while(n&&!/^H[1-4]$/.test(n.tagName)){if(n.tagName==='P'&&!n.classList.contains('access'))return n.textContent.toLowerCase();n=n.nextElementSibling}return ''}
  var items=[];var stack={h2:null,h3:null};
  toc.querySelectorAll('li').forEach(function(li){if(li.classList.contains('part'))return;var a=li.querySelector(':scope>a');var lv=li.classList.contains('h2')?'h2':li.classList.contains('h3')?'h3':'h4';var h=document.getElementById(a.getAttribute('href').slice(1));
    var it={li:li,a:a,h:h,lv:lv,text:(h?h.textContent:a.textContent).replace(/#$/,'').toLowerCase(),desc:lv==='h2'||!h?'':firstPara(h),parent:null,kids:[]};
    var sec=h&&h.closest('section.entry');it.tier=sec?sec.dataset.tier:'';it.sec=sec;
    if(lv==='h2'){stack.h2=it;stack.h3=null}else if(lv==='h3'){it.parent=stack.h2;if(stack.h2)stack.h2.kids.push(it);stack.h3=it}else{var p=stack.h3||stack.h2;it.parent=p;if(p)p.kids.push(it)}
    items.push(it)});
  var q=document.getElementById('q'),count=document.getElementById('count');
  var tiers={public:true,reachable:true,internal:false};
  try{var saved=JSON.parse(localStorage.getItem('ref-tiers')||'null');if(saved&&typeof saved==='object')Object.keys(tiers).forEach(function(k){if(k in saved)tiers[k]=!!saved[k]})}catch(e){}
  var tierButtons=Array.prototype.slice.call(nav.querySelectorAll('.tiers button'));
  tierButtons.forEach(function(b){b.setAttribute('aria-pressed',String(tiers[b.dataset.tier]));b.addEventListener('click',function(){tiers[b.dataset.tier]=!tiers[b.dataset.tier];b.setAttribute('aria-pressed',String(tiers[b.dataset.tier]));try{localStorage.setItem('ref-tiers',JSON.stringify(tiers))}catch(e){}applyView();spy()})});
  function inHood(el){return !!(hood&&el&&hood.contains(el))}
  function tierOn(it){if(it.h&&inHood(it.h))return true;var t=it.tier||(it.parent&&it.parent.tier);return !t||t==='other'||tiers[t]}
  function applyView(){var v=q.value.trim().toLowerCase();var filtering=!!v;var n=0,total=0;
    document.querySelectorAll('section.entry').forEach(function(sec){sec.hidden=!inHood(sec)&&!(sec.dataset.tier==='other'||tiers[sec.dataset.tier])});
    items.forEach(function(it){it.self=tierOn(it)&&(!filtering||it.text.indexOf(v)>=0||it.desc.indexOf(v)>=0)});
    items.forEach(function(it){if(it.lv==='h4'){it.show=it.self;if(it.show)total++;if(it.show&&filtering)n++}});
    items.forEach(function(it){if(it.lv==='h3'){var kid=it.kids.some(function(k){return k.show});it.show=tierOn(it)&&(!filtering||it.self||kid);it.li.classList.toggle('match',filtering&&it.show);if(it.show&&filtering&&!kid&&!it.kids.length)n++}});
    items.forEach(function(it){if(it.lv==='h2'){var kid=it.kids.some(function(k){return k.show});it.show=!filtering||kid||it.text.indexOf(v)>=0;it.li.classList.toggle('match',filtering&&it.show)}});
    items.forEach(function(it){it.li.hidden=!it.show});
    toc.querySelectorAll('li.part').forEach(function(p){p.hidden=filtering});
    count.textContent=filtering?n+' matching':total+' entries'}
  // Scroll-spy: the last heading above the top of the viewport names the open group.
  var heads=items.filter(function(it){return it.lv!=='h2'&&it.h});var activeH3=null,activeItem=null,ticking=false;
  function spy(){ticking=false;var y=90;var found=null;for(var i=0;i<heads.length;i++){var it=heads[i];if(it.li.hidden||(it.sec&&it.sec.hidden))continue;if(it.h.getBoundingClientRect().top<=y)found=it;else break}
    var h3=found?(found.lv==='h3'?found:found.parent):null;if(h3&&h3.lv!=='h3')h3=null;
    if(activeItem&&activeItem!==found)activeItem.li.classList.remove('active');
    if(activeH3&&activeH3!==h3)activeH3.li.classList.remove('open');
    activeItem=found;activeH3=h3;if(found)found.li.classList.add('active');if(h3)h3.li.classList.add('open');
    if(found&&!q.value.trim()){var r=found.a.getBoundingClientRect(),nr=nav.getBoundingClientRect();if(r.top<nr.top+40||r.bottom>nr.bottom-40)found.a.scrollIntoView({block:'center'})}}
  window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(spy)}},{passive:true});
  document.addEventListener('keydown',function(e){if(e.key==='/'&&!/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)){e.preventDefault();q.focus();q.select()}});
  q.addEventListener('keydown',function(e){if(e.key==='Escape'){q.value='';applyView();spy()}
    if(e.key==='Enter'){var first=items.filter(function(it){return it.show&&it.lv!=='h2'&&it.h&&(it.text.indexOf(q.value.trim().toLowerCase())>=0||it.desc.indexOf(q.value.trim().toLowerCase())>=0)})[0];if(first){reveal(first.h.id);first.h.scrollIntoView();first.h.focus&&first.h.focus()}}});
  q.addEventListener('input',applyView);applyView();spy();
})();
</script>
`
writeFileSync(process.argv[3], html)
console.log('bytes', html.length, 'headings', headings.length, 'links', (body.match(/<a class="ref"/g) || []).length)
