import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "_shared"))

from board_kit import givens_of
from build_sparse_count_digits import (
    BACKEND,
    BOARD_DIR,
    GEN,
    build,
)
from count_board import (
    BASELINE_NAME,
    CANDIDATE_NAME,
    COMPONENT,
    model,
    sparse_backend_code,
)
from count_test_kit import (
    assert_counter_is_count,
    check_rule_is_enforced,
    check_same_board_pair,
    counter_for,
)
from minify import minify_file
from sudoku_kit.link_codec import decode_puzzle

ANNOTATED = "PUZZLE_LINK_annotated.txt"


count_solutions = counter_for(model)


def check_board(gen):
    groups = gen["groups"]
    # the shape the README's recorded rows describe
    assert len(groups) == 20, "the timed board has 20 groups"
    for g in groups:
        cells = [tuple(p) for p in g["cells"]]
        counter = tuple(g["counter"])
        assert len(set(cells)) == len(cells) == 14, (
            f"{g['name']}: not 14 distinct cells"
        )
        assert len(g["values"]) == 3, f"{g['name']}: not 3 listed digits"
        assert counter not in set(cells), (
            f"{g['name']}: the counter is one of its targets"
        )
        assert_counter_is_count(gen, g)
    carve_order = [tuple(p) for p in gen["carve_order"]]
    assert len(set(carve_order)) == len(carve_order), "a cell is carved twice"
    assert 0 <= gen["carved"] <= len(carve_order), "carved is outside the carve order"
    assert count_solutions(groups, givens_of(gen)) == 1, (
        "not unique under the CP-SAT model"
    )


def check_annotated(gen, plain_doc):
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp)
        build(out, keep_comments=True)
        assert [p.name for p in out.iterdir()] == [ANNOTATED], (
            "--keep-comments writes only the annotated link"
        )
        built = (out / ANNOTATED).read_bytes()
    assert built == (BOARD_DIR / ANNOTATED).read_bytes(), (
        f"{ANNOTATED} does not reproduce"
    )
    doc = decode_puzzle(built.decode().strip())
    constraint = doc["puzzle"]["constraints"][-1]["definition"]
    component = constraint["components"][0]["code"]
    assert component == minify_file(COMPONENT, keep_comments=True)
    assert constraint["backend"]["code"] == sparse_backend_code(
        BACKEND, gen, CANDIDATE_NAME, True
    )
    plain_doc = json.loads(json.dumps(plain_doc))
    plain_c = plain_doc["puzzle"]["constraints"][-1]["definition"]
    plain_c["components"][0]["code"] = component
    plain_c["backend"]["code"] = constraint["backend"]["code"]
    assert doc == plain_doc, "the annotated link differs beyond the code comments"


if __name__ == "__main__":
    gen = json.loads(GEN.read_text())
    check_board(gen)
    check_rule_is_enforced(gen, count_solutions)

    cand_doc_full = check_same_board_pair(
        gen,
        board_dir=BOARD_DIR,
        build=build,
        backend=BACKEND,
        candidate=CANDIDATE_NAME,
        baseline=BASELINE_NAME,
        component=COMPONENT,
    )
    check_annotated(gen, cand_doc_full)
    print("ok")
