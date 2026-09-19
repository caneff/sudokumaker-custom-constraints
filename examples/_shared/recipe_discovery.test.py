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
#   uv run examples/_shared/recipe_discovery.test.py

import pathlib
import shutil
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from gate_lib import commands

if __name__ == "__main__":
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
        tree = pathlib.Path(tmp)
        shutil.copy(ROOT / "justfile", tree / "justfile")
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
