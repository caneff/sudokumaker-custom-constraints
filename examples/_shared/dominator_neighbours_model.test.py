"""The shared JS neighbour helper (dominator.js `neighbours(i, width, height)`)
names the same neighbours as the CP-SAT fillomino model's edges, on boards that
are not square, both ways round. A component that reads another neighbour than
its model would prune on a different board than the one the model proved unique.

dominator.test.mjs holds the helper's own hand-listed answers; this is the
agreement with the Python model, which it cannot see.

    uv run examples/_shared/dominator_neighbours_model.test.py
"""

import importlib.util
import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
EXAMPLES = HERE.parent


def _load_generate():
    """`examples/fillomino/generate.py` as its own module: several examples
    share file names, so it is not imported by name."""
    directory = EXAMPLES / "fillomino"
    sys.path.insert(0, str(directory))
    spec = importlib.util.spec_from_file_location(
        "fillomino_generate", directory / "generate.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    sys.path.remove(str(directory))
    return module


def _js_neighbours(width, height):
    src = (HERE / "dominator.js").read_text()
    script = (
        f"{src}\nconsole.log(JSON.stringify(Array.from("
        f"{{ length: {width * height} }}, (_, i) => neighbours(i, {width}, {height}))))"
    )
    out = subprocess.run(
        ["node", "-e", script], capture_output=True, text=True, check=True
    )
    return [sorted(n) for n in json.loads(out.stdout)]


def the_neighbour_helper_agrees_with_the_model_on_a_rectangle():
    generate = _load_generate()
    for width, height in [(7, 5), (5, 7)]:
        board = generate.Board.of(width, height)
        model = [[] for _ in range(width * height)]
        for p, q in board.edges:
            model[board.idx(p)].append(board.idx(q))
        assert _js_neighbours(width, height) == [sorted(n) for n in model], (
            f"{width}x{height}: the helper and the model disagree on a neighbour"
        )


if __name__ == "__main__":
    the_neighbour_helper_agrees_with_the_model_on_a_rectangle()
    print("dominator_neighbours_model.test.py: ok")
