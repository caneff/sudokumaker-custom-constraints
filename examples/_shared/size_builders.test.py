# Every size builder's committed boards rebuild byte for byte: each
# examples/*/build_size.py's Spec, run through `lanes.rebuild_all` (what
# `build_link.py --refresh` runs) on every gen JSON its example ships, gives
# back the committed link exactly: a change to the frame builder's lanes that
# moves a single byte of a shipped link fails here, naming the board.
#
# No CP-SAT search runs: a rebuild re-encodes the recorded board, so the whole
# sweep is document assembly and minification.
#
# Then every example's `build_link.py --refresh` -- the command the
# stale-backend violation names -- is run for real, in a copy of the tree: it
# exits 0, rewrites every link that embeds shared code, and changes no byte.
# A few hand-built boards re-prove uniqueness there (house-gac, dutch-flatmates,
# squishdoku); the whole run is seconds.
#
#   uv run examples/_shared/size_builders.test.py

import importlib.util
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import link_checks
from document import SHARED_BACKENDS, link_suffix
from lanes import rebuild_all
from sudoku_kit.link_codec import decode_puzzle

EXAMPLES = pathlib.Path(__file__).parent.parent
REPO = EXAMPLES.parent


def _spec(builder):
    """The SPEC one build_size.py declares, loaded under a name of its own so
    six modules all called build_size do not shadow one another."""
    name = f"build_size_{builder.parent.name.replace('-', '_')}"
    module_spec = importlib.util.spec_from_file_location(name, builder)
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    return module.SPEC


def _carved_boards(example_dir):
    """The link of every gen JSON in `example_dir` that records a carved
    board, read off the files, not the lanes: a gen JSON holding a whole
    `puzzle` document is a hand-built board's."""
    links = set()
    for gen in example_dir.glob("gen*.json"):
        if "puzzle" in json.loads(gen.read_text()):
            continue
        tag = link_suffix(gen.name, "gen", ".json")
        links.add(
            example_dir / (f"PUZZLE_LINK_{tag}.txt" if tag else "PUZZLE_LINK.txt")
        )
    return links


def test_every_size_builder_rebuilds_its_committed_boards_byte_for_byte():
    builders = sorted(EXAMPLES.glob("*/build_size.py"))
    assert len(builders) >= 6, "the size builders moved: fix the glob"
    for builder in builders:
        rebuilt = rebuild_all(_spec(builder), write=False)
        # Every carved board, not a count of them: a board the sweep skipped
        # is named, and a floor would let one go quietly.
        want = _carved_boards(builder.parent)
        assert set(rebuilt) == want, (
            f"{builder.parent.name}: rebuild_all skipped "
            f"{sorted(p.name for p in want - set(rebuilt))}, made "
            f"{sorted(p.name for p in set(rebuilt) - want)}"
        )
        for link, built in rebuilt.items():
            assert built + "\n" == link.read_text(), (
                f"{link.relative_to(EXAMPLES)} is not what --refresh makes of "
                "its recorded board"
            )


def _embeds_shared_code(path):
    """Whether the link at `path` carries a shared backend or the shared
    component -- what the stale-backend check compares."""
    titles = {b.title for b in SHARED_BACKENDS}
    components = {b.component for b in SHARED_BACKENDS if b.component}
    for c in decode_puzzle(path.read_text().strip())["puzzle"]["constraints"]:
        definition = c.get("definition") or {}
        if definition.get("name") in titles or any(
            comp["name"] in components for comp in definition.get("components", [])
        ):
            return True
    return False


def test_the_command_the_stale_backend_violation_names_runs_on_every_example():
    """check_layout tells the author to run `build_link.py --refresh`. Run it,
    on every example, in a copy of the tree: each exits 0, rewrites every
    committed link that embeds shared code -- the links the violation can
    name -- and, the tree being unchanged, leaves every link's bytes as they
    were (no regeneration ships)."""
    command = link_checks.REFRESH_COMMAND
    assert command == "build_link.py --refresh", command
    script, flag = command.split()
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        shutil.copytree(
            EXAMPLES, root / "examples", ignore=shutil.ignore_patterns("__pycache__")
        )
        # component_scan reads the built-in component list from here.
        (root / "docs").mkdir()
        shutil.copy(REPO / "docs/builtin-components.md", root / "docs")
        links = sorted((root / "examples").rglob("PUZZLE_LINK*.txt"))
        before = {p: p.read_bytes() for p in links}
        for p in links:
            os.utime(p, ns=(0, 0))
        builders = sorted((root / "examples").glob(f"*/{script}"))
        assert len(builders) >= 13, "the link builders moved: fix the glob"
        for builder in builders:
            run = subprocess.run(
                [sys.executable, str(builder), flag],
                capture_output=True,
                text=True,
                timeout=300,
            )
            assert run.returncode == 0, (
                f"{builder.parent.name}/{command} exited {run.returncode}: {run.stderr}"
            )
        shown = lambda p: p.relative_to(root / "examples")
        changed = [shown(p) for p in links if p.read_bytes() != before[p]]
        assert not changed, f"{command} does not rebuild these byte for byte: {changed}"
        missed = [
            shown(p)
            for p in links
            if p.stat().st_mtime_ns == 0 and _embeds_shared_code(p)
        ]
        assert not missed, f"{command} leaves these links unrebuilt: {missed}"


if __name__ == "__main__":
    test_every_size_builder_rebuilds_its_committed_boards_byte_for_byte()
    test_the_command_the_stale_backend_violation_names_runs_on_every_example()
    print("PASS")
