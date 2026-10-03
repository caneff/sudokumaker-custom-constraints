# The custom-constraint entry (type 1000) is built, found and written through
# sm_document alone. The expected entries below are the shapes the committed
# links already ship, written out by hand, so a drift in the builder shows as
# a diff against a link the app has opened.
#
#   uv run examples/_shared/sm_document.test.py

import pathlib
import tempfile

from link_codec import decode_puzzle
from sm_document import (
    code_constraint,
    find_constraint,
    registering_constraint_name,
    write_link,
)


def raises(fn, message):
    try:
        fn()
    except ValueError as e:
        assert message in str(e), f"wanted {message!r}, got {e!r}"
        return
    raise AssertionError(f"expected a ValueError naming {message!r}")


if __name__ == "__main__":
    # A board's own rule with drawn groups: the groups input is declared on
    # the definition and filled on the entry, and the entry carries its name.
    groups = [{"cells": [0, 7, 8], "value": "6"}]
    assert code_constraint(
        "Sum", "B", [("SumComponent", "C")], groups=groups, named=True
    ) == {
        "name": "Sum",
        "type": 1000,
        "definition": {
            "name": "Sum",
            "input": [{"id": "groups", "label": "Groups", "params": {"type": "raw"}}],
            "backend": {"type": "code", "code": "B"},
            "components": [{"type": "code", "name": "SumComponent", "code": "C"}],
        },
        "input": {"groups": groups},
        "style": {},
    }

    # A shared backend: no groups, no components, no entry-level name -- and
    # still the empty input and style every entry carries (the grid backend
    # once shipped without them).
    assert code_constraint("Grid Rows and Columns", "G") == {
        "type": 1000,
        "definition": {
            "name": "Grid Rows and Columns",
            "input": [],
            "backend": {"type": "code", "code": "G"},
            "components": [],
        },
        "input": {},
        "style": {},
    }

    doc = {
        "puzzle": {
            "constraints": [
                {"type": 0},
                code_constraint("Frame", "F"),
                code_constraint("Sum", "B", [("A", "a"), ("SumComponent", "c")]),
            ]
        }
    }

    # found by constraint name; a missing name is named in the refusal
    assert find_constraint(doc, "Sum") is doc["puzzle"]["constraints"][2]
    raises(lambda: find_constraint(doc, "Nope"), "'Nope'")

    # found by the component it registers, whatever its own name
    assert registering_constraint_name(doc, "SumComponent") == "Sum"
    raises(lambda: registering_constraint_name(doc, "Typo"), "'Typo'")

    # the writer leaves a link that decodes back to the document, one line
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "PUZZLE_LINK.txt"
        link = write_link(doc, out)
        assert out.read_text() == link + "\n"
        assert decode_puzzle(link) == doc

        # and refuses a document the encoder cannot carry: a tuple comes back
        # a list, so the link is not the board that was asked for
        try:
            write_link({"puzzle": {"cells": (1, 2)}}, out)
        except AssertionError as e:
            assert "round-trip" in str(e), e
        else:
            raise AssertionError("a document that does not round-trip was written")

    print("ok")
