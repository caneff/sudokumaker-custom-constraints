// Numbered Rooms (escape-the-grid), LOCAL variant. Each group the author draws
// is one clued line: cells[0] is the outside clue, the rest is the line read
// inward from the cell next to the clue (trust the author's group order).
// One self-contained component per line does all the work — no split across a
// wrapper and a built-in.
//
// The line may bend and may repeat a digit. NumberedRoomsComponent asks the app
// at solve time whether the line is a house and runs its two house rules only
// then (docs/line-contract.md), so nothing is assumed about the shape here.

for (const { cells } of input.groups) {
  const [clue, ...line] = cells
  // A group still being drawn has only its clue; nothing to enforce yet, and
  // an empty line would read an undefined cell and throw in the editor.
  if (line.length === 0) continue
  const name = helpers.naming.getCellsDescription(cells)
  puzzle.addConstraintComponent(new NumberedRoomsComponent(name, clue, line))
}
