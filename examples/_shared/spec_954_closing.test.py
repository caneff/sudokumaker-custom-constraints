"""One end-to-end test for spec #954, the 2026-11-13 audit sweep: test
witnesses, small cleanups and a tested reference-page builder (slices
#968-#972).

Driven here, on the real tree:

  1. The two sparse count-digits boards rebuild their committed links byte for
     byte through the one shared `sparse_backend_code`, and neither builder
     keeps a backend encoder of its own (#968).
  2. Each copied behaviour has one home: the fixture-git scrub and the fixture
     `git` call live in gate_lib alone, the same-board pair check in
     count_test_kit alone, and dutch-flatmates has no `read_board` (#968, #970).
  3. The small cleanups hold: `frame.rect` has a docstring, `run_logged` takes
     `env`, ruff.toml has no stale "separate pass" line, and running-start's
     README says "pair component" (#970).
  4. The reference-page builder is maintained: tools/humanify holds it, the
     frozen docs/research/humanify-pedagogy/tools is gone, no tracked file
     outside docs/research/ and .audit-ignore.md names that old path, lint
     reads tools/, and the seam runs both of its tests (#971, #972).

The behaviour of the moved tools is the seam's own: tools/humanify's
build-ref.test.mjs (the public-only filter on a fixture reference, with its
residual guard) and verify.test.mjs (a rename that changes scoping or swaps a
global is refused) run beside this file, and item 4 checks they do.

WHAT A GREEN RUN DOES NOT COVER (this seam, `just check-full`, is blind to it):
  - the published reference page: `build-ref.mjs --public-only` on the real
    reference and the artifact opened from it. The closing check on #954 opens
    it once; the fixture test cannot show the real page reads right.
  - the app: how the rebuilt count-digits links solve in sudokumaker.app.

    uv run examples/_shared/spec_954_closing.test.py
"""

import inspect
import json
import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
EXAMPLES = HERE.parent
ROOT = EXAMPLES.parent
COUNT = EXAMPLES / "count-digits-gac"
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(COUNT))

import build_sparse_count_digits
import build_sparse_required_digits
import frame
import gate_lib

OLD_TOOLS = "humanify-pedagogy/tools"


def tracked():
    """Every tracked file, repo-relative; in a sandbox with no `.git`, every
    file in the tree."""
    r = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True)
    if r.returncode == 0 and r.stdout:
        return r.stdout.split()
    return [
        p.relative_to(ROOT).as_posix()
        for p in ROOT.rglob("*")
        if p.is_file() and ".git" not in p.parts and "node_modules" not in p.parts
    ]


def files_holding(needle, under=EXAMPLES, glob="*.py"):
    """The files under `under` that hold `needle`, this one left out: it names
    every needle it looks for."""
    me = pathlib.Path(__file__).resolve()
    return sorted(
        p.relative_to(ROOT).as_posix()
        for p in under.rglob(glob)
        if p.resolve() != me and needle in p.read_text(errors="replace")
    )


def sparse_links_rebuild():
    for builder in (build_sparse_count_digits, build_sparse_required_digits):
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp)
            builder.build(out)
            built = sorted(p.name for p in out.iterdir())
            assert built == ["PUZZLE_LINK.txt", "PUZZLE_LINK_original.txt"], built
            for name in built:
                assert (out / name).read_bytes() == (
                    builder.BOARD_DIR / name
                ).read_bytes(), f"{builder.__name__}: {name} does not reproduce"
        assert "def backend_code" not in inspect.getsource(builder), (
            f"{builder.__name__} keeps its own backend encoder"
        )
    required = (COUNT / "build_required_digits.py").read_text()
    assert "def _backend_code" not in required, "_backend_code is not inlined"


def one_home_each():
    scrub = files_holding('startswith("GIT_")')
    assert scrub == ["examples/_shared/gate_lib.py"], scrub
    for name in ("seam_runner.test.py", "spec_809_closing.test.py"):
        assert "def git(" not in (HERE / name).read_text(), (
            f"{name} keeps its own fixture git helper"
        )
    pair = files_holding("def check_same_board_pair")
    assert pair == ["examples/count-digits-gac/count_test_kit.py"], pair
    assert not files_holding("def check_sparse_pair"), "the old pair check remains"
    assert not files_holding("read_board", under=EXAMPLES / "dutch-flatmates"), (
        "dutch-flatmates still names read_board"
    )


def cleanups_hold():
    assert inspect.getdoc(frame.rect), "frame.rect has no docstring"
    params = inspect.signature(gate_lib.run_logged).parameters
    assert "env" in params and "extra" not in params, list(params)
    assert "separate pass" not in (ROOT / "ruff.toml").read_text(), (
        "ruff.toml keeps the stale separate-pass line"
    )
    readme = (EXAMPLES / "running-start/README.md").read_text()
    assert "opposite-pair" not in readme and "pair component" in readme, (
        "running-start's README still says opposite-pair component"
    )


def tools_are_maintained():
    tools = ROOT / "tools/humanify"
    for name in (
        "build-ref.mjs",
        "verify.mjs",
        "build-ref.test.mjs",
        "verify.test.mjs",
    ):
        assert (tools / name).is_file(), f"tools/humanify/{name} is missing"
    assert not (ROOT / "docs/research" / OLD_TOOLS).exists(), (
        "the old tools folder is still under docs/research"
    )
    stale = [
        f
        for f in tracked()
        if not f.startswith("docs/research/")
        and f not in (".audit-ignore.md", "examples/_shared/spec_954_closing.test.py")
        and (ROOT / f).is_file()
        and OLD_TOOLS in (ROOT / f).read_text(errors="replace")
    ]
    assert not stale, f"live files still name {OLD_TOOLS}: {stale}"
    ignored = json.loads((ROOT / "package.json").read_text())["standard"]["ignore"]
    assert not any(p.startswith("tools") for p in ignored), (
        f"lint ignores tools/: {ignored}"
    )
    listed = gate_lib.runner_listing()
    for test in ("build-ref.test.mjs", "verify.test.mjs"):
        assert f"node tools/humanify/{test}" in listed, (
            f"the seam does not run tools/humanify/{test}"
        )


if __name__ == "__main__":
    sparse_links_rebuild()
    one_home_each()
    cleanups_hold()
    tools_are_maintained()
    print("spec #954 closing check: ok")
