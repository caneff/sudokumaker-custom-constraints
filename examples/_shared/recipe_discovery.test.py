# Two recipes find their files by glob, not by a hand-kept list:
#
#   - `just test` runs every examples/_shared/*.test.mjs and *.test.py;
#   - `just verify-isofill` proves every examples/isofill/gen*.json.
#
# A hand-kept list lets a new file go unrun. So each recipe runs against a
# copy of the justfile in a scratch tree holding a file no list could name,
# and must pick it up; verify-isofill must also name every gen file in the
# real tree.
#
# The glob stops at examples/: `just test` runs no test file planted outside
# it. And the justfile holds no recipe the gate does not reach except the ones
# BY_HAND names, so a recipe added for another directory's tests fails here
# until it is wired into check-full or listed.
#
#   uv run examples/_shared/recipe_discovery.test.py

import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from gate_lib import commands, gate_tree

# Recipes `just check-full` does not reach, each run by hand.
BY_HAND = {"fmt", "time", "verify-isofill", "verify-skyscraper"}


def recipes():
    """{recipe: the recipes it depends on}, read from the justfile."""
    just = os.environ.get("JUST") or shutil.which("just")
    assert just, "no just executable: set JUST or put just on PATH"
    r = subprocess.run(
        [just, "--justfile", str(ROOT / "justfile"), "--dump", "--dump-format", "json"],
        capture_output=True,
        text=True,
        check=True,
    )
    return {
        name: [dep["recipe"] for dep in recipe["dependencies"]]
        for name, recipe in json.loads(r.stdout)["recipes"].items()
    }


def every_recipe_is_gated_or_by_hand():
    """Each recipe is one `just check-full` runs, itself or through its
    dependencies, or one BY_HAND names."""
    needs = recipes()
    gated, todo = set(), ["check-full"]
    while todo:
        name = todo.pop()
        if name not in gated:
            gated.add(name)
            todo += needs[name]
    assert not gated & BY_HAND, f"BY_HAND names gated recipes: {gated & BY_HAND}"
    assert set(needs) == gated | BY_HAND, (
        f"recipes neither reached by check-full nor in BY_HAND: "
        f"{sorted(set(needs) - gated - BY_HAND)}; "
        f"BY_HAND names no recipe: {sorted(BY_HAND - set(needs))}"
    )


if __name__ == "__main__":
    every_recipe_is_gated_or_by_hand()

    gens = sorted(ROOT.glob("examples/isofill/gen*.json"))
    assert gens, "no isofill gen files found"
    ran = commands("verify-isofill")
    unproved = [
        g.name
        for g in gens
        if f"uv run examples/isofill/verify.py {g.relative_to(ROOT).as_posix()}"
        not in ran
    ]
    assert not unproved, f"verify-isofill does not prove {unproved}"

    with tempfile.TemporaryDirectory() as tmp:
        tree = gate_tree(tmp)
        (tree / "examples/_shared").mkdir(parents=True)
        (tree / "examples/isofill").mkdir(parents=True)
        (tree / "zz_outside/deep").mkdir(parents=True)
        (tree / "zz_outside/test_new.py").touch()
        (tree / "zz_outside/deep/test_deeper.py").touch()
        for name in (
            "_shared/zz_new.test.mjs",
            "_shared/zz_new.test.py",
            "isofill/gen_new.json",
        ):
            (tree / "examples" / name).touch()

        ran = commands("test", root=tree)
        for want in (
            "node examples/_shared/zz_new.test.mjs",
            "uv run examples/_shared/zz_new.test.py",
        ):
            assert want in ran, f"just test does not run a new shared test: {want}"

        strays = [c for c in ran if "zz_outside" in c]
        assert not strays, f"just test runs a test outside examples/: {strays}"

        ran = commands("verify-isofill", root=tree)
        want = "uv run examples/isofill/verify.py examples/isofill/gen_new.json"
        assert want in ran, "verify-isofill does not prove a new gen file"

    print("recipe_discovery.test.py: ok")
