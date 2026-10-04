"""One end-to-end test for the 2026-09-29 audit spec (#649, closing slice #739).

A new example is added the way an agent adds one: a copy of up-to-n under a
name no shared file has ever seen, in a throwaway copy of `examples/`. It then
lives through the spec's acceptance criteria in order, at the shared layer's
public seams:

  1. the layout gate accepts it from its `example.toml` alone, and refuses it
     once the manifest is gone (user story 1, card 1);
  2. the timing driver resolves its timed component from that manifest, and
     refuses a name the board does not register (card 1);
  3. the document module finds its custom-constraint entry, with the `input`
     and `style` every entry carries, and writes it back byte-for-byte
     (the thermo-nuclear headline);
  4. its soundness harness passes through the shared fuzz runner, and fails on
     a component that drops a true candidate or a `validate` that rejects the
     true solution (user story 2, card 2, crap-audit);
  5. the lint run fails on a style break in every shipped component, the moved
     GAC components included (user story 2, card 5);
  6. the layout gate refuses a load from docs/research/ (card 5);
  7. its link opens in the app session's HAR adapter and solves unique
     (card 7).

Then three sweeps over the real tree: every example's timed component resolves
(card 1), every shipped component is soundness-fuzzed or listed with a reason
(user story 2), and every component a committed link registers still has a
file of that name (user story 3, the glossary renames).

WHAT A GREEN RUN DOES NOT COVER (this seam is blind to it):
  - the live site: whether each rebuilt link opens and solves unique in
    sudokumaker.app itself, `withApp({ live: true })`, and `just time`'s
    timings. Step 7 replays the recorded app (sudokumaker.har), so a
    SudokuMaker release that changes the solver or the link format is not
    seen. #739's PR records the live-site open of every link the spec rebuilt.
  - solve time: no deduction changed in this spec, and nothing here times one.
  - the finders: the Renbanana model pieces, the hunt driver's half-stateful
    refusal and the hunt tests are the finders' own suites.

    uv run examples/_shared/spec_649_closing.test.py
"""

import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

from check_layout import check_research_loads
from link_codec import decode_puzzle
from manifest import load_manifest
from sm_document import find_constraint, registering_constraint_name, write_link
from time_example import find_component_file

SOURCE_EXAMPLE = "up-to-n"
NEW_EXAMPLE = "zz-new-example"
COMPONENT = "UpToNComponent"

# Shipped components no soundness harness loads, each with the reason. A new
# component fails sweep 2 until a harness loads it or it is listed here.
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
}


def run(cmd, cwd):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)


