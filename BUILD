# uv owns the Python environment: every wired suite has these two in its
# sandbox, so a lockfile change reaches every one of them.
files(name="uvproject", sources=["pyproject.toml", "uv.lock"])

# What every wired suite runs under: the seam runner, Pants's configuration,
# the prelude that shapes a suite's target, and .gitignore, which Pants reads
# to leave files out of every sandbox. Every suite declares it
# (tests/pants_prelude.py), so a change to one of these selects them all.
files(
    name="runner",
    sources=[".gitignore", "pants.toml", "tests/all.sh", "tests/pants_prelude.py"],
)

# The one Markdown file code reads: examples/_shared/component_scan.py takes
# the built-in component list from it.
files(name="builtin-components", sources=["docs/builtin-components.md"])

# The hard-classic pass-1 record (#430): its corpora and sweep table, which
# examples/_shared/spec_427_closing.test.mjs reads.
files(name="hard-corpus-pass1", sources=["docs/research/sudoku-hard-corpus-pass1/*"])

# The whole repository but its `.git`, for a suite that scans every example.
# `.git` is a pointer file in a worktree and a whole directory (60 MB in the
# primary checkout) in a plain clone, copied into every sandbox and able to
# change under the snapshot when another session commits. A suite that asks git
# for the tracked files is on tests/sandbox-exceptions.txt and runs from the
# tree.
# The justfile, for the suite that reads only it.
files(name="justfile", sources=["justfile"])

files(name="tree", sources=["**", "!.git", "!.git/**"])
