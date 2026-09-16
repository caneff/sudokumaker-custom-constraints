# Shared machinery for building a same-board comparison link: the committed
# PUZZLE_LINK.txt with one named custom constraint's code swapped out, so two
# variants can be timed on the same grid, givens, and clues
# (docs/real-app-timing.md). Every example's build_link.py and build_original.py
# use these functions; only the constraint's code changes, never the frame.
# A build_link.py is a manifest over `swap_main`, which swaps through
# `swap_build`.

import argparse
import copy
import pathlib

from frame import UndescribableInk, segments
from link_codec import decode_puzzle, encode_link
from minify import minify_file


def find_constraint(doc, constraint_name):
    """The constraint `doc` ships under `constraint_name`.

    Raises naming the constraint it could not find: a caller that reaches
    through this -- `framebuild.refresh_frame_backends`, `frame_and_comment_only`
    -- is asserting the board carries it, and a bare StopIteration names
    nothing to go and look for.
    """
    for c in doc["puzzle"]["constraints"]:
        if c.get("definition", {}).get("name") == constraint_name:
            return c
    raise ValueError(f"the document has no constraint named {constraint_name!r}")


def constraint_with(doc, component_name):
    """The name of doc's constraint that registers `component_name`. Raises if
    none does -- a typo'd component must not silently no-op.

    A board is searched by component, not by constraint name, because one
    example's boards need not agree on the name: numbered-rooms' hand-built
    board says "Custom Numbered Rooms", its generated ones "Numbered Rooms"."""
    for c in doc["puzzle"]["constraints"]:
        definition = c.get("definition", {})
        if any(
            comp["name"] == component_name for comp in definition.get("components", [])
        ):
            return definition["name"]
    raise ValueError(f"no constraint registers a component named {component_name!r}")


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


def write_link(doc, out_path):
    """Encode `doc`, assert the link decodes back to it, and write it.

    Every path through this module writes its link here, and a builder that
    encodes its own should assert the same thing: the encoder is lossy on a
    document it cannot represent, and a link that does not round-trip is a
    board nobody can rebuild from what is on disk."""
    link = encode_link(doc)
    assert decode_puzzle(link) == doc, "link does not round-trip"
    pathlib.Path(out_path).write_text(link + "\n")
    return link


def check_and_write(base_doc, new_doc, constraint_name, out_path):
    """Assert new_doc differs from base_doc only in the named constraint's
    code, then encode, round-trip check, and write the link to out_path."""
    assert blanked(base_doc, constraint_name) == blanked(new_doc, constraint_name), (
        "frames differ beyond the constraint code"
    )
    return write_link(new_doc, out_path)


def swap_build(board, component, out, backend=None):
    """Swap one component file's code into the committed link `board` and
    write the result to `out`: the same-board pair `just time` compares
    (docs/real-app-timing.md).

    The component is named by the file's stem and found on whichever
    constraint registers it; `backend`, when given, replaces that constraint's
    backend code as well. Nothing else changes, and `check_and_write` asserts
    so before writing. Returns the link."""
    component = pathlib.Path(component)
    base = decode_puzzle(pathlib.Path(board).read_text().strip())
    name = constraint_with(base, component.stem)
    doc = swap_component_code(base, name, component.stem, minify_file(component))
    if backend is not None:
        doc = replace_constraint_code(
            doc, name, backend_code=minify_file(pathlib.Path(backend))
        )
    return check_and_write(base, doc, name, out)


def swap_main(example_dir, parser=None, rebuild=None):
    """The command line every build_link.py shares.

    `--component FILE --out FILE [--board LINK] [--backend FILE]` runs
    `swap_build` against `--board`, or the example's PUZZLE_LINK.txt when it
    is omitted. Without `--component`, `rebuild(args, parser)` runs instead --
    the example's own from-source build -- and an example with none refuses.

    `parser` carries an example's own flags; the four above are added to it.
    A flag the chosen path cannot honour is refused, never ignored: an
    example's own flag beside --component (it belongs to the rebuild), and
    --board without --component (there is nothing to swap into it)."""
    p = parser or argparse.ArgumentParser()
    own = [a.dest for a in p._actions if a.dest != "help"]
    p.add_argument("--component", help="component file to swap into the board")
    p.add_argument("--out", help="where to write the swapped link")
    p.add_argument("--board", help="committed link to swap into (PUZZLE_LINK.txt)")
    p.add_argument("--backend", help="backend file to swap in as well")
    args = p.parse_args()
    if args.component is None:
        if rebuild is None:
            p.error("give --component with --out")
        if args.board is not None:
            p.error("--board names the link a --component swaps into; give --component")
        rebuild(args, p)
        return
    for dest in own:
        if getattr(args, dest) != p.get_default(dest):
            p.error(
                f"--{dest.replace('_', '-')} belongs to the rebuild; drop it or --component"
            )
    if args.out is None:
        p.error("--component needs --out")
    board = args.board or pathlib.Path(example_dir) / "PUZZLE_LINK.txt"
    link = swap_build(board, args.component, args.out, args.backend)
    print(f"wrote {args.out} ({len(link)} chars, from {board})")
