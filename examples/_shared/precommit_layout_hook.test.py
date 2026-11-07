"""#879: a docs-only change runs check_layout and check_research_loads, on
commit and on push.

The research-load rule (#659) is its own script, run with no argument, so each
hook must be exactly that command, fire on both stages whatever the diff
touches, and be the only hooks on the push stage. This test reads
.pre-commit-config.yaml and holds the hooks to that.

WHAT A GREEN RUN DOES NOT COVER: that pre-commit is installed in a clone, and
that it coexists with the commit-identity guard wrappers in .git/hooks. Those
are per-clone state, not in the tree (docs/testing-and-generation.md).

    uv run examples/_shared/precommit_layout_hook.test.py
"""

import pathlib
import re

CONFIG = pathlib.Path(__file__).resolve().parents[2] / ".pre-commit-config.yaml"
ENTRIES = (
    "uv run examples/_shared/check_layout.py",
    "uv run examples/_shared/check_research_loads.py",
)


def hook_blocks(text):
    """Each `- id:` block of the config, as its own text."""
    return re.split(r"(?m)^(?=\s*- id: )", text)[1:]


def field(block, name):
    """A hook field's value, its trailing YAML comment dropped."""
    m = re.search(rf"(?m)^\s*(?:- )?{name}:[ \t]*([^#\n]*)", block)
    return m.group(1).strip() if m else None


def stages(block):
    value = field(block, "stages") or ""
    assert value.startswith("[") and value.endswith("]"), f"stages: {value!r}"
    return {s.strip() for s in value[1:-1].split(",")}


def main():
    text = CONFIG.read_text()
    gate = []
    for entry in ENTRIES:
        script = entry.rsplit("/", 1)[1]
        blocks = [b for b in hook_blocks(text) if f" {entry}" in b]
        assert len(blocks) == 1, f"want one hook running {script}, got {len(blocks)}"
        block = blocks[0]
        gate.append(block)

        assert field(block, "entry") == entry, f"entry: {field(block, 'entry')!r}"
        assert field(block, "args") is None, "args would change the no-argument run"
        assert stages(block) == {"pre-commit", "pre-push"}, f"stages: {stages(block)}"
        assert field(block, "always_run") == "true", "a docs-only change must run it"
        assert field(block, "pass_filenames") == "false", "it reads the whole tree"

    # No other hook may reach the push stage: ruff --fix and the whitespace
    # fixers rewrite files, which fails a push.
    assert field(text, "default_stages") == "[pre-commit]", "default_stages"
    others = [b for b in hook_blocks(text) if b not in gate and field(b, "stages")]
    assert not others, "another hook sets its own stages"
    print("precommit_layout_hook.test.py: ok")


main()
