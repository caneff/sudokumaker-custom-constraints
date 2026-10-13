# The two gate tiers: `just check` is the fast loop, `just check-full`
# is everything and runs on every pull request. Both reach their suites
# through the seam runner, `tests/all.sh`. This runs both recipes with
# node, npx, uv and uvx replaced by stubs that log their argv and exit 0, then
# checks what each tier would have run against the files on disk:
#
#   - check-full runs every *.test.mjs, *.test.py and soundness-harness.mjs
#     under examples/, lint, and the two plain scripts the gate runs, so a new
#     or renamed test cannot drop out of both tiers -- and it runs nothing
#     else: a suite or a lint step for a directory outside examples/ fails
#     here, and so does a file `just fmt` rewrites outside it;
#   - the research .test.mjs files are run by hand, and BY_HAND names them: a
#     new one fails here until it is wired into a recipe or added to BY_HAND;
#   - what check-full adds over check is exactly the heavy tests HEAVY names
#     and the soundness harnesses -- nothing heavy runs in check, and
#     nothing light is moved out of it;
#   - every command check runs, check-full runs too;
#   - lint runs `uv lock --check`, which fails when uv.lock no longer matches
#     pyproject.toml;
#   - no Python step passes --with, so every call uses the one synced project
#     environment and nothing resolves per call;
#   - the seam runner (`tests/all.sh`), which the recipes call and a worker
#     runs narrowed, reaches exactly the suites check-full reaches, on the real
#     tree and on a scratch tree with a new example planted;
#   - every test file is run by exactly one mechanism: the runner's own loop,
#     or Pants in its sandbox for a suite Pants has a test target for. A file
#     run by both, or by neither, fails here.
#   - every test file is run through Pants, or is on the exception list
#     (tests/sandbox-exceptions.txt) with its reason: a test file in neither
#     or in both fails here, and so does an entry with no reason or one that
#     names no test file of the seam. A narrowed run (`tests/all.sh
#     --changed`) leaves every selection to Pants and runs the excepted tests
#     always, so a test file in neither would be one nothing selects for a
#     reason.
#
#   uv run examples/_shared/gate.test.py

import pathlib
import shutil
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from gate_lib import (
    EXCEPTIONS,
    by_mechanism,
    commands,
    gate_tree,
    pants_suites,
    run_logged,
    runner_listing,
    sandbox_exceptions,
)

# The heavy tier, named file by file: `just test` skips exactly these by path.
HEAVY = {
    "uv run examples/fillomino/pipeline.test.py",
    "uv run examples/fillomino/generate.test.py",
    "node examples/skyscraper/recovery-probe.test.mjs",
    "node examples/hit-counts/recovery-probe.test.mjs",
}

# Research tests run by hand, after touching what they cover.
BY_HAND = {
    "docs/research/required-digits-gac/required-digits-wrapper.test.mjs",
}

LINT = {
    "npx standard",
    "uvx ruff check examples",
    "uvx ruff format --check examples",
    "uv lock --check",
}

SCRIPTS = {
    "uv run examples/_shared/check_layout.py",
    "uv run examples/skyscraper/verify.py",
}

# Everything `just fmt` rewrites: the Node code and the Python under examples/.
FMT = [
    "npx standard --fix",
    "uvx ruff check --fix examples",
    "uvx ruff format examples",
]


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
    return want


def research_tests():
    """Every research .test.mjs on disk, as a repo-relative path."""
    return {
        f.relative_to(ROOT).as_posix() for f in ROOT.glob("docs/research/**/*.test.mjs")
    }


def planted_example_is_run():
    """A planted example's tests and harness must be reached by check-full and
    by the runner alike, and a test file planted outside examples/ by
    neither: the gate's suites all live under examples/."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = gate_tree(tmp)
        example = tree / "examples/zz_new"
        example.mkdir(parents=True)
        for name in ("zz.test.mjs", "zz.test.py", "soundness-harness.mjs"):
            (example / name).touch()
        outside = tree / "zz_outside/deep"
        outside.mkdir(parents=True)
        for name in ("test_planted.py", "zz.test.py", "zz.test.mjs"):
            (outside / name).touch()
            (outside.parent / name).touch()
        demanded = on_disk(tree)
        assert "node examples/zz_new/soundness-harness.mjs" in demanded, demanded
        both_reach(demanded, root=tree)
        strays = [c for c in commands("check-full", root=tree) if "zz_outside" in c]
        assert not strays, f"check-full runs a test outside examples/: {strays}"


def both_reach(demanded, root=ROOT):
    """`just check-full` and `tests/all.sh` reach the same suites, and every
    demanded one: a test file one of them runs and the other does not is a
    suite a worker's run and the gate disagree about."""
    full = set(commands("check-full", root=root))
    runner = set(runner_listing(root=root))
    assert demanded <= runner, f"tests/all.sh does not run: {sorted(demanded - runner)}"
    assert full == runner, (
        f"check-full only: {sorted(full - runner)}; "
        f"tests/all.sh only: {sorted(runner - full)}"
    )


