# check_layout walks an examples/-shaped directory and verifies every
# example (any dir other than _shared) has the required file set, that
# every PUZZLE_LINK*.txt name matches the link grammar, and that every link
# decodes clean (docs/share-checklist.md). These fixtures build small temp
# trees rather than reuse the real examples/, so a case (a missing file, a
# bad link name, a dirty link) is exact and does not drift with the repo.
#
#   uv run examples/_shared/check_layout.test.py

import ast
import contextlib
import json
import pathlib
import subprocess
import sys
import tempfile
import tomllib

import check_layout
import document
import link_checks
from check_layout import (
    check_gen_frame_backends,
    check_gen_json_parses,
    check_tree,
)
from document import (
    FRAME_CORNERS,
    FRAME_ROWCOL,
    GRID_ROWCOL,
    NO_RING_RULES_PREFIX,
    RULES_PREFIX,
    SHARED_BACKENDS,
)
from link_checks import (
    CommittedLink,
    HouseSource,
    LinkFacts,
    LinkKind,
    check_digit_range,
    check_stale_backend_code,
)
from manifest import Manifest, load_manifest
from minify import minify_file
from sm_document import code_constraint
from sudoku_kit.link_codec import decode_puzzle, encode_link

HERE = pathlib.Path(__file__).parent
LOCAL_FILES = ("PUZZLE_LINK_local.txt", "gen_local.json")


def _link(
    entered=False,
    prefix=True,
    ships=("FooComponent",),
    registers=None,
    note=None,
    full_ring=False,
    houses="full",
    frame_backend=False,
    corners_backend=False,
    house_gac_backend=False,
    house_gac_renamed=False,
    digits=(1, 3),
    no_ring=None,
    grid_backend=None,
    ringless=False,
    borrowed_rowcol=None,
    annotated_copy=False,
    sudoku_rules=False,
):
    """A minimal encoded puzzle link: one given cell, the rest empty, and one
    custom constraint whose backend registers the components it ships.

    `entered` puts a value on a non-given cell (the link does not open
    clean); `full_ring` makes every cell a given, which on this 3x3 board
    fills the whole outside ring while leaving nothing entered, so the ring
    check is exercised on its own. `prefix` controls whether the comment
    carries RULES_PREFIX (the rules-prefix check fails when False). `ships`
    names the components the
    constraint carries and `registers` (default: the same names) the ones its
    backend instantiates, so a case can make the two sets disagree. `note`
    prepends a comment line to the backend, which must not read as a
    registration.

    `houses` shapes the board's house constraints on this 3x3: "full" (the
    default) is a real board -- three regions, one per row, plus a column cage
    each; "boxes" drops the column cages, the shape that cost three tickets of
    quad-rank work; "none" drops both. `frame_backend` adds a constraint
    carrying the shared frame row/column backend, which declares the interior
    lines in JS instead of in the document, and `corners_backend` the corner-pin
    one; either takes "stale" to embed an older copy. `house_gac_backend` adds
    the shared house-GAC filter constraint the same way, with its
    HouseGacComponent.js as the one component it ships; "stale" stales
    the backend, "stale_component" stales the component instead, and
    "no_component" ships the backend with no component at all.
    `house_gac_renamed` builds house-gac's own standalone shape instead: the
    filter spliced under a backend that is legitimately not house-gac.js (so
    its own staleness check does not apply) and a constraint name other than
    "House GAC" (examples/house-gac/build_link.py renames it to avoid the
    reserved title); "stale_component" stales the shared component the
    same way `house_gac_backend` does. `digits` is the
    document's declared range -- None leaves it off, which leaves the range
    to the app default (1..9) instead of the document.

    `no_ring` builds a no-ring board instead: its comment is `no_ring` (the
    whole text) rather than RULES_PREFIX, and it carries the shared whole-grid
    rows-and-columns backend. `grid_backend` overrides that backend alone --
    False drops it, "stale" embeds an older copy. `ringless` opens the comment on
    NO_RING_RULES_PREFIX, as a plain 9x9 board with no ring does
    (house-gac; `house_gac_renamed` implies it). `borrowed_rowcol` adds a
    constraint of that name with no components, the shape of a borrowed
    rows-and-columns backend (house-gac's "Rows & Columns"); `house_gac_renamed`
    values are above. `annotated_copy` embeds every shared backend and component
    the link carries, and the standalone component, through the
    comment-keeping minify mode, as an `_annotated` link does; a "stale" one is
    then stale against that build. `sudoku_rules` adds the bare type-2003
    constraint (`SudokuRules`), which the app expands into every row and
    column of the grid.
    """
    if grid_backend is None:
        grid_backend = no_ring is not None
    cells = [{"given": True, "value": 1}] + [{} for _ in range(8)]
    if full_ring:
        cells = [{"given": True, "value": 1} for _ in range(9)]
    if entered:
        cells[1] = {"value": 2}
    sentence = NO_RING_RULES_PREFIX if ringless or house_gac_renamed else RULES_PREFIX
    comment = (sentence if prefix else "") + "test rules"
    if no_ring is not None:
        comment = no_ring
    registers = ships if registers is None else registers
    lines = [f"puzzle.addConstraintComponent(new {n}('a'))" for n in registers]
    if note:
        lines.insert(0, f"// {note}")
    backend = "\n".join(lines)
    constraint = code_constraint(
        "Widget Lines", backend, [(n, "x") for n in ships], named=True
    )
    house_constraints = []
    if houses in ("full", "boxes"):
        house_constraints.append({"type": 1, "regions": [0, 0, 0, 1, 1, 1, 2, 2, 2]})
    if houses == "full":
        house_constraints.append(
            {
                "name": "Columns",
                "type": 301,
                "cages": [{"cells": [c, c + 3, c + 6], "value": 0} for c in range(3)],
            }
        )
    if sudoku_rules:
        house_constraints.append({"type": 2003})
    extra = []
    for wanted, source, title, component in (
        (frame_backend, "frame-rowcol.js", "Frame Rows and Columns", None),
        (corners_backend, "frame-corners.js", "Frame Corners", None),
        (house_gac_backend, "house-gac.js", "House GAC", "HouseGacComponent"),
        (grid_backend, "grid-rowcol.js", "Grid Rows and Columns", None),
    ):
        if not wanted:
            continue
        code = minify_file(HERE / source, keep_comments=annotated_copy)
        if wanted == "stale":
            code = code + "\n// an older copy"
        components = (
            [
                (
                    component,
                    minify_file(HERE / f"{component}.js", keep_comments=annotated_copy)
                    + ("\n// an older copy" if wanted == "stale_component" else ""),
                )
            ]
            if component and wanted != "no_component"
            else []
        )
        extra.append(code_constraint(title, code, components))
    if house_gac_renamed:
        # A backend of its own (never house-gac.js -- that is the point of
        # the rename), carrying only the shared HouseGacComponent.js.
        comp_code = minify_file(
            HERE / "HouseGacComponent.js",
            keep_comments=annotated_copy,
        )
        if house_gac_renamed == "stale_component":
            comp_code += "\n// an older copy"
        extra.append(
            code_constraint(
                "House GAC (standalone)",
                "puzzle.addConstraintComponent(new HouseGacComponent('a'))",
                [("HouseGacComponent", comp_code)],
            )
        )
    if borrowed_rowcol:
        extra.append(code_constraint(borrowed_rowcol, "// borrowed backend", []))
    puzzle = {
        "width": 3,
        "height": 3,
        "cells": cells,
        "comment": comment,
        "constraints": [*house_constraints, constraint, *extra],
    }
    if digits is not None:
        puzzle["minDigit"], puzzle["maxDigit"] = digits
    return encode_link({"puzzle": puzzle})


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


# example.toml traits, spelled as the manifest keys. A whole-grid example is
# not sudoku and has no houses; a ringless one opens on the plain sentence; the
# shared-component one borrows a component from `_shared/` and a rows-and-
# columns backend of its own, with a hand-made link.
WHOLE_GRID = {"lanes": "single", "rules_prefix": "none", "houses": False}
SINGLE_LANE = {"lanes": "single"}
# A single-lane example's files: main.js alone, no main-global.js and no
# local board pair.
SINGLE_LANE_FILES = [
    f
    for f in REQUIRED
    if f not in ("main-global.js", "PUZZLE_LINK_local.txt", "gen_local.json")
]
HAND_MADE = {"generator_less_links": ["PUZZLE_LINK.txt"]}
SHARED_GAC = {
    "lanes": "single",
    "rules_prefix": "ringless",
    "shared_component": "HouseGacComponent",
    "generator_less_links": ["PUZZLE_LINK.txt"],
    "rowcol_backend": "Rows & Columns",
}


