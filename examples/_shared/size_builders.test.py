# Every size builder's committed boards rebuild byte for byte: each
# examples/*/build_size.py's Spec, run through `--rebuild` on every gen JSON
# its example ships, gives back the committed link exactly. This is the seam
# the lane split (#655) is held to -- a refactor of framebuild that moves a
# single byte of a shipped link fails here, naming the board.
#
# No CP-SAT search runs: a rebuild re-encodes the recorded board, so the whole
# sweep is document assembly and minification.
#
#   uv run examples/_shared/size_builders.test.py

import importlib.util
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from framebuild import board_files, load_board, rebuild

EXAMPLES = pathlib.Path(__file__).parent.parent


def _spec(builder):
    """The SPEC one build_size.py declares, loaded under a name of its own so
    six modules all called build_size do not shadow one another."""
    name = f"build_size_{builder.parent.name.replace('-', '_')}"
    module_spec = importlib.util.spec_from_file_location(name, builder)
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    return module.SPEC


def _lanes(spec):
    """The lanes `spec` builds, each as the `local` value rebuild takes."""
    return [True] if spec.groups_fn is not None else [False, True]


def _rebuild(spec, gen):
    """`gen`'s link as `--rebuild` makes it, and the committed link it must
    equal. A board its lane does not name by default (a second board of one
    size) is rebuilt through `files=`, which only a one-lane example can
    resolve without guessing."""
    n = load_board(gen).n
    lanes = _lanes(spec)
    for local in lanes:
        link, owned = board_files(spec, n, local)
        if owned == gen:
            return rebuild(spec, n, local=local), link
    assert len(lanes) == 1, f"{gen} is no lane's board: name it in board_files"
    link = gen.parent / gen.name.replace("gen", "PUZZLE_LINK", 1).replace(
        ".json", ".txt"
    )
    return rebuild(spec, n, local=lanes[0], files=(link, gen)), link


def test_every_size_builder_rebuilds_its_committed_boards_byte_for_byte():
    builders = sorted(EXAMPLES.glob("*/build_size.py"))
    assert len(builders) >= 6, "the size builders moved: fix the glob"
    seen = 0
    for builder in builders:
        spec = _spec(builder)
        for gen in sorted(builder.parent.glob("gen*.json")):
            # running-start's gen.json is its hand-built board's document,
            # rebuilt by its own build_link.py; a carved board records a grid
            if "grid" not in json.loads(gen.read_text()):
                continue
            built, link = _rebuild(spec, gen)
            assert built + "\n" == link.read_text(), (
                f"{link.relative_to(EXAMPLES)} is not what --rebuild makes of "
                f"{gen.name}"
            )
            seen += 1
    assert seen >= 27, f"only {seen} boards rebuilt: the gen JSON glob missed some"


if __name__ == "__main__":
    test_every_size_builder_rebuilds_its_committed_boards_byte_for_byte()
    print("PASS")
