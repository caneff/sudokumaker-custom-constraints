# The houseless board isofill and fillomino share: a custom n x n board with
# no rows, columns or boxes, built from scratch out of a gen JSON (the grid and
# its clue cells) and the example's main.js and one component. There is no
# template -- such a board is small enough to write out (the board fields come
# from the scaffold check in #50). What differs between the two examples is the
# digit range and the rules text, so each supplies those and nothing else.

import argparse
import dataclasses
import json
import pathlib
from collections.abc import Callable

from link_codec import decode_puzzle, encode_link
from link_swap import swap_main
from minify import minify_file


@dataclasses.dataclass(frozen=True)
class BareBoard:
    """One example's houseless board.

    `digit_range(spec, n)` returns `(lo, hi, fields)`: the digits the board
    plays and the range fields the puzzle document ships for them, which may
    be none (the app's default). `rule` is the rules text, formatted with
    `n`, `lo` and `hi`."""

    dir: pathlib.Path
    name: str
    component: str
    rule: str
    digit_range: Callable

    def build(self, component_path, puzzle_path):
        """Build the board in `puzzle_path` with `component_path`'s code.
        Returns (link, doc, number of givens)."""
        spec = json.loads(pathlib.Path(puzzle_path).read_text())
        clues = {tuple(p) for p in spec["clues"]}
        n = len(spec["grid"])
        lo, hi, fields = self.digit_range(spec, n)
        # a cell holds a value only when it is a clue: a non-given value ships
        # as an entered digit and the recipient opens a solved board
        cells = [
            {"value": int(spec["grid"][r][c]), "given": True} if (r, c) in clues else {}
            for r in range(n)
            for c in range(n)
        ]
        doc = {
            "formatVersion": "1.6.0",
            "puzzle": {
                "name": self.name,
                "author": "",
                "type": "custom",
                "width": n,
                "height": n,
                **fields,
                "comment": self.rule.format(n=n, lo=lo, hi=hi),
                "cells": cells,
                "constraints": [
                    # the built-in "Given digits" constraint every frame
                    # carries; without it the app lists no givens (found live,
                    # 2026-08-27)
                    {"type": 0},
                    {
                        "name": self.name,
                        "type": 1000,
                        "definition": {
                            "name": self.name,
                            "input": [],
                            "backend": {
                                "type": "code",
                                "code": minify_file(self.dir / "main.js"),
                            },
                            "components": [
                                {
                                    "type": "code",
                                    "name": self.component,
                                    "code": minify_file(pathlib.Path(component_path)),
                                }
                            ],
                        },
                        "input": {},
                        "style": {},
                    },
                ],
            },
        }
        return encode_link(doc), doc, len(clues)

    def check(self, link, doc, n_clues):
        back = decode_puzzle(link)
        assert back == doc, "link does not decode back to the built document"
        p = back["puzzle"]
        n = p["width"]
        assert (p["type"], p["height"]) == ("custom", n)
        lo = p.get("minDigit", 1)
        assert lo + n - 1 <= 9, "n digits must fit the app's 0-9 range"
        assert len(p["cells"]) == n * n and not any("houses" in k for k in p)
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

        def rebuild(args, _parser):
            out = args.out or self.dir / "PUZZLE_LINK.txt"
            link, doc, n_clues = self.build(
                self.dir / f"{self.component}.js", args.puzzle
            )
            self.check(link, doc, n_clues)
            pathlib.Path(out).write_text(link + "\n")
            print(f"wrote {out} ({len(link)} chars, {n_clues} givens)")

        swap_main(self.dir, p, rebuild)
