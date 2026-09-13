## Guide: writing a custom constraint

A custom constraint is two kinds of code segment. Main code runs once, when
the solver is set up: it reads the puzzle and registers component instances.
Component code is a class the solver calls during the search: it reads
candidates and yields deductions. The reference below is organised around that
split. Each fact in this guide comes from a reference entry, and the links go
there.

### 1. Where your code runs

Main code receives `puzzle`, `input` and `helpers` as plain names in scope.
`puzzle` is a [PuzzleSetupView](#puzzlesetupview). It can read the board
geometry and register or remove components; it cannot read candidates. The
component segment defines up to five free functions, and
[compileCustomComponentClass](#how-your-code-becomes-a-class-compilecustomcomponentclass)
copies them onto a class for you:

```js
// component segment: five free functions the app looks up by name
function getAffectedCells (cells, target) { return cells } // -> instance.cellIds; runs before `this` exists
function setParams (instance, cells, target) { instance.target = target } // the only route from arguments to fields
function * initialize (instance, puzzle) { }  // once, before the first search node; then update runs once
function * update (instance, puzzle) { }      // whenever one of getAffectedCells' cells changes
function validate (instance, puzzle) { return true } // a boolean; defining it turns per-node checking on
```

Inside those functions `puzzle` is a different object, a
[SolverPuzzleView](#solverpuzzleview): it reads the live search node and builds
change objects. Neither `input` nor the setup `puzzle` is in scope there.

There are also two `helpers` objects. Main code gets the extended one with
`lines`, `misc` and a region-aware `geometry`; component functions get the base
one without them. The [table under Shared reads](#puzzleaccessorbase) says which
members each has.

Main code fails open. A throw in the backend segment, or a compile error in a
component, is logged and the puzzle solves as if the constraint did not exist
([registerCustomConstraint](#how-your-code-becomes-a-class-registercustomconstraint)).
A throw inside `update` is silent apart from the console: the generator ends,
no deduction is made, and the solve continues.

### 2. Reading the grid

Cell ids are integers, `x + y * width`, 0-based. Every read on the solver view
goes straight to the search node's cells:

| You want | Call | Returns |
|-|-|-|
| the placed digit | [getValue](#solverpuzzleview-getvalue) | digit or `undefined` |
| whether a cell is placed | [hasValue](#solverpuzzleview-hasvalue) | boolean |
| remaining candidates as a set | [getCandidates](#solverpuzzleview-getcandidates) | a fresh `SudokuDigitSet` |
| remaining candidates as bits | [getCandidatesBitMask](#solverpuzzleview-getcandidatesbitmask) | number, bit `d` is digit `d` |
| cells that must differ from one cell | [getCellsSeenByCell](#puzzleaccessorbase-getcellsseenbycell) | a fresh `Set` |
| whether cells are pairwise distinct | [getCellsSeeEachOther](#puzzleaccessorbase-getcellsseeeachother) | boolean |

"Seen by" is built at call time from the components registered so far. In main
code that means only the constraints ordered before yours; from `update` every
house is already registered. A custom component never contributes to it, because
[getExclusionGroup](#constraintcomponent-getexclusiongroup) is not one of the
five functions you can define.

Geometry that does not depend on the solve state, such as rows, boxes, neighbours
and knight moves, lives on [helpers.geometry](#regionawaregeometryhelper); id
arithmetic on [helpers.cellIds](#cellids) and its corner, edge and outer-cell
siblings. Almost every geometry member is a generator: spread it before indexing,
and call it again rather than iterate it twice.

### 3. Making a deduction

`update` and `initialize` are generators. They never write to the grid; they
`yield` change objects that the solver applies. The solver view has one method
per change. In every one of them the digit or digit set comes first and the
cell or cells second:

```js
function * update (instance, puzzle) {
  const { cells, target } = instance
  for (const c of cells) {
    if (puzzle.getValue(c) === target) {
      // keep only `target` here, and drop it from every other cell in the set
      yield puzzle.filterCandidatesInCell(1 << target, c)
      yield puzzle.removeCandidateFromCells(target, cells.filter(o => o !== c))
      return
    }
  }
}
```

| To | Yield |
|-|-|
| drop one digit, or a set, from one cell or several | [removeCandidate(s)FromCell(s)](#solverpuzzleview-removecandidatefromcell) |
| keep only these digits | [filterCandidatesInCell(s)](#solverpuzzleview-filtercandidatesincell) |
| declare the branch dead, with a reason | [stop](#solverpuzzleview-stop) |
| replace yourself with a built-in | [replaceComponent](#solverpuzzleview-replacecomponent) |
| retire yourself | [removeComponent](#solverpuzzleview-removecomponent) |

There is no change that places a digit. A component narrows candidates until one
remains, and the solver's own naked-single step does the placing. The full list
of change shapes is the [Change objects](#change-objects) table.

> The one rule that fails silently: a yielded change must never remove a
> candidate the true solution needs. The app shows no error; the solver just
> rules the answer out. Every deduction should follow from the rules alone, not
> from a guess about how the puzzle will resolve.

`replaceComponent` and `removeComponent` are terminal changes. The solver stops
draining your generator after either one, so yield them last.

### 4. When update runs, and when you are done

The solver runs a fixpoint per search node
([updateConstraints](#solverstate-updateconstraints)). A component's `update`
runs when any cell in its `cellIds` is dirtied, where dirty means any candidate
removal or placement on that cell. A cell your logic reads but did not list in
`getAffectedCells` is invisible to that test, which is why `getAffectedCells`
must name every cell you read.

`initialize` is not called at registration. It runs once per component after
givens and pencilmarks are loaded, and the base implementation then runs
`update` once, so a component whose cells are never dirtied still gets one pass
([initialize](#constraintcomponent-initialize)).

Defining `validate` does two things. It turns on a per-node check, run for every
component regardless of `update`, and your boolean is wrapped as
`{ valid, message }` ([validate](#constraintcomponent-validate)). It also lets
the component retire: once every cell in `cellIds` is placed and `validate`
passes, [getIsDone](#constraintcomponent-getisdone) drops the component for the
rest of that branch. A component without `validate` is never dropped.

One object per component, shared by every search node. The solver clones cell
values and candidates per node but copies the component set by reference, so a
field you set on `instance` deep in a branch survives the backtrack. Read state
fresh every call; cache only facts that cannot be undone, such as a house that
has been registered.

### 5. Reusing a built-in

Every registered built-in constructor is a global inside both segments, under
its `Component` name. The cheapest way to say "these cells are a house" is to
hand the solver a [HouseComponent](#housecomponent), either from main code:

```js
// main code
puzzle.addConstraintComponent(new HouseComponent('the ring', ringCells))
```

or from `update`, when a condition has resolved and a built-in can take over:

```js
yield puzzle.replaceComponent(new HouseComponent(instance.name, instance.cells))
```

Three shapes recur among the built-ins, and they show how the app itself splits
work between `update` and `validate`. A leaf extends
[ConstraintComponent](#constraintcomponent) and prunes in `update`. A composite
extends [CompositeComponent](#compositecomponent), builds leaf components in
`initialize`, and deletes itself. A pair extends
[PairComponent](#paircomponent) and delegates all pruning to a precomputed friend
table, supplying only a constructor and `validate`. The components index below is
grouped by what each one constrains.

### 6. Coordinates

Four id schemes, all row-major integers over four different lattices:

| Scheme | Helper | Lattice |
|-|-|-|
| cells | [helpers.cellIds](#cellids) | `width` per row |
| corners | [helpers.cornerIds](#cornerids) | `width + 1` per row |
| edges | [helpers.edgeIds](#edgeids) | `2 * width` per row |
| outer cells | [helpers.outerCellIds](#outercellids) | `width + 2` per row, ring at `-1` |

They are all plain numbers, so nothing throws when one scheme's id reaches
another scheme's call. `x` is a column and `y` a row, both 0-based. Splitting a
set of cells into orthogonally connected groups is
[helpers.connectivity](#connectivityhelper); it yields graphs, not arrays, so
call `getPoints()` on each.

### 7. Sums, combinations and digit sets

[helpers.sums](#sumshelper) has two families. The `ExtremeSums` methods take
per-cell candidate masks and answer what range the cells can sum to, with or
without repeats. The `Combinations` methods ignore candidates and enumerate digit
combinations for a target. The without-repeat range search returns `null` when
no distinct-digit assignment exists, which means the constraint is already
broken. Combination lists are memoized and shared between callers, so never
mutate one.

[SudokuDigitSet](#sudokudigitset) is a bitmask with set algebra, and
[helpers.digits](#digitshelper) builds the common ones (all, odds, evens, a
modulo class). `valueOf` returns the mask, so a set can be passed wherever a mask
is expected. Messages name cells through [helpers.naming](#naminghelper), which is
the vocabulary the app's own components use.

### 8. How the solver runs it

One search node runs the constraint fixpoint and the validators, takes the app's
own logic steps until they stall, then branches on a cell and starts a child node
on a cloned state. The diagram under [SolverState](#solverstate) is the whole
loop; [processChange](#solverstate-processchange) is what happens to each change
you yield. The logic steps run beside your component and never call it; they only see
the candidates it has narrowed.

`update` reruns on every dirtied cell in every node of the search, so a
deduction that costs more than the branching it saves makes the puzzle slower.
Read bitmasks in hot loops, and hoist anything that does not depend on the
node.
