# The community constraint catalog

A shared spreadsheet lists 200+ SudokuMaker custom constraints and templates,
each with a sample link, implementation credit, and notes. It is the best place
to find a ready-made constraint or a near-match to copy and adapt.

**Spreadsheet:**
<https://docs.google.com/spreadsheets/d/1C5rQaYlDJb3HVzHJSp5UibgM9uo57fwRdxgUOl8t7nA/edit?gid=0>

Read it as CSV without a browser:

```
https://docs.google.com/spreadsheets/d/1C5rQaYlDJb3HVzHJSp5UibgM9uo57fwRdxgUOl8t7nA/export?format=csv&gid=0
```

## Reading the code behind a link

The catalog's links are `tinyurl.com` redirects to `sudokumaker.app/?puzzle=...`.
The puzzle JSON — including every constraint's JavaScript — is LZString-compressed
in the `puzzle=` parameter. Resolve the redirect, then decompress:

```python
import urllib.parse
from lzstring import LZString   # uv run --with lzstring
raw = LZString.decompressFromEncodedURIComponent(urllib.parse.unquote(link.split("puzzle=")[-1]))
doc = json.loads(raw)
# code lives at doc["puzzle"]["constraints"][*]["definition"]["backend"]["code"]
#            and doc["puzzle"]["constraints"][*]["definition"]["components"][*]["code"]
```

tinyurl rate-limits fast loops — resolve with backoff and retry.
`curlingclips-links.json` caches the resolved `sudokumaker.app` URLs for the 47
curlingclips rows (44 resolved; 3 pending a re-fetch), so a future run can skip
tinyurl. See `advanced-techniques.md` for what the decoded code teaches.

## Columns

`Type` (Custom Constraint or Template), `Name`, and `Size / Link /
Implementation / Note`. The catalog holds sample links, not API docs — open a
row's link to read the actual code.

## Edge / "count from the edge" family

Useful when building a new outside-clue rule; each is a starting point:

- **Skyscraper Clues** — "Cells form a Skyscraper starting from the first cell
  in the group."
- **Skyscraper Lines** — "The digit in cell 0 of the group is the skyscraper
  clue for the rest of the line." This is the template the Running Start
  example started from; we replaced its rule.
- **X-Sum Arrows** — "the one/two-digit number in circle/pill is the sum of the
  first X digits on the attached arrow, where X is the first digit."
- **Up-to-N Sums** — "a clue outside the row or column indicates the sum of all
  digits up to the cell that contains the digit N."
- **First Seen Odd/Even** — an odd clue outside the grid indicates the first
  seen odd digit from that side; an even clue, the first seen even digit.

## What it does not have

No formal API documentation (no `validate`/`update`/`initialize` reference, no
`puzzle` method list). For that, use `component-contract.md` and `puzzle-api.md`
here, and the [Chris-Tophski repo](https://github.com/Chris-Tophski/SudokuMakerConstraints).
No running-start built-in exists — hence the custom component in `examples/`.
