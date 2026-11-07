# An example's `example.toml` and its `build_size.py` Spec are two records the
# author writes by hand about the same board: which lanes it ships and what its
# rules text opens on. Nothing else ties them, so a flipped `rules_prefix` or a
# `lanes` that names a backend the Spec never builds passes every other suite.
# This test loads both for each of the seven `build_size.py` examples and fails
# when they disagree. Neither is derived from the other: both are inputs.
#
#   uv run examples/_shared/manifest_spec.test.py

import importlib.util
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
EXAMPLES = HERE.parent
sys.path.insert(0, str(HERE))

from lanes import RingGlobal, RingLocal, lane_kinds
from manifest import MANIFEST_NAME, load_manifest

# The manifest's `lanes` word for the set of lane backends a Spec ships.
LANES_BY_BACKENDS = {
    frozenset({"main.js", "main-global.js"}): "split",
    frozenset({"main.js"}): "single",
    frozenset({"main-global.js"}): "global",
}


def example_dirs():
    return sorted(p.parent for p in EXAMPLES.glob("*/build_size.py"))


def load_spec(example_dir):
    """The `SPEC` of `example_dir/build_size.py`, imported under a name of its
    own so seven `build_size` modules do not collide."""
    path = example_dir / "build_size.py"
    sys.path.insert(0, str(example_dir))
    try:
        name = f"build_size_{example_dir.name.replace('-', '_')}"
        spec = importlib.util.spec_from_file_location(name, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    finally:
        sys.path.remove(str(example_dir))
    return module.SPEC


def disagreements(example_dir, manifest=None):
    """One string per way the manifest and the Spec of `example_dir` disagree.
    `manifest` overrides the one on disk (a scratch copy)."""
    manifest = manifest or load_manifest(example_dir)
    spec = load_spec(example_dir)
    problems = []

    # A lane's backend file is what ships; `lane_kinds` says which lanes the
    # Spec's shape builds, and the files on disk say which of them exist.
    backends = frozenset(
        k.backend for k in lane_kinds(spec) if (example_dir / k.backend).is_file()
    )
    built = LANES_BY_BACKENDS.get(backends)
    if built != manifest.lanes:
        problems.append(
            f"{example_dir.name}: manifest lanes = {manifest.lanes!r}, "
            f"the Spec builds {sorted(backends)}"
        )

    # The opening the Spec's lanes write: "" is no sudoku sentence, a no-ring
    # lane writes the ringless one, any other ring lane the inner-grid one.
    kinds = lane_kinds(spec)
    if spec.rules_prefix == "":
        opens = "none"
    elif not any(k in kinds for k in (RingGlobal, RingLocal)):
        opens = "ringless"
    else:
        opens = "inner-grid"
    if opens != manifest.rules_prefix:
        problems.append(
            f"{example_dir.name}: manifest rules_prefix = "
            f"{manifest.rules_prefix!r}, the Spec's lanes write {opens!r}"
        )
    return problems


def flipped_copy(example_dir, old, new):
    """A scratch copy of `example_dir`'s manifest with `old` replaced by `new`,
    loaded as a Manifest. The checked-in file is never touched."""
    text = (example_dir / MANIFEST_NAME).read_text()
    assert old in text, f"{example_dir.name}: {old!r} is not in its manifest"
    with tempfile.TemporaryDirectory() as tmp:
        scratch = pathlib.Path(tmp)
        (scratch / MANIFEST_NAME).write_text(text.replace(old, new))
        return load_manifest(scratch)


if __name__ == "__main__":
    dirs = example_dirs()
    assert len(dirs) == 7, [d.name for d in dirs]

    problems = [p for d in dirs for p in disagreements(d)]
    assert not problems, "\n".join(problems)

    # The check can fail: flip one prefix and one lanes word by hand.
    skyscraper = EXAMPLES / "isofill-skyscraper"
    bad = disagreements(
        skyscraper,
        flipped_copy(
            skyscraper, 'rules_prefix = "none"', 'rules_prefix = "inner-grid"'
        ),
    )
    assert len(bad) == 1 and "rules_prefix" in bad[0], bad
    bad = disagreements(
        skyscraper, flipped_copy(skyscraper, 'lanes = "global"', 'lanes = "split"')
    )
    assert len(bad) == 1 and "lanes" in bad[0], bad
    print("ok")
