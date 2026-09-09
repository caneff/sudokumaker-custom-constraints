# Shared machinery for building a same-board comparison link: the committed
# PUZZLE_LINK.txt with one named custom constraint's code swapped out, so two
# variants can be timed on the same grid, givens, and clues
# (docs/real-app-timing.md). Every example's build_link.py and build_original.py
# use these functions; only the constraint's code changes, never the frame.

import copy
import pathlib

from frame import UndescribableInk, segments
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


def _comparable_ink(lines):
    """What to compare a decoration layer by: its ink where `frame.segments`
    can name it, otherwise the polylines exactly as authored.

    segments only speaks of axis-aligned runs on the integer lattice, which is
    all `frame.cosmetics` draws. A hand-authored layer can hold a diagonal, a
    half-cell line or a repeated point -- numbered-rooms already ships
    decoration cosmetics never drew -- and such a layer falls back to being
    compared point for point. That reads a redraw of it as a mismatch, which
    the caller can look at; raising instead would take the guard itself down.
    A malformed layer -- a point short of a coordinate, a "line" that is not
    points -- is that same outage, so it degrades the same way rather than
    raising.
    """
    try:
        return sorted(segments(lines))
    except (UndescribableInk, KeyError, TypeError):
        return lines


def frame_and_comment_only(doc, constraint_name, also_blank=()):
    """`frame_only`, plus the puzzle comment cleared and every decoration
    layer reduced to the ink it draws, so two variants that differ only in
    code, input, comment or how the decoration is drawn compare equal -- the
    same board, givens and shown clues either way. The guard a
    rebuild-from-seed script puts on its output.

    `also_blank` names further constraints whose code is generated rather than
    board data -- the frame's own shared backends, which every framebuilt link
    embeds. Without it, editing one of those files makes every committed link
    unrebuildable: the guard reads the new code as a changed board and refuses
    the only route that would refresh it.

    The decoration layers are derived from the board, and a rebuild redraws
    them: merging the per-cell squares into runs changes every polyline and
    nothing a solver sees (#385). Comparing the ink instead of the point
    lists still catches a layer that moved, gained a line, or lost one.

    Layers whose ink has no name in segments are compared as authored --
    see `_comparable_ink`."""
    d = frame_only(doc, constraint_name)
    for name in also_blank:
        defn = find_constraint(d, name)["definition"]
        defn["backend"]["code"] = ""
        defn["components"] = []
    d["puzzle"]["comment"] = ""
    for c in d["puzzle"]["constraints"]:
        if c.get("type") == 2000:
            c["lines"] = _comparable_ink(c.get("lines", []))
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
