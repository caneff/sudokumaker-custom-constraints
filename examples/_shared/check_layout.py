# Every example under examples/ (all but _shared) must carry the same file
# set and name its puzzle links by the same grammar, so a tool can discover
# a new example with no justfile edit. See docs/example-layout.md. It also
# decodes every committed link under an example, a board's own subdirectory
# included -- the shipped PUZZLE_LINK*.txt
# boards and the other link .txt files an example commits beside them
# (fillomino's frozen timing fixtures and its hunt records) -- and checks the
# three mechanical pre-share criteria from docs/share-checklist.md: the link
# opens clean (no entered values on non-given cells), the outside ring is not
# filled end to end, and the rules text carries the sudoku prefix, except an
# example whose manifest sets rules_prefix = "none" (not sudoku). A _clued
# link is exempt from the first two -- filling every clue is what that name
# means. It also checks that every link ships exactly the components its own
# embedded code registers (the backend, or a shipped component that constructs
# another through `customComponents`), so a link cannot go stale behind its
# builder, and that every interior row and column of a sudoku example's board is
# a house the link actually declares (a region constraint gives boxes only --
# see docs/gotchas.md #9; a manifest with houses = false is a bare
# board, and a "sudoku" document gets its lines from the app, so both are
# exempt).
#
# The per-link checks themselves (share-readiness, components, stale backend
# code, digit range, houses) live in link_checks.py; this file finds the links
# and hands each one over.
#
# What is special about an example is that example's own: each carries an
# example.toml (manifest.py), and this sweep names no example.
#
# Links committed outside examples/ (docs/research/fillomino-baseline/'s
# PUZZLE_LINK.txt and its 19 timing fixtures) are out of scope for this sweep
# -- they are not an example directory and carry no builder to check
# components against. They still get a manual decode pass when touched; see
# examples/fillomino/README.md's fixture-reuse justification.
#
# The link-NAME grammar binds only PUZZLE_LINK*.txt: a fixture or a hunt record
# is not a shipped board and names itself for what it records. The share
# criteria bind all of them -- a link is a link, and any of these can be handed
# to a person (a board has been picked out of exactly such a batch).
#
#   uv run examples/_shared/check_layout.py [root]

import json
import pathlib
import re
import sys
import tomllib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from document import SHARED_BACKEND_TITLES
from link_checks import LINK_CHECKS, CommittedLink
from manifest import load_manifest
from minify import minify_file
from sudoku_kit.link_codec import decode_puzzle

# What a boardless example (manifest `boardless = true`) still needs: it ships
# components and a harness, and no board.
BOARDLESS_REQUIRED_FILES = ["README.md", "soundness-harness.mjs"]

# What a houses-only example (manifest `houses_only = true`) needs: its backend
# registers only built-in `HouseComponent`s, so there is no component to fuzz,
# and one CP-SAT test proving every registered house is forced replaces the
# harness, the strength fuzz and the optimization log.
HOUSES_ONLY_REQUIRED_FILES = [
    "README.md",
    "main.js",
    "build_link.py",
    "build_link.test.py",
    "forced_houses.test.py",
    "PUZZLE_LINK.txt",
]

REQUIRED_FILES = [
    "README.md",
    "main.js",
    "build_link.py",
    "build_link.test.py",
    "soundness-harness.mjs",
    "update-strength.test.mjs",
    "OPTIMIZATION_LOG.md",
    "PUZZLE_LINK.txt",
]

# The local lane's own files. PUZZLE_LINK.txt is the GLOBAL-lane board in
# every split example, so the local lane needs a board of its own: the link
# plus the gen JSON that records it. An example whose manifest says
# `lanes = "single"` ships main.js alone and neither; one that says
# `lanes = "global"` ships main-global.js in main.js's place, and neither.
REQUIRED_LOCAL_FILES = ["PUZZLE_LINK_local.txt", "gen_local.json"]

# Examples folded into another and deleted, name -> the example that took over.
# One rule has one example, so the directory must not come back -- a second one
# would drift from the first the way numbered-rooms-lines drifted from
# numbered-rooms. Data, not code: a retired name is not an example.
RETIRED_EXAMPLES = tomllib.loads(
    (pathlib.Path(__file__).parent / "retired-examples.toml").read_text()
)


