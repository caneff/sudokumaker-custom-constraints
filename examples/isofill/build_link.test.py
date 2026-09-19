# The ISOFILL board builds through _shared/bareboard.py: the committed
# component and gen.json reproduce PUZZLE_LINK.txt byte for byte. The
# component swap is link_swap.test.py's.
#
# Also covers build_hard_links.py's FIXTURES: write_links, run into a temp
# dir with every subprocess call made to fail, must write each hard-fixture
# link (PUZZLE_LINK_30g.txt and friends) byte-equal to the committed one, so
# drift in a fixture is caught and the build stays in-process.
#
#   uv run examples/isofill/build_link.test.py

import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

import build_hard_links
from build_hard_links import FIXTURES
from build_link import build, check

if __name__ == "__main__":
    link, doc, n_clues = build(HERE / "IsofillComponent.js", HERE / "gen.json")
    check(link, doc, n_clues)
    assert link == (HERE / "PUZZLE_LINK.txt").read_text().strip(), (
        "the committed component must reproduce PUZZLE_LINK.txt exactly"
    )

    # build_hard_links writes the committed links byte for byte, spawning nothing
    def no_subprocess(*args, **kwargs):
        raise AssertionError(f"build_hard_links spawned a process: {args}")

    subprocess.run = subprocess.Popen = no_subprocess
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        build_hard_links.write_links(tmp)
        for link_name in FIXTURES.values():
            assert (tmp / link_name).read_bytes() == (HERE / link_name).read_bytes(), (
                f"build_hard_links wrote a {link_name} that differs from the committed one"
            )
        assert sorted(p.name for p in tmp.iterdir()) == sorted(FIXTURES.values()), (
            "build_hard_links left extra files behind"
        )

    print("ok")
