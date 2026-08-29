# Shared machinery for building a same-board comparison link: the committed
# PUZZLE_LINK.txt with one named custom constraint's code swapped out, so two
# variants can be timed on the same grid, givens, and clues
# (docs/real-app-timing.md). Every example's build_link.py and build_original.py
# use these functions; only the constraint's code changes, never the frame.

import copy
import pathlib

from link_codec import decode_puzzle, encode_link


def find_constraint(doc, constraint_name):
    return next(
        c
        for c in doc["puzzle"]["constraints"]
        if c.get("definition", {}).get("name") == constraint_name
    )


def blanked(doc, constraint_name):
    """doc with the named constraint's code fields emptied, for an
    apples-to-apples diff against another variant."""
    d = copy.deepcopy(doc)
    defn = find_constraint(d, constraint_name)["definition"]
    defn["backend"]["code"] = ""
    defn["components"] = []
    return d


def frame_only(doc, constraint_name):
    """doc with the named constraint's own configuration -- code and input
    (explicit drawn groups vs none) -- cleared, so a local-groups variant and
    a global (frame-built) variant of the same board compare equal
    everywhere else: the same grid, givens, and clues either way."""
    d = blanked(doc, constraint_name)
    lc = find_constraint(d, constraint_name)
    lc["definition"]["input"], lc["input"] = [], {}
    return d


def replace_constraint_code(
    doc, constraint_name, *, backend_code=None, components=None
):
    """Return a copy of doc with the named constraint's backend and/or
    components replaced. Omit either to leave it exactly as committed."""
    doc = copy.deepcopy(doc)
    defn = find_constraint(doc, constraint_name)["definition"]
    if backend_code is not None:
        defn["backend"]["code"] = backend_code
    if components is not None:
        defn["components"] = components
    return doc


def swap_component_code(doc, constraint_name, component_name, new_code):
    """Return a copy of doc with one named component's code replaced; the
    backend and every other component stay exactly as committed. Raises if no
    component with that name exists — a typo must not silently no-op."""
    defn = find_constraint(doc, constraint_name)["definition"]
    names = [c["name"] for c in defn["components"]]
    if component_name not in names:
        raise ValueError(
            f"no component named {component_name!r} in {constraint_name!r} "
            f"(have {names})"
        )
    components = [
        {**c, "code": new_code} if c["name"] == component_name else c
        for c in defn["components"]
    ]
    return replace_constraint_code(doc, constraint_name, components=components)


def check_and_write(base_doc, new_doc, constraint_name, out_path):
    """Assert new_doc differs from base_doc only in the named constraint's
    code, then encode, round-trip check, and write the link to out_path."""
    assert blanked(base_doc, constraint_name) == blanked(new_doc, constraint_name), (
        "frames differ beyond the constraint code"
    )
    link = encode_link(new_doc)
    assert decode_puzzle(link) == new_doc, "link does not round-trip"
    pathlib.Path(out_path).write_text(link + "\n")
    return link
