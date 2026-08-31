# check_layout walks an examples/-shaped directory and verifies every
# example (any dir other than _shared) has the required file set, that
# every PUZZLE_LINK*.txt name matches the link grammar, and that every link
# decodes clean (docs/share-checklist.md). These fixtures build small temp
# trees rather than reuse the real examples/, so a case (a missing file, a
# bad link name, a dirty link) is exact and does not drift with the repo.
#
#   uv run --with lzstring examples/_shared/check_layout.test.py

import contextlib
import pathlib
import subprocess
import sys
import tempfile

from check_layout import RULES_PREFIX, check_tree
from link_codec import encode_link

HERE = pathlib.Path(__file__).parent


def _link(
    entered=False, prefix=True, ships=("FooComponent",), registers=None, note=None
):
    """A minimal encoded puzzle link: one given cell, the rest empty, and one
    custom constraint whose backend registers the components it ships.

    `entered` puts a value on a non-given cell (the link does not open
    clean); `prefix` controls whether the comment carries RULES_PREFIX (the
    rules-prefix check fails when False). `ships` names the components the
    constraint carries and `registers` (default: the same names) the ones its
    backend instantiates, so a case can make the two sets disagree. `note`
    prepends a comment line to the backend, which must not read as a
    registration.
    """
    cells = [{"given": True, "value": 1}] + [{} for _ in range(8)]
    if entered:
        cells[1] = {"value": 2}
    comment = (RULES_PREFIX if prefix else "") + "test rules"
    registers = ships if registers is None else registers
    lines = [f"puzzle.addConstraintComponent(new {n}('a'))" for n in registers]
    if note:
        lines.insert(0, f"// {note}")
    backend = "\n".join(lines)
    constraint = {
        "name": "Widget Lines",
        "type": 1000,
        "definition": {
            "name": "Widget Lines",
            "backend": {"type": "code", "code": backend},
            "components": [{"type": "code", "name": n, "code": "x"} for n in ships],
        },
    }
    doc = {
        "puzzle": {
            "width": 3,
            "height": 3,
            "cells": cells,
            "comment": comment,
            "constraints": [constraint],
        }
    }
    return encode_link(doc)


REQUIRED = [
    "README.md",
    "main.js",
    "main-global.js",
    "FooComponent.js",
    "build_link.py",
    "build_link.test.py",
    "soundness-harness.mjs",
    "update-strength.test.mjs",
    "OPTIMIZATION_LOG.md",
    "PUZZLE_LINK.txt",
    "gen.json",
    "PUZZLE_LINK_local.txt",
    "gen_local.json",
]


@contextlib.contextmanager
def example(
    files=REQUIRED, extra_links=(), extra_gens=(), name="widget", contents=None
):
    """A temp examples/-shaped tree with one example dir, `name`.

    Yields (root, example_dir). `files` are the example's own files;
    `extra_links` are extra PUZZLE_LINK*.txt names to add on top, `extra_gens`
    extra gen*.json names (for a test that must keep every generated link
    paired). `contents` overrides one file's text (default "x") -- used by
    the lane tests to put a real marker in main.js or main-global.js.
    """
    contents = contents or {}
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        d = root / name
        d.mkdir()
        for f in files:
            default = _link() if f.startswith("PUZZLE_LINK") else "x"
            (d / f).write_text(contents.get(f, default))
        for link in extra_links:
            (d / link).write_text(contents.get(link, _link()))
        for gen in extra_gens:
            (d / gen).write_text(contents.get(gen, "x"))
        yield root, d


