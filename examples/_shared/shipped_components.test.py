"""Sweeps over the real tree: every shipped component is accounted for.

  1. every shipped component is loaded by a soundness harness, or is listed in
     NOT_FUZZED with a reason, so a component that is never fuzzed fails here;
  2. every component a committed link registers has a file of that name, so a
     rename that leaves a link behind fails here;
  3. every example's timed component resolves to a file;
  4. every custom-constraint entry in a committed link carries `input` and
     `style`;
  5. no `standard.ignore` entry of package.json hides a shipped component from
     lint.

Sweep 1 reads harness source for `load(...)` calls: it proves a harness loads
the file, not that every draw reaches it. Whether the fuzz asks a component's
`validate` is not checked here (harness-lib.test.mjs: fuzzSoundness refuses a
module that lacks the `validate` its file defines).

    uv run examples/_shared/shipped_components.test.py
"""

import fnmatch
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

from check_research_loads import _js_code
from manifest import load_manifest
from sudoku_kit.link_codec import decode_puzzle
from time_example import find_component_file, shipped_component_code

# Shipped components no soundness harness loads, each with the reason. A new
# component fails the fuzz sweep until a harness loads it or it is listed here.
NOT_FUZZED = {
    "examples/_shared/AllDiffGacComponent.js": (
        "no link ships it: house-gac.test.mjs checks HouseGacComponent against it"
    ),
    "examples/dutch-flatmates/NoFiveComponent.js": (
        "no update: initialize removes 5 from its own cells once (no-five.test.mjs)"
    ),
    "examples/count-digits-gac/required-digits/RequiredDigitsWrapperComponent.js": (
        "a replaceComponent delegate that removes no candidate itself; "
        "RequiredDigitsGacComponent, which it swaps in, is fuzzed"
    ),
    "examples/count-digits-gac/required-digits/RequiredDigitsWrapperComponentBuiltin.js": (
        "a replaceComponent delegate to the app's built-in RequiredDigitsComponent"
    ),
}

# makeIo's `load(file, ...)`.
LOAD = re.compile(r"""\bload\(\s*['"]([^'"]+Component[^'"]*\.js)['"]""")
LOCAL_IMPORT = re.compile(r"""from\s+['"](\./[^'"]+\.mjs)['"]""")

CUSTOM_CONSTRAINT = 1000


def shipped_components():
    """Every component file under examples/ except the verbatim or
    frozen original/ snippets and the dot-directory strength floors, as
    repo-relative paths."""
    rels = (p.relative_to(ROOT) for p in (ROOT / "examples").rglob("*Component*.js"))
    return sorted(
        rel.as_posix()
        for rel in rels
        if "original" not in rel.parts
        and not any(part.startswith(".") for part in rel.parts)
    )


def harness_loads(harness):
    """Every component path `harness` loads through makeIo, itself or through
    the example-local modules it imports. Comments are blanked first, so a
    commented-out load is no load."""
    seen, todo, loads = set(), [harness], set()
    while todo:
        module = todo.pop()
        if module in seen:
            continue
        seen.add(module)
        code = _js_code(module.read_text())
        loads.update((module.parent / file).resolve() for file in LOAD.findall(code))
        todo.extend((module.parent / m).resolve() for m in LOCAL_IMPORT.findall(code))
    return loads


def committed_links():
    links = sorted((ROOT / "examples").rglob("PUZZLE_LINK*.txt"))
    assert links, "no PUZZLE_LINK*.txt under examples/ to sweep"
    return links


def test_every_shipped_component_is_fuzzed_or_excused():
    loads = set()
    for harness in (ROOT / "examples").glob("*/soundness-harness.mjs"):
        loads |= harness_loads(harness)
    shipped = shipped_components()
    problems = []
    for c in shipped:
        loaded = (ROOT / c).resolve() in loads
        if c in NOT_FUZZED:
            if loaded:
                problems.append(f"{c}: in NOT_FUZZED but a harness loads it")
        elif not loaded:
            problems.append(f"{c}: no soundness harness loads it")
    problems += [f"{c}: in NOT_FUZZED but gone" for c in set(NOT_FUZZED) - set(shipped)]
    assert not problems, "\n".join(problems)


def test_every_component_a_link_registers_has_a_file():
    names = {p.stem for p in (ROOT / "examples").rglob("*Component*.js")}
    registered = [
        (link, name)
        for link in committed_links()
        for name in shipped_component_code(decode_puzzle(link.read_text().strip()))
    ]
    assert registered, "no link registers a component, so the sweep checked nothing"
    missing = [
        f"{link.relative_to(ROOT)}: {name}"
        for link, name in registered
        if name not in names
    ]
    assert not missing, f"links register components with no file: {missing}"


def test_every_examples_timed_component_resolves():
    checked = 0
    for manifest in sorted((ROOT / "examples").glob("*/example.toml")):
        ex = manifest.parent
        traits = load_manifest(ex)
        # no board to time, or no component of its own to follow
        if traits.boardless or traits.houses_only:
            continue
        doc = decode_puzzle((ex / "PUZZLE_LINK.txt").read_text().strip())
        assert find_component_file(ex, doc).is_file(), ex.name
        checked += 1
    assert checked, "no timed example was checked: the sweep matched nothing"


def test_every_custom_constraint_in_a_committed_link_carries_input_and_style():
    bad = []
    for link in committed_links():
        doc = decode_puzzle(link.read_text().strip())
        for entry in doc["puzzle"]["constraints"]:
            if entry.get("type") != CUSTOM_CONSTRAINT:
                continue
            missing = {"input", "style"} - entry.keys()
            if missing:
                name = entry.get("definition", {}).get("name")
                bad.append(f"{link.relative_to(ROOT)}: {name} lacks {sorted(missing)}")
    assert not bad, "\n".join(bad)


def test_no_lint_ignore_entry_hides_a_shipped_component():
    ignore = json.loads((ROOT / "package.json").read_text())["standard"]["ignore"]
    hidden = [
        f"{c}: {pattern}"
        for c in shipped_components()
        for pattern in ignore
        if fnmatch.fnmatch(c, pattern)
    ]
    assert not hidden, "lint never reads: " + "; ".join(hidden)


if __name__ == "__main__":
    test_every_shipped_component_is_fuzzed_or_excused()
    test_every_component_a_link_registers_has_a_file()
    test_every_examples_timed_component_resolves()
    test_every_custom_constraint_in_a_committed_link_carries_input_and_style()
    test_no_lint_ignore_entry_hides_a_shipped_component()
    print("shipped_components.test.py: ok")