# `build_original.py` / `build_clued.py` build a hand-derived twin: the same
# board as another committed link, re-encoded with different wrapper code or
# extra clues. That board already has its own gen entry under an untagged
# name -- skyscraper's PUZZLE_LINK_6x6_original.txt reads gen_6x6.json (the
# 6x6 size's own entry, not a "6x6_original" one), and its untagged twin
# PUZZLE_LINK_original.txt reads gen.json the same way -- or, for
# a hand-made link, no gen JSON at all (the manifest's generator_less_links).
# Either way, a link whose suffix carries either tag never gets its
# own separate gen*.json. "annotated" is the same shape: a link of the
# same board as PUZZLE_LINK.txt with only its embedded code's minification
# changed, not a fresh generation.
NO_GENERATOR_TAGS = {"clued", "original", "annotated"}

# NxN: the same digit run on both sides, so 6x7 is rejected same as 6-7.
SIZE = r"\d+"
# Tags chain in this fixed order; each is optional, but present tags must
# keep this relative order (PUZZLE_LINK_original_clued.txt is rejected).
TAGS = ("clued", "original", "silent", "local", "annotated")
LINK_RE = re.compile(
    rf"^PUZZLE_LINK(_({SIZE})x\2)?(_\d+g)?"
    + "".join(f"(_{t})?" for t in TAGS)
    + r"\.txt$"
)


def link_tags(filename):
    """The tags `filename` carries, read once from `LINK_RE`'s groups. Empty
    for a name the grammar rejects: a link found by its `LINK_PREFIX` text, or a
    malformed `PUZZLE_LINK*` name, claims no tag and so earns no exemption."""
    match = LINK_RE.match(filename)
    if not match:
        return frozenset()
    return frozenset(
        t for t, g in zip(TAGS, match.groups()[-len(TAGS) :], strict=True) if g
    )


def check_lanes(example_dir):
    """`main.js` (the local, drawn-groups paste target) must never build the
    frame itself; `main-global.js` (the whole-grid paste target) must never
    read the drawn groups. See docs/example-layout.md.

    Both scans read the SHIPPED text -- `minify_file`, so `// #include`s are
    spliced in and comments are gone. That is the lane: a paste target's real
    body can live in an included file, and a mention inside a comment is not
    part of it."""
    name = example_dir.name
    violations = []

    def shipped(path):
        """path's shipped text, or None with a violation recorded. minify_file
        signals a malformed file (unpaired block marker, broken #include) by
        assertion; letting that out would end the whole sweep on one example
        and leave the rest unchecked, so it becomes a violation like any
        other."""
        try:
            return minify_file(path)
        except AssertionError as exc:
            violations.append(f"{name}: {path.name} does not minify: {exc}")
            return None

    main_js = example_dir / "main.js"
    if main_js.is_file() and "getCellAt(" in (shipped(main_js) or ""):
        violations.append(f"{name}: main.js builds frame lines (calls getCellAt)")

    main_global_js = example_dir / "main-global.js"
    if main_global_js.is_file() and "input.groups" in (shipped(main_global_js) or ""):
        violations.append(f"{name}: main-global.js reads input.groups")

    return violations


def _link_suffix(filename, prefix, ext):
    """The part of a `gen*.json`/`PUZZLE_LINK*.txt` name between `prefix` and
    `ext`, minus one leading underscore -- "" for the plain-named file."""
    return filename[len(prefix) : -len(ext)].lstrip("_")