def manifest_text(traits):
    """example.toml text for `traits` (manifest keys), timed_component filled
    in -- every manifest needs one."""
    lines = ['timed_component = "WidgetComponent"']
    lines += [f"{key} = {json.dumps(value)}" for key, value in traits.items()]
    return "\n".join(lines) + "\n"


@contextlib.contextmanager
def example(
    files=None,
    extra_links=(),
    extra_gens=(),
    name="widget",
    contents=None,
    manifest=None,
):
    """A temp examples/-shaped tree with one example dir, `name`.

    Yields (root, example_dir). `files` are the example's own files;
    `extra_links` are extra PUZZLE_LINK*.txt names to add on top, `extra_gens`
    extra gen*.json names (for a test that must keep every generated link
    paired). `contents` overrides one file's text (default "x"; a gen*.json defaults to "{}") -- used by
    the lane tests to put a real marker in main.js or main-global.js.
    `manifest` is the example.toml traits (see manifest_text); None writes the
    defaults, and a `contents` entry for "example.toml" replaces the text.
    """
    contents = contents or {}
    if files is None:
        # The default file set is a split example's; a single- or global-lane
        # manifest drops the files its lane does not carry.
        lane = (manifest or {}).get("lanes", "split")
        strays = {
            "single": {"main-global.js", *LOCAL_FILES},
            "global": set(LOCAL_FILES),
        }.get(lane, set())
        files = [f for f in REQUIRED if f not in strays]
    # A ringless board's links open on the plain sentence, not the inner-grid
    # one.
    traits = manifest or {}
    default_link = _link(ringless=traits.get("rules_prefix") == "ringless")
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        d = root / name
        d.mkdir()
        (d / "example.toml").write_text(
            contents.get("example.toml", manifest_text(traits))
        )
        for f in files:
            default = "x"
            if f.startswith("PUZZLE_LINK"):
                default = default_link
            elif f.startswith("gen") and f.endswith(".json"):
                default = "{}"
            (d / f).write_text(contents.get(f, default))
        for link in extra_links:
            (d / link).write_text(contents.get(link, default_link))
        for gen in extra_gens:
            (d / gen).write_text(contents.get(gen, "{}"))
        yield root, d


GLOBAL_ONLY = [
    f
    for f in REQUIRED
    if f not in ("main.js", "PUZZLE_LINK_local.txt", "gen_local.json")
]

# A hand-made `_annotated` link of the shared-gac example, and the manifests
# that read it with and without the comment-keeping carve-out.
ANNOTATED_HANDMADE = {
    **SHARED_GAC,
    "generator_less_links": ["PUZZLE_LINK.txt", "PUZZLE_LINK_annotated.txt"],
}
ANNOTATED_KEEPS = {**ANNOTATED_HANDMADE, "annotated_keeps_comments": True}
ANNOTATED_LINK = {
    "PUZZLE_LINK_annotated.txt": _link(house_gac_renamed=True, annotated_copy=True)
}
PLAIN_AND_ANNOTATED = {
    "PUZZLE_LINK.txt": _link(house_gac_renamed=True),
    **ANNOTATED_LINK,
}
FIXTURE = "timing-fixture-9x9-cap9-seed3-rung25.txt"
EXAMPLE_NAMES = {
    d.name for d in HERE.parent.iterdir() if d.is_dir() and d.name != "_shared"
}


def annotated_violations(traits, contents):
    with example(
        name="shared-gac",
        manifest=traits,
        extra_links=["PUZZLE_LINK_annotated.txt"],
        contents=contents,
    ) as (root, _):
        (root / "_shared").mkdir()
        (root / "_shared" / "HouseGacComponent.js").write_text("x")
        return check_tree(root)


def _gen(code, name="Frame Rows and Columns"):
    return json.dumps({"puzzle": {"constraints": [code_constraint(name, code)]}})


def _facts_doc(*constraints, **top):
    return {
        "width": 3,
        "height": 3,
        "cells": [{} for _ in range(9)],
        "constraints": list(constraints),
        **top,
    }


def _named(title, **extra):
    return {"definition": {"name": title}, **extra}


def _example_names_in(source):
    return sorted(
        {
            node.value
            for node in ast.walk(ast.parse(source))
            if isinstance(node, ast.Constant) and node.value in EXAMPLE_NAMES
        }
    )


def test_a_complete_example_passes():
    # a complete example passes
    with example() as (root, _):
        violations = check_tree(root)
        assert violations == [], f"complete example reported violations: {violations}"


def test_a_missing_required_file_is_named():
    # a missing required file fails and names it
    missing = [f for f in REQUIRED if f != "OPTIMIZATION_LOG.md"]
    with example(files=missing) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "widget" in violations[0]
        assert "OPTIMIZATION_LOG.md" in violations[0]


def test_a_missing_component_file_fails():
    # at least one *Component.js required — none present fails
    missing = [f for f in REQUIRED if f != "FooComponent.js"]
    with example(files=missing) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "*Component.js" in violations[0]


def test_a_missing_main_global_js_is_named():
    # missing main-global.js fails and names it
    missing = [f for f in REQUIRED if f != "main-global.js"]
    with example(files=missing) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "widget" in violations[0]
        assert "main-global.js" in violations[0]


def test_a_single_lane_example_needs_no_main_global_js_or_local_board():
    # a `lanes = "single"` example needs no main-global.js and no local board
    with example(files=SINGLE_LANE_FILES, name="whole-grid", manifest=WHOLE_GRID) as (
        root,
        _,
    ):
        violations = check_tree(root)
        assert violations == [], violations


