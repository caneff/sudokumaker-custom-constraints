import { readFileSync, writeFileSync } from 'fs'
const md = readFileSync(process.argv[2], 'utf8').replace(/<\/script/gi, '<\\/script')
const html = `<title>SudokuMaker Constraint API</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600&family=Source+Sans+3:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
:root{--bg:#F4F6F8;--panel:#FFFFFF;--ink:#17202A;--muted:#5B6774;--rule:#D7DDE4;--accent:#2F4A8A;--accent-bg:#E7ECF7;--warn:#8A5A12;--warn-bg:#FBF1DC;--code-bg:#EEF1F5}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#12171E;--panel:#1A2029;--ink:#E6EAF0;--muted:#97A3B1;--rule:#2C3542;--accent:#8FA5E8;--accent-bg:#1E2840;--warn:#E8B95C;--warn-bg:#3A2E14;--code-bg:#0F141A}}
:root[data-theme="dark"]{--bg:#12171E;--panel:#1A2029;--ink:#E6EAF0;--muted:#97A3B1;--rule:#2C3542;--accent:#8FA5E8;--accent-bg:#1E2840;--warn:#E8B95C;--warn-bg:#3A2E14;--code-bg:#0F141A}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:"Source Sans 3",system-ui,sans-serif;font-size:16.5px;line-height:1.55;padding-block:0 60px;padding-inline:16px}
.shell{display:grid;grid-template-columns:360px minmax(0,1fr);gap:40px;max-width:1400px;margin:0}
nav{position:sticky;top:0;height:100vh;overflow-y:auto;padding-block:24px 40px;border-right:1px solid var(--rule);padding-right:14px;font-size:.88rem}
nav .brand{font-family:"Source Serif 4",Georgia,serif;font-weight:600;font-size:1.05rem;margin-bottom:10px}
nav input{width:100%;padding:7px 10px;border:1px solid var(--rule);border-radius:4px;background:var(--panel);color:var(--ink);font:inherit;margin-bottom:12px}
nav input:focus{outline:2px solid var(--accent);outline-offset:1px}
nav ul{list-style:none;padding:0;margin:0}
nav li{margin:0}
nav a{display:block;color:var(--ink);text-decoration:none;padding:3px 8px;border-radius:3px;line-height:1.3}
nav a:hover,nav a:focus-visible{background:var(--accent-bg);outline:none}
nav .h2>a{font-weight:600;margin-top:10px;color:var(--accent);text-transform:uppercase;letter-spacing:.06em;font-size:.72rem}
nav .h3>a{padding-left:16px}
nav .h4>a{padding-left:30px;font-family:"JetBrains Mono",monospace;font-size:.74rem;color:var(--muted)}
nav li[hidden]{display:none}
nav .count{color:var(--muted);font-size:.75rem;margin:4px 8px 8px}
main{padding-block:28px;min-width:0}
main h1{font-family:"Source Serif 4",Georgia,serif;font-weight:600;font-size:2.2rem;line-height:1.1;margin:0 0 .6rem;text-wrap:balance}
main h2{font-family:"Source Serif 4",Georgia,serif;font-weight:600;font-size:1.6rem;margin:3rem 0 .8rem;padding-top:1.2rem;border-top:2px solid var(--rule);text-wrap:balance}
main h3{font-family:"Source Serif 4",Georgia,serif;font-weight:600;font-size:1.2rem;margin:2.2rem 0 .5rem}
main h4{font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:600;font-size:.92rem;margin:1.6rem 0 .3rem;padding:6px 10px;background:var(--accent-bg);border-left:3px solid var(--accent);border-radius:0 3px 3px 0}
main h4 code{background:none;padding:0;font-size:inherit}
main p,main li{max-width:74ch}
main p{margin:0 0 .8rem}
main ul{padding-left:1.2rem;margin:0 0 .8rem}
main li{margin-bottom:.3rem}
main li>p{margin-bottom:.3rem}
code,pre{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace}
code{font-size:.85em;background:var(--code-bg);padding:.1em .35em;border-radius:3px}
pre{background:var(--code-bg);border:1px solid var(--rule);border-radius:4px;padding:12px 14px;font-size:.8rem;line-height:1.5;overflow-x:auto;margin:0 0 1rem}
pre code{background:none;padding:0;font-size:inherit}
blockquote{margin:.8rem 0 1rem;padding:8px 14px;border-left:3px solid var(--warn);background:var(--warn-bg);color:inherit;max-width:74ch}
blockquote p{margin:0}
table{border-collapse:collapse;font-size:.9rem;margin:.4rem 0 1rem;display:block;overflow-x:auto;max-width:100%}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--rule);vertical-align:top}
th{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
a{color:var(--accent)}
.toggle{display:none}
@media (max-width:880px){.shell{grid-template-columns:1fr;gap:0}nav{position:static;height:auto;border-right:0;border-bottom:1px solid var(--rule);padding-right:0;max-height:40vh}}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
</style>
<div class="shell">
<nav aria-label="Contents"><div class="brand">Constraint API</div><input id="q" type="search" placeholder="Filter entries…" aria-label="Filter entries"><div class="count" id="count"></div><ul id="toc"></ul></nav>
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
  var r=new marked.Renderer();
  r.heading=function(text,level){var id=slug(typeof text==='string'?text:text.text);var t=typeof text==='string'?text:marked.parseInline(text.text);var lv=typeof text==='string'?level:text.depth;return '<h'+lv+' id="'+id+'">'+t+'</h'+lv+'>'};
  marked.use({renderer:r,gfm:true});
  document.getElementById('doc').innerHTML=marked.parse(src);
  var toc=document.getElementById('toc');var items=[];
  document.querySelectorAll('#doc h2,#doc h3,#doc h4').forEach(function(h){var li=document.createElement('li');li.className=h.tagName.toLowerCase();var a=document.createElement('a');a.href='#'+h.id;a.textContent=h.textContent;li.appendChild(a);toc.appendChild(li);items.push({li:li,text:h.textContent.toLowerCase(),lv:li.className})});
  var q=document.getElementById('q'),count=document.getElementById('count');
  function filter(){var v=q.value.trim().toLowerCase();var n=0;items.forEach(function(it){var show=!v||it.lv==='h2'||it.text.indexOf(v)>=0;it.li.hidden=!show;if(show&&it.lv!=='h2')n++});count.textContent=v?n+' matching':items.filter(function(i){return i.lv==='h4'}).length+' entries';}
  q.addEventListener('input',filter);filter();
})();
</script>
`
writeFileSync(process.argv[3], html)
console.log('bytes', html.length)