def check_gen_link_pairing(example_dir, manifest):
    """Return one violation string per gen*.json / PUZZLE_LINK*.txt name that
    does not pair with the other of the same suffix (docs/example-layout.md,
    "Board naming"): `gen.json` pairs with `PUZZLE_LINK.txt`, `gen_6x6.json`
    with `PUZZLE_LINK_6x6.txt`, and so on. A gen JSON always needs its link;
    a link needs a gen JSON back only where one is generated -- not a
    build_original.py/build_clued.py twin (NO_GENERATOR_TAGS) or a hand-made
    exception (the manifest's generator_less_links)."""
    name = example_dir.name
    violations = []

    for gen in sorted(example_dir.glob("gen*.json")):
        suffix = _link_suffix(gen.name, "gen", ".json")
        link_name = f"PUZZLE_LINK_{suffix}.txt" if suffix else "PUZZLE_LINK.txt"
        if not (example_dir / link_name).is_file():
            violations.append(f"{name}: {gen.name} has no matching {link_name}")

    for link in sorted(example_dir.glob("PUZZLE_LINK*.txt")):
        # A malformed link name is reported by the LINK_RE check below; its
        # "suffix" is not well-formed either, so pairing does not pile on.
        if not LINK_RE.match(link.name):
            continue
        if link_tags(link.name) & NO_GENERATOR_TAGS:
            continue
        suffix = _link_suffix(link.name, "PUZZLE_LINK", ".txt")
        if link.name in manifest.generator_less_links:
            continue
        gen_name = f"gen_{suffix}.json" if suffix else "gen.json"
        if not (example_dir / gen_name).is_file():
            violations.append(
                f"{name}: {link.name} has no matching {gen_name} -- most "
                "likely the gen JSON is missing or misnamed and should match "
                "this link's own suffix; if this link is genuinely hand-made "
                "instead, record it in the example's example.toml generator_less_links"
            )

    return violations


# The prefix every SudokuMaker link starts with. A committed .txt beside an
# example is a link when it starts with this and nothing else is; a golden or a
# note is not decoded and not checked.
LINK_PREFIX = "https://sudokumaker.app/?puzzle="


def committed_links(example_dir):
    """Every committed link .txt under `example_dir`, its board subdirectories
    included, PUZZLE_LINK*.txt first. A dot directory is scratch, not a board,
    and is skipped: a link may sit in a board's own subdirectory, and every
    one is gated.

    A PUZZLE_LINK*.txt is a link by its name -- one that does not decode is a
    broken shipped board and gets reported as one. Any other .txt is a link
    only when its text starts with `LINK_PREFIX`, so a fixture or a hunt record
    is covered without a naming rule of its own and a golden or a note is left
    alone."""
    named, sniffed = [], []
    for f in sorted(example_dir.rglob("*.txt")):
        if any(p.startswith(".") for p in f.relative_to(example_dir).parts):
            continue
        if f.name.startswith("PUZZLE_LINK"):
            named.append(f)
            continue
        try:
            if f.read_text().lstrip().startswith(LINK_PREFIX):
                sniffed.append(f)
        except (OSError, UnicodeDecodeError):
            continue
    return named + sniffed


def _parse_gen(gen):
    """`(document, None)` for a `gen*.json` that parses, `(None, error)` for one
    that does not."""
    try:
        return json.loads(gen.read_text()), None
    except json.JSONDecodeError as e:
        return None, e


def check_gen_json_parses(example_dir):
    """Return one violation per `gen*.json` that is not valid JSON.

    A corrupt board record must stop the gate, not drop out of the checks that
    read it.
    """
    name = example_dir.name
    return [
        f"{name}: {gen.name} is not valid JSON: {error}"
        for gen in sorted(example_dir.glob("gen*.json"))
        if (error := _parse_gen(gen)[1])
    ]


def check_gen_frame_backends(example_dir):
    """Return one violation per `gen*.json` that records a frame backend's code.

    A gen JSON is the board's record, and the shared frame backends are not
    part of a board: their code is read from the tree at build time
    (`document.refresh_frame_backends`), so a copy kept here is dead data no
    build reads and nothing rebuilds -- it can only drift from the file it
    copies, and a reader comparing the two has no way to tell which one runs.
    Keep the field empty. A gen JSON that does not parse is
    `check_gen_json_parses`'s to report.
    """
    name = example_dir.name
    titles = SHARED_BACKEND_TITLES
    violations = []
    for gen in sorted(example_dir.glob("gen*.json")):
        doc, error = _parse_gen(gen)
        if error:
            continue
        try:
            puzzle = doc["puzzle"]
        except KeyError:
            continue  # a board-data gen JSON carries no document at all
        constraints = puzzle["constraints"]
        for constraint in constraints:
            definition = constraint.get("definition") or {}
            if definition.get("name") in titles and definition.get("backend", {}).get(
                "code"
            ):
                violations.append(
                    f"{name}: {gen.name} records code for "
                    f"{definition['name']!r} -- the frame backends come from "
                    f"the tree at build time, so a copy here is dead data that "
                    f"goes stale. Empty the field"
                )
    return violations