def test_a_global_lane_example_ships_main_global_js_alone():
    # a `lanes = "global"` example ships main-global.js alone: no main.js
    # and no local board, and dropping main-global.js names it
    with example(files=GLOBAL_ONLY, manifest={"lanes": "global"}) as (root, _):
        violations = check_tree(root)
        assert violations == [], violations
    no_backend = [f for f in GLOBAL_ONLY if f != "main-global.js"]
    with example(files=no_backend, manifest={"lanes": "global"}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "missing required file main-global.js" in violations[0]


def test_a_single_lane_example_names_a_stray_lane_file():
    # a `lanes = "single"` example ships main.js alone: a main-global.js, or
    # the local board pair, is a stray lane file and is named
    with example(files=SINGLE_LANE_FILES, manifest=SINGLE_LANE) as (root, _):
        assert check_tree(root) == []
    with example(
        files=[*SINGLE_LANE_FILES, "main-global.js"], manifest=SINGLE_LANE
    ) as (
        root,
        _,
    ):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "single-lane" in violations[0] and "main-global.js" in violations[0]
    with example(
        files=[*SINGLE_LANE_FILES, "PUZZLE_LINK_local.txt", "gen_local.json"],
        manifest=SINGLE_LANE,
    ) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 2, violations
        for stray in ("PUZZLE_LINK_local.txt", "gen_local.json"):
            assert any("single-lane" in v and stray in v for v in violations), (
                violations
            )


def test_a_global_lane_example_carries_neither_local_file():
    # a `lanes = "global"` example carries neither local file either
    with example(
        files=[*GLOBAL_ONLY, "PUZZLE_LINK_local.txt", "gen_local.json"],
        manifest={"lanes": "global"},
    ) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 2, violations
        for stray in ("PUZZLE_LINK_local.txt", "gen_local.json"):
            assert any("global-lane" in v and stray in v for v in violations), (
                violations
            )


def test_a_split_example_requires_both_halves_of_the_local_board():
    # a split example ships a local board: both halves of the pair are
    # required, and each is named on its own. Dropping one half also
    # leaves the other unpaired, so two violations fire, not one --
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


def test_a_gen_json_with_no_matching_link_is_unpaired():
    # a gen*.json with no matching link is unpaired: the naming-follows-the-
    # rename bug this check exists to catch
    with example(extra_gens=["gen_9x9.json"]) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "gen_9x9.json" in violations[0], violations
        assert "PUZZLE_LINK_9x9.txt" in violations[0], violations


def test_a_generated_link_with_no_gen_json_is_unpaired():
    # the reverse: a well-named, generated-style link with no gen*.json is
    # unpaired too
    with example(extra_links=["PUZZLE_LINK_6x6.txt"]) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "PUZZLE_LINK_6x6.txt" in violations[0], violations
        assert "gen_6x6.json" in violations[0], violations


def test_a_clued_or_original_twin_needs_no_gen_json():
    # a clued/original twin is hand-derived, straight from another committed
    # link (build_clued.py/build_original.py) -- it needs no gen JSON of its
    # own, chained tags included
    for twin in ("PUZZLE_LINK_original.txt", "PUZZLE_LINK_clued_original.txt"):
        with example(extra_links=[twin]) as (root, _):
            violations = check_tree(root)
            assert violations == [], violations


def test_a_hand_made_link_named_in_the_manifest_needs_no_gen_json():
    # a hand-made PUZZLE_LINK.txt with no generator at all is named in its
    # manifest's generator_less_links -- the one exception
    missing = [f for f in REQUIRED if f != "gen.json"]
    with example(files=missing, name="hand-made", manifest=HAND_MADE) as (root, _):
        violations = check_tree(root)
        assert violations == [], violations


def test_any_other_plain_link_still_needs_its_gen_json():
    # any other example's plain PUZZLE_LINK.txt still needs its gen.json
    missing = [f for f in REQUIRED if f != "gen.json"]
    with example(files=missing) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "widget" in violations[0], violations
        assert "gen.json" in violations[0], violations


def test_a_retired_example_directory_may_not_come_back():
    # numbered-rooms-lines was folded into numbered-rooms (retired-examples.toml):
    # the directory must not come back, complete file set or not
    with example(name="numbered-rooms-lines") as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "numbered-rooms-lines" in violations[0], violations
        assert "numbered-rooms" in violations[0], violations


def test_main_js_building_frame_lines_is_a_lane_violation():
    # main.js building frame lines (reading the board via getCellAt) is a
    # lane violation -- frame building belongs to main-global.js only
    with example(contents={"main.js": "puzzle.getCellAt(0, 0)"}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "main.js" in violations[0] and "frame" in violations[0]


def test_the_lane_guards_read_the_assembled_source():
    # the lane guards read the ASSEMBLED, minified source: a main.js whose
    # body arrives through an `// #include` is still the local lane, so the
    # getCellAt in the included file is the one that counts
    with example(contents={"main.js": "// #include seg.js\n"}) as (root, d):
        (d / "seg.js").write_text("puzzle.getCellAt(0, 0)\n")
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "main.js" in violations[0] and "frame" in violations[0]


def test_naming_the_other_lane_in_a_comment_is_not_a_violation():
    # ...and comments are gone by then, so merely NAMING the other lane in
    # prose is not a violation
    with example(
        contents={"main-global.js": "// never reads input.groups\nconst x = 1\n"}
    ) as (root, _):
        assert check_tree(root) == [], check_tree(root)


def test_a_main_js_that_does_not_minify_is_a_violation():
    # a main.js that does not minify (here, an #include resolving to nothing)
    # is a violation naming the example, not an AssertionError out of the walk
    # that would leave every later example unchecked
    with example(contents={"main.js": "// #include missing.js\n"}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "widget: main.js does not minify" in violations[0], violations[0]
        assert "missing.js" in violations[0], violations[0]


def test_main_global_js_reading_input_groups_is_a_lane_violation():
    # main-global.js reading input.groups is a lane violation -- the drawn
    # groups belong to main.js only
    with example(contents={"main-global.js": "input.groups.map(g => g)"}) as (
        root,
        _,
    ):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "main-global.js" in violations[0] and "input.groups" in violations[0]


def test_a_bad_link_name_fails_naming_the_file():
    # a hyphenated, seed-bearing, non-square-size, unknown-tag, or
    # wrong-order-tag link name each fails, naming the bad file
    bad_names = [
        "PUZZLE_LINK-30.txt",
        "PUZZLE_LINK_seed104.txt",
        "PUZZLE_LINK_6x7.txt",
        "PUZZLE_LINK_timing.txt",
        "PUZZLE_LINK_original_clued.txt",
        "PUZZLE_LINK_global_local.txt",
        # there is no `global` tag: PUZZLE_LINK.txt is the global-lane board
        # in every split example, so a _global link has nothing left to name
        "PUZZLE_LINK_global.txt",
        "PUZZLE_LINK_6x6_global.txt",
    ]
    for bad_name in bad_names:
        with example(extra_links=[bad_name]) as (root, _):
            violations = check_tree(root)
            assert len(violations) == 1, (bad_name, violations)
            assert bad_name in violations[0], (bad_name, violations)


def test_valid_link_name_variants_pass():
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
    # the clued/original/local ones either are hand-derived twins or
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


def test_an_entered_value_on_a_non_given_cell_fails():
    # a well-named link with an entered value on a non-given cell fails --
    # the link does not open clean (docs/share-checklist.md)
    with example(contents={"PUZZLE_LINK.txt": _link(entered=True)}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "PUZZLE_LINK.txt" in violations[0]
        assert "entered value" in violations[0]


def test_a_clued_link_is_exempt_from_the_entered_value_check():
    # a _clued link is exempt from the entered-value check -- it fills the
    # outside-clue ring on purpose
    with example(
        extra_links=["PUZZLE_LINK_clued.txt"],
        contents={"PUZZLE_LINK_clued.txt": _link(entered=True)},
    ) as (root, _):
        violations = check_tree(root)
        assert violations == [], violations


def test_a_link_that_fills_every_ring_cell_fails():
    # a link that fills every ring cell fails -- it hands the solver every
    # outside clue (docs/share-checklist.md, criterion 3)
    with example(contents={"PUZZLE_LINK.txt": _link(full_ring=True)}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "PUZZLE_LINK.txt" in violations[0]
        assert "ring cells" in violations[0]


def test_a_clued_link_is_exempt_from_the_ring_check():
    # a _clued link is exempt from the ring check too -- filling every clue is
    # what that name means
    with example(
        extra_links=["PUZZLE_LINK_clued.txt"],
        contents={"PUZZLE_LINK_clued.txt": _link(full_ring=True)},
    ) as (root, _):
        violations = check_tree(root)
        assert violations == [], violations


def test_a_comment_missing_the_rules_prefix_fails():
    # a link whose comment is missing the rules prefix fails
    with example(contents={"PUZZLE_LINK.txt": _link(prefix=False)}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "PUZZLE_LINK.txt" in violations[0]
        assert "rules prefix" in violations[0]


def test_rules_prefix_none_exempts_the_rules_prefix_check():
    # `rules_prefix = "none"` exempts the rules-prefix check -- the example is
    # not sudoku, and its rules text must not mention sudoku
    with example(
        files=SINGLE_LANE_FILES,
        name="whole-grid",
        manifest=WHOLE_GRID,
        contents={"PUZZLE_LINK.txt": _link(prefix=False)},
    ) as (root, _):
        violations = check_tree(root)
        assert violations == [], violations


def test_boxes_without_column_houses_fail():
    # a link with boxes but no column houses fails: a region constraint gives
    # boxes only, and the app solves the under-constrained board without a
    # word
    with example(contents={"PUZZLE_LINK.txt": _link(houses="boxes")}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "PUZZLE_LINK.txt" in violations[0]
        assert "3 interior column(s)" in violations[0], violations[0]


def test_a_link_with_no_houses_fails_on_rows_and_columns():
    # a link with no houses at all fails on both rows and columns
    with example(contents={"PUZZLE_LINK.txt": _link(houses="none")}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 2, violations
        assert any("interior row(s)" in v for v in violations), violations
        assert any("interior column(s)" in v for v in violations), violations


def test_a_whole_grid_example_declares_no_houses():
    # isofill and fillomino are exempt: whole-grid constraints on a bare
    # board, with no row, column or box rule to declare
    with example(
        files=SINGLE_LANE_FILES,
        name="whole-grid",
        manifest=WHOLE_GRID,
        contents={"PUZZLE_LINK.txt": _link(prefix=False, houses="none")},
    ) as (root, _):
        violations = check_tree(root)
        assert violations == [], violations


def test_a_single_lane_example_ships_main_js_alone():
    # a no-ring example with a local lane only ships main.js and
    # PUZZLE_LINK.txt with no global lane and no _local pair
    with example(files=SINGLE_LANE_FILES, name="single-lane", manifest=SINGLE_LANE) as (
        root,
        _,
    ):
        violations = check_tree(root)
        assert violations == [], violations


def test_a_no_ring_board_carries_the_grid_rows_and_columns_backend():
    # A no-ring board carries the whole-grid rows-and-columns backend: its
    # rows and columns are declared in JS, so a link whose document holds only
    # boxes is not missing a house, and every edge cell is a real cell, so a
    # board given along its whole edge is not a filled clue ring. Its rules
    # text opens on the plain sentence -- there is no inner grid to name.
    no_ring = _link(
        houses="boxes", full_ring=True, no_ring="Normal sudoku rules apply. Up to N."
    )
    with example(contents={"PUZZLE_LINK.txt": no_ring}) as (root, _):
        violations = check_tree(root)
        assert violations == [], violations


def test_a_no_ring_comment_owes_the_plain_sentence():
    # ...but it still owes the sentence: a no-ring comment without it fails,
    # and so does one naming an inner grid the board does not have
    for comment in ("Up to N.", RULES_PREFIX + "Up to N."):
        with example(
            contents={"PUZZLE_LINK.txt": _link(houses="boxes", no_ring=comment)}
        ) as (root, _):
            violations = check_tree(root)
            assert len(violations) == 1, violations
            assert "rules prefix" in violations[0], violations


def test_a_ringless_manifest_opens_on_the_plain_sentence():
    # a plain board with no ring and no grid backend cannot be detected by the
    # checker: its manifest says `rules_prefix = "ringless"` and it opens on the
    # plain sentence, and the inner-grid sentence fails there.
    # (the manifest also arms the shared-component check, so only the prefix
    # violation is asserted on)
    with example(name="shared-gac", manifest=SHARED_GAC) as (root, _):
        violations = check_tree(root)
        assert not any("rules prefix" in v for v in violations), violations
    inner = {"PUZZLE_LINK.txt": _link()}
    with example(name="shared-gac", manifest=SHARED_GAC, contents=inner) as (root, _):
        violations = check_tree(root)
        assert any(
            "PUZZLE_LINK.txt comment missing rules prefix" in v for v in violations
        ), violations


def test_a_stale_grid_backend_is_stale_like_a_frame_backend():
    # a stale copy of the grid backend is stale like a frame backend's
    stale_grid = _link(
        houses="boxes",
        no_ring="Normal sudoku rules apply. Up to N.",
        grid_backend="stale",
    )
    with example(contents={"PUZZLE_LINK.txt": stale_grid}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "stale copy of grid-rowcol.js" in violations[0], violations


def test_a_shipped_component_the_backend_never_registers_fails():
    # a link shipping a component its backend never registers fails: dead
    # weight the recipient reads as part of the rule
    stale = _link(ships=("FooComponent", "BarComponent"), registers=("FooComponent",))
    with example(contents={"PUZZLE_LINK.txt": stale}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "PUZZLE_LINK.txt" in violations[0]
        assert "BarComponent" in violations[0]


def test_a_registered_component_the_link_left_out_fails():
    # the other direction fails too: a backend registering a component the
    # link left out throws inside the app, where the author never sees it
    short = _link(ships=("FooComponent",), registers=("FooComponent", "BarComponent"))
    with example(contents={"PUZZLE_LINK.txt": short}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "PUZZLE_LINK.txt" in violations[0]
        assert "BarComponent" in violations[0]


def test_a_frame_backend_satisfies_the_house_check():
    # a link that declares its interior rows and columns in the shared frame
    # backend, not in the document, still satisfies the house check: the cage
    # form cannot be named and the named houses cost nothing once their ids are
    # coerced, so framebuilt boards declare them in JS. The guard matches the
    # committed frame-rowcol.js byte for byte, so a stale or hand-edited copy
    # is still caught.
    framed = _link(houses="none", frame_backend=True)
    with example(contents={"PUZZLE_LINK.txt": framed}) as (root, _):
        violations = check_tree(root)
        assert violations == [], violations


def test_a_stale_frame_backend_is_stale_not_house_less():
    # A link carrying an OLD copy of the frame backend is stale, not house-less.
    # Both fail, but they need different fixes -- rebuild the link, versus
    # declare the lines at all -- so the message has to tell them apart. Every
    # committed frame link goes stale together the moment frame-rowcol.js
    # changes, and "declares no house for 9 interior row(s)" sends the reader
    # hunting for a missing constraint that is right there.
    stale = _link(houses="none", frame_backend="stale")
    with example(contents={"PUZZLE_LINK.txt": stale}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "stale" in violations[0].lower(), violations[0]
        assert "frame-rowcol.js" in violations[0], violations[0]
        assert "interior row" not in violations[0], violations[0]


def test_a_stale_corner_pin_backend_is_its_own_finding():
    # The corner-pin backend goes stale the same way, and NOTHING ELSE can see
    # it: it registers a built-in, so its constraint ships no component file and
    # check_components has no set to compare. The pin is what makes a frame
    # board unique at all, so a stale copy has to be its own finding.
    stale_corners = _link(corners_backend="stale")
    with example(contents={"PUZZLE_LINK.txt": stale_corners}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "stale" in violations[0].lower(), violations[0]
        assert "frame-corners.js" in violations[0], violations[0]


def test_a_current_corner_pin_backend_is_fine():
    # a current copy of it is fine
    fresh_corners = _link(corners_backend=True)
    with example(contents={"PUZZLE_LINK.txt": fresh_corners}) as (root, _):
        assert check_tree(root) == [], check_tree(root)


def test_a_stale_house_gac_backend_is_stale():
    # The house-GAC filter is opt-in per board, so a link that never
    # carries it is fine -- and one that does gets the same staleness check as
    # the other two shared backends, with its component checked too since it
    # ships one where the other two ship none.
    stale_house_gac = _link(house_gac_backend="stale")
    with example(contents={"PUZZLE_LINK.txt": stale_house_gac}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "stale" in violations[0].lower(), violations[0]
        assert "house-gac.js" in violations[0], violations[0]


def test_a_current_house_gac_backend_is_fine():
    fresh_house_gac = _link(house_gac_backend=True)
    with example(contents={"PUZZLE_LINK.txt": fresh_house_gac}) as (root, _):
        assert check_tree(root) == [], check_tree(root)


def test_a_stale_house_gac_component_is_stale():
    # The backend can be fresh while the COMPONENT it ships alongside is a
    # stale copy -- the same failure mode as frame-rowcol/frame-corners, but
    # nothing catches it unless the component's own code is compared too.
    stale_component = _link(house_gac_backend="stale_component")
    with example(contents={"PUZZLE_LINK.txt": stale_component}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "stale" in violations[0].lower(), violations[0]
        assert "HouseGacComponent.js" in violations[0], violations[0]


def test_a_missing_house_gac_component_is_caught_by_check_components():
    # And the backend can be fresh while the component is missing outright --
    # worse than stale, since house-gac.js calls `new HouseGacComponent(...)`
    # at setup. `check_components` (not this check) already covers it: it
    # flags any constraint whose backend registers a name its own
    # `components` list omits, House GAC included.
    no_component = _link(house_gac_backend="no_component")
    with example(contents={"PUZZLE_LINK.txt": no_component}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "House GAC" in violations[0], violations[0]
        assert "HouseGacComponent" in violations[0], violations[0]


def test_a_renamed_house_gac_constraint_still_gets_the_stale_component_check():
    # A constraint renamed away from "House GAC" (examples/house-gac's own
    # standalone board, which cannot keep the reserved title since its
    # backend is legitimately not house-gac.js) still ships the
    # shared HouseGacComponent.js, and a stale copy of it is caught the same
    # way: `check_components` cannot see it (component names still agree),
    # so this check keys the component comparison on its own name rather
    # than the constraint's title.
    renamed_stale_component = _link(house_gac_renamed="stale_component")
    with example(
        name="shared-gac",
        manifest=SHARED_GAC,
        contents={"PUZZLE_LINK.txt": renamed_stale_component},
    ) as (root, _):
        (root / "_shared").mkdir()
        (root / "_shared" / "HouseGacComponent.js").write_text("x")
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "stale" in violations[0].lower(), violations[0]
        assert "HouseGacComponent.js" in violations[0], violations[0]


def test_a_fresh_renamed_house_gac_constraint_raises_no_false_positive():
    # A fresh copy under the renamed title raises no false positive.
    renamed_fresh = _link(house_gac_renamed=True)
    with example(
        name="shared-gac",
        manifest=SHARED_GAC,
        contents={"PUZZLE_LINK.txt": renamed_fresh},
    ) as (
        root,
        _,
    ):
        (root / "_shared").mkdir()
        (root / "_shared" / "HouseGacComponent.js").write_text("x")
        assert check_tree(root) == [], check_tree(root)


def test_manifest_rowcol_backend_stands_in_for_the_interior_houses():
    # The manifest traits check_layout reads each need a witness here: strip
    # the branch in check_layout.py or link_checks.py and the case below goes red (#712).
    # rowcol_backend: a borrowed rows-and-columns backend, named in the
    # manifest, stands in for the interior houses the document omits. Without
    # the key the same link is a missing-house violation, and a constraint of
    # another name is not exempted by it.
    borrowed = {
        "PUZZLE_LINK.txt": _link(
            houses="none", borrowed_rowcol="Rows & Columns", ringless=True
        )
    }
    with example(name="shared-gac", manifest=SHARED_GAC, contents=borrowed) as (
        root,
        _,
    ):
        (root / "_shared").mkdir()
        (root / "_shared" / "HouseGacComponent.js").write_text("x")
        assert check_tree(root) == [], check_tree(root)
    no_key = {k: v for k, v in SHARED_GAC.items() if k != "rowcol_backend"}
    with example(name="shared-gac", manifest=no_key, contents=borrowed) as (root, _):
        (root / "_shared").mkdir()
        (root / "_shared" / "HouseGacComponent.js").write_text("x")
        violations = check_tree(root)
        assert any("declares no house" in v for v in violations), violations
    other = {
        "PUZZLE_LINK.txt": _link(
            houses="none", borrowed_rowcol="Other Lines", ringless=True
        )
    }
    with example(name="shared-gac", manifest=SHARED_GAC, contents=other) as (root, _):
        (root / "_shared").mkdir()
        (root / "_shared" / "HouseGacComponent.js").write_text("x")
        violations = check_tree(root)
        assert any("declares no house" in v for v in violations), violations


def test_manifest_digits_exceed_lines_allows_a_wider_range():
    # digits_exceed_lines: a frame board whose range (1..4) is wider than its
    # 3-cell interior lines is a violation, unless the manifest says the
    # excess is deliberate.
    wide = {"PUZZLE_LINK.txt": _link(frame_backend=True, houses="none", digits=(1, 4))}
    with example(contents=wide) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1 and "against 3" in violations[0], violations
    with example(contents=wide, manifest={"digits_exceed_lines": True}) as (root, _):
        assert check_tree(root) == [], check_tree(root)


def test_manifest_annotated_keeps_comments_scopes_to_the_annotated_name():
    # annotated_keeps_comments: an `_annotated` link embeds the shared
    # component with its comments kept. The manifest key makes that the copy
    # to compare against; without it the link reads stale. A plain link under
    # the key still carries the stripped copy, so the carve-out is scoped to
    # the link's name.

    assert annotated_violations(ANNOTATED_KEEPS, PLAIN_AND_ANNOTATED) == []
    violations = annotated_violations(ANNOTATED_HANDMADE, ANNOTATED_LINK)
    assert len(violations) == 1 and "stale" in violations[0].lower(), violations
    # the plain link given the comment-keeping copy is stale even under the key
    plain_annotated_copy = {
        "PUZZLE_LINK.txt": _link(house_gac_renamed=True, annotated_copy=True)
    }
    violations = annotated_violations(ANNOTATED_KEEPS, plain_annotated_copy)
    assert len(violations) == 1 and "PUZZLE_LINK.txt" in violations[0], violations


def test_shared_backends_in_an_annotated_link_read_against_the_comment_keeping_build():
    # The shared frame backends follow the same rule: under the key, an
    # `_annotated` link carrying them is read against their comment-keeping
    # build (#443), and a plain link under the key still reads against the
    # stripped one. A tampered annotated backend fails like a tampered plain one.
    shared_backends = {
        "frame_backend": True,
        "corners_backend": True,
        "house_gac_backend": True,
        "grid_backend": True,
        "houses": "none",
        "ringless": True,
        "annotated_copy": True,
    }
    frame_keeps = {**ANNOTATED_KEEPS, "digits_exceed_lines": True}
    annotated_frame = {"PUZZLE_LINK_annotated.txt": _link(**shared_backends)}
    got = annotated_violations(frame_keeps, annotated_frame)
    assert got == [], got
    for tamper, source in (
        ("frame_backend", "frame-rowcol.js"),
        ("corners_backend", "frame-corners.js"),
        ("house_gac_backend", "house-gac.js"),
    ):
        tampered = {**shared_backends, tamper: "stale"}
        violations = annotated_violations(
            frame_keeps, {"PUZZLE_LINK_annotated.txt": _link(**tampered)}
        )
        assert len(violations) == 1 and f"stale copy of {source}" in violations[0], (
            violations
        )
    tampered = {**shared_backends, "house_gac_backend": "stale_component"}
    violations = annotated_violations(
        frame_keeps, {"PUZZLE_LINK_annotated.txt": _link(**tampered)}
    )
    assert len(violations) == 1 and "HouseGacComponent.js" in violations[0], violations
    # an annotated copy in a plain link under the key is stale
    violations = annotated_violations(
        frame_keeps, {"PUZZLE_LINK.txt": _link(**shared_backends)}
    )
    # one stale copy per shared file the link carries: frame-rowcol.js,
    # frame-corners.js, house-gac.js, HouseGacComponent.js and grid-rowcol.js
    assert len(violations) == 5 and all("PUZZLE_LINK.txt" in v for v in violations), (
        violations
    )


def test_a_frame_link_with_no_digit_range_fails():
    # A frame link that declares no digit range leaves it to the app default
    # (1..9 whatever the grid size), not to the document. The source text
    # still reads right, so only the document can be asked.
    for kwargs in (
        {"frame_backend": True, "houses": "none"},
        {"corners_backend": True},
    ):
        rangeless = _link(digits=None, **kwargs)
        with example(contents={"PUZZLE_LINK.txt": rangeless}) as (root, _):
            violations = check_tree(root)
            assert len(violations) == 1, violations
            assert "digit range" in violations[0], violations[0]


def test_a_digit_range_wider_than_the_interior_line_fails():
    # A range that is declared but does not span the interior line degrades the
    # lines exactly the same way, so presence is not enough: nine digits on a
    # three-cell line is all-different, not a house.
    wide = _link(frame_backend=True, houses="none", digits=(1, 9))
    with example(contents={"PUZZLE_LINK.txt": wide}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "9 digits" in violations[0] and "3 cell" in violations[0], violations[0]


def test_a_boolean_digit_bound_is_not_a_declared_range():
    # `isinstance(True, int)` is true in Python, so a bool has to be turned away
    # by name or `minDigit: true` reads as a declared 1.
    boolean = _link(frame_backend=True, houses="none", digits=(True, 3))
    with example(contents={"PUZZLE_LINK.txt": boolean}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "digit range" in violations[0], violations[0]


def test_a_gen_json_recording_frame_backend_code_fails():
    # A gen JSON records the BOARD. The frame backends' code is read from the
    # tree at build time, so a copy kept in a gen JSON is dead data no build
    # reads and nothing rebuilds -- it can only drift from the file it copies.

    with example(
        extra_links=["PUZZLE_LINK_6x6.txt"],
        extra_gens=["gen_6x6.json"],
        contents={"gen_6x6.json": _gen("// a copy")},
    ) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "gen_6x6.json" in violations[0], violations[0]
        assert "Frame Rows and Columns" in violations[0], violations[0]


def test_a_gen_json_with_an_emptied_backend_field_is_fine():
    # an emptied field is what the template is supposed to carry
    with example(
        extra_links=["PUZZLE_LINK_6x6.txt"],
        extra_gens=["gen_6x6.json"],
        contents={"gen_6x6.json": _gen("")},
    ) as (root, _):
        assert check_tree(root) == [], check_tree(root)


def test_a_gen_json_recording_house_gac_code_fails():
    # The house-GAC filter is opt-in, but once a board carries it, a gen JSON
    # that records its code goes stale the same way.
    with example(
        extra_links=["PUZZLE_LINK_6x6.txt"],
        extra_gens=["gen_6x6.json"],
        contents={"gen_6x6.json": _gen("// a copy", name="House GAC")},
    ) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "gen_6x6.json" in violations[0], violations[0]
        assert "House GAC" in violations[0], violations[0]


def test_a_gen_json_recording_grid_backend_code_fails():
    # ...and so does a no-ring board's: the registry covers the grid backend too
    with example(
        extra_links=["PUZZLE_LINK_6x6.txt"],
        extra_gens=["gen_6x6.json"],
        contents={"gen_6x6.json": _gen("// a copy", name="Grid Rows and Columns")},
    ) as (_, d):
        violations = check_gen_frame_backends(d)
        assert len(violations) == 1, violations
        assert "Grid Rows and Columns" in violations[0], violations[0]


def test_a_gen_json_that_does_not_parse_stops_the_gate():
    # A gen JSON that does not parse stops the gate. It is the board's record,
    # and a corrupt one must not drop out of the checks that read it.
    with example(
        extra_links=["PUZZLE_LINK_6x6.txt"],
        extra_gens=["gen_6x6.json"],
        contents={"gen_6x6.json": "{not json"},
    ) as (root, d):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "gen_6x6.json is not valid JSON" in violations[0], violations[0]
        # each violation comes from the function named for it
        assert len(check_gen_json_parses(d)) == 1
        assert check_gen_frame_backends(d) == []


def test_a_gen_json_with_no_puzzle_key_is_board_data():
    # a gen JSON with no `puzzle` key is board data, not a corrupt document
    with example(
        extra_links=["PUZZLE_LINK_6x6.txt"],
        extra_gens=["gen_6x6.json"],
        contents={"gen_6x6.json": json.dumps({"cells": []})},
    ) as (root, _):
        assert check_tree(root) == [], check_tree(root)


def test_a_gen_json_that_is_not_an_object_fails_loud():
    # only a missing `puzzle` key is skipped: a gen JSON of the wrong shape, or
    # a `puzzle` with no `constraints`, is a broken record and must fail loud
    with example(extra_gens=["gen_6x6.json"], contents={"gen_6x6.json": "[]"}) as (
        _,
        d,
    ):
        try:
            check_gen_frame_backends(d)
        except TypeError:
            pass
        else:
            raise AssertionError("a gen JSON that is not an object was skipped")


def test_a_puzzle_with_no_constraints_fails_loud():
    with example(
        extra_gens=["gen_6x6.json"],
        contents={"gen_6x6.json": json.dumps({"puzzle": {}})},
    ) as (_, d):
        try:
            check_gen_frame_backends(d)
        except KeyError:
            pass
        else:
            raise AssertionError("a puzzle with no constraints was skipped")


def test_stale_backend_code_and_a_missing_digit_range_are_two_checks():
    # stale backend code and a missing digit range are two checks: a stale
    # copy with a good range trips only the first, a fresh copy with no range
    # only the second
    def _checks(link_text):
        with example(contents={"PUZZLE_LINK.txt": link_text}) as (_, d):
            path = d / "PUZZLE_LINK.txt"
            puzzle = decode_puzzle(path.read_text().strip())["puzzle"]
            manifest = load_manifest(d)
            link = CommittedLink.of(d, path, puzzle, frozenset())
            return (
                check_stale_backend_code(link, manifest),
                check_digit_range(link, manifest),
            )

    stale_found, range_found = _checks(_link(frame_backend="stale", houses="none"))
    assert len(stale_found) == 1 and range_found == [], (stale_found, range_found)
    stale_found, range_found = _checks(
        _link(frame_backend=True, houses="none", digits=None)
    )
    assert stale_found == [] and len(range_found) == 1, (stale_found, range_found)


def test_a_ring_board_with_no_boxes_still_has_a_ring():
    # a ring board with no box regions (isofill-skyscraper's) still has a
    # ring: the corner pin says so, and its interior lines are the n cells
    # inside it, not the whole board's width
    ring_no_boxes = {
        "width": 5,
        "height": 5,
        "minDigit": 1,
        "maxDigit": 3,
        "cells": [{} for _ in range(25)],
        "constraints": [{"definition": {"name": "Frame Corners"}}],
    }
    widget = pathlib.Path("widget")
    found = check_digit_range(
        CommittedLink.of(
            widget, widget / "PUZZLE_LINK.txt", ring_no_boxes, frozenset()
        ),
        Manifest(timed_component="WidgetComponent"),
    )
    assert found == [], found
    wide = dict(ring_no_boxes, maxDigit=5)
    found = check_digit_range(
        CommittedLink.of(widget, widget / "PUZZLE_LINK.txt", wide, frozenset()),
        Manifest(timed_component="WidgetComponent"),
    )
    assert len(found) == 1 and "3 cell interior lines" in found[0], found


def test_a_board_with_no_frame_backend_is_not_asked_for_one():
    # ...and a board with no frame backend at all is not asked for one
    plain = _link(digits=None)
    with example(contents={"PUZZLE_LINK.txt": plain}) as (root, _):
        assert check_tree(root) == [], check_tree(root)


def test_a_board_that_declares_no_houses_fails_and_says_so():
    # ...but a board that declares them nowhere at all still fails, and says so
    bare = _link(houses="none")
    with example(contents={"PUZZLE_LINK.txt": bare}) as (root, _):
        violations = check_tree(root)
        assert violations, "a board with no houses at all was accepted"
        assert "stale" not in violations[0].lower(), violations[0]


def test_a_built_in_is_not_a_component_the_link_must_carry():
    # a built-in is not a component the link must carry: SudokuMaker provides
    # the class, so a backend that constructs one ships no file for it and the
    # link is not stale. The frame boards' corner pin is such a backend.
    builtin = _link(
        ships=("FooComponent",),
        registers=("FooComponent", "PredefinedCandidatesComponent"),
    )
    with example(contents={"PUZZLE_LINK.txt": builtin}) as (root, _):
        violations = check_tree(root)
        assert violations == [], violations


def test_a_comment_naming_a_component_is_not_a_registration():
    # a comment naming a component is not a registration. A link built today
    # ships no comments, but this sweep also reads backends off links
    # no builder rebuilds -- fillomino's frozen fixtures and hunt records --
    # and one of their notes must not read as a `new BarComponent` the link
    # is missing
    commented = _link(
        ships=("FooComponent",), note="a paired end gets a new BarComponent"
    )
    with example(contents={"PUZZLE_LINK.txt": commented}) as (root, _):
        violations = check_tree(root)
        assert violations == [], violations


def test_a_link_that_fails_to_decode_is_reported():
    # a link file that fails to decode is reported, not a crash
    with example(contents={"PUZZLE_LINK.txt": "not a real link"}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "PUZZLE_LINK.txt" in violations[0]
        assert "failed to decode" in violations[0]


def test_the_shared_directory_is_skipped():
    # _shared is skipped even though it has none of the required files
    with example() as (root, _):
        (root / "_shared").mkdir()
        (root / "_shared" / "helper.py").write_text("x")
        violations = check_tree(root)
        assert violations == [], violations


def test_a_nonexistent_root_is_one_violation():
    # a nonexistent root produces one violation, not a crash
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp) / "does_not_exist"
        violations = check_tree(root)
        assert len(violations) == 1, violations


def test_the_script_exits_1_and_names_the_violation():
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


def test_the_script_exits_0_on_a_clean_tree():
    with example() as (root, _):
        result = subprocess.run(
            [sys.executable, str(HERE / "check_layout.py"), str(root)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result
        assert "ok" in result.stdout, result.stdout


def test_a_committed_link_that_is_not_a_puzzle_link_file_is_still_checked():
    # a committed link that is NOT a PUZZLE_LINK*.txt -- a frozen timing
    # fixture, a hunt record -- is still a link, so the share criteria bind it
    with example(extra_links=[FIXTURE], contents={FIXTURE: _link(entered=True)}) as (
        root,
        _,
    ):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert FIXTURE in violations[0], violations
        assert "entered value" in violations[0], violations


def test_a_link_found_only_by_its_prefix_claims_no_tag():
    # a link found only by its LINK_PREFIX text claims no tag: a name that
    # merely contains `_clued` earns no exemption from the share checks
    planted = "hunt_clued_record.txt"
    with example(extra_links=[planted], contents={planted: _link(entered=True)}) as (
        root,
        _,
    ):
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert planted in violations[0] and "entered value" in violations[0], violations
    assert check_layout.link_tags(planted) == frozenset()
    assert check_layout.link_tags("PUZZLE_LINK_6x6_clued_annotated.txt") == {
        "clued",
        "annotated",
    }
    assert check_layout.link_tags("PUZZLE_LINK_original_clued.txt") == frozenset()


def test_the_link_name_grammar_binds_only_puzzle_link_files():
    # ...but the link-NAME grammar does not: a fixture names itself for what it
    # records, and only PUZZLE_LINK*.txt has a grammar to break
    with example(extra_links=[FIXTURE]) as (root, _):
        assert check_tree(root) == [], check_tree(root)


def test_a_committed_txt_that_is_not_a_link_is_left_alone():
    # a committed .txt that is not a link at all is left alone -- no decode,
    # no criteria, no name complaint
    with example(
        extra_links=["hunt-cold-times.tsv.txt"],
        contents={"hunt-cold-times.tsv.txt": "board\tms\ncap9-seed3\t1000\n"},
    ) as (root, _):
        assert check_tree(root) == [], check_tree(root)


def test_a_link_in_a_subdirectory_is_gated_like_a_top_level_one():
    # a link in a board's own subdirectory is gated like one at the top level:
    # the share criteria and the name grammar both reach it, and the
    # violation names its path inside the example
    with example() as (root, d):
        (d / "board").mkdir()
        (d / "board" / "PUZZLE_LINK.txt").write_text(_link(entered=True))
        (d / "board" / "PUZZLE_LINK_demo.txt").write_text(_link())
        violations = check_tree(root)
        assert len(violations) == 2, violations
        assert "board/PUZZLE_LINK.txt has 1 entered value" in violations[0], violations
        assert "link name board/PUZZLE_LINK_demo.txt" in violations[1], violations


def test_a_dot_directory_is_left_alone():
    # ...but a dot directory is scratch, not a board, and is left alone
    with example() as (root, d):
        (d / ".scratch").mkdir()
        (d / ".scratch" / "PUZZLE_LINK_x.txt").write_text(_link(entered=True))
        assert check_tree(root) == [], check_tree(root)


def test_a_sudoku_document_gets_its_rows_and_columns_from_the_app():
    # a "sudoku" document gets its rows and columns from the app itself
    # (SudokuRules, prepended for a sudoku document: bundle.claude.js:11450-11456),
    # and has no clue ring, so it needs no declared lines and opens on the
    # plain rules sentence
    doc = decode_puzzle(_link(houses="none", ringless=True))
    doc["puzzle"]["type"] = "sudoku"
    with example(contents={"PUZZLE_LINK.txt": encode_link(doc)}) as (root, _):
        assert check_tree(root) == [], check_tree(root)
    doc["puzzle"]["type"] = "custom"
    with example(contents={"PUZZLE_LINK.txt": encode_link(doc)}) as (root, _):
        violations = check_tree(root)
        assert any("declares no house" in v for v in violations), violations


def test_a_sudoku_document_s_edge_cells_are_real_cells():
    # ...and its edge cells are real cells, so givens filling them are no ring
    doc = decode_puzzle(_link(full_ring=True, ringless=True))
    doc["puzzle"]["type"] = "sudoku"
    with example(contents={"PUZZLE_LINK.txt": encode_link(doc)}) as (root, _):
        assert check_tree(root) == [], check_tree(root)


def test_a_component_built_through_custom_components_is_registered():
    # a component a shipped component constructs through `customComponents` is
    # registered, not dead weight
    doc = decode_puzzle(
        _link(ships=("FooComponent", "BarComponent"), registers=("FooComponent",))
    )
    custom = next(c for c in doc["puzzle"]["constraints"] if c.get("type") == 1000)
    foo = custom["definition"]["components"][0]
    foo["code"] += "\nnew customComponents.BarComponent(name, cells)"
    with example(contents={"PUZZLE_LINK.txt": encode_link(doc)}) as (root, _):
        assert check_tree(root) == [], check_tree(root)


def test_an_example_with_no_manifest_fails():
    # an example with no example.toml fails and names the file: its traits
    # are what the checker reads, so there is nothing to guess from
    with example() as (root, d):
        (d / "example.toml").unlink()
        violations = check_tree(root)
        assert len(violations) == 1, violations
        assert "widget" in violations[0] and "example.toml" in violations[0], violations


def test_a_bad_manifest_is_a_violation_not_a_crash():
    # a manifest with an unknown key or no timed_component is a violation, not
    # a crash
    for bad in ('timed_component = "W"\ncolour = "red"\n', 'lanes = "single"\n'):
        with example(contents={"example.toml": bad}) as (root, _):
            violations = check_tree(root)
            assert len(violations) == 1, violations
            assert "widget" in violations[0] and "example.toml" in violations[0], (
                violations
            )


def test_a_boardless_example_needs_only_three_files():
    # a boardless example (components and a harness, no shipped board) needs
    # only README, a component and the soundness harness -- and still needs
    # those three
    BOARDLESS = ["README.md", "FooComponent.js", "soundness-harness.mjs"]
    with example(files=BOARDLESS, manifest={"boardless": True}) as (root, d):
        assert check_tree(root) == [], check_tree(root)
        for missing in BOARDLESS:
            (d / missing).rename(d / "held")
            violations = check_tree(root)
            assert any("missing required file" in v for v in violations), (
                missing,
                violations,
            )
            (d / "held").rename(d / missing)
        # a link committed to a boardless example is still checked
        (d / "PUZZLE_LINK_bogus.txt").write_text(_link())
        violations = check_tree(root)
        assert any("link name" in v for v in violations), violations


def test_a_houses_only_example_needs_six_files():
    # a houses_only example (a backend of built-in houses, proved by one CP-SAT
    # test) needs neither a component, the soundness harness, the strength fuzz
    # nor the optimization log -- and still needs its own six files
    HOUSES_ONLY = [
        "README.md",
        "main.js",
        "build_link.py",
        "build_link.test.py",
        "forced_houses.test.py",
        "PUZZLE_LINK.txt",
    ]
    EMPTY_TEMPLATE = {"houses_only": True, **SINGLE_LANE, **HAND_MADE}
    with example(files=HOUSES_ONLY, manifest=EMPTY_TEMPLATE) as (root, d):
        assert check_tree(root) == [], check_tree(root)
        for missing in HOUSES_ONLY:
            (d / missing).rename(d / "held")
            violations = check_tree(root)
            assert any(
                "missing required file" in v and missing in v for v in violations
            ), (missing, violations)
            (d / "held").rename(d / missing)
    # without the flag the same files lack the component and the harness
    with example(files=HOUSES_ONLY, manifest={**SINGLE_LANE, **HAND_MADE}) as (root, _):
        violations = check_tree(root)
        assert any("soundness-harness.mjs" in v for v in violations), violations
        assert any("*Component.js" in v for v in violations), violations


def test_sudoku_rules_declare_the_rows_and_columns():
    # a board whose rows and columns come from SudokuRules (type 2003) declares
    # them: boxes alone are a violation, boxes plus SudokuRules are not
    with example(
        contents={"PUZZLE_LINK.txt": _link(houses="boxes", sudoku_rules=True)}
    ) as (root, _):
        assert check_tree(root) == [], check_tree(root)


def test_a_manifest_shared_component_must_exist_in_shared():
    # a manifest's shared_component must exist in _shared/
    with example(manifest={"shared_component": "NoSuchComponent"}) as (root, _):
        violations = check_tree(root)
        assert any("NoSuchComponent" in v for v in violations), violations


def test_a_manifest_rules_prefix_trait_decides_the_sentence():
    # a fixture example with a manifest is checked by its traits: a link that
    # opens on the inner-grid sentence fails under `rules_prefix = "ringless"`,
    # and a plain-sentence link fails under the default
    with example(
        manifest={"rules_prefix": "ringless"},
        contents={"PUZZLE_LINK.txt": _link()},
    ) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1 and "rules prefix" in violations[0], violations
    with example(contents={"PUZZLE_LINK.txt": _link(ringless=True)}) as (root, _):
        violations = check_tree(root)
        assert len(violations) == 1 and "rules prefix" in violations[0], violations


def test_a_document_whose_cells_do_not_fill_the_board_has_no_ring():
    # a document whose cells do not fill width x height has no ring to judge:
    # ten given cells on a 3x3 would read as a full ring if the size guard
    # were gone, and the share check says nothing about it
    misfit = {
        "width": 3,
        "height": 3,
        "comment": RULES_PREFIX,
        "cells": [{"value": 1, "given": True} for _ in range(10)],
        "constraints": [],
    }
    widget = pathlib.Path("widget")
    assert (
        link_checks.check_share_ready(
            CommittedLink.of(widget, widget / "PUZZLE_LINK.txt", misfit, frozenset()),
            Manifest(timed_component="WidgetComponent"),
        )
        == []
    )
    fits = dict(misfit, cells=misfit["cells"][:9])
    found = link_checks.check_share_ready(
        CommittedLink.of(widget, widget / "PUZZLE_LINK.txt", fits, frozenset()),
        Manifest(timed_component="WidgetComponent"),
    )
    assert len(found) == 1 and "fills all 8 ring cells" in found[0], found


def test_link_facts_classifies_a_decoded_link_once():
    # LinkFacts classifies a decoded link once, from the raw document alone

    no_ring_doc = LinkFacts.of(_facts_doc(_named(GRID_ROWCOL.title)))
    assert no_ring_doc.kind is LinkKind.NO_RING and no_ring_doc.ringless, no_ring_doc
    assert no_ring_doc.house_source is HouseSource.NO_RING_BACKEND, no_ring_doc
    # a no-ring backend wins over the document type: it is the stronger claim
    both = LinkFacts.of(_facts_doc(_named(GRID_ROWCOL.title), type="sudoku"))
    assert both.kind is LinkKind.NO_RING, both
    sudoku_doc = LinkFacts.of(_facts_doc(type="sudoku"))
    assert sudoku_doc.kind is LinkKind.SUDOKU_DOCUMENT and sudoku_doc.ringless, (
        sudoku_doc
    )
    plain_frame = LinkFacts.of(_facts_doc())
    assert plain_frame.kind is LinkKind.FRAME and not plain_frame.ringless, plain_frame
    assert plain_frame.house_source is HouseSource.DOCUMENT, plain_frame
    rowcol = LinkFacts.of(_facts_doc(_named(FRAME_ROWCOL.title)))
    assert rowcol.house_source is HouseSource.FRAME_BACKEND, rowcol
    assert rowcol.backend_titles == (FRAME_ROWCOL.title,), rowcol
    assert (
        LinkFacts.of(_facts_doc({"type": 2003})).house_source
        is HouseSource.SUDOKU_RULES
    )
    # backend titles keep constraint order and skip unrelated names
    ordered = LinkFacts.of(
        _facts_doc(
            _named(FRAME_CORNERS.title), _named("Mine"), _named(GRID_ROWCOL.title)
        )
    )
    assert ordered.backend_titles == (FRAME_CORNERS.title, GRID_ROWCOL.title)
    assert "Mine" in ordered.constraint_names, ordered
    # interior: the region cells, or None when the size is not declared
    regions = LinkFacts.of(
        _facts_doc({"type": 1, "regions": [0, 0, -1, 0, 0, -1, -1, -1, -1]})
    )
    assert regions.interior == frozenset({0, 1, 3, 4}), regions
    assert LinkFacts.of(_facts_doc(width=None)).interior is None


def test_reading_the_titles_never_minifies_a_backend():
    # reading the titles never minifies a backend (ARCH-8 a): stub every
    # minify route the backends share -- the registry's reader and the minify
    # entry under it -- so a minify through any of them fails the call
    def refuse(*a, **k):
        raise AssertionError("LinkFacts minified a backend")

    every_title = [_named(b.title) for b in SHARED_BACKENDS]
    stubs = [
        (link_checks, "backend_code"),
        (link_checks, "component_code"),
        (check_layout, "minify_file"),
        (document, "backend_code"),
        (document, "component_code"),
        (document, "minify_file"),
    ]
    real = [getattr(m, n) for m, n in stubs]
    for m, n in stubs:
        setattr(m, n, refuse)
    try:
        facts = LinkFacts.of(_facts_doc(*every_title))
    finally:
        for (m, n), r in zip(stubs, real, strict=True):
            setattr(m, n, r)
    assert facts.backend_titles == tuple(b.title for b in SHARED_BACKENDS), facts


def test_check_layout_and_link_checks_name_no_example():
    # check_layout.py and link_checks.py name no example: no string in either
    # source equals the name of a directory under examples/ -- a name-keyed
    # table or an `if name == "..."` branch would be a trait recorded by name

    # the guard itself: a planted example name is found, whichever file it is in
    planted = sorted(EXAMPLE_NAMES)[0]
    assert _example_names_in(f'x = "{planted}"') == [planted]
    for module in ("check_layout.py", "link_checks.py"):
        source = (HERE / module).read_text()
        named = _example_names_in(source)
        assert named == [], f"{module} names example(s): {named}"
        assert _example_names_in(source + f'\n_PLANTED = "{planted}"\n') == [planted], (
            f"{module}: the guard missed a planted example name"
        )


def test_every_real_example_has_a_manifest_the_loader_accepts():
    # ...and every real example has a manifest the loader accepts
    for name in sorted(EXAMPLE_NAMES):
        load_manifest(HERE.parent / name)


def test_retired_examples_toml_names_no_current_example():
    # retired-examples.toml is a name -> successor table of retired examples,
    # none of which is a current example
    retired = tomllib.loads((HERE / "retired-examples.toml").read_text())
    assert retired and not set(retired) & EXAMPLE_NAMES, retired


if __name__ == "__main__":
    test_a_complete_example_passes()
    test_a_missing_required_file_is_named()
    test_a_missing_component_file_fails()
    test_a_missing_main_global_js_is_named()
    test_a_single_lane_example_needs_no_main_global_js_or_local_board()
    test_a_global_lane_example_ships_main_global_js_alone()
    test_a_single_lane_example_names_a_stray_lane_file()
    test_a_global_lane_example_carries_neither_local_file()
    test_a_split_example_requires_both_halves_of_the_local_board()
    test_a_gen_json_with_no_matching_link_is_unpaired()
    test_a_generated_link_with_no_gen_json_is_unpaired()
    test_a_clued_or_original_twin_needs_no_gen_json()
    test_a_hand_made_link_named_in_the_manifest_needs_no_gen_json()
    test_any_other_plain_link_still_needs_its_gen_json()
    test_a_retired_example_directory_may_not_come_back()
    test_main_js_building_frame_lines_is_a_lane_violation()
    test_the_lane_guards_read_the_assembled_source()
    test_naming_the_other_lane_in_a_comment_is_not_a_violation()
    test_a_main_js_that_does_not_minify_is_a_violation()
    test_main_global_js_reading_input_groups_is_a_lane_violation()
    test_a_bad_link_name_fails_naming_the_file()
    test_valid_link_name_variants_pass()
    test_an_entered_value_on_a_non_given_cell_fails()
    test_a_clued_link_is_exempt_from_the_entered_value_check()
    test_a_link_that_fills_every_ring_cell_fails()
    test_a_clued_link_is_exempt_from_the_ring_check()
    test_a_comment_missing_the_rules_prefix_fails()
    test_rules_prefix_none_exempts_the_rules_prefix_check()
    test_boxes_without_column_houses_fail()
    test_a_link_with_no_houses_fails_on_rows_and_columns()
    test_a_whole_grid_example_declares_no_houses()
    test_a_single_lane_example_ships_main_js_alone()
    test_a_no_ring_board_carries_the_grid_rows_and_columns_backend()
    test_a_no_ring_comment_owes_the_plain_sentence()
    test_a_ringless_manifest_opens_on_the_plain_sentence()
    test_a_stale_grid_backend_is_stale_like_a_frame_backend()
    test_a_shipped_component_the_backend_never_registers_fails()
    test_a_registered_component_the_link_left_out_fails()
    test_a_frame_backend_satisfies_the_house_check()
    test_a_stale_frame_backend_is_stale_not_house_less()
    test_a_stale_corner_pin_backend_is_its_own_finding()
    test_a_current_corner_pin_backend_is_fine()
    test_a_stale_house_gac_backend_is_stale()
    test_a_current_house_gac_backend_is_fine()
    test_a_stale_house_gac_component_is_stale()
    test_a_missing_house_gac_component_is_caught_by_check_components()
    test_a_renamed_house_gac_constraint_still_gets_the_stale_component_check()
    test_a_fresh_renamed_house_gac_constraint_raises_no_false_positive()
    test_manifest_rowcol_backend_stands_in_for_the_interior_houses()
    test_manifest_digits_exceed_lines_allows_a_wider_range()
    test_manifest_annotated_keeps_comments_scopes_to_the_annotated_name()
    test_shared_backends_in_an_annotated_link_read_against_the_comment_keeping_build()
    test_a_frame_link_with_no_digit_range_fails()
    test_a_digit_range_wider_than_the_interior_line_fails()
    test_a_boolean_digit_bound_is_not_a_declared_range()
    test_a_gen_json_recording_frame_backend_code_fails()
    test_a_gen_json_with_an_emptied_backend_field_is_fine()
    test_a_gen_json_recording_house_gac_code_fails()
    test_a_gen_json_recording_grid_backend_code_fails()
    test_a_gen_json_that_does_not_parse_stops_the_gate()
    test_a_gen_json_with_no_puzzle_key_is_board_data()
    test_a_gen_json_that_is_not_an_object_fails_loud()
    test_a_puzzle_with_no_constraints_fails_loud()
    test_stale_backend_code_and_a_missing_digit_range_are_two_checks()
    test_a_ring_board_with_no_boxes_still_has_a_ring()
    test_a_board_with_no_frame_backend_is_not_asked_for_one()
    test_a_board_that_declares_no_houses_fails_and_says_so()
    test_a_built_in_is_not_a_component_the_link_must_carry()
    test_a_comment_naming_a_component_is_not_a_registration()
    test_a_link_that_fails_to_decode_is_reported()
    test_the_shared_directory_is_skipped()
    test_a_nonexistent_root_is_one_violation()
    test_the_script_exits_1_and_names_the_violation()
    test_the_script_exits_0_on_a_clean_tree()
    test_a_committed_link_that_is_not_a_puzzle_link_file_is_still_checked()
    test_a_link_found_only_by_its_prefix_claims_no_tag()
    test_the_link_name_grammar_binds_only_puzzle_link_files()
    test_a_committed_txt_that_is_not_a_link_is_left_alone()
    test_a_link_in_a_subdirectory_is_gated_like_a_top_level_one()
    test_a_dot_directory_is_left_alone()
    test_a_sudoku_document_gets_its_rows_and_columns_from_the_app()
    test_a_sudoku_document_s_edge_cells_are_real_cells()
    test_a_component_built_through_custom_components_is_registered()
    test_an_example_with_no_manifest_fails()
    test_a_bad_manifest_is_a_violation_not_a_crash()
    test_a_boardless_example_needs_only_three_files()
    test_a_houses_only_example_needs_six_files()
    test_sudoku_rules_declare_the_rows_and_columns()
    test_a_manifest_shared_component_must_exist_in_shared()
    test_a_manifest_rules_prefix_trait_decides_the_sentence()
    test_a_document_whose_cells_do_not_fill_the_board_has_no_ring()
    test_link_facts_classifies_a_decoded_link_once()
    test_reading_the_titles_never_minifies_a_backend()
    test_check_layout_and_link_checks_name_no_example()
    test_every_real_example_has_a_manifest_the_loader_accepts()
    test_retired_examples_toml_names_no_current_example()
    print("ok")
