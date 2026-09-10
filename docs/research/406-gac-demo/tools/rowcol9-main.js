function postprocessJSON (json, input, helpers) {
  function getRowsAndColumns () {
    return [
      ['row ', helpers.geometry.getAllRows()],
      ['column ', helpers.geometry.getAllColumns()]
    ].flatMap(([type, lines]) =>
      [...lines].map((line, i) => ({ name: `${type}${i + 1}`, cells: line.map(c => c | 0) }))
    )
  }
  if (json == undefined) return getRowsAndColumns()
  json.metadata.norowcol = true
  json.cages.push(
    ...getRowsAndColumns().map(({ cells }) => ({
      unique: 'true', type: 'rowcol', hidden: 'true', cells: cells.map(toRC)
    }))
  )
  function toRC (cell) {
    const { x, y } = helpers.cellIds.getCoordsFromId(cell)
    return [y, x]
  }
}
const components = postprocessJSON(undefined, undefined, helpers)
  .map(({ name, cells }) => new DifferentDigitsComponent(name, cells))
for (const component of components) puzzle.addConstraintComponent(component)