def required_files(manifest):
    """The files an example with this manifest must carry."""
    if manifest.boardless:
        return BOARDLESS_REQUIRED_FILES
    if manifest.houses_only:
        return HOUSES_ONLY_REQUIRED_FILES
    if manifest.lanes == "global":
        return ["main-global.js" if f == "main.js" else f for f in REQUIRED_FILES]
    return REQUIRED_FILES


def check_example(example_dir):
    """Return one violation string per problem found in `example_dir`."""
    name = example_dir.name

    if name in RETIRED_EXAMPLES:
        return [
            f"{name}: folded into {RETIRED_EXAMPLES[name]} (#238); "
            "this directory must not exist"
        ]

    try:
        manifest = load_manifest(example_dir)
    except (FileNotFoundError, ValueError) as e:
        return [f'{name}: {e} (docs/example-layout.md, "The manifest")']

    violations = [
        f"{name}: missing required file {required}"
        for required in required_files(manifest)
        if not (example_dir / required).is_file()
    ]

    if manifest.shared_component:
        shared_file = example_dir.parent / "_shared" / f"{manifest.shared_component}.js"
        if not shared_file.is_file():
            violations.append(
                f"{name}: declared shared component {manifest.shared_component!r} "
                f"has no file at {shared_file}"
            )
    elif not manifest.houses_only and not list(example_dir.glob("*Component.js")):
        violations.append(f"{name}: missing required file *Component.js")

    if manifest.lanes == "split" and not manifest.boardless:
        violations.extend(
            f"{name}: missing required file {required}"
            for required in ["main-global.js", *REQUIRED_LOCAL_FILES]
            if not (example_dir / required).is_file()
        )

    # A single-lane example ships main.js alone and a global-lane one ships
    # main-global.js in its place; neither carries the local board (the
    # comment above REQUIRED_LOCAL_FILES). A stray file is a lane the
    # manifest says does not exist.
    strays = {
        "single": ["main-global.js", *REQUIRED_LOCAL_FILES],
        "global": REQUIRED_LOCAL_FILES,
    }.get(manifest.lanes, [])
    violations.extend(
        f"{name}: {manifest.lanes}-lane example carries {stray}, a file of a lane "
        f"its manifest says it does not have"
        for stray in strays
        if (example_dir / stray).is_file()
    )

    violations.extend(check_lanes(example_dir))
    violations.extend(check_gen_link_pairing(example_dir, manifest))
    violations.extend(check_gen_json_parses(example_dir))
    violations.extend(check_gen_frame_backends(example_dir))

    for path in committed_links(example_dir):
        shown = path.relative_to(example_dir).as_posix()
        if path.name.startswith("PUZZLE_LINK") and not LINK_RE.match(path.name):
            violations.append(
                f"{name}: link name {shown} does not match "
                f"PUZZLE_LINK[_<size>][_<givens>g][_<tag>]*.txt "
                f"(size=NxN, tags in fixed order {list(TAGS)})"
            )
        # Decoded once, here: every check below reads the same puzzle.
        try:
            puzzle = decode_puzzle(path.read_text().strip())["puzzle"]
        except Exception as e:
            violations.append(f"{name}: {shown} failed to decode: {e}")
            continue
        link = CommittedLink.of(example_dir, path, puzzle, link_tags(path.name))
        for check in LINK_CHECKS:
            violations.extend(check(link, manifest))

    return violations


def check_tree(root):
    """Return one violation string per problem in every example under `root`.

    Every directory directly under `root` is an example, except `_shared`.
    """
    root = pathlib.Path(root)
    if not root.is_dir():
        return [f"{root}: not a directory"]

    violations = []
    for example_dir in sorted(root.iterdir()):
        if not example_dir.is_dir() or example_dir.name == "_shared":
            continue
        violations.extend(check_example(example_dir))
    return violations


def main(argv):
    root = argv[1] if len(argv) > 1 else "examples"
    violations = check_tree(root)
    for v in violations:
        print(v)
    print(f"{'FAILED' if violations else 'ok'} — {len(violations)} violation(s)")
    return 1 if violations else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
