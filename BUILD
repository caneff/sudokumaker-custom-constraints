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

# The npm packages a node suite resolves. pants.toml keeps node_modules out of
# every sandbox, so the suites on tests/sandbox-exceptions.txt that import one
# are selected by the manifest and the lockfile instead.
files(name="npm", sources=["package.json", "package-lock.json"])

# The gate's own files, which select the gate's own tests (the suites that
# start the real Pants or the seam runner on the whole tree): the justfile, CI,
# the runner's config and exception list, every BUILD file (a test file is wired
# there), the shipped isofill boards `just verify-isofill` must prove, a research
# test gate.test.py holds to its by-hand list, and the AGENTS.md that names the
# seam's commands. Those tests read the whole tree
# (`//:tree`) to run, but only these files decide what they check, so an edit to
# an example's code or data does not select them. A new test file with no BUILD
# entry has neither a target nor a selector, so a narrowed run runs it from the
# tree alone, and gate.test.py, which would name it, runs when a BUILD file
# changes or in the nightly check-full. known_edges.test.py is also selected by
# the example files its edges name; an edit to a file between them (an import
# that carries an edge) reaches it only in the nightly run.
files(
    name="gate",
    sources=[
        "AGENTS.md",
        "justfile",
        "pants.toml",
        ".github/workflows/*.yml",
        "tests/**",
        "**/BUILD",
        "examples/isofill/gen*.json",
        "docs/research/**/*.test.mjs",
    ],
)

# The generated bundle index, which examples/_shared/bundle-index.test.mjs
# regenerates and compares.
files(name="bundle-api-index", sources=["docs/bundle-api-index.md"])

# Every source file of the code, for a test that greps all of it.
files(name="code", sources=["**/*.py", "**/*.js", "**/*.mjs"])

# The one Markdown file code reads: examples/_shared/component_scan.py takes
# the built-in component list from it.
files(name="builtin-components", sources=["docs/builtin-components.md"])

# The whole repository but its `.git`, for a suite that scans every example.
# `.git` is a pointer file in a worktree and a whole directory (60 MB in the
# primary checkout) in a plain clone, copied into every sandbox and able to
# change under the snapshot when another session commits. A suite that asks git
# for the tracked files is on tests/sandbox-exceptions.txt and runs from the
# tree.
# The justfile, for the suite that reads only it.
files(name="justfile", sources=["justfile"])

# The pre-commit config, for the suite that reads only it.
files(name="precommit-config", sources=[".pre-commit-config.yaml"])

files(name="tree", sources=["**", "!.git", "!.git/**"])
