# Build the squishdoku links. Two boards, each with an empty template and
# generated puzzles:
#
#   .                7x7 squishdoku, backend main.js (13 forced houses)
#   embedded/        9x9 Latin square with the 7x7 squish on r2c2-r8c8,
#                    backend embedded/main.js (43 forced houses)
#
# A template (PUZZLE_LINK.txt) is the committed one with its backend swapped
# for the board's main.js and nothing else changed. A puzzle link
# (PUZZLE_LINK_<n>g.txt) is that template plus the givens of its gen_<n>g.json,
# proved to have exactly one solution before it is written. No board has a
# component of its own: both backends register built-in HouseComponents only.
#
#   uv run examples/squishdoku/build_link.py
#   uv run examples/squishdoku/build_link.py --generate squish --seed 7
#   uv run examples/squishdoku/build_link.py --generate embedded --seed 7
#
# --generate writes a new gen_<n>g.json and its link, <n> the givens left after
# removing every given the uniqueness proof allows.

import argparse
import json
import pathlib
import sys
from dataclasses import dataclass

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from link_swap import check_and_write, replace_constraint_code, swap_main
from minify import minify_file
from sm_document import write_link
from squish_board import EMBEDDED, SQUISH, Board, generate, has_one_solution
from sudoku_kit.link_codec import decode_puzzle, encode_link


@dataclass(frozen=True)
class Spec:
    name: str
    dir: pathlib.Path
    board: Board
    # The definition name of the constraint carrying the backend.
    constraint: str


BOARDS = [
    Spec("squish", HERE, SQUISH, "Squishdoku implied houses"),
    Spec("embedded", HERE / "embedded", EMBEDDED, "Embedded squishdoku extra regions"),
]


def build_template(spec):
    """The template link: the committed PUZZLE_LINK.txt with the backend
    rebuilt from the board's main.js."""
    base = decode_puzzle((spec.dir / "PUZZLE_LINK.txt").read_text().strip())
    doc = replace_constraint_code(
        base, spec.constraint, backend_code=minify_file(spec.dir / "main.js")
    )
    return encode_link(doc)


def gen_files(spec):
    """The gen JSONs of the board's generated puzzles, by given count."""
    return sorted(spec.dir.glob("gen_*g.json"))


def link_path(gen_path):
    """The puzzle link a gen JSON builds: gen_<n>g.json -> PUZZLE_LINK_<n>g.txt."""
    return gen_path.with_name(
        gen_path.name.replace("gen_", "PUZZLE_LINK_").replace(".json", ".txt")
    )


def build_puzzle(spec, gen):
    """The puzzle link: the template with `gen["givens"]` ({cell: digit}) set.
    Raises ValueError when the givens do not have exactly one solution."""
    givens = {int(i): d for i, d in gen["givens"].items()}
    if not has_one_solution(spec.board, givens):
        raise ValueError(f"{spec.name}: the givens do not have a unique solution")
    doc = decode_puzzle(build_template(spec))
    for cell, digit in givens.items():
        doc["puzzle"]["cells"][cell] = {"value": digit, "given": True}
    return encode_link(doc)


def write_all(spec):
    template = spec.dir / "PUZZLE_LINK.txt"
    base = decode_puzzle(template.read_text().strip())
    doc = decode_puzzle(build_template(spec))
    check_and_write(base, doc, spec.constraint, template)
    for gen_path in gen_files(spec):
        gen = json.loads(gen_path.read_text())
        out = link_path(gen_path)
        write_link(decode_puzzle(build_puzzle(spec, gen)), out)
        print(f"wrote {out.relative_to(HERE)}")


def generate_puzzle(spec, seed):
    grid, givens = generate(spec.board, seed)
    gen = {
        "seed": seed,
        "grid": [grid[i] for i in range(spec.board.cells)],
        "givens": {str(i): d for i, d in sorted(givens.items())},
    }
    path = spec.dir / f"gen_{len(givens)}g.json"
    path.write_text(json.dumps(gen, indent=1) + "\n")
    print(f"wrote {path.relative_to(HERE)}")


def rebuild(args, _parser):
    specs = [s for s in BOARDS if args.generate in (None, s.name)]
    for spec in specs:
        if args.generate:
            generate_puzzle(spec, args.seed)
        write_all(spec)


if __name__ == "__main__":
    p = argparse.ArgumentParser(
        description="Rebuild the squishdoku links, or generate a new puzzle."
    )
    p.add_argument("--generate", choices=[s.name for s in BOARDS])
    p.add_argument("--seed", type=int, default=0)
    swap_main(HERE, p, rebuild)
