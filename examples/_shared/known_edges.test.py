# The known edges: reads across files that a narrowed run of the seam
# (`tests/all.sh --changed <base>`) must keep seeing. Each names one file of
# the real tree, suites a change to it must select and suites it must not.
# The runner selects a wired suite when Pants lists it among the file's
# dependents, so this asks Pants for exactly that, once, and commits nothing.
# An edge that stops resolving fails here by name: a narrowed run would have
# skipped the suite in silence.
#
#   uv run examples/_shared/known_edges.test.py

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

from gate_lib import pants, pants_suites

# (file, why it is read, suites it must reach, suites it must not reach)
KNOWN_EDGES = [
    (
        "examples/_shared/line-kind.js",
        "UpToNComponent.js pulls it in by `// #include`, which no import shows",
        ["node examples/up-to-n/update-strength.test.mjs"],
        ["node examples/outside-sudoku/update-strength.test.mjs"],
    ),
    (
        "examples/_shared/no_ring.py",
        "house-gac's build_link.py imports it",
        ["uv run examples/house-gac/build_link.test.py"],
        ["uv run examples/count-digits-gac/build_required_digits.test.py"],
    ),
    (
        "examples/up-to-n/PUZZLE_LINK_4x4.txt",
        "a unit's fixture is an input of that unit's suites",
        [
            "uv run examples/up-to-n/build_link.test.py",
            "node examples/up-to-n/end-to-end.test.mjs",
            "node examples/up-to-n/marker-contract.test.mjs",
            "node examples/up-to-n/update-strength.test.mjs",
            "node examples/up-to-n/soundness-harness.mjs",
        ],
        ["uv run examples/skyscraper/build_link.test.py"],
    ),
    (
        "examples/outside-sudoku/PUZZLE_LINK.txt",
        "count-digits-gac's build_required_digits.py builds its link from it",
        ["uv run examples/count-digits-gac/build_required_digits.test.py"],
        ["uv run examples/up-to-n/build_link.test.py"],
    ),
    (
        "examples/outside-sudoku/gen.json",
        "the one file of outside-sudoku that count-digits-gac reads is its link",
        ["uv run examples/outside-sudoku/build_link.test.py"],
        ["uv run examples/count-digits-gac/build_required_digits.test.py"],
    ),
    (
        ".gitignore",
        "Pants leaves a file it names out of every sandbox, a suite's fixture included",
        [
            "node examples/up-to-n/update-strength.test.mjs",
            "uv run examples/fillomino/build_link.test.py",
            "uv run examples/_shared/frame.test.py",
        ],
        [],
    ),
]


def reached():
    """file -> the suites Pants lists among its dependents, at any distance.
    A file more than one target owns is in the answer once per owner."""
    files = [edge[0] for edge in KNOWN_EDGES]
    r = pants("dependents", "--transitive", "--format=json", *files)
    assert r.returncode == 0, f"pants dependents failed:\n{r.stderr}"
    suites = pants_suites()
    found = {file: set() for file in files}
    for owner, dependents in json.loads(r.stdout).items():
        file = owner.lstrip("/").split(":")[0]
        assert file in found, f"Pants answered for {owner}, which nobody asked about"
        found[file] |= {suites[a] for a in dependents if a in suites}
    return found


if __name__ == "__main__":
    found = reached()
    known = set(pants_suites().values())
    for file, why, must, must_not in KNOWN_EDGES:
        for suite in must + must_not:
            assert suite in known, f"{suite} is not a suite wired into Pants"
        for suite in must:
            assert suite in found[file], (
                f"edge lost: a change to {file} no longer selects {suite} ({why})"
            )
        for suite in must_not:
            assert suite not in found[file], (
                f"a change to {file} now selects {suite}, which does not read it"
            )
    print(f"known_edges.test.py: {len(KNOWN_EDGES)} edges: ok")
