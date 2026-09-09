//! Pin the four corner cells of a frame board.
//!
//! A frame board is an interior sudoku inside a one-cell clue ring. Every ring
//! cell but the corners is some line's clue, so a component reaches it. A
//! corner sits on two edges, belongs to no line, no region and no cage, and
//! nothing reaches it -- so it takes any digit and the board is not unique.
//!
//! Pinning them to the puzzle's lowest digit costs the solver one candidate
//! set each and leaves the board blank where a filler given used to show a
//! digit the recipient could read (#394).

const { width: W, height: H } = helpers.cellIds
const corners = [0, W - 1, W * (H - 1), W * H - 1]

puzzle.addConstraintComponent(new PredefinedCandidatesComponent(
  'the frame corners', SudokuDigitSet.from([helpers.digits.minDigit]), corners))
