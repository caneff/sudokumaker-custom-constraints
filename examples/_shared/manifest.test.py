# manifest.load_manifest reads an example's example.toml: the traits the shared
# checker and the timing driver read (docs/example-layout.md, "The manifest").
# These cases pin the defaults, the values a manifest can set, and the loud
# failures.
#
#   uv run examples/_shared/manifest.test.py

import pathlib
import tempfile

from manifest import MANIFEST_NAME, load_manifest


def manifest_in(text):
    """A temp example dir holding `text` as its example.toml (None: no file)."""
    tmp = tempfile.TemporaryDirectory()
    d = pathlib.Path(tmp.name) / "widget"
    d.mkdir()
    if text is not None:
        (d / MANIFEST_NAME).write_text(text)
    return tmp, d


def raises(exc, d, *needles):
    try:
        load_manifest(d)
    except exc as e:
        for needle in needles:
            assert needle in str(e), (needle, str(e))
        return
    raise AssertionError(f"expected {exc.__name__}")


if __name__ == "__main__":
    # the one required field; every other trait has the common-case default
    tmp, d = manifest_in('timed_component = "WidgetComponent"\n')
    m = load_manifest(d)
    assert m.timed_component == "WidgetComponent"
    assert m.lanes == "split"
    assert m.rules_prefix == "inner-grid"
    assert m.houses is True
    assert m.digits_exceed_lines is False
    assert m.shared_component is None
    assert m.generator_less_links == ()
    assert m.rowcol_backend is None
    assert m.constraint_name is None
    assert m.boardless is False
    assert m.annotated_keeps_comments is False
    tmp.cleanup()

    # every trait can be set
    tmp, d = manifest_in(
        """
timed_component = "WidgetComponent"
constraint_name = "Widget"
lanes = "single"
rules_prefix = "none"
houses = false
digits_exceed_lines = true
shared_component = "SharedComponent"
generator_less_links = ["PUZZLE_LINK.txt"]
rowcol_backend = "Rows & Columns"
boardless = true
annotated_keeps_comments = true
"""
    )
    m = load_manifest(d)
    assert (m.constraint_name, m.lanes, m.rules_prefix) == ("Widget", "single", "none")
    assert m.houses is False and m.digits_exceed_lines is True
    assert m.shared_component == "SharedComponent"
    assert m.generator_less_links == ("PUZZLE_LINK.txt",)
    assert m.rowcol_backend == "Rows & Columns"
    assert m.boardless is True and m.annotated_keeps_comments is True
    tmp.cleanup()

    # NO_RULES_PREFIX and NO_HOUSES stay two separate fields (2026-09-07 ruling)
    tmp, d = manifest_in('timed_component = "W"\nrules_prefix = "none"\n')
    m = load_manifest(d)
    assert m.rules_prefix == "none" and m.houses is True
    tmp.cleanup()

    # a missing manifest names the file it wanted
    tmp, d = manifest_in(None)
    raises(FileNotFoundError, d, str(d / MANIFEST_NAME))
    tmp.cleanup()

    # a missing timed_component, an unknown key and a bad value all fail loud
    for text, needles in [
        ('lanes = "split"\n', ("timed_component",)),
        ('timed_component = "W"\nlane = "split"\n', ("lane",)),
        ('timed_component = "W"\nlanes = "both"\n', ("lanes", "both")),
        ('timed_component = "W"\nrules_prefix = "sudoku"\n', ("rules_prefix",)),
        ('timed_component = "W"\nhouses = "no"\n', ("houses",)),
        ('timed_component = "W"\ngenerator_less_links = "a.txt"\n', ("generator",)),
        ('timed_component = "W"\nlanes = \n', ("Invalid",)),
    ]:
        tmp, d = manifest_in(text)
        raises(ValueError, d, str(d / MANIFEST_NAME), *needles)
        tmp.cleanup()

    print("ok")
