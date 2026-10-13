python_sources(
    name="py",
    sources=["*.py"],
    # These read shared .js files by computed name; coarse on purpose (every shared .js).
    overrides={
        ("framebuild.py", "no_ring.py"): {"dependencies": [":js"]},
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
# Builds a git repository of its own in a temporary directory.
suite("harness-lib.test.mjs", needs=[":data"], tools=["git"])

# These read the tree: they scan every example, or read other examples' files
# by path (a shipped link, a builder, a main.js). Their input is the whole
# repository until each example's own targets can be named.
for file in [
    "bundle-solve.test.mjs",
    "check_layout.py",
    "check_layout.test.py",
    "global-backends.test.mjs",
    "link_swap.test.py",
    "probe_link.test.py",
    "size_builders.test.py",
    "whole-grid-backends.test.mjs",
    "whole-grid-mains.test.mjs",
]:
    suite(file, needs=["//:tree"])

# The same, and they ask git for the tracked files.
for file in [
    "bundle-load.test.mjs",
    "sudoku_kit_source.test.py",
]:
    suite(file, needs=["//:tree"], tools=["git"])

# Reads the justfile through `just --dump`.
suite("just_list.test.py", needs=["//:tree"], tools=["just"])
# Lists the seam through `bash tests/all.sh --list`, which starts these.
suite(
    "spec_748_closing.test.py",
    needs=["//:tree"],
    tools=["bash", "dirname", "awk", "cut"],
)
