# uv owns the Python environment: every wired suite has these two in its
# sandbox, so a lockfile change reaches every one of them.
files(name="uvproject", sources=["pyproject.toml", "uv.lock"])

# What every wired suite runs under: the seam runner, Pants's configuration
# and the prelude that shapes a suite's target. Every suite declares it
# (tests/pants_prelude.py), so a change to one of these selects them all.
files(name="runner", sources=["pants.toml", "tests/all.sh", "tests/pants_prelude.py"])

# The one Markdown file code reads: examples/_shared/component_scan.py takes
# the built-in component list from it.
files(name="builtin-components", sources=["docs/builtin-components.md"])

# The whole repository, for a suite that reads the tree: one that scans every
# example, asks git for the tracked files, or reads other units' files by
# path. The `.git` entry is in it, since git answers from there.
files(name="tree", sources=["**"])
