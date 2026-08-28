# build_link.py --component --out: decode the output and assert the only
# difference from the committed PUZZLE_LINK.txt is the swapped-in component's
# code. ISOFILL is global with one component and no groups, so there is no
# sibling component to leave untouched (contrast the local-groups examples).
# Mirrors examples/skyscraper/build_link.test.py.
#
# Also covers build_hard_links.py's FIXTURES: each hard-fixture link
# (PUZZLE_LINK_30g.txt and friends) must reproduce build+strip of its own
# gen_*.json, and must carry no stray non-given value. This guard used to run
# only when build_hard_links.py executed as a script under `just test`; it
# moved here so `just test` can drop builders and still catch drift.
#
#   uv run --with lzstring examples/isofill/build_link.test.py

import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_hard_links import FIXTURES
from build_link import CONSTRAINT_NAME, build, check
from link_codec import decode_puzzle, encode_link
from link_swap import blanked, find_constraint
from probe_link import strip_to_givens

if __name__ == "__main__":
    base_text = (HERE / "PUZZLE_LINK.txt").read_text().strip()
    base = decode_puzzle(base_text)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)

        # the committed component round-trips to PUZZLE_LINK.txt byte-for-byte
        link, doc, n_clues = build(HERE / "IsofillComponent.js", HERE / "gen.json")
        check(link, doc, n_clues)
        assert link == base_text, (
            "the committed component must reproduce PUZZLE_LINK.txt exactly"
        )

        # a candidate file for the same registered component name, the shape a
        # real edit-and-retime loop uses
        candidate = tmp / "IsofillComponent.js"
        candidate.write_text(
            (HERE / "IsofillComponent.js").read_text() + "\n//! candidate edit\n"
        )
        out = tmp / "candidate.txt"
        cand_link, cand_doc, cand_n_clues = build(candidate, HERE / "gen.json")
        check(cand_link, cand_doc, cand_n_clues)
        out.write_text(cand_link + "\n")
        assert decode_puzzle(out.read_text().strip()) == cand_doc, "did not write --out"

        # only the constraint's code differs from the committed link
        assert blanked(cand_doc, CONSTRAINT_NAME) == blanked(base, CONSTRAINT_NAME)

        base_code = find_constraint(base, CONSTRAINT_NAME)["definition"]["components"][
            0
        ]["code"]
        new_code = find_constraint(cand_doc, CONSTRAINT_NAME)["definition"][
            "components"
        ][0]["code"]
        assert new_code != base_code
        # the backend is untouched
        assert (
            find_constraint(cand_doc, CONSTRAINT_NAME)["definition"]["backend"]["code"]
            == find_constraint(base, CONSTRAINT_NAME)["definition"]["backend"]["code"]
        )

    # each hard-fixture link matches build+strip of its own gen_*.json, and
    # carries no stray non-given value (mirrors build_hard_links.py)
    for gen_name, link_name in FIXTURES.items():
        committed = (HERE / link_name).read_text().strip()
        link, doc, n_clues = build(HERE / "IsofillComponent.js", HERE / gen_name)
        check(link, doc, n_clues)
        stripped = strip_to_givens(decode_puzzle(link))
        stripped_text = encode_link(stripped)
        assert stripped_text == committed, (
            f"{link_name} does not match build+strip of {gen_name}"
        )
        bad = [c for c in stripped["puzzle"]["cells"] if not c.get("given") and c]
        assert not bad, f"{link_name}: {len(bad)} non-given cells hold data"

    print("ok")
