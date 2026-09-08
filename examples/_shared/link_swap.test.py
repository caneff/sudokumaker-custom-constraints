# swap_component_code replaces one named component's code and leaves the
# backend and every other component untouched; replace_constraint_code can
# replace both. check_and_write enforces the "only the constraint code
# differs" invariant that build_link.py and build_original.py rely on, and
# frame_and_comment_only is the same invariant for a rebuild-from-seed
# script, judging the decoration layers by the ink they lay down rather than
# by the polylines that carry it (#385).
#
#   uv run --with lzstring examples/_shared/link_swap.test.py

import itertools
import pathlib
import tempfile

from link_codec import decode_puzzle
from link_swap import (
    blanked,
    check_and_write,
    find_constraint,
    frame_and_comment_only,
    replace_constraint_code,
    swap_component_code,
)

HERE = pathlib.Path(__file__).parent
LINK_FILE = HERE.parent / "skyscraper" / "PUZZLE_LINK.txt"
CONSTRAINT_NAME = "Skyscrapers"

if __name__ == "__main__":
    base = decode_puzzle(LINK_FILE.read_text().rstrip("\n"))

    # swap_component_code: only the named component's code changes
    swapped = swap_component_code(
        base, CONSTRAINT_NAME, "SkyscraperLineComponent", "NEW CODE"
    )
    base_components = find_constraint(base, CONSTRAINT_NAME)["definition"]["components"]
    new_components = find_constraint(swapped, CONSTRAINT_NAME)["definition"][
        "components"
    ]
    assert [c["name"] for c in new_components] == [c["name"] for c in base_components]
    got = {c["name"]: c["code"] for c in new_components}
    want = {c["name"]: c["code"] for c in base_components}
    diffs = [name for name in got if got[name] != want[name]]
    assert diffs == ["SkyscraperLineComponent"], (
        f"expected only SkyscraperLineComponent to change, got {diffs}"
    )
    assert (
        find_constraint(swapped, CONSTRAINT_NAME)["definition"]["backend"]["code"]
        == find_constraint(base, CONSTRAINT_NAME)["definition"]["backend"]["code"]
    ), "backend must stay untouched"
    assert blanked(swapped, CONSTRAINT_NAME) == blanked(base, CONSTRAINT_NAME)

    # swap_component_code fails loud on an unknown component name
    try:
        swap_component_code(base, CONSTRAINT_NAME, "NoSuchComponent", "x")
        raise AssertionError("expected ValueError for an unknown component name")
    except ValueError:
        pass

    # replace_constraint_code: backend and components both replaceable
    replaced = replace_constraint_code(
        base,
        CONSTRAINT_NAME,
        backend_code="NEW BACKEND",
        components=[{"type": "code", "name": "Whatever", "code": "X"}],
    )
    d = find_constraint(replaced, CONSTRAINT_NAME)["definition"]
    assert d["backend"]["code"] == "NEW BACKEND"
    assert d["components"] == [{"type": "code", "name": "Whatever", "code": "X"}]
    assert blanked(replaced, CONSTRAINT_NAME) == blanked(base, CONSTRAINT_NAME)

    # check_and_write: writes a round-tripping link, raises if the frame moved
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "out.txt"
        link = check_and_write(base, swapped, CONSTRAINT_NAME, out)
        assert decode_puzzle(out.read_text().strip()) == swapped
        assert decode_puzzle(link) == swapped

        moved = decode_puzzle(link)
        moved["puzzle"]["width"] += 1
        try:
            check_and_write(base, moved, CONSTRAINT_NAME, out)
            raise AssertionError("expected an assertion when the frame itself changes")
        except AssertionError as e:
            assert "frames differ" in str(e)

    # frame_and_comment_only: a decoration layer redrawn with different
    # polylines over the same ink is the same board. A rebuild that merges the
    # per-cell squares into runs has to pass this guard, and one that moves a
    # line has to fail it.
    def cosmetic(doc):
        return next(c for c in doc["puzzle"]["constraints"] if c.get("type") == 2000)

    redrawn = decode_puzzle(LINK_FILE.read_text().rstrip("\n"))
    layer = cosmetic(redrawn)
    # every closed square broken back into its four sides: same ink on the
    # page, a completely different set of polylines carrying it
    layer["lines"] = [
        [a, b] for pts in layer["lines"] for a, b in itertools.pairwise(pts)
    ]
    assert cosmetic(redrawn)["lines"] != cosmetic(base)["lines"], "fixture is a no-op"
    assert frame_and_comment_only(redrawn, CONSTRAINT_NAME) == frame_and_comment_only(
        base, CONSTRAINT_NAME
    ), "the same ink drawn as different polylines must compare equal"

    shifted = decode_puzzle(LINK_FILE.read_text().rstrip("\n"))
    for point in cosmetic(shifted)["lines"][0]:
        point["x"] += 1
    assert frame_and_comment_only(shifted, CONSTRAINT_NAME) != frame_and_comment_only(
        base, CONSTRAINT_NAME
    ), "a decoration line that actually moved must compare unequal"

    print("ok")
