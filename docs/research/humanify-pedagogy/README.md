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
| The reference as a page | `node docs/research/humanify-pedagogy/tools/build-ref.mjs docs/research/bundle-api-reference.md <out.html>`, then republish the artifact at `https://claude.ai/code/artifact/f1c77297-9319-45a5-9551-789c90b7b4c5` with the Artifact tool, passing that `url`. The builder strips bundle line citations and renders mermaid fences as `<pre class="mermaid">`, which the artifact host renders. |
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
| `tools/build-ref.mjs` | Build the reference page; styles inlined from `tools/vt/`. |
| `reference/` | The section drafts the reference was assembled from, and `BRIEF.md`. |

The reading and renaming pipeline runs `enumerate → summary → (name) →
fixnames → apply → verify`; it is only needed again when the app ships a new
bundle.
