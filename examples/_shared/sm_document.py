# The SudokuMaker document's custom-constraint entry (type 1000), in one
# place: the builder every board's code constraint is made by, the two ways a
# board is searched for one, and the writer every link goes to disk through.

import pathlib

from link_codec import decode_puzzle, encode_link

# The input a constraint declares when its board ships drawn groups: main.js
# reads them as `input.groups` (docs/example-layout.md).
GROUPS_INPUT = {"id": "groups", "label": "Groups", "params": {"type": "raw"}}


def code_constraint(name, backend_code, components=(), *, groups=None, named=False):
    """A type-1000 entry running `backend_code`, registering each
    `(component name, code)` pair in `components`.

    `groups` is the drawn groups a local board ships: the entry declares the
    groups input and carries them. None declares no input at all. `named`
    also puts `name` on the entry itself, as a board's own rule ships it; the
    shared backends a board carries beside it do not."""
    return {
        **({"name": name} if named else {}),
        "type": 1000,
        "definition": {
            "name": name,
            "input": [GROUPS_INPUT] if groups is not None else [],
            "backend": {"type": "code", "code": backend_code},
            "components": [
                {"type": "code", "name": component, "code": code}
                for component, code in components
            ],
        },
        "input": {"groups": groups} if groups is not None else {},
        "style": {},
    }


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


def registering_constraint_name(doc, component_name):
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


def write_link(doc, out_path):
    """Encode `doc`, assert the link decodes back to it, and write it.

    Every builder writes its link here: the encoder is lossy on a document it
    cannot represent, and a link that does not round-trip is a board nobody
    can rebuild from what is on disk."""
    link = encode_link(doc)
    assert decode_puzzle(link) == doc, "link does not round-trip"
    pathlib.Path(out_path).write_text(link + "\n")
    return link
