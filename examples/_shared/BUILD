python_sources(
    name="py",
    sources=["*.py"],
    # Shared .js files read by path, which no import shows. Each is named: a
    # blanket `:js` here would put every shared .js under every suite whose
    # unit imports document.
    overrides={
        "document.py": {
            "dependencies": [
                # SHARED_BACKENDS, read in backend_code and component_code.
                # FRAME_ROWCOL and FRAME_CORNERS.
                "./frame-rowcol.js:js",
                "./frame-corners.js:js",
                # HOUSE_GAC.
                "./house-gac.js:js",
                "./HouseGacComponent.js:js",
                # GRID_ROWCOL, the no-ring lane's.
                "./grid-rowcol.js:js",
            ]
        },
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
# Each entry has a selector below (`excepted`), so a narrowed run selects it by
# what it reads like any suite; a test that scans a whole class of files names
# that class.

# The Chromium session and the verdict probe: the playwright package, the app
# session's code and the boards it opens.
excepted(
    "app-session.test.mjs",
    needs=[
        ":js",
        ":py",
        ":data",
        "examples/up-to-n/PUZZLE_LINK_9x9.txt:data",
        "examples/up-to-n/PUZZLE_LINK_4x4.txt:data",
        "examples/numbered-rooms/PUZZLE_LINK_clued.txt:data",
    ],
)
# Starts app-solve.mjs, and greps every script of the tree for the verdict phrases.
excepted("app-solve-lib.test.mjs", needs=[":js", ":py", ":data", "//:code"])
# Generates the bundle index with acorn and compares it with the committed one.
excepted("bundle-index.test.mjs", needs=[":js", ":data", ":vendor", "//:bundle-api-index"])
# Loads the bundle, and greps every .mjs and .js of the tree for a second splice.
excepted("bundle-load.test.mjs", needs=[":js", ":data", ":vendor", "//:code"])
# Reads every tracked file for a path into a gridfind checkout.
excepted("sudoku_kit_source.test.py", needs=["//:tree"])
# Copy the whole tree, and its node_modules, into a scratch repository.

# Imports only: Pants infers everything these read.
for file in [
    "app-dom.test.mjs",
    "backend-runner.test.mjs",
    "board.test.py",
    "board_checks.test.py",
    "bundle-behaviour.test.mjs",
    "carve.test.py",
    "component_scan.test.py",
    "document.test.py",
    "frame-geometry.test.mjs",
    "frame.test.py",
    "harness-lib.test.mjs",
    "harness-parity.test.mjs",
    "lanes.test.py",
    "manifest.test.py",
    "minify.test.py",
    "recovery-lib.test.mjs",
    "sm_document.test.py",
]:
    suite(file, needs=[":data"])

# Reads isofill's gen.json, the digit-string grid #989 ran into: the one file,
# by name.
suite("app-strip-lib.test.mjs", needs=[":data", "examples/isofill/gen.json:data"])

# These read shared .js files by path; coarse on purpose (every shared .js).
for file in [
    "count_calls.test.py",
    "frame-corners.test.mjs",
    "frame-lines.test.mjs",
    "frame-rowcol.test.mjs",
    "grid-rowcol.test.mjs",
    "grid_to_link.test.py",
    "dominator.test.mjs",
    "house-gac.test.mjs",
    "line-kind.test.mjs",
    "stamp.test.mjs",
]:
    suite(file, needs=[":data", ":js"])

# Runs dominator.js in node and reads fillomino's generate.py, the CP-SAT model's edges.
suite(
    "dominator_neighbours_model.test.py",
    needs=[":data", ":js", "examples/fillomino/generate.py:py"],
)

# Starts grid_to_link.py as a subprocess, and runs the solver bundle.
suite("hard-sweep-lib.test.mjs", needs=[":data", ":js", "./grid_to_link.py:py"])

# Starts grid_to_link.py, bundle-solve.mjs and hard-sweep.mjs as subprocesses.
suite("spec_427_closing.test.mjs", needs=[":data", ":js", "./grid_to_link.py:py"])

# Starts include_agreement.py as a subprocess, and reads shared .js by path.
suite("include.test.mjs", needs=[":data", ":js", "./include_agreement.py:py"])

# Reads only the pre-commit config.
suite("precommit_layout_hook.test.py", needs=["//:precommit-config"])

# These read the tree: they scan every example.
for file in [
    "check_layout.py",
    "check_layout.test.py",
    "check_research_loads.py",
    "check_research_loads.test.py",
    "global-backends.test.mjs",
    "manifest_spec.test.py",
    "size_builders.test.py",
    # refresh_links copies the examples tree and docs/builtin-components.md, and
    # runs every example's build_link.py --refresh and check_layout.py on the copy.
    "refresh_links.test.py",
    "shipped_components.test.py",
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
    "searchable_link.test.py",
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

# Row building, verdicts and rep aggregation, with the browser call faked.
suite("app_timing.test.py")

# Row building and argument handling for `just time-link`; the browser call is
# faked.
suite("time_link.test.py")

# Reads the justfile through `just --dump`.
suite("just_list.test.py", needs=["//:justfile"], tools=["just"])
# What `bash tests/all.sh` calls by name; a sandbox's PATH holds these and
# nothing else.
RUNNER_TOOLS = ["bash", "dirname", "awk", "cut", "mkdir"]

# Each starts the real Pants, `bash tests/all.sh` or `just`, from the sandbox's
# root, so they need `pants`, `just` and what the runner calls by name on the
# PATH. The sandbox's PATH holds the tools named here and nothing else, and a
# missing one does not always fail the suite: it can change what the runner
# prints. `pants.toml` ignores `/_binary_shims_*`, the links the outer Pants
# keeps in that root. Not `env`: its shim runs `~/.local/bin/env`, which is
# no program.
# known_edges.test.py also names the files its edges start from.
KNOWN_EDGE_FILES = [
    "examples/_shared/line-kind.js:js",
    "examples/_shared/document.py:py",
    "examples/up-to-n/PUZZLE_LINK_4x4.txt:data",
    "examples/outside-sudoku/PUZZLE_LINK.txt:data",
    "examples/outside-sudoku/gen.json:data",
]
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
        # They read the whole tree to run; the gate's files decide whether one
        # runs on a narrowed run (//:gate).
        selected_by=[
            "//:gate",
            "//:uvproject",
            *(KNOWN_EDGE_FILES if file == "known_edges.test.py" else []),
        ],
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
