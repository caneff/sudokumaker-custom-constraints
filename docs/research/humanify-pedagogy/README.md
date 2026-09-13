# humanify-pedagogy: the app's solver bundle, renamed and read

`bundle.claude.js` is the same program as the app's `solver-Bv75x3BJ.js`
(`bundle.min.js` here), with every identifier renamed for reading. Public
method names, decorator display names and string literals are the app's own;
everything else was inferred and `tools/verify.mjs` proves the rename kept
scoping intact. `docs/research/bundle-api-reference.md` was written from it.

## Reach for these

| Need | Do |
|-|-|
| What a `puzzle` / `helpers` method or built-in component does | Read its entry in `../bundle-api-reference.md`; the bundle line is in the entry. |
| The exact body | `sed -n '<line>,<line+40>p' docs/research/humanify-pedagogy/bundle.claude.js` |
| Run the bundle in Node to check a claim | `node docs/research/humanify-pedagogy/tools/bugcheck.mjs docs/research/humanify-pedagogy/bundle.claude.js`. It stubs the worker globals, appends a `globalThis.__probe` export of the bindings it needs, and evaluates the bundle. Copy the file and change the `__probe` list and the probes for a new question. |
| The reference as a page | `node docs/research/humanify-pedagogy/tools/build-ref.mjs docs/research/bundle-api-reference.md <out.html>` (needs `npm ci` for `marked`), then republish the artifact at `https://claude.ai/code/artifact/6f166095-f641-4edc-8485-69cb61380118` with the Artifact tool, passing that `url`. The page is a guide (`tools/guide.md`) in front of the reference, reordered and regrouped by `tools/page.json`; the builder strips bundle line citations, renders mermaid fences as `<pre class="mermaid">` (the artifact host renders them), and fails if a guide or task link names an entry that does not exist. The earlier page at `…/f1c77297-9319-45a5-9551-789c90b7b4c5` is superseded. |
| Names and arities only, generated | `../bundle-api-index.md` from `examples/_shared/bundle-index.mjs`. |

## Editing the reference

- Every sentence is earned by reading the body. Tag an entry `[inferred]` when
  it is not. `reference/BRIEF.md` is the brief the sections were written to.
- Keep bundle line citations in the markdown; the page builder removes them.
- The page is shared outside this repo: no pointers into other repo docs, no
  notes about the document's own history.
- Mermaid fences: keep node labels free of line numbers, and quote any label
  with parentheses.

## Tools

| File | Role |
|-|-|
| `tools/enumerate.mjs` | Enumerate every binding of a JS file with a stable id, split into units, write annotated chunks for reading. |
| `tools/summary.mjs` | One line per top-level unit for a first naming pass. |
| `tools/fixnames.mjs` | Merge name maps and repair collisions so the rename preserves resolution. |
| `tools/apply.mjs` | Apply a `{bindingId: newName}` map to the source through the AST. |
| `tools/verify.mjs` | Prove the output equals the input modulo identifier names. |
| `tools/bugcheck.mjs` | Node harness that evaluates the bundle with worker stubs and probes it. |
| `tools/build-ref.mjs` | Build the reference page in Node with `marked`; styles inlined from `tools/vt/`. Ids are class-scoped (`solverpuzzleview-getvalue`), backticked identifiers link to their entries, the internals sections sit collapsed under "Under the hood", and every internal link is checked at build time. The nav collapses each class's members until it is on screen; the tier buttons hide public, reachable or internal entries in the reference part; the filter searches headings and first paragraphs (Enter jumps, Escape clears). |
| `tools/guide.md` | The reading order in front of the reference: where code runs, reading the grid, making a deduction, when `update` runs, reusing a built-in, coordinates, sums, how the solver runs it. Links into entries by id. |
| `tools/page.json` | Page-only structure: section order, which sections are "Under the hood", the component families and the "What do I call to…" task index. The markdown stays in bundle order. |
| `reference/` | The section drafts the reference was assembled from, and `BRIEF.md`. The drafts keep the original split (components A to M and N to Z, appendices per topic); the assembled reference has since been reorganised to one entry per class, so edit the reference, not a draft. |

The reading and renaming pipeline runs `enumerate → summary → (name) →
fixnames → apply → verify`; it is only needed again when the app ships a new
bundle.
