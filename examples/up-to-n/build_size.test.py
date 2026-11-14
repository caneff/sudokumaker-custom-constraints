# `build_size.py --derive-shipped-9x9` writes the shipped 9x9 only through the
# lane's checked encode: a board whose link fails `Lane.check` is refused and
# nothing is written. Runs the real derive against a scratch copy of this
# example's folder, so the committed files are never touched.
#
#   uv run examples/up-to-n/build_size.test.py

import contextlib
import pathlib
import sys
import tempfile
from dataclasses import replace

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

import build_size


@contextlib.contextmanager
def scratch_spec(**changes):
    """`build_size.SPEC` pointed at a scratch folder holding this example's
    backend and component, `_shared` beside it so their `#include`s resolve.
    `changes` replace further Spec fields; `extra` files are written into the
    folder."""
    extra = changes.pop("extra", {})
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        (root / "_shared").symlink_to(HERE.parent / "_shared")
        folder = root / HERE.name
        folder.mkdir()
        for name in ("main.js", *build_size.SPEC.components):
            (folder / name).symlink_to(HERE / name)
        for name, text in extra.items():
            (folder / name).write_text(text)
        saved = build_size.SPEC
        build_size.SPEC = replace(saved, dir=folder, **changes)
        try:
            yield folder
        finally:
            build_size.SPEC = saved


def test_derive_writes_the_committed_shipped_9x9():
    # The control: the unbroken derive reproduces the committed pair.
    with scratch_spec() as folder:
        build_size.derive_shipped_9x9()
        assert (folder / "PUZZLE_LINK.txt").read_text() == (
            HERE / "PUZZLE_LINK.txt"
        ).read_text(), "the derive no longer writes the committed shipped 9x9"


def test_derive_refuses_a_link_that_fails_the_lane_check():
    # A component no backend registers is dead weight `Lane.check` rejects;
    # an encode that skips the check would write the link anyway.
    dead = {"DeadComponent.js": "class DeadComponent {}\n"}
    components = [*build_size.SPEC.components, "DeadComponent.js"]
    with scratch_spec(components=components, extra=dead) as folder:
        try:
            build_size.derive_shipped_9x9()
        except AssertionError as e:
            assert "DeadComponent" in str(e), e
        else:
            raise AssertionError("the derive wrote a link that fails Lane.check")
        assert not (folder / "PUZZLE_LINK.txt").exists(), "a refused link was written"


if __name__ == "__main__":
    test_derive_writes_the_committed_shipped_9x9()
    test_derive_refuses_a_link_that_fails_the_lane_check()
    print("ok")
