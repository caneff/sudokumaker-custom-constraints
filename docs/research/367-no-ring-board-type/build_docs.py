# Four empty 4x4 documents for docs/research/367-no-ring-board-type.md:
# sudoku vs custom header, with and without a custom constraint that pins
# cell 0 to its group's value. Prints them as one JSON object on stdout.
import json
import sys

n = 4
regions = [(r // 2) * 2 + c // 2 for r in range(n) for c in range(n)]
code = (
    "for (const g of input.groups) puzzle.addConstraintComponent("
    "new PredefinedCandidatesComponent('pin', SudokuDigitSet.from([Number(g.value)]), g.cells))"
)


def doc(kind, custom):
    cons = [{"type": 1, "regions": regions}, {"type": 0}]
    if custom:
        cons.append(
            {
                "name": "Pin",
                "type": 1000,
                "definition": {
                    "name": "Pin",
                    "input": [
                        {"id": "groups", "label": "Groups", "params": {"type": "raw"}}
                    ],
                    "backend": {"type": "code", "code": code},
                    "components": [],
                },
                "input": {"groups": [{"cells": [0], "value": "1"}]},
                "style": {},
            }
        )
    return {
        "formatVersion": "1.6.0",
        "puzzle": {
            "name": "p",
            "author": "",
            "comment": "",
            "type": kind,
            "width": n,
            "height": n,
            "minDigit": 1,
            "maxDigit": n,
            "cells": [{} for _ in range(n * n)],
            "constraints": cons,
        },
    }


json.dump(
    {
        k: doc(*v)
        for k, v in {
            "sudoku": ("sudoku", False),
            "sudoku+pin": ("sudoku", True),
            "custom": ("custom", False),
            "custom+pin": ("custom", True),
        }.items()
    },
    sys.stdout,
)