def one_mechanism_per_file():
    """A whole run sends every suite Pants has a test target for through
    Pants and no other, and runs every test file once: a wired suite the loop
    also runs is run by both, and one neither reaches is run by nothing."""
    r, log = run_logged(["bash", "tests/all.sh"])
    assert r.returncode == 0, f"a stubbed full run failed:\n{r.stdout}{r.stderr}"
    loop, pants = by_mechanism(log)
    wired = set(pants_suites().values())
    assert "uv run examples/up-to-n/build_link.test.py" in wired, (
        f"Pants has no test target for the up-to-n suites: {sorted(wired)}"
    )
    both = sorted(set(loop) & (set(pants) | wired))
    assert not both, f"run by the loop and wired into Pants: {both}"
    assert sorted(pants) == sorted(wired), (
        f"Pants targets the runner does not run: {sorted(wired - set(pants))}; "
        f"run through Pants twice or with no target: "
        f"{sorted(c for c in pants if pants.count(c) > 1 or c not in wired)}"
    )
    for suite in sorted(on_disk()):
        n = (loop + pants).count(suite)
        assert n == 1, f"{suite} is run {n} times, not once"
    return len(pants)


def test_files_are_wired_or_excepted(root=ROOT):
    """Every test file of the seam under `root` is wired into Pants or named
    on the exception list, never both, and the list names nothing else."""
    excepted = sandbox_exceptions(root)
    wired = set(pants_suites(root).values())
    suites = {c for c in runner_listing(root=root) if c not in LINT}
    for suite in sorted(suites):
        file = suite.split()[-1]
        assert (suite in wired) != (file in excepted), (
            f"{suite} is "
            + ("wired into Pants and" if suite in wired else "neither wired nor")
            + f" on {EXCEPTIONS}"
        )
    stale = sorted(set(excepted) - {c.split()[-1] for c in suites})
    assert not stale, f"{EXCEPTIONS} names what is no test file of the seam: {stale}"
    return len(excepted)


def an_exception_needs_a_reason():
    """An entry of the exception list with no reason is refused."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = gate_tree(tmp)
        for entry, ok in (
            ("examples/_shared/x.test.py", False),
            ("examples/_shared/x.test.py   ", False),
            ("examples/_shared/x.test.py it printed `no such file`", True),
        ):
            (tree / EXCEPTIONS).write_text(f"# a comment\n\n{entry}\n")
            try:
                sandbox_exceptions(tree)
                refused = False
            except AssertionError as e:
                refused = "has no reason" in str(e)
            assert refused != ok, f"exception entry {entry!r}: refused={refused}"


def a_test_file_in_neither_is_refused():
    """On a scratch tree with one suite wired: a test file with no Pants
    target and no entry on the exception list fails the check by name, the
    entry passes it, and an entry for the wired suite fails it too."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = gate_tree(tmp)
        shutil.copy(ROOT / "pants.toml", tree / "pants.toml")
        files = {
            "pyproject.toml": "",
            "uv.lock": "",
            "BUILD": (
                'files(name="uvproject", sources=["pyproject.toml", "uv.lock"])\n'
                'files(name="runner", sources=["pants.toml", "tests/all.sh", '
                '"tests/pants_prelude.py"])\n'
            ),
            "examples/aa/BUILD": (
                'javascript_sources(name="js", sources=["*.mjs"])\n'
                'suite("wired.test.mjs")\n'
            ),
            "examples/aa/wired.test.mjs": "",
            "examples/aa/planted.test.mjs": "",
        }
        for rel, text in files.items():
            (tree / rel).parent.mkdir(parents=True, exist_ok=True)
            (tree / rel).write_text(text)
        wired, planted = "examples/aa/wired.test.mjs", "examples/aa/planted.test.mjs"
        # The suites the runner names by path are in every tree's seam.
        named = [
            c.split()[-1]
            for c in runner_listing(root=tree)
            if c not in LINT and "examples/aa/" not in c
        ]
        for extra, want in (
            ([], f"node {planted} is neither wired nor on {EXCEPTIONS}"),
            ([planted], None),
            ([planted, wired], f"node {wired} is wired into Pants and on {EXCEPTIONS}"),
        ):
            (tree / EXCEPTIONS).write_text(
                "".join(f"{file} a reason\n" for file in named + extra)
            )
            try:
                test_files_are_wired_or_excepted(tree)
                said = None
            except AssertionError as e:
                said = str(e)
            assert said == want, f"with {extra} excepted the check said: {said}"


if __name__ == "__main__":
    full = commands("check-full")
    fast = commands("check")

    with_flags = [c for c in full if "--with" in c]
    assert not with_flags, f"steps resolve their own environment: {with_flags}"

    assert research_tests() == BY_HAND, (
        f"research tests on disk {sorted(research_tests())} are not the by-hand "
        f"allowlist {sorted(BY_HAND)}: wire a new one into a recipe or list it"
    )

    planted_example_is_run()

    fmt = commands("fmt")
    assert fmt == FMT, f"just fmt runs {fmt}, not {FMT}"

    missing = (on_disk() | LINT | SCRIPTS) - set(full)
    assert not missing, f"check-full does not run: {sorted(missing)}"
    extra = set(full) - (on_disk() | LINT | SCRIPTS)
    assert not extra, (
        f"check-full runs what is neither a test under examples/, a lint step "
        f"nor a listed script: {sorted(extra)}"
    )
    both_reach(on_disk() | LINT | SCRIPTS)

    harnesses = {c for c in on_disk() if c.endswith("soundness-harness.mjs")}
    added = set(full) - set(fast)
    assert added == HEAVY | harnesses, (
        f"check-full adds {sorted(added)}, not the heavy tests and harnesses"
    )

    only_fast = set(fast) - set(full)
    assert not only_fast, f"check runs steps check-full skips: {sorted(only_fast)}"

    wired = one_mechanism_per_file()
    an_exception_needs_a_reason()
    a_test_file_in_neither_is_refused()
    excepted = test_files_are_wired_or_excepted()

    print(
        f"gate.test.py: check {len(fast)} steps, check-full {len(full)} steps, "
        f"{wired} through Pants, {excepted} excepted from its sandbox: ok"
    )
