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


def _link(entered=False, prefix=True):
    """A minimal encoded puzzle link: one given cell, the rest empty.

    `entered` puts a value on a non-given cell (the link does not open
    clean); `prefix` controls whether the comment carries RULES_PREFIX (the
    rules-prefix check fails when False).
    """
    cells = [{"given": True, "value": 1}] + [{} for _ in range(8)]
    if entered:
        cells[1] = {"value": 2}
    comment = (RULES_PREFIX if prefix else "") + "test rules"
    doc = {"puzzle": {"width": 3, "height": 3, "cells": cells, "comment": comment}}
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
    "PUZZLE_LINK_local.txt",
    "gen_local.json",
]


@contextlib.contextmanager
def example(files=REQUIRED, extra_links=(), name="widget", contents=None):
    """A temp examples/-shaped tree with one example dir, `name`.

    Yields (root, example_dir). `files` are the example's own files;
    `extra_links` are extra PUZZLE_LINK*.txt names to add on top. `contents`
    overrides one file's text (default "x") -- used by the lane tests to put
    a real marker in main.js or main-global.js.
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
    # required, and each is named on its own (#268)
    for local_file in ("PUZZLE_LINK_local.txt", "gen_local.json"):
        missing = [f for f in REQUIRED if f != local_file]
        with example(files=missing) as (root, _):
            violations = check_tree(root)
            assert len(violations) == 1, violations
            assert "widget" in violations[0]
            assert local_file in violations[0]

        # the no-local-global-split example needs neither
        with example(files=missing, name="isofill") as (root, _):
            violations = check_tree(root)
            assert violations == [], violations

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
    with example(extra_links=good_names) as (root, _):
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

    # isofill is NOT exempt from the rules-prefix check -- its own
    # build_link.py already puts RULES_PREFIX in the rule text, so a missing
    # prefix there is a real regression, not an expected shape
    missing = [f for f in REQUIRED if f != "main-global.js"]
    with example(
        files=missing,
        name="isofill",
        contents={"PUZZLE_LINK.txt": _link(prefix=False)},
    ) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "rules prefix" in violations[0]

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
