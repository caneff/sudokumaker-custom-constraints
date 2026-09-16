# check_local_board against a synthetic 4x4 local board written to a temp
# example directory: a well-formed board passes, and each property it guards
# -- the backend lane, the drawn groups, the clue rule, the bend, the repeat --
# fails loud when the board breaks it.
#
#   uv run examples/_shared/board_checks.test.py

import json
import pathlib
import tempfile

from board_checks import check_local_board
from frame import ring_cell
from link_codec import encode_link
from minify import minify_file

GRID = [[1, 2, 3, 4], [3, 4, 1, 2], [2, 1, 4, 3], [4, 3, 2, 1]]
KEYS = [f"{side}{i}" for side in "LRTB" for i in range(4)]
# Bends across two rows, two columns and two boxes, and repeats its 1.
BENT = [(0, 0), (1, 2)]
COMPONENT = "SumComponent"


def total(values):
    # The synthetic clue rule, stated here once: the path's digits summed.
    return sum(values)


def write_example(root, *, paths=None, clue=None, backend="const A = 1\n", groups=None):
    """A local board, gen_local.json and PUZZLE_LINK_local.txt, under `root`."""
    paths = paths or dict.fromkeys(KEYS, BENT)
    W = 6
    spec = {
        "n": 4,
        "box": [2, 2],
        "grid": GRID,
        "paths": {k: [list(c) for c in v] for k, v in paths.items()},
        "clue": clue
        or {k: total([GRID[r][c] for r, c in v]) for k, v in paths.items()},
    }
    (root / "gen_local.json").write_text(json.dumps(spec))
    (root / "main.js").write_text("const A = 1\n")
    (root / "shipped.js").write_text(backend)
    drawn = groups or [
        [ring_cell(k, W)[0] * W + ring_cell(k, W)[1]]
        + [(r + 1) * W + c + 1 for r, c in v]
        for k, v in paths.items()
    ]
    doc = {
        "puzzle": {
            "cells": [{} for _ in range(W * W)],
            "constraints": [
                {
                    "type": 1000,
                    "definition": {
                        "name": "Sum",
                        "backend": {"code": minify_file(root / "shipped.js")},
                        "components": [{"name": COMPONENT, "code": ""}],
                    },
                    "input": {"groups": [{"cells": g} for g in drawn]},
                }
            ],
        }
    }
    (root / "PUZZLE_LINK_local.txt").write_text(encode_link(doc) + "\n")


def fails(message, **board):
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        write_example(root, **board)
        try:
            check_local_board(root, "local", COMPONENT, total)
        except AssertionError as e:
            assert message in str(e), f"wanted {message!r}, got {e!r}"
            return
        raise AssertionError(f"expected a failure naming {message!r}")


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        write_example(root)
        spec, doc = check_local_board(root, "local", COMPONENT, total)
        assert spec["n"] == 4 and len(doc["puzzle"]["cells"]) == 36

    fails("main.js lane", backend="const B = 2\n")
    fails("drawn groups", groups=[[0, 7]] * 16)
    fails("L0", clue={**dict.fromkeys(KEYS, 2), "L0": 3})
    fails("straight line", paths={k: [(0, 0), (0, 1)] for k in KEYS})
    fails("repeated digit", paths={k: [(0, 1), (1, 2)] for k in KEYS})
    print("ok")
