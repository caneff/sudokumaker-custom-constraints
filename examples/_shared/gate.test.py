# The two gate tiers: `just check` is the fast loop, `just check-full`
# is everything and runs on every pull request. This runs both recipes with
# node, npx, uv and uvx replaced by stubs that log their argv and exit 0, then
# checks what each tier would have run against the files on disk:
#
#   - check-full runs every *.test.mjs, *.test.py and soundness-harness.mjs
#     under examples/, every test_*.py under finders/ (found by glob; the slow
#     ones are named in SLOW below and run by `just test-finders-slow`), lint,
#     and the two plain scripts the gate runs, so a new or renamed test cannot
#     drop out of both tiers;
#   - the research .test.mjs files are run by hand, and BY_HAND names them: a
#     new one fails here until it is wired into a recipe or added to BY_HAND;
#   - what check-full adds over check is exactly the heavy tests HEAVY names
#     and the soundness harnesses -- nothing heavy runs in check, and
#     nothing light is moved out of it;
#   - every command check runs, check-full runs too;
#   - lint runs `uv lock --check`, which fails when uv.lock no longer matches
#     pyproject.toml;
#   - no Python step passes --with, so every call uses the one synced project
#     environment and nothing resolves per call.
#
#   uv run examples/_shared/gate.test.py

import ast
import pathlib
import shutil
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from gate_lib import commands

# The heavy tier, named file by file: `just test` skips exactly these by path.
HEAVY = {
    "uv run examples/fillomino/pipeline.test.py",
    "uv run examples/fillomino/generate.test.py",
    "node examples/skyscraper/recovery-probe.test.mjs",
    "node examples/hit-counts/recovery-probe.test.mjs",
}

# Finder tests the gate leaves to `just test-finders-slow`, with the command
# that recipe must run for each.
SLOW = {
    "uv run finders/renbanana/tools/test_prove_two_stage_slow.py",
}

# Finder tests the gate runs with a flag or another runner, not a plain
# `uv run <file>`: the `--cover` subsets and the one pytest suite.
FINDER_COMMAND = {
    "finders/renbanana/tools/test_probe_circle_pattern_accepts_known_grids.py": (
        "uv run finders/renbanana/tools/test_probe_circle_pattern_accepts_known_grids.py --cover"
    ),
    "finders/renbanana/tools/test_probe_finds_known_grids.py": (
        "uv run finders/renbanana/tools/test_probe_finds_known_grids.py --cover"
    ),
    "finders/counting_shaded/test_counting_shaded.py": (
        "uv run pytest finders/counting_shaded/test_counting_shaded.py -q"
    ),
}

# Research tests run by hand, after touching what they cover.
BY_HAND = {
    "docs/research/required-digits-gac/required-digits-wrapper.test.mjs",
}

LINT = {
    "npx standard",
    "uvx ruff check examples",
    "uvx ruff check finders",
    "uvx ruff format --check examples",
    "uvx ruff format --check finders",
    "uv lock --check",
}

SCRIPTS = {
    "uv run examples/_shared/check_layout.py",
    "uv run examples/skyscraper/verify.py",
}


def finder_tests(root=ROOT):
    """Repo-relative paths of every finder test, as the recipe's bash glob sees
    them: dot-directories are skipped there, so they are skipped here."""
    return sorted(
        rel
        for rel in (
            p.relative_to(root).as_posix() for p in root.glob("finders/**/test_*.py")
        )
        if not any(part.startswith(".") for part in rel.split("/"))
    )


def on_disk(root=ROOT):
    """The command the gate must run for every test and harness file."""
    want = set()
    for pattern, runner in (
        ("*.test.mjs", "node"),
        ("*.test.py", "uv run"),
        ("soundness-harness.mjs", "node"),
    ):
        for f in root.glob(f"examples/*/{pattern}"):
            want.add(f"{runner} {f.relative_to(root).as_posix()}")
    for rel in finder_tests(root):
        want.add(FINDER_COMMAND.get(rel, f"uv run {rel}"))
    return want - SLOW


def research_tests():
    """Every research .test.mjs on disk, as a repo-relative path."""
    return {
        f.relative_to(ROOT).as_posix() for f in ROOT.glob("docs/research/**/*.test.mjs")
    }


