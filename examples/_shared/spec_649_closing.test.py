"""One end-to-end test for the 2026-09-29 audit spec (#649, closing slice #739).

A new example is added the way an agent adds one: a copy of up-to-n under a
name no shared file has ever seen, in a throwaway copy of `examples/` and
`docs/`. The copy is then taken through the shared layer, in order:

  1. the layout gate accepts it from its `example.toml` alone, and refuses
     it once the manifest is gone;
  2. the timing driver resolves its timed component from that manifest, and
     refuses a name the board does not register;
  3. its 4x4 board rebuilds byte-for-byte through framebuild and the
     document module, and every custom-constraint entry on it carries
     `input` and `style`;
  4. its soundness harness passes, and the shared fuzz runner fails a run of
     its component that drops a true candidate, and one whose `validate`
     rejects the true solution;
  5. the lint run reports a style break planted in every shipped component,
     the GAC components moved out of docs/research included;
  6. the layout gate's research rule refuses a load from docs/research/;
  7. its 4x4 link opens in the app session's HAR adapter and solves unique.

Then three sweeps over the real tree: every example's timed component
resolves; every shipped component is loaded by a soundness harness that asks
it `validate` when it has one, or is listed in NOT_FUZZED with a reason; and
every component a committed link registers has a file of that name, so a
rename that leaves a link behind fails here.

WHAT A GREEN RUN DOES NOT COVER (this seam is blind to it):
  - the live site: whether each rebuilt link opens and solves unique in
    sudokumaker.app itself (`withApp({ live: true })`), and `just time`'s
    timings. Step 7 replays the recorded app (sudokumaker.har), so a
    SudokuMaker release that changes the solver or the link format is not
    seen here. docs/research/2026-10-04-spec-649-live-open.md records the
    live open of every link this spec rebuilt.
  - solve time: no deduction changed in this spec, and nothing here times one.
  - whether a component name matches GLOSSARY.md: sweep 3 catches a link left
    behind by a rename, not a name the glossary does not use.
  - sweep 2 reads harness source for `load(...)` calls: it proves a harness
    loads the file and names `validate`, not that every draw reaches it.

Left to their own suites in the same gate, not driven here: the CP-SAT base
model and solve_unique (cpsat.test.py), loadBundle and the bundle-solve
import (bundle-load.test.mjs, bundle-solve.test.mjs), the framebuild lanes
(framebuild.test.py), the finder-test glob (gate.test.py), the stamp guard
(the fillomino and isofill stamp tests), and the finders' Renbanana model,
half-stateful refusal and hunt tests.

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

from check_layout import _js_code, check_example, check_research_loads
from link_codec import decode_puzzle
from manifest import load_manifest
from sm_document import find_constraint, registering_constraint_name
from time_example import find_component_file, shipped_component_code

SOURCE_EXAMPLE = "up-to-n"
NEW_EXAMPLE = "zz-new-example"
COMPONENT = "UpToNComponent"
BOARD = "PUZZLE_LINK_4x4.txt"

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
    "examples/count-digits-gac/required-digits/RequiredDigitsWrapperComponentBuiltin.js": (
        "a replaceComponent delegate to the app's built-in RequiredDigitsComponent"
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
    r = run([sys.executable, "examples/_shared/check_layout.py", "examples"], tmp)
    assert r.returncode == 0, (
        f"the gate refused a copied example:\n{r.stdout}{r.stderr}"
    )
    manifest = ex / "example.toml"
    text = manifest.read_text()
    manifest.unlink()
    try:
        found = check_example(ex)
        assert any(
            v.startswith(f"{NEW_EXAMPLE}: missing") and "example.toml" in v
            for v in found
        ), found
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


def step_rebuild(ex):
    r = run([sys.executable, "build_size.py", "--rebuild", "4", "--local"], ex)
    assert r.returncode == 0, r.stdout + r.stderr
    rebuilt = (ex / BOARD).read_text()
    assert rebuilt == (ROOT / "examples" / SOURCE_EXAMPLE / BOARD).read_text(), (
        "the rebuild moved the committed board's bytes"
    )
    doc = decode_puzzle(rebuilt.strip())
    entries = [c for c in doc["puzzle"]["constraints"] if c.get("type") == 1000]
    assert len(entries) > 1, [c.get("definition", {}).get("name") for c in entries]
    for entry in entries:
        name = entry["definition"]["name"]
        assert {"input", "style"} <= entry.keys(), f"{name}: {sorted(entry)}"
    assert COMPONENT in shipped_component_code(doc)
    assert find_constraint(doc, registering_constraint_name(doc, COMPONENT)) in entries


# One house line 4 1 2 3 read from cell 0 with N = 4, so the clue is 0: a
# component that drops 4 from cell 0 loses the truth, and `validate` on the
# filled line must accept it.
RUNNER = """
import { installGlobals, makeIo, fuzzSoundness } from './examples/_shared/harness-lib.mjs'
const [dir, from, to] = process.argv.slice(1)
installGlobals(1, 4)
const mod = makeIo(dir).load('UpToNComponent.js', ['setParams', 'update', 'validate'],
  src => from ? src.replace(from, to) : src)
