// Build the single-page HTML view of docs/research/bundle-api-reference.md.
//   node build-ref.mjs <reference.md> <out.html>
// Styling comes from the visual-teach component set: the token block from its
// base stylesheet plus the callout, chip, table and code components, all
// inlined from ./vt/ so the page has no external stylesheet. Markdown is
// rendered in the browser by marked; the renderer below maps the reference's
// conventions onto the components:
//   "Access: **tier** — reason"  → a colour chip per tier
//   **[read]** / **[inferred]**  → small outline pills
//   > Discrepancy … / > Note …   → risk / info callouts
//   tables                       → .vt-table.compact in a scroll wrapper
//   fenced code                  → .vt-code with a copy button
//   fenced mermaid               → <pre class="mermaid"> in a .vt-diagram panel
//                                  (the artifact host renders mermaid itself)
// After rendering, every h3 and what follows it is wrapped in a
// <section class="entry" data-tier> so the tier toggles can hide whole entries.
// The nav is a tree: h2 › h3 › h4. h4 groups are collapsed until their h3 is
// the one on screen (scroll-spy) or the filter matches inside them. The filter
// searches headings and each entry's first descriptive paragraph.
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const vt = (name) => readFileSync(join(here, 'vt', name), 'utf8')
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
}
// Mermaid fences are left alone: their labels carry no citations and the
// stripper would eat the empty parens of a method name.
const md = readFileSync(process.argv[2], 'utf8')
  .split(/(```mermaid\n[\s\S]*?\n```)/)
  .map((part, i) => (i % 2 ? part : stripLineRefs(part)))
  .join('')
  .replace(/<\/script/gi, '<\\/script')

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
p.access{display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap;font-size:.92rem;color:var(--vt-muted);margin:0 0 1rem}
p.access .vt-pill{flex:none;font-weight:600;letter-spacing:.02em}
.vt-pill.tag{font-family:var(--vt-mono-font);font-size:.68rem;padding:.02rem .45rem;vertical-align:baseline}
.vt-callout{max-width:none;font-family:var(--vt-ui-font)}
.vt-callout p{margin:0}
.vt-callout p+p{margin-top:.5rem}
.vt-table-wrap{max-width:100%}
.vt-table{font-size:.9rem}
.vt-code{max-width:100%}
.vt-diagram{background:var(--vt-soft);border:1px solid var(--vt-rule);border-radius:12px;padding:1.5rem;margin:1.4rem 0;overflow-x:auto}
.vt-diagram pre.mermaid{margin:0;display:flex;justify-content:safe center;font-family:var(--vt-mono-font);font-size:.8rem}
.vt-diagram svg{display:block;max-width:100%;height:auto}
a{color:var(--vt-accent)}
@media (max-width:880px){.shell{grid-template-columns:1fr;gap:0}nav{position:static;height:auto;border-right:0;border-bottom:1px solid var(--vt-rule);padding-right:0;max-height:40vh}}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
</style>
<div class="shell">
<nav aria-label="Contents"><div class="brand">Constraint API</div><input id="q" type="search" placeholder="Filter entries… ( / )" aria-label="Filter entries"><div class="tiers" role="group" aria-label="Show tiers"><button type="button" data-tier="public" aria-pressed="true">public</button><button type="button" data-tier="reachable" aria-pressed="true">reachable</button><button type="button" data-tier="internal" aria-pressed="true">internal</button></div><div class="count" id="count"></div><ul id="toc"></ul></nav>
<main id="doc"></main>
</div>
<script type="text/markdown" id="src">
${md}
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>
<script>
(function(){
  var src=document.getElementById('src').textContent;
  var used={};
  function slug(t){var s=t.toLowerCase().replace(/<[^>]+>/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');if(used[s]){used[s]++;s+='-'+used[s]}else used[s]=1;return s}
  function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
  var TIER={'public':'good','reachable, not documented':'warn','internal':'neutral'};
  var r=new marked.Renderer();
  r.heading=function(text,level){var id=slug(typeof text==='string'?text:text.text);var t=typeof text==='string'?text:marked.parseInline(text.text);var lv=typeof text==='string'?level:text.depth;return '<h'+lv+' id="'+id+'">'+t+(lv>=2?'<a class="anchor" href="#'+id+'" aria-label="Link to this section" title="Copy link">#</a>':'')+'</h'+lv+'>'};
  r.paragraph=function(tok){var raw=typeof tok==='string'?tok:tok.text;var m=/^Access: (?:\\*\\*|<strong>)([^*<]+)(?:\\*\\*|<\\/strong>)\\s*[—-]\\s*([\\s\\S]*)$/.exec(raw);
    if(m){var tone=TIER[m[1]]||'neutral';var rest=typeof tok==='string'?m[2]:marked.parseInline(m[2]);return '<p class="access"><span class="vt-pill dot '+tone+'">'+esc(m[1])+'</span><span>'+rest+'</span></p>'}
    var inner=typeof tok==='string'?tok:marked.parseInline(tok.text);return '<p>'+inner+'</p>'};
  r.blockquote=function(tok){var body=typeof tok==='string'?tok:marked.parser(tok.tokens);var plain=body.replace(/<[^>]+>/g,'');var tone=/^\\s*Discrepancy/.test(plain)?'risk':/^\\s*Note/.test(plain)?'info':'warn';return '<div class="vt-callout '+tone+'">'+body+'</div>'};
  r.table=function(tok){var head='',rows='';
    if(typeof tok==='string'){head=tok;rows=arguments[1]||''}else{
      head='<tr>'+tok.header.map(function(c){return '<th>'+marked.parseInline(c.text)+'</th>'}).join('')+'</tr>';
      rows=tok.rows.map(function(row){return '<tr>'+row.map(function(c){return '<td>'+marked.parseInline(c.text)+'</td>'}).join('')+'</tr>'}).join('')}
    return '<div class="vt-table-wrap"><table class="vt-table compact"><thead>'+head+'</thead><tbody>'+rows+'</tbody></table></div>'};
  r.code=function(tok){var code=typeof tok==='string'?tok:tok.text;var lang=(typeof tok==='string'?arguments[1]:tok.lang)||'';
    if(lang==='mermaid')return '<div class="vt-diagram"><pre class="mermaid">'+esc(code)+'</pre></div>';
    return '<div class="vt-code"><div class="vt-code-head"><span>'+esc(lang||'code')+'</span><button class="vt-code-copy" type="button" aria-label="Copy code"></button></div><pre><code>'+esc(code)+'</code></pre></div>'};
  marked.use({renderer:r,gfm:true});
  var doc=document.getElementById('doc');
  doc.innerHTML=marked.parse(src)
    .replace(/<strong>\\[read\\]<\\/strong>/g,'<span class="vt-pill outline good tag">read</span>')
    .replace(/<strong>\\[inferred\\]<\\/strong>/g,'<span class="vt-pill outline warn tag">inferred</span>');
  var COPY='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  doc.querySelectorAll('.vt-code').forEach(function(block){var btn=block.querySelector('.vt-code-copy'),pre=block.querySelector('pre');btn.innerHTML=COPY;
    btn.addEventListener('click',function(){if(!(navigator.clipboard&&navigator.clipboard.writeText))return;navigator.clipboard.writeText(pre.textContent||'').then(function(){btn.innerHTML=CHECK;setTimeout(function(){btn.innerHTML=COPY},2000)}).catch(function(){})})});
  doc.querySelectorAll('a.anchor').forEach(function(a){a.addEventListener('click',function(){var url=location.href.split('#')[0]+a.getAttribute('href');if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(function(){a.classList.add('copied');setTimeout(function(){a.classList.remove('copied')},1500)}).catch(function(){})}})});
  // Wrap each h3 and everything up to the next h2/h3 in a section carrying its tier.
  var TIERKEY={'public':'public','reachable, not documented':'reachable','internal':'internal'};
  Array.prototype.slice.call(doc.querySelectorAll('h3')).forEach(function(h){var sec=document.createElement('section');sec.className='entry';h.parentNode.insertBefore(sec,h);
    var n=h;while(n&&!(n.nodeType===1&&(n.tagName==='H2'||(n.tagName==='H3'&&n!==h)))){var nx=n.nextSibling;sec.appendChild(n);n=nx}
    var pill=sec.querySelector('p.access .vt-pill');sec.dataset.tier=pill?(TIERKEY[pill.textContent.trim()]||'other'):'other'});
  function firstPara(h){var n=h.nextElementSibling;while(n&&!/^H[1-4]$/.test(n.tagName)){if(n.tagName==='P'&&!n.classList.contains('access'))return n.textContent.toLowerCase();n=n.nextElementSibling}return ''}
  var toc=document.getElementById('toc');var items=[];var curH2=null,curH3=null;
  function childList(li){var ul=li.querySelector(':scope>ul');if(!ul){ul=document.createElement('ul');li.appendChild(ul)}return ul}
  doc.querySelectorAll('h2,h3,h4').forEach(function(h){var lv=h.tagName.toLowerCase();var li=document.createElement('li');li.className=lv;var a=document.createElement('a');a.href='#'+h.id;var label=h.textContent.replace(/#$/,'');a.textContent=lv==='h4'?label.split(' / ')[0]:label;li.appendChild(a);
    var it={li:li,a:a,h:h,lv:lv,text:label.toLowerCase(),desc:lv==='h2'?'':firstPara(h),parent:null,kids:[]};
    var sec=h.closest('section.entry');it.tier=sec?sec.dataset.tier:'';it.sec=sec;
    if(lv==='h2'){toc.appendChild(li);curH2=it;curH3=null}
    else if(lv==='h3'){childList(curH2.li).appendChild(li);it.parent=curH2;curH2.kids.push(it);curH3=it}
    else{var p=curH3||curH2;childList(p.li).appendChild(li);it.parent=p;p.kids.push(it)}
    items.push(it)});
  items.forEach(function(it){if(it.lv==='h3'&&!it.kids.length)it.li.classList.add('leaf')});
  var q=document.getElementById('q'),count=document.getElementById('count'),nav=document.querySelector('nav');
  var tiers={public:true,reachable:true,internal:true};
  try{var saved=JSON.parse(localStorage.getItem('ref-tiers')||'null');if(saved&&typeof saved==='object')Object.keys(tiers).forEach(function(k){if(k in saved)tiers[k]=!!saved[k]})}catch(e){}
  var tierButtons=Array.prototype.slice.call(nav.querySelectorAll('.tiers button'));
  tierButtons.forEach(function(b){b.setAttribute('aria-pressed',String(tiers[b.dataset.tier]));b.addEventListener('click',function(){tiers[b.dataset.tier]=!tiers[b.dataset.tier];b.setAttribute('aria-pressed',String(tiers[b.dataset.tier]));try{localStorage.setItem('ref-tiers',JSON.stringify(tiers))}catch(e){}applyView();spy()})});
  function tierOn(it){var t=it.tier||(it.parent&&it.parent.tier);return !t||t==='other'||tiers[t]}
  function applyView(){var v=q.value.trim().toLowerCase();var filtering=!!v;var n=0,total=0;
    // entries hidden by tier disappear from the page too; the text filter only prunes the nav
    document.querySelectorAll('section.entry').forEach(function(sec){sec.hidden=!(sec.dataset.tier==='other'||tiers[sec.dataset.tier])});
    items.forEach(function(it){it.self=tierOn(it)&&(!filtering||it.text.indexOf(v)>=0||it.desc.indexOf(v)>=0)});
    items.forEach(function(it){if(it.lv==='h4'){it.show=it.self;if(it.show)total++;if(it.show&&filtering)n++}});
    items.forEach(function(it){if(it.lv==='h3'){var kid=it.kids.some(function(k){return k.show});it.show=tierOn(it)&&(!filtering||it.self||kid);it.li.classList.toggle('match',filtering&&it.show);if(it.show&&filtering&&!kid&&!it.kids.length)n++}});
    items.forEach(function(it){if(it.lv==='h2'){var kid=it.kids.some(function(k){return k.show});it.show=!filtering||kid||it.text.indexOf(v)>=0;it.li.classList.toggle('match',filtering&&it.show)}});
    items.forEach(function(it){it.li.hidden=!it.show});
    count.textContent=filtering?n+' matching':total+' entries'}
  // Scroll-spy: the last heading above the top of the viewport names the open group.
  var heads=items.filter(function(it){return it.lv!=='h2'});var activeH3=null,activeItem=null,ticking=false;
  function spy(){ticking=false;var y=90;var found=null;for(var i=0;i<heads.length;i++){var it=heads[i];if(it.li.hidden||(it.sec&&it.sec.hidden))continue;if(it.h.getBoundingClientRect().top<=y)found=it;else break}
    var h3=found?(found.lv==='h3'?found:found.parent):null;if(h3&&h3.lv!=='h3')h3=null;
    if(activeItem&&activeItem!==found)activeItem.li.classList.remove('active');
    if(activeH3&&activeH3!==h3)activeH3.li.classList.remove('open');
    activeItem=found;activeH3=h3;if(found)found.li.classList.add('active');if(h3)h3.li.classList.add('open');
    if(found&&!q.value.trim()){var r=found.a.getBoundingClientRect(),nr=nav.getBoundingClientRect();if(r.top<nr.top+40||r.bottom>nr.bottom-40)found.a.scrollIntoView({block:'center'})}}
  window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(spy)}},{passive:true});
  document.addEventListener('keydown',function(e){if(e.key==='/'&&!/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)){e.preventDefault();q.focus();q.select()}});
  q.addEventListener('input',applyView);applyView();spy();
})();
</script>
`
writeFileSync(process.argv[3], html)
console.log('bytes', html.length)
