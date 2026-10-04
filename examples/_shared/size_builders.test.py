# Every size builder's committed boards rebuild byte for byte: each
# examples/*/build_size.py's Spec, run through `--rebuild` on every gen JSON
# its example ships, gives back the committed link exactly: a change to
# framebuild's lanes that moves a single byte of a shipped link fails here,
# naming the board.
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
from check_layout import _link_suffix
from framebuild import lane_kinds, load_board, named_files

EXAMPLES = pathlib.Path(__file__).parent.parent


def _spec(builder):
    """The SPEC one build_size.py declares, loaded under a name of its own so
    six modules all called build_size do not shadow one another."""
    name = f"build_size_{builder.parent.name.replace('-', '_')}"
    module_spec = importlib.util.spec_from_file_location(name, builder)
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    return module.SPEC


def _rebuild(spec, gen):
    """`gen`'s link as `--rebuild` makes it, and the committed link it must
    equal. A board its lane does not name by default (a second board of one
    size) is rebuilt through `pair=`, which only a one-lane example can
    resolve without guessing; its link is the one check_layout pairs it with."""
    n = load_board(gen).n
    lanes = [kind(spec) for kind in lane_kinds(spec)]
    for lane in lanes:
        link, owned = lane.files(n)
        if owned == gen:
            return lane.rebuild(n), link
    assert len(lanes) == 1, f"{gen} is no lane's board: name it in its lane's files()"
    pair = named_files(spec, _link_suffix(gen.name, "gen", ".json"))
    return lanes[0].rebuild(n, pair=pair), pair[0]


def test_every_size_builder_rebuilds_its_committed_boards_byte_for_byte():
    builders = sorted(EXAMPLES.glob("*/build_size.py"))
    assert len(builders) >= 6, "the size builders moved: fix the glob"
    seen = 0
    for builder in builders:
        spec = _spec(builder)
        for gen in sorted(builder.parent.glob("gen*.json")):
            # running-start's gen.json is its hand-built board's whole
            # document, rebuilt by its own build_link.py; anything else is a
            # carved board, and one that fails to load fails here
            if "puzzle" in json.loads(gen.read_text()):
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
