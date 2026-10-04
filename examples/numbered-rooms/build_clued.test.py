import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_clued import CONSTRAINT_NAME, build
from build_original import frame_groups
from link_codec import decode_puzzle
from link_swap import frame_only
from sm_document import find_constraint

if __name__ == "__main__":
    base = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
    # read the shipped links before the rebuild runs, so a rebuild that also
    # wrote to HERE could not satisfy the untouched check below
    names = ["PUZZLE_LINK_clued.txt", "PUZZLE_LINK_clued_original.txt"]
    shipped = {n: (HERE / n).read_bytes() for n in names}
    # modification times too: a rebuild that also wrote to HERE rewrites the
    # same bytes, so only the time shows it
    stamped = {n: (HERE / n).stat().st_mtime_ns for n in names}

    with tempfile.TemporaryDirectory() as tmp:
        out_dir = pathlib.Path(tmp)
        clued, clued_original = build(out_dir)
        for n in names:
            assert (out_dir / n).read_bytes() == shipped[n], (
                f"{n} does not reproduce byte-identically"
            )
    for n in names:
        assert (HERE / n).read_bytes() == shipped[n], f"{n} was touched by build()"
        assert (HERE / n).stat().st_mtime_ns == stamped[n], (
            f"{n} was rewritten by build()"
        )

    ring = {g["cells"][0] for g in frame_groups()}
    assert len(ring) == 36, f"expected 36 clue cells, found {len(ring)}"

    base_cells = base["puzzle"]["cells"]
    clued_cells = clued["puzzle"]["cells"]

    for i in ring:
        assert clued_cells[i].get("value") is not None, f"clue cell {i} still blank"

    for i in range(len(base_cells)):
        if i not in ring:
            assert clued_cells[i] == base_cells[i], f"interior cell {i} changed"

    assert (
        find_constraint(clued, CONSTRAINT_NAME)["definition"]["components"]
        == find_constraint(base, CONSTRAINT_NAME)["definition"]["components"]
    )
    assert (
        find_constraint(clued, CONSTRAINT_NAME)["definition"]["backend"]
        == find_constraint(base, CONSTRAINT_NAME)["definition"]["backend"]
    )

    # frame_only() empties the constraint's code and input, so equality means
    # everything else matches; the code and input themselves must differ.
    assert frame_only(clued, CONSTRAINT_NAME) == frame_only(
        clued_original, CONSTRAINT_NAME
    )
    assert (
        len(find_constraint(clued_original, CONSTRAINT_NAME)["input"]["groups"]) == 36
    ), "the original wrapper's twin must ship the 36 drawn frame lines"
    assert find_constraint(clued, CONSTRAINT_NAME)["input"] == {}, (
        "the clued board runs the global lane, so it draws no groups"
    )
    assert (
        find_constraint(clued, CONSTRAINT_NAME)["definition"]["components"]
        != find_constraint(clued_original, CONSTRAINT_NAME)["definition"]["components"]
    )

    print("ok")
