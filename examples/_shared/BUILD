python_sources(
    name="py",
    sources=["*.py"],
    # Shared .js files read by path, which no import shows. Each is named: a
    # blanket `:js` here would put every shared .js under every suite whose
    # unit imports framebuild.
    overrides={
        "framebuild.py": {
            "dependencies": [
                # FRAME_BACKENDS, read in frame_backend_code.
                "./frame-rowcol.js:js",
                "./frame-corners.js:js",
                # house_gac_backend_code.
                "./house-gac.js:js",
                "./HouseGacComponent.js:js",
            ]
        },
        # GRID_BACKEND, read in grid_backend_constraint.
        "no_ring.py": {"dependencies": ["./grid-rowcol.js:js"]},
        "component_scan.py": {"dependencies": ["//:builtin-components"]},
    },
)
javascript_sources(
    name="js",
    sources=["*.mjs", "*.js"],
    # Edges no import shows: a file read, or a script started as a subprocess.
    overrides={
        "bundle-solve-lib.mjs": {"dependencies": ["./link_codec_cli.py:py"]},
        "bundle-load.mjs": {"dependencies": [":vendor"]},
        # `// #include ../_shared/bit-helpers.js`.
        "HouseGacComponent.js": {"dependencies": ["./bit-helpers.js:js"]},
    },
)
files(name="vendor", sources=["vendor/*"])
# The directory's non-code files: inputs of every shared suite.
files(name="data", sources=["*.toml", "*.har"])

# A shared test not wired here is on tests/sandbox-exceptions.txt, with what
# the sandbox said; gate.test.py fails on one that is in neither or in both.

# Imports only: Pants infers everything these read.
for file in [
    "app-strip-lib.test.mjs",
    "board_checks.test.py",
    "bundle-behaviour.test.mjs",
    "component_scan.test.py",
    "frame-geometry.test.mjs",
    "frame.test.py",
    "framebuild.test.py",
    "harness-lib.test.mjs",
    "harness-parity.test.mjs",
    "manifest.test.py",
    "minify.test.py",
    "recovery-lib.test.mjs",
    "sm_document.test.py",
]:
    suite(file, needs=[":data"])

# These read shared .js files by path; coarse on purpose (every shared .js).
for file in [
    "count_calls.test.py",
    "frame-corners.test.mjs",
    "frame-lines.test.mjs",
    "frame-rowcol.test.mjs",
    "grid-rowcol.test.mjs",
    "house-gac.test.mjs",
    "line-kind.test.mjs",
]:
    suite(file, needs=[":data", ":js"])

# Starts include_agreement.py as a subprocess, and reads shared .js by path.
suite("include.test.mjs", needs=[":data", ":js", "./include_agreement.py:py"])

# These read the tree: they scan every example.
for file in [
    "check_layout.py",
    "check_layout.test.py",
    "global-backends.test.mjs",
    "size_builders.test.py",
]:
    suite(file, needs=["//:tree"])

# Not here: bundle-load.test.mjs (`git grep`) and sudoku_kit_source.test.py
# (`git ls-files`) ask git for the tracked files, and //:tree holds no .git.
# Both are on tests/sandbox-exceptions.txt.

# The whole-grid mains: the two backends each assembles, read by path.
for file in ["whole-grid-backends.test.mjs", "whole-grid-mains.test.mjs"]:
    suite(
        file,
        needs=[
            "examples/isofill/main.js:js",
            "examples/fillomino/main.js:js",
        ],
    )

# Rewrites a skyscraper and an isofill board, which it reads by path.
suite(
    "probe_link.test.py",
    needs=[
        "examples/skyscraper/PUZZLE_LINK_6x6.txt:data",
        "examples/isofill/PUZZLE_LINK.txt:data",
    ],
)

# Swaps components into shipped boards, and starts each example's build_link.py
# as a subprocess to see what it refuses. A path it only names in argv, which
# the refusal comes before anything opens (an isofill component, `gen_24g.json`,
# a `main.js`), is not declared.
suite(
    "link_swap.test.py",
    needs=[
        "examples/skyscraper/PUZZLE_LINK.txt:data",
        "examples/hit-counts/PUZZLE_LINK.txt:data",
        "examples/hit-counts/HitCountsPairComponent.js:js",
        "examples/numbered-rooms/PUZZLE_LINK_local.txt:data",
        "examples/numbered-rooms/NumberedRoomsComponent.js:js",
        "examples/isofill/build_link.py:py",
        "examples/fillomino/build_link.py:py",
        "examples/numbered-rooms/build_link.py:py",
        "examples/running-start/build_link.py:py",
        "examples/house-gac/build_link.py:py",
        "examples/house-gac/main.js:js",
        "examples/house-gac/PUZZLE_LINK.txt:data",
        "examples/house-gac/base/PUZZLE_LINK.txt:../data",
        # Each build_link.py reads its manifest.
        "examples/isofill/example.toml:data",
        "examples/fillomino/example.toml:data",
        "examples/numbered-rooms/example.toml:data",
        "examples/running-start/example.toml:data",
        "examples/house-gac/example.toml:data",
    ],
)

# Solves two shipped boards in the app's bundle, which it reads by path.
suite(
    "bundle-solve.test.mjs",
    needs=[
        "examples/house-gac/base/PUZZLE_LINK.txt:../data",
        "examples/numbered-rooms/PUZZLE_LINK_clued.txt:data",
    ],
)

# Scans every example for its timed component, and builds a git repository of
# its own in a temporary directory.
suite("time_example.test.py", needs=["//:tree"], tools=["git"])

# Reads the justfile through `just --dump`.
suite("just_list.test.py", needs=["//:justfile"], tools=["just"])
# What `bash tests/all.sh` calls by name; a sandbox's PATH holds these and
# nothing else.
RUNNER_TOOLS = ["bash", "dirname", "awk", "cut"]
# Lists the seam through `bash tests/all.sh --list`, which starts these.
suite(
    "spec_748_closing.test.py",
    needs=["//:tree"],
    tools=RUNNER_TOOLS,
)

# Each starts the real Pants, `bash tests/all.sh` or `just`, from the sandbox's
# root, so they need `pants`, `just` and what the runner calls by name on the
# PATH. The sandbox's PATH holds the tools named here and nothing else, and a
# missing one does not always fail the suite: it can change what the runner
# prints. `pants.toml` ignores `/_binary_shims_*`, the links the outer Pants
# keeps in that root. Not `env`: its shim runs `~/.local/bin/env`, which is
# no program.
for file in [
    "ci_workflow.test.py",
    "gate.test.py",
    "known_edges.test.py",
    "recipe_discovery.test.py",
    "seam_runner.test.py",
]:
    suite(
        file,
        needs=["//:tree"],
        tools=[
            *RUNNER_TOOLS,
            "pants",
            "just",
            "sh",
            "git",
            "cat",
            "mktemp",
            "rm",
            "sort",
            "grep",
            "basename",
            "readlink",
        ],
    )