const line = [0, 1, 2, 3]
const r = fuzzSoundness('toy', { iters: 1, log: () => {}, draw: () => {
  const inst = {}
  mod.setParams(inst, line, 4, 0)
  return { truth: { 0: 4, 1: 1, 2: 2, 3: 3 }, seed: () => [1, 2, 3, 4], parts: [{ mod, inst }], houses: [line] }
} })
console.log(JSON.stringify(r))
"""


def fuzz_once(tmp, ex, patch=None):
    """fuzzSoundness's result for one draw of the copy's component, with
    `patch` (old, new) applied to its source first."""
    source = (ex / f"{COMPONENT}.js").read_text()
    if patch:
        assert patch[0] in source, patch[0]
    argv = ["node", "--input-type=module", "-e", RUNNER, str(ex), *(patch or ())]
    r = run(argv, tmp)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout.strip().splitlines()[-1])


def step_fuzz_runner(tmp, ex):
    # A tenth of the shipped draw count: `just soundness` runs the full count
    # on the real harness.
    edited(
        ex / "soundness-harness.mjs", "const ITERS = 20000\n", "const ITERS = 2000\n"
    )
    r = run(["node", "soundness-harness.mjs"], ex)
    assert r.returncode == 0 and "PASS" in r.stdout, r.stdout + r.stderr

    clean = fuzz_once(tmp, ex)
    assert clean["ok"], clean
    unsound = fuzz_once(
        tmp,
        ex,
        (
            "  const { line, target } = instance\n",
            "  const { line, target } = instance\n"
            "  yield puzzle.removeCandidateFromCell(target, line[0])\n",
        ),
    )
    assert unsound["violations"] == 1 and not unsound["ok"], unsound
    rejecting = fuzz_once(
        tmp,
        ex,
        (
            "function validate (instance, puzzle) {\n",
            "function validate (instance, puzzle) {\n  return false\n",
        ),
    )
    assert rejecting["validateRejects"] == 1 and not rejecting["ok"], rejecting


def shipped_components(tree):
    """Every component file under `tree`/examples except the verbatim or
    frozen original/ snippets and the dot-directory strength floors, as
    repo-relative paths."""
    rels = (p.relative_to(tree) for p in (tree / "examples").rglob("*Component*.js"))
    return sorted(
        rel.as_posix()
        for rel in rels
        if "original" not in rel.parts
        and not any(part.startswith(".") for part in rel.parts)
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
    r = run(["node", "--input-type=module", "-e", APP_SOLVE, str(ex / BOARD)], tmp)
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


# makeIo's `load(file, names, ...)`, with `names` an array literal or the name
# of a `const` holding one.
LOAD = re.compile(
    r"""\bload\(\s*['"]([^'"]+Component[^'"]*\.js)['"]\s*,\s*(\[[^\]]*\]|[A-Za-z_$][\w$]*)"""
)
NAMES_CONST = r"""\bconst\s+{}\s*=\s*(\[[^\]]*\])"""
LOCAL_IMPORT = re.compile(r"""from\s+['"](\./[^'"]+\.mjs)['"]""")


def harness_loads(harness):
    """{component path: names loaded} for every component file `harness`
    loads through makeIo, itself or through the example-local modules it
    imports. Comments are blanked first, so a commented-out load is no load."""
    seen, todo, loads = set(), [harness], {}
    while todo:
        module = todo.pop()
        if module in seen:
            continue
        seen.add(module)
        code = _js_code(module.read_text())
        for file, names in LOAD.findall(code):
            if not names.startswith("["):
                const = re.search(NAMES_CONST.format(re.escape(names)), code)
                assert const, f"{module.name}: load({file!r}, {names}) not resolved"
                names = const.group(1)
            path = (module.parent / file).resolve()
            loads.setdefault(path, set()).update(re.findall(r"['\"](\w+)['\"]", names))
        todo.extend((module.parent / m).resolve() for m in LOCAL_IMPORT.findall(code))
    return loads


def sweep_fuzzed(tree):
    loads = {}
    for harness in (tree / "examples").glob("*/soundness-harness.mjs"):
        for path, names in harness_loads(harness).items():
            loads.setdefault(path, set()).update(names)
    shipped = shipped_components(tree)
    problems = []
    for c in shipped:
        names = loads.get((tree / c).resolve())
        if c in NOT_FUZZED:
            if names is not None:
                problems.append(f"{c}: in NOT_FUZZED but a harness loads it")
        elif names is None:
            problems.append(f"{c}: no soundness harness loads it")
        elif "validate" not in names and re.search(
            r"^function validate\b", (tree / c).read_text(), re.M
        ):
            problems.append(
                f"{c}: loaded without validate, so the runner never asks it"
            )
    problems += [f"{c}: in NOT_FUZZED but gone" for c in set(NOT_FUZZED) - set(shipped)]
    assert not problems, "\n".join(problems)


def sweep_registered_names(tree):
    names = {p.stem for p in (tree / "examples").rglob("*Component*.js")}
    missing = [
        f"{link.relative_to(tree)}: {name}"
        for link in sorted((tree / "examples").rglob("PUZZLE_LINK*.txt"))
        for name in shipped_component_code(decode_puzzle(link.read_text().strip()))
        if name not in names
    ]
    assert not missing, f"links register components with no file: {missing}"


def main():
    with tempfile.TemporaryDirectory() as t:
        tmp = pathlib.Path(t)
        ex = copy_tree(tmp)
        step_layout_gate(tmp, ex)
        step_timed_component(ex)
        step_rebuild(ex)
        step_fuzz_runner(tmp, ex)
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
