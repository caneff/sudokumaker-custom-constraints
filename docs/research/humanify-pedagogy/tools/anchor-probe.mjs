// Probe for issue #445: click three in-body a.ref links whose targets are far
// apart on the built Constraint API page, wait 1.2s, and report where each
// target actually landed relative to the viewport top. A landed link reads
// 0..20px (the page's scroll-margin-top is 12px); a smooth-scroll interrupt
// reads tens of thousands of px off.
//
// Usage: node anchor-probe.mjs <built.html>
// Requires `shot-scraper` and `python3` on PATH (installed separately, not
// npm deps).

import { execFileSync, spawn } from 'node:child_process'
import path from 'node:path'

const htmlPath = process.argv[2]
if (!htmlPath) {
  console.error('usage: node anchor-probe.mjs <built.html>')
  process.exit(2)
}
const resolved = path.resolve(htmlPath)
const dir = path.dirname(resolved)
const file = path.basename(resolved)

// shot-scraper's URL argument prepends http:// to anything that doesn't
// already look like a URL, mangling a bare file:// path. Serve the file over
// a throwaway local HTTP server instead.
const port = 20000 + Math.floor(Math.random() * 10000)
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' })
server.on('error', (err) => {
  console.error(`could not start python3 -m http.server: ${err.message}`)
  process.exit(2)
})
await waitForServer(port)
const url = `http://127.0.0.1:${port}/${encodeURIComponent(file)}`

async function waitForServer (p, deadlineMs = 5000) {
  const start = Date.now()
  while (Date.now() - start < deadlineMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${p}/`)
      await res.arrayBuffer()
      return
    } catch {
      await new Promise((r) => setTimeout(r, 50))
    }
  }
  server.kill()
  console.error(`http.server on port ${p} never came up within ${deadlineMs}ms`)
  process.exit(2)
}

const js = `
new Promise(async (resolve) => {
  function farApartLinks() {
    // Targets under "Under the hood" are collapsed by default and go through
    // a separate reveal path with its own nav-scroll-spy interaction; this
    // probe sticks to ordinary visible-section links, per the ticket.
    var hood = document.getElementById('under-the-hood')
    var links = Array.from(document.querySelectorAll('main a.ref[href^="#"]'))
      .map(function (a) {
        var t = document.getElementById(a.getAttribute('href').slice(1))
        if (!t || (hood && hood.contains(t))) return null
        return { a: a, top: t.getBoundingClientRect().top + window.scrollY }
      })
      .filter(Boolean)
    links.sort(function (x, y) { return x.top - y.top })
    if (links.length < 3) return links
    return [links[0], links[Math.floor(links.length / 2)], links[links.length - 1]]
  }
  var picks = farApartLinks()
  var results = []
  for (var i = 0; i < picks.length; i++) {
    window.scrollTo(0, 0)
    await new Promise(function (r) { setTimeout(r, 50) })
    var href = picks[i].a.getAttribute('href')
    picks[i].a.scrollIntoView({ block: 'center' })
    picks[i].a.click()
    await new Promise(function (r) { setTimeout(r, 1200) })
    var target = document.getElementById(href.slice(1))
    var top = target ? target.getBoundingClientRect().top : null
    results.push({ href: href, top: top })
  }
  resolve(results)
})
`

let out
try {
  out = execFileSync('shot-scraper', ['javascript', url, js], { encoding: 'utf8' })
} finally {
  server.kill()
}
const results = JSON.parse(out)

// A page with too few main-body ref links (a bad path, a 404, a page that
// changed shape) must fail loudly rather than report PASS on zero evidence.
if (results.length < 3) {
  console.error(`FAIL: only found ${results.length} eligible link(s) to test (need 3) — check the built file and URL`)
  process.exit(1)
}

let allLanded = true
for (const r of results) {
  const landed = r.top !== null && r.top >= 0 && r.top <= 20
  if (!landed) allLanded = false
  console.log(`${landed ? 'OK  ' : 'MISS'} ${r.href} top=${r.top}`)
}
console.log(allLanded ? 'PASS: all links landed within 0..20px' : 'FAIL: at least one link missed')
process.exit(allLanded ? 0 : 1)
