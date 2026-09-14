# House GAC (standalone) — optimization log

`HouseGacComponent.js` is a shared file (`examples/_shared/`), owned and
optimized where it was introduced (#422, #408 — the four-form speed
comparison lives in `docs/research/408-house-gac/`). This example only
registers it 27 times over a plain 9x9's rows, columns and boxes; nothing here
has changed the component itself, so there is no attempt to log yet.

`just time house-gac` gives the two-row gate for this registration, same as
any other example; see the README's `## Timing` for the recorded row.

| Variant | Kept / rejected | Numbers | Commit |
|---|---|---|---|
| (none attempted yet) | — | — | — |
