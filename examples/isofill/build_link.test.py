# The ISOFILL board builds through _shared/bareboard.py: the committed
# component and gen.json reproduce PUZZLE_LINK.txt byte for byte, and each
# hard-fixture link (PUZZLE_LINK_30g.txt and friends) reproduces build+strip
# of its own gen_*.json, so drift in a fixture is caught without running
# build_hard_links.py itself. The component swap is link_swap.test.py's.
#
#   uv run examples/isofill/build_link.test.py

import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_hard_links import FIXTURES
from build_link import build, check
from link_codec import decode_puzzle, encode_link
from probe_link import strip_to_givens

if __name__ == "__main__":
    link, doc, n_clues = build(HERE / "IsofillComponent.js", HERE / "gen.json")
    check(link, doc, n_clues)
    assert link == (HERE / "PUZZLE_LINK.txt").read_text().strip(), (
        "the committed component must reproduce PUZZLE_LINK.txt exactly"
    )

    for gen_name, link_name in FIXTURES.items():
        committed = (HERE / link_name).read_text().strip()
        link, doc, n_clues = build(HERE / "IsofillComponent.js", HERE / gen_name)
        check(link, doc, n_clues)
        stripped_text = encode_link(strip_to_givens(decode_puzzle(link)))
        assert stripped_text == committed, (
            f"{link_name} does not match build+strip of {gen_name}"
        )

    print("ok")
