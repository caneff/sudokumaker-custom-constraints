# The shared document parts (document.py): the House GAC constraint's own
# size cap, checked without a lane around it.
#
#   uv run examples/_shared/document.test.py

from document import house_gac_constraint


def test_house_gac_constraint_refuses_above_nine_cells_on_its_own():
    # build_doc's own cap check (test above) is not the only caller: a
    # hand-built board (running-start/build_link.py's build_from_template)
    # appends `house_gac_constraint()` directly, bypassing build_doc
    # entirely, so the cap has to live in the one function every caller goes
    # through, not just in build_doc.
    house_gac_constraint(9)  # does not raise
    try:
        house_gac_constraint(10)
    except ValueError as e:
        assert "9-cell house cap" in str(e), e
    else:
        raise AssertionError("house_gac_constraint accepted n=10")


if __name__ == "__main__":
    test_house_gac_constraint_refuses_above_nine_cells_on_its_own()
    print("document self-check OK")
