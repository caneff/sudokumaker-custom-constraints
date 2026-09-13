# Brief for reference-section writers

You are writing one section of an explanatory API reference for the SudokuMaker
custom-constraint API, derived from the deobfuscated solver bundle at
`bundle.claude.js` (one directory up). Audience: Claude, in a future session,
writing a custom constraint component and needing to know what a function
actually does without reading the bundle. Every sentence must be earned by
reading the function body; do not guess from the name.

Also read (same directory, one up: `../../../puzzle-api.md`,
`../../../component-contract.md`, `../../bundle-api-index.md`) for the
already-verified facts and the house vocabulary. Where the bundle contradicts a
doc, say so in a `> Discrepancy:` blockquote with the line number.

## Format (strict, so sections concatenate)

Start with `## <Section title>` then one short paragraph on what the section
covers and how a component reaches it (e.g. `helpers.geometry`, or a global
name available inside custom component code).

For each class/namespace: `### <Name>` (with how it is reached, e.g.
`### helpers.cellIds (class CellIds)`), one or two sentences on its role and
any fields worth knowing, then one entry per public member in source order:

#### `methodName(paramA, paramB)`
One sentence: what it does. Then, only where they add information:
- **Params:** `paramA` – meaning and type (cell id number, coords object
  `{x, y}`, digit bitmask, DigitSet, array of cell ids …). `paramB` – …
- **Returns:** what, and its type. Say "generator" when it yields.
- **Mutates:** what, if anything (the receiver, an argument).
- **Notes:** gotchas, edge cases (undefined on out-of-range, 0-based vs 1-based,
  which digit convention, cost if it enumerates combinations), and a one-line
  usage example when the calling convention is not obvious.

Private members (`#name`) and internal-only classes: skip, or one line if a
public method's behaviour depends on them. Fields: list under the class
paragraph, not as entries. Keep each entry to under ~6 lines. No headings
deeper than ####. Write the section to the file named in your task, nothing
else. Cite `bundle.claude.js:<line>` for the class header of each class you
document, in the class paragraph.
