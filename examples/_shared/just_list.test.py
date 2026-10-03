# `just --list` prints each recipe's doc line, and that line is all a reader
# sees there. A recipe whose doc is missing, or is the tail of a longer comment
# ("commit.", "invariant. Discovered by file name..."), fails here: give it a
# `[doc("...")]` attribute holding one sentence that starts with a capital.
#
#   uv run examples/_shared/just_list.test.py

import json
import os
import pathlib
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIN_DOC = 20

if __name__ == "__main__":
    just = os.environ.get("JUST") or shutil.which("just")
    assert just, "no just executable: set JUST or put just on PATH"
    r = subprocess.run(
        [just, "--justfile", str(ROOT / "justfile"), "--dump", "--dump-format", "json"],
        capture_output=True,
        text=True,
        check=True,
    )
    bad = []
    for name, recipe in json.loads(r.stdout)["recipes"].items():
        if recipe["private"]:
            continue
        doc = recipe["doc"] or ""
        if len(doc) < MIN_DOC or not doc[0].isupper():
            bad.append(f"{name}: {doc!r}")
    assert not bad, "recipes with no useful `just --list` line:\n  " + "\n  ".join(bad)
    print("just_list.test.py: ok")
