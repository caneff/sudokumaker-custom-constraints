# The houseless board isofill and fillomino share: a custom W x H board with no
# rows, columns or boxes, built from scratch out of a gen JSON (the grid and
# its clue cells) and the example's main.js and one component. There is no
# template -- such a board is small enough to write out. What differs between
# the two examples is the digit range and the rules text, so each supplies
# those and nothing else.

import argparse
import dataclasses
import json
import pathlib
from collections.abc import Callable

from link_swap import swap_main
from minify import minify_file
from sm_document import code_constraint
from sudoku_kit.link_codec import decode_puzzle, encode_link


@dataclasses.dataclass(frozen=True)
class BareBoard:
    """One example's houseless board.

    `digit_range(spec, n)` returns `(lo, hi, fields)`: the digits the board
    plays and the range fields the puzzle document ships for them, which may
    be none (the app's default); `n` is the width. `rule` is the rules text,
    formatted with `lo`, `hi`, `count` (the digits) and `size` (cells per
    digit, rounded down)."""

    dir: pathlib.Path
    name: str
    component: str
    rule: str
    digit_range: Callable

    def build(self, component_path, puzzle_path, keep_comments=False):
        """Build the board in `puzzle_path` with `component_path`'s code.
        `keep_comments` builds the annotated twin: the embedded code keeps its
        comments (minify.py). Returns (link, doc, number of givens)."""
        spec = json.loads(pathlib.Path(puzzle_path).read_text())
        clues = {tuple(p) for p in spec["clues"]}
        height = len(spec["grid"])
        n = width = len(spec["grid"][0])
        lo, hi, fields = self.digit_range(spec, n)
        assert 0 <= lo <= hi <= 9, f"digits {lo}-{hi} do not fit the app's 0-9 range"
        count = hi - lo + 1
        # a cell holds a value only when it is a clue: a non-given value ships
        # as an entered digit and the recipient opens a solved board
        cells = [
            {"value": int(spec["grid"][r][c]), "given": True} if (r, c) in clues else {}
            for r in range(height)
            for c in range(width)
        ]
        doc = {
            "formatVersion": "1.6.0",
            "puzzle": {
                "name": self.name,
                "author": "",
                "type": "custom",
                "width": width,
                "height": height,
                **fields,
                "comment": self.rule.format(
                    lo=lo, hi=hi, count=count, size=width * height // count
                ),
                "cells": cells,
                "constraints": [
                    # the built-in "Given digits" constraint every frame
                    # carries; without it the app lists no givens (found live,
                    # 2026-08-27)
                    {"type": 0},
                    code_constraint(
                        self.name,
                        minify_file(self.dir / "main.js", keep_comments),
                        [
                            (
                                self.component,
                                minify_file(
                                    pathlib.Path(component_path), keep_comments
                                ),
                            )
                        ],
                        named=True,
                    ),
                ],
            },
        }
        return encode_link(doc), doc, len(clues)

    def check(self, link, doc, n_clues):
        back = decode_puzzle(link)
        assert back == doc, "link does not decode back to the built document"
        p = back["puzzle"]
        width, height = p["width"], p["height"]
        assert p["type"] == "custom"
        # The digits the app offers: minDigit..maxDigit, each defaulting to
        # the app's own 1 and 9. The board's shape does not enter into it.
        lo, hi = p.get("minDigit", 1), p.get("maxDigit", 9)
        assert 0 <= lo <= hi <= 9, "digits must fit the app's 0-9 range"
        assert len(p["cells"]) == width * height and not any("houses" in k for k in p)
        # every non-given cell must be empty, or the board ships entered digits
        assert all(c.get("given") or c == {} for c in p["cells"])
        assert sum(1 for c in p["cells"] if c.get("given")) == n_clues
        assert p["constraints"][0] == {"type": 0}, "given-digits constraint missing"
        d = p["constraints"][1]["definition"]
        assert d["input"] == [], "a global constraint has no groups"
        assert [c["name"] for c in d["components"]] == [self.component]

    def main(self):
        """The example's command line: no --component rebuilds the board in
        --puzzle (gen.json) to --out (PUZZLE_LINK.txt); --component swaps a
        candidate into a committed board (link_swap.swap_main)."""
        p = argparse.ArgumentParser()
        p.add_argument("--puzzle", default=self.dir / "gen.json")
        p.add_argument(
            "--keep-comments",
            action="store_true",
            help="build the annotated twin: the embedded code keeps its comments",
        )

        def rebuild(args, _parser):
            out = args.out or self.dir / "PUZZLE_LINK.txt"
            link, doc, n_clues = self.build(
                self.dir / f"{self.component}.js", args.puzzle, args.keep_comments
            )
            self.check(link, doc, n_clues)
            pathlib.Path(out).write_text(link + "\n")
            print(f"wrote {out} ({len(link)} chars, {n_clues} givens)")

        swap_main(self.dir, p, rebuild)
