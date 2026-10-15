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
# And the justfile holds no recipe the gate does not reach except the ones
# UNGATED names, so a recipe added for another directory's tests fails here
# until it is wired into check-full or listed. (gate.test.py checks that
# nothing planted outside examples/ is run.)
#
#   uv run examples/_shared/recipe_discovery.test.py

import json
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from gate_lib import commands, gate_tree, just_executable

# Recipes `just check-full` does not reach, each run by hand.
UNGATED = {"fmt", "time", "time-link", "verify-isofill", "verify-skyscraper"}


def recipes():
    """{recipe: the recipes it depends on}, read from the justfile."""
    r = subprocess.run(
        [
            just_executable(),
            "--justfile",
            str(ROOT / "justfile"),
            "--dump",
            "--dump-format",
            "json",
        ],
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
    dependencies, or one UNGATED names."""
    needs = recipes()
    gated, todo = set(), ["check-full"]
    while todo:
        name = todo.pop()
        if name not in gated:
            gated.add(name)
            todo += needs[name]
    assert not gated & UNGATED, f"UNGATED names gated recipes: {gated & UNGATED}"
    assert set(needs) == gated | UNGATED, (
        f"recipes neither reached by check-full nor in UNGATED: "
        f"{sorted(set(needs) - gated - UNGATED)}; "
        f"UNGATED names no recipe: {sorted(UNGATED - set(needs))}"
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

        ran = commands("verify-isofill", root=tree)
        want = "uv run examples/isofill/verify.py examples/isofill/gen_new.json"
        assert want in ran, "verify-isofill does not prove a new gen file"

    print("recipe_discovery.test.py: ok")
