"""#879: a docs push to main runs check_layout.

check_layout's "nothing gated loads from docs/research" rule (#659) ran only
inside `just check`, so a docs commit that auto-shipped to main never met it.
The fix is a local hook in .pre-commit-config.yaml. This test reads that file
and holds the hook to what the incident needs:

  - it runs examples/_shared/check_layout.py with no argument (the no-arg run
    is the one that scans docs/research loads; see check_layout.main);
  - it fires on a push, the last step before main, as well as on a commit;
  - it fires whatever the diff touches, because the commit that broke main
    touched only docs/ and check_layout reads the whole tree: always_run, and
    no filename list handed to it.

WHAT A GREEN RUN DOES NOT COVER: that pre-commit is installed in a clone
(`uvx pre-commit install --hook-type pre-commit --hook-type pre-push`), and
that this box's commit-identity guard wrappers in .git/hooks coexist with it.
Those are per-clone state, not in the tree.

    uv run examples/_shared/precommit_layout_hook.test.py
"""

import pathlib
import re

CONFIG = pathlib.Path(__file__).resolve().parents[2] / ".pre-commit-config.yaml"


def hook_blocks(text):
    """Each `- id:` block of the config, as its own text."""
    return re.split(r"(?m)^(?=\s*- id: )", text)[1:]


def layout_hook(text):
    blocks = [b for b in hook_blocks(text) if "check_layout.py" in b]
    assert len(blocks) == 1, f"want one hook running check_layout.py, got {len(blocks)}"
    return blocks[0]


def field(block, name):
    m = re.search(rf"(?m)^\s*(?:- )?{name}:\s*(.+)$", block)
    return m.group(1).strip() if m else None


def main():
    block = layout_hook(CONFIG.read_text())

    entry = field(block, "entry")
    assert entry.endswith("examples/_shared/check_layout.py"), (
        f"entry must run check_layout.py with no argument, got: {entry}"
    )
    stages = field(block, "stages") or ""
    assert "pre-push" in stages and "pre-commit" in stages, (
        f"hook must run on pre-commit and pre-push, stages: {stages!r}"
    )
    assert field(block, "always_run") == "true", "a docs-only change must run it"
    assert field(block, "pass_filenames") == "false", "it reads the whole tree"
    print("precommit_layout_hook.test.py: ok")


main()
