# Helpers the count-digits builders' tests share: the solution grid as an
# all-givens board, and `count_solutions` bound to a builder's own model.

from board_kit import count_solutions


def full_givens(gen):
    """Every cell of the gen's solution grid, as givens."""
    return {(r, c): v for r, row in enumerate(gen["grid"]) for c, v in enumerate(row)}


def counter_for(model):
    """`count_solutions(groups, givens)` under `model`."""

    def count(groups, givens):
        return count_solutions(model, groups, givens)

    return count