def pytest_style_outside_list(root=ROOT):
    """Finder tests that define a top-level test_* function nothing in the file
    references and have no `__main__` guard to dispatch to it: pytest would
    collect it, but run as a plain script the file defines the test and exits 0
    without calling it."""
    pytest_files = {k for k, v in FINDER_COMMAND.items() if "pytest" in v}
    out = []
    for rel in finder_tests(root):
        if rel in pytest_files:
            continue
        tree = ast.parse((root / rel).read_text(encoding="utf-8"))
        used = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)}
        if "__main__" in {
            n.value for n in ast.walk(tree) if isinstance(n, ast.Constant)
        }:
            continue
        if any(
            isinstance(n, ast.FunctionDef)
            and n.name.startswith("test_")
            and n.name not in used
            for n in tree.body
        ):
            out.append(rel)
    return out


def planted_finder_test_is_run():
    """A finder test no list can name must appear in what `just test` runs, and
    in what on_disk() demands -- else the glob here has gone narrower than the
    recipe's, or the recipe's narrower than the tree."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = pathlib.Path(tmp)
        shutil.copy(ROOT / "justfile", tree / "justfile")
        planted = tree / "finders/zz_new/deep"
        planted.mkdir(parents=True)
        (planted / "test_planted.py").touch()
        hidden = tree / "finders/zz_new/.venv"
        hidden.mkdir()
        (hidden / "test_vendored.py").write_text("def test_x():\n    assert False\n")
        (tree / "finders/zz_new/test_pytest_style.py").write_text(
            "def test_x():\n    assert False\n"
        )
        demanded = on_disk(tree)
        assert demanded == {
            "uv run finders/zz_new/deep/test_planted.py",
            "uv run finders/zz_new/test_pytest_style.py",
        }, (
            f"on_disk() misses a planted finder test or reads a hidden one: {sorted(demanded)}"
        )
        assert pytest_style_outside_list(tree) == [
            "finders/zz_new/test_pytest_style.py"
        ], "an uncalled test_ function in an unlisted finder test is not flagged"
        ran = set(commands("test", root=tree))
        assert demanded <= ran, f"just test misses {sorted(demanded - ran)}"


if __name__ == "__main__":
    full = commands("check-full")
    fast = commands("check")

    with_flags = [c for c in full if "--with" in c]
    assert not with_flags, f"steps resolve their own environment: {with_flags}"

    assert research_tests() == BY_HAND, (
        f"research tests on disk {sorted(research_tests())} are not the by-hand "
        f"allowlist {sorted(BY_HAND)}: wire a new one into a recipe or list it"
    )

    stale = sorted(
        p
        for p in [s.removeprefix("uv run ") for s in SLOW] + list(FINDER_COMMAND)
        if not (ROOT / p).is_file()
    )
    assert not stale, f"exception lists name files that do not exist: {stale}"

    outside = pytest_style_outside_list()
    assert not outside, f"pytest suites the recipe would run as scripts: {outside}"

    planted_finder_test_is_run()

    slow = set(commands("test-finders-slow"))
    covers = {
        c.removesuffix(" --cover")
        for c in FINDER_COMMAND.values()
        if c.endswith(" --cover")
    }
    assert slow >= SLOW | covers, (
        f"test-finders-slow does not run {sorted((SLOW | covers) - slow)} in full"
    )
    assert not SLOW & set(full), (
        f"check-full runs a slow test: {sorted(SLOW & set(full))}"
    )

    missing = (on_disk() | LINT | SCRIPTS) - set(full)
    assert not missing, f"check-full does not run: {sorted(missing)}"

    harnesses = {c for c in on_disk() if c.endswith("soundness-harness.mjs")}
    added = set(full) - set(fast)
    assert added == HEAVY | harnesses, (
        f"check-full adds {sorted(added)}, not the heavy tests and harnesses"
    )

    only_fast = set(fast) - set(full)
    assert not only_fast, f"check runs steps check-full skips: {sorted(only_fast)}"

    print(f"gate.test.py: check {len(fast)} steps, check-full {len(full)} steps: ok")