if __name__ == "__main__":
    # a complete example passes
    with example() as (root, _):
        violations = check_tree(root)
        assert violations == [], f"complete example reported violations: {violations}"

    # a missing required file fails and names it
    missing = [f for f in REQUIRED if f != "OPTIMIZATION_LOG.md"]
    with example(files=missing) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "widget" in violations[0]
        assert "OPTIMIZATION_LOG.md" in violations[0]

    # at least one *Component.js required — none present fails
    missing = [f for f in REQUIRED if f != "FooComponent.js"]
    with example(files=missing) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "*Component.js" in violations[0]

    # missing main-global.js fails and names it
    missing = [f for f in REQUIRED if f != "main-global.js"]
    with example(files=missing) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "widget" in violations[0]
        assert "main-global.js" in violations[0]

    # a no-local-global-split example (isofill) needs no main-global.js
    with example(files=missing, name="isofill") as (root, _):
        violations = check_tree(root)
        assert violations == [], violations

    # a split example ships a local board: both halves of the pair are
    # required, and each is named on its own (#268). Dropping one half also
    # leaves the other unpaired (#294), so two violations fire, not one --
    # the missing-required-file one, and the pairing one for the survivor.
    missing_local_cases = {
        "PUZZLE_LINK_local.txt": "gen_local.json has no matching PUZZLE_LINK_local.txt",
        "gen_local.json": "PUZZLE_LINK_local.txt has no matching gen_local.json",
    }
    for local_file, pairing_text in missing_local_cases.items():
        missing = [f for f in REQUIRED if f != local_file]
        with example(files=missing) as (root, _):
            violations = check_tree(root)
            assert len(violations) == 2, violations
            assert any(
                "widget" in v and f"missing required file {local_file}" in v
                for v in violations
            ), violations
            assert any("widget" in v and pairing_text in v for v in violations), (
                violations
            )

    # the no-local-global-split example needs neither half of the local pair,
    # and ships neither in reality -- dropping both leaves nothing unpaired
    iso_missing = [
        f for f in REQUIRED if f not in ("PUZZLE_LINK_local.txt", "gen_local.json")
    ]
    with example(files=iso_missing, name="isofill") as (root, _):
        violations = check_tree(root)
        assert violations == [], violations

    # a gen*.json with no matching link is unpaired: the naming-follows-the-
    # rename bug this check exists to catch (#294)
    with example(extra_gens=["gen_9x9.json"]) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "gen_9x9.json" in violations[0], violations
        assert "PUZZLE_LINK_9x9.txt" in violations[0], violations

    # the reverse: a well-named, generated-style link with no gen*.json is
    # unpaired too
    with example(extra_links=["PUZZLE_LINK_6x6.txt"]) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "PUZZLE_LINK_6x6.txt" in violations[0], violations
        assert "gen_6x6.json" in violations[0], violations

    # a clued/original twin is hand-derived, straight from another committed
    # link (build_clued.py/build_original.py) -- it needs no gen JSON of its
    # own, chained tags included
    for twin in ("PUZZLE_LINK_original.txt", "PUZZLE_LINK_clued_original.txt"):
        with example(extra_links=[twin]) as (root, _):
            violations = check_tree(root)
            assert violations == [], violations

    # numbered-rooms/PUZZLE_LINK.txt is hand-made with no generator at all
    # (its own README, "Not covered") -- the one named exception
    missing = [f for f in REQUIRED if f != "gen.json"]
    with example(files=missing, name="numbered-rooms") as (root, _):
        violations = check_tree(root)
        assert violations == [], violations

    # any other example's plain PUZZLE_LINK.txt still needs its gen.json
    with example(files=missing) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "widget" in violations[0], violations
        assert "gen.json" in violations[0], violations

    # numbered-rooms-lines was folded into numbered-rooms (#238): the
    # directory must not come back, complete file set or not
    with example(name="numbered-rooms-lines") as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "numbered-rooms-lines" in violations[0], violations
        assert "numbered-rooms" in violations[0], violations

    # main.js building frame lines (reading the board via getCellAt) is a
    # lane violation -- frame building belongs to main-global.js only
    with example(contents={"main.js": "puzzle.getCellAt(0, 0)"}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "main.js" in violations[0] and "frame" in violations[0]

    # main-global.js reading input.groups is a lane violation -- the drawn
    # groups belong to main.js only
    with example(contents={"main-global.js": "input.groups.map(g => g)"}) as (
        root,
        _,
    ):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "main-global.js" in violations[0] and "input.groups" in violations[0]

    # a hyphenated, seed-bearing, non-square-size, unknown-tag, or
    # wrong-order-tag link name each fails, naming the bad file
    bad_names = [
        "PUZZLE_LINK-30.txt",
        "PUZZLE_LINK_seed104.txt",
        "PUZZLE_LINK_6x7.txt",
        "PUZZLE_LINK_timing.txt",
        "PUZZLE_LINK_original_clued.txt",
        "PUZZLE_LINK_global_local.txt",
        # the `global` tag is gone: PUZZLE_LINK.txt is the global-lane board
        # in every split example, so a _global link has nothing left to name
        # (#268)
        "PUZZLE_LINK_global.txt",
        "PUZZLE_LINK_6x6_global.txt",
    ]
    for bad_name in bad_names:
        with example(extra_links=[bad_name]) as (root, _):
            violations = check_tree(root)
            assert len(violations) == 1, (bad_name, violations)
            assert bad_name in violations[0], (bad_name, violations)

    # valid size, givens-count, and tag variants pass, including chained
    # tags in fixed order and a givens count ahead of a tag
    good_names = [
        "PUZZLE_LINK_6x6.txt",
        "PUZZLE_LINK_6x6_original.txt",
        "PUZZLE_LINK_clued.txt",
        "PUZZLE_LINK_silent.txt",
        "PUZZLE_LINK_local.txt",
        "PUZZLE_LINK_6x6_local.txt",
        "PUZZLE_LINK_30g.txt",
        "PUZZLE_LINK_35g_silent.txt",
        "PUZZLE_LINK_clued_original.txt",
    ]
    # each non-hand-derived name above needs its own gen*.json to stay paired
    # (#294); the clued/original/local ones either are hand-derived twins or
    # already have theirs from REQUIRED
    good_gens = [
        "gen_6x6.json",
        "gen_silent.json",
        "gen_6x6_local.json",
        "gen_30g.json",
        "gen_35g_silent.json",
    ]
    with example(extra_links=good_names, extra_gens=good_gens) as (root, _):
        violations = check_tree(root)
        assert violations == [], violations

    # a well-named link with an entered value on a non-given cell fails --
    # the link does not open clean (docs/share-checklist.md)
    with example(contents={"PUZZLE_LINK.txt": _link(entered=True)}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "PUZZLE_LINK.txt" in violations[0]
        assert "entered value" in violations[0]

    # a _clued link is exempt from the entered-value check -- it fills the
    # outside-clue ring on purpose
    with example(
        extra_links=["PUZZLE_LINK_clued.txt"],
        contents={"PUZZLE_LINK_clued.txt": _link(entered=True)},
    ) as (root, _):
        violations = check_tree(root)
        assert violations == [], violations

    # a link whose comment is missing the rules prefix fails
    with example(contents={"PUZZLE_LINK.txt": _link(prefix=False)}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "PUZZLE_LINK.txt" in violations[0]
        assert "rules prefix" in violations[0]

    # isofill is exempt from the rules-prefix check -- it is not sudoku, and
    # its rules text must not mention sudoku (#271)
    missing = [f for f in REQUIRED if f != "main-global.js"]
    with example(
        files=missing,
        name="isofill",
        contents={"PUZZLE_LINK.txt": _link(prefix=False)},
    ) as (root, _):
        violations = check_tree(root)
        assert violations == [], violations

    # a link shipping a component its backend never registers fails: dead
    # weight the recipient reads as part of the rule (#291)
    stale = _link(ships=("FooComponent", "BarComponent"), registers=("FooComponent",))
    with example(contents={"PUZZLE_LINK.txt": stale}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "PUZZLE_LINK.txt" in violations[0]
        assert "BarComponent" in violations[0]

    # the other direction fails too: a backend registering a component the
    # link left out throws inside the app, where the author never sees it
    short = _link(ships=("FooComponent",), registers=("FooComponent", "BarComponent"))
    with example(contents={"PUZZLE_LINK.txt": short}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "PUZZLE_LINK.txt" in violations[0]
        assert "BarComponent" in violations[0]

    # a comment naming a component is not a registration -- minify keeps
    # `//!` notes in the shipped backend, and one of those must not read as
    # a `new BarComponent` the link is missing
    commented = _link(
        ships=("FooComponent",), note="a paired end gets a new BarComponent"
    )
    with example(contents={"PUZZLE_LINK.txt": commented}) as (root, _):
        violations = check_tree(root)
        assert violations == [], violations

    # a link file that fails to decode is reported, not a crash
    with example(contents={"PUZZLE_LINK.txt": "not a real link"}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "PUZZLE_LINK.txt" in violations[0]
        assert "failed to decode" in violations[0]

    # _shared is skipped even though it has none of the required files
    with example() as (root, _):
        (root / "_shared").mkdir()
        (root / "_shared" / "helper.py").write_text("x")
        violations = check_tree(root)
        assert violations == [], violations

    # a nonexistent root produces one violation, not a crash
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp) / "does_not_exist"
        violations = check_tree(root)
        assert len(violations) == 1, violations

    # run as a script: exit code and stdout are the enforced seam
    with example(files=[f for f in REQUIRED if f != "OPTIMIZATION_LOG.md"]) as (
        root,
        _,
    ):
        result = subprocess.run(
            [sys.executable, str(HERE / "check_layout.py"), str(root)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 1, result
        assert "OPTIMIZATION_LOG.md" in result.stdout, result.stdout
        assert "FAILED" in result.stdout, result.stdout

    with example() as (root, _):
        result = subprocess.run(
            [sys.executable, str(HERE / "check_layout.py"), str(root)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result
        assert "ok" in result.stdout, result.stdout

    print("ok")