def copy_tree(tmp):
    """The tracked `examples/`, `docs/` (research left out) and package.json
    under `tmp`, node_modules linked in, and up-to-n copied again as
    NEW_EXAMPLE."""
    tracked = subprocess.run(
        [
            "git",
            "ls-files",
            "-z",
            "examples",
            "docs",
            ":!docs/research",
            "package.json",
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.split("\0")
    for rel in filter(None, tracked):
        dest = tmp / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / rel, dest)
    # The node_modules Node itself would find from ROOT: a task worktree has
    # none of its own and resolves through the primary checkout's.
    modules = next(
        d / "node_modules"
        for d in (ROOT, *ROOT.parents)
        if (d / "node_modules").is_dir()
    )
    (tmp / "node_modules").symlink_to(modules)
    shutil.copytree(tmp / "examples" / SOURCE_EXAMPLE, tmp / "examples" / NEW_EXAMPLE)
    return tmp / "examples" / NEW_EXAMPLE


def edited(path, old, new):
    """Replace `old` (which must occur) with `new` in `path`; return the
    original text so the caller can restore it."""
    text = path.read_text()
    assert old in text, f"{path.name}: {old!r} not found"
    path.write_text(text.replace(old, new, 1))
    return text


def step_layout_gate(tmp, ex):
    gate = [sys.executable, "examples/_shared/check_layout.py", "examples"]
    r = run(gate, tmp)
    assert r.returncode == 0, (
        f"the gate refused a copied example:\n{r.stdout}{r.stderr}"
    )
    manifest = ex / "example.toml"
    text = manifest.read_text()
    manifest.unlink()
    try:
        r = run(gate, tmp)
        assert r.returncode == 1, r.stdout
        assert f"{NEW_EXAMPLE}: missing" in r.stdout, r.stdout
        assert "example.toml" in r.stdout, r.stdout
    finally:
        manifest.write_text(text)


def step_timed_component(ex):
    doc = decode_puzzle((ex / "PUZZLE_LINK.txt").read_text().strip())
    assert find_component_file(ex, doc) == ex / f"{COMPONENT}.js"
    original = edited(ex / "example.toml", COMPONENT, "NoSuchComponent")
    try:
        find_component_file(ex, doc)
    except ValueError as e:
        assert "NoSuchComponent" in str(e), e
    else:
        raise AssertionError("a timed component the board does not register resolved")
    finally:
        (ex / "example.toml").write_text(original)


def step_document(tmp, ex):
    link = (ex / "PUZZLE_LINK.txt").read_text().strip()
    doc = decode_puzzle(link)
    entry = find_constraint(doc, registering_constraint_name(doc, COMPONENT))
    assert entry["type"] == 1000
    assert {"input", "style"} <= entry.keys(), sorted(entry)
    assert COMPONENT in [c["name"] for c in entry["definition"]["components"]]
    out = tmp / "rewritten.txt"
    write_link(doc, out)
    assert decode_puzzle(out.read_text().strip()) == doc


def step_fuzz_runner(ex):
    # A tenth of the shipped draw count: both faults below show within it,
    # and `just soundness` runs the full count on the real harness.
    edited(
        ex / "soundness-harness.mjs", "const ITERS = 20000\n", "const ITERS = 2000\n"
    )
    harness = ["node", "soundness-harness.mjs"]
    r = run(harness, ex)
    assert r.returncode == 0 and "PASS" in r.stdout, r.stdout + r.stderr
    component = ex / f"{COMPONENT}.js"
    # Drops N from the clue's first cell on every call: wrong whenever the
    # first N sits there.
    unsound = edited(
        component,
        "  const { line, target } = instance\n",
        "  const { line, target } = instance\n"
        "  yield puzzle.removeCandidateFromCell(target, line[0])\n",
    )
    try:
        r = run(harness, ex)
        assert r.returncode == 1, r.stdout
        assert re.search(r" [1-9]\d* violations,", r.stdout), r.stdout
    finally:
        component.write_text(unsound)
    rejecting = edited(
        component,
        "function validate (instance, puzzle) {\n",
        "function validate (instance, puzzle) {\n  return false\n",
    )
    try:
        r = run(harness, ex)
        assert r.returncode == 1, r.stdout
        assert re.search(r" [1-9]\d* validate rejections,", r.stdout), r.stdout
    finally:
        component.write_text(rejecting)


def shipped_components(tree):
    """Every *Component.js under `tree`/examples except the verbatim
    third-party original/ snippets, as repo-relative paths."""
    return sorted(
        p.relative_to(tree).as_posix()
        for p in (tree / "examples").rglob("*Component.js")
        if "original" not in p.parts
    )


def step_lint(tmp):
    components = [
        c for c in shipped_components(tmp) if f"/{NEW_EXAMPLE}/" not in f"/{c}"
    ]
    for c in components:
        with (tmp / c).open("a") as f:
            f.write("const lintProbe = 1;\n")
    r = run(["npx", "standard"], tmp)
    assert r.returncode != 0, r.stdout
    unlinted = [c for c in components if f"{c}:" not in r.stdout]
    assert not unlinted, f"the lint run never read: {unlinted}\n{r.stdout}"


def step_research_load(tmp, ex):
    assert check_research_loads(tmp) == []
    (ex / "loader.py").write_text('SOURCE = "docs/research/up-to-n/main.js"\n')
    try:
        found = check_research_loads(tmp)
        assert any(f"examples/{NEW_EXAMPLE}/loader.py:1:" in v for v in found), found
    finally:
        (ex / "loader.py").unlink()


APP_SOLVE = """
import fs from 'fs'
import { withApp, solveInApp } from './examples/_shared/app-session.mjs'
const link = fs.readFileSync(process.argv[1], 'utf8').trim()
const r = await withApp({ live: false }, async app =>
  solveInApp(await app.newPage(), link, { deterministic: false, timeoutMs: 60000 }))
console.log(JSON.stringify({ verdict: r.verdict, version: r.version }))
"""


def step_app_session(tmp, ex):
    link = ex / "PUZZLE_LINK_4x4.txt"
    r = run(["node", "--input-type=module", "-e", APP_SOLVE, str(link)], tmp)
    assert r.returncode == 0, r.stderr
    result = json.loads(r.stdout.strip().splitlines()[-1])
    assert result["verdict"] == "unique", result
    assert result["version"], result


def sweep_timed_components(tree):
    for manifest in sorted((tree / "examples").glob("*/example.toml")):
        ex = manifest.parent
        if load_manifest(ex).boardless:
            continue
        doc = decode_puzzle((ex / "PUZZLE_LINK.txt").read_text().strip())
        assert find_component_file(ex, doc).is_file(), ex.name


LOAD = re.compile(r"""load(?:Source|At)?\(\s*['"]([^'"]+Component\.js)['"]""")
LOCAL_IMPORT = re.compile(r"""from\s+['"](\./[^'"]+\.mjs)['"]""")


def harness_loads(harness):
    """The component files `harness` loads through makeIo, itself or through
    the example-local modules it imports, as resolved paths."""
    seen, todo, loads = set(), [harness], set()
    while todo:
        module = todo.pop()
        if module in seen:
            continue
        seen.add(module)
        text = module.read_text()
        loads.update((module.parent / m).resolve() for m in LOAD.findall(text))
        todo.extend((module.parent / m).resolve() for m in LOCAL_IMPORT.findall(text))
    return loads


def sweep_fuzzed(tree):
    fuzzed = set()
    for harness in (tree / "examples").glob("*/soundness-harness.mjs"):
        fuzzed |= harness_loads(harness)
    shipped = shipped_components(tree)
    unfuzzed = [
        c for c in shipped if (tree / c).resolve() not in fuzzed and c not in NOT_FUZZED
    ]
    assert not unfuzzed, (
        f"no soundness harness loads {unfuzzed} (or list it in NOT_FUZZED)"
    )
    stale = sorted(set(NOT_FUZZED) - set(shipped))
    assert not stale, f"NOT_FUZZED names a file that is gone: {stale}"
    also = sorted(c for c in NOT_FUZZED if (tree / c).resolve() in fuzzed)
    assert not also, f"NOT_FUZZED names a component a harness loads: {also}"


def sweep_registered_names(tree):
    names = {p.stem for p in (tree / "examples").rglob("*Component.js")}
    missing = [
        f"{link.relative_to(tree)}: {comp['name']}"
        for link in sorted((tree / "examples").rglob("PUZZLE_LINK*.txt"))
        for c in decode_puzzle(link.read_text().strip())["puzzle"]["constraints"]
        for comp in c.get("definition", {}).get("components", [])
        if comp["name"] not in names
    ]
    assert not missing, f"links register components with no file: {missing}"


def main():
    with tempfile.TemporaryDirectory() as t:
        tmp = pathlib.Path(t)
        ex = copy_tree(tmp)
        step_layout_gate(tmp, ex)
        step_timed_component(ex)
        step_document(tmp, ex)
        step_fuzz_runner(ex)
        step_lint(tmp)
        step_research_load(tmp, ex)
        step_app_session(tmp, ex)
    sweep_timed_components(ROOT)
    sweep_fuzzed(ROOT)
    sweep_registered_names(ROOT)
    print("spec_649_closing: new example through the shared layer, three sweeps ok")


if __name__ == "__main__":
    # SM_LIVE=1 would send step 7 to the live site to re-record the HAR.
    os.environ.pop("SM_LIVE", None)
    main()
