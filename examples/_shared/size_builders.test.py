# Every size builder's committed boards rebuild byte for byte: each
# examples/*/build_size.py's Spec, run through `lanes.rebuild_all` (what
# `build_link.py --refresh` runs) on every gen JSON its example ships, gives
# back the committed link exactly: a change to the frame builder's lanes that
# moves a single byte of a shipped link fails here, naming the board.
#
# No CP-SAT search runs: a rebuild re-encodes the recorded board, so the whole
# sweep is document assembly and minification.
#
#   uv run examples/_shared/size_builders.test.py

import importlib.util
import pathlib
import re
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import check_layout
from lanes import rebuild_all

EXAMPLES = pathlib.Path(__file__).parent.parent


def _spec(builder):
    """The SPEC one build_size.py declares, loaded under a name of its own so
    six modules all called build_size do not shadow one another."""
    name = f"build_size_{builder.parent.name.replace('-', '_')}"
    module_spec = importlib.util.spec_from_file_location(name, builder)
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    return module.SPEC


def test_every_size_builder_rebuilds_its_committed_boards_byte_for_byte():
    builders = sorted(EXAMPLES.glob("*/build_size.py"))
    assert len(builders) >= 6, "the size builders moved: fix the glob"
    seen = 0
    for builder in builders:
        for link, built in rebuild_all(_spec(builder), write=False).items():
            assert built + "\n" == link.read_text(), (
                f"{link.relative_to(EXAMPLES)} is not what --refresh makes of "
                "its recorded board"
            )
            seen += 1
    assert seen >= 27, f"only {seen} boards rebuilt: the gen JSON glob missed some"


def test_the_command_the_stale_backend_violation_names_parses_on_every_example():
    """check_layout tells the author to run `build_link.py --refresh`; every
    example with a build_link.py must list that flag. Reading --help is the
    parse check: argparse registers the flag or it does not."""
    command = check_layout.REFRESH_COMMAND
    assert command == "build_link.py --refresh", command
    flag = command.split()[1]
    builders = sorted(EXAMPLES.glob("*/build_link.py"))
    assert len(builders) >= 12, "the link builders moved: fix the glob"
    for builder in builders:
        out = subprocess.run(
            [sys.executable, str(builder), "--help"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
        assert re.search(rf"{flag}\b", out), (
            f"{builder.parent.name}/build_link.py has no {flag}"
        )


if __name__ == "__main__":
    test_every_size_builder_rebuilds_its_committed_boards_byte_for_byte()
    test_the_command_the_stale_backend_violation_names_parses_on_every_example()
    print("PASS")
