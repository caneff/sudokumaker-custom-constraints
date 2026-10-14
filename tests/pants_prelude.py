# The one shape of a wired suite. `suite("x.test.py")`, which `unit(...)`
# (below) calls once per test file and which a BUILD file with its own needs
# calls directly, runs that file in Pants's sandbox with the command the seam runner
# (tests/all.sh) names it by, `uv run <file>` or `node <file>`, from the
# sandbox root. The target is named for the file, which is how the runner
# finds the target of a suite: `<directory>:<file>`.
#
# The sandbox holds the file's own source target, so every import Pants infers
# from it and every dependency the unit's BUILD file declares on it, then
# `needs` (what the suite reads that no import shows), plus pyproject.toml and
# uv.lock: `uv run` builds the environment inside the sandbox. `//:runner` is
# what every wired suite runs under (the seam runner, pants.toml, this file
# and .gitignore). No suite reads those; declaring them is how a change to
# one selects every wired suite on a narrowed run.
#
# The toolchain is not sealed: uv and node come from the PATH, and uv finds
# its installs and its cache under HOME, or in UV_CACHE_DIR where one is set
# (CI sets it). UV_PYTHON is the interpreter tests/all.sh names, the one the
# tree's own environment was built from. A node suite keeps it in its
# environment, for the `uv run` it starts. A Python suite is started on it
# with `--python` and does not hand the variable on: with it set, uv 0.13
# runs a second `uv run` of a script outside the project without the
# project's environment. The sandbox's PATH holds uv, node and what `tools`
# names, and nothing else: a suite that starts `git` names it.


def suite(file, needs=(), tools=(), timeout=None):
    path = f"{build_file_dir()}/{file}"
    if file.endswith(".py"):
        kind = "py"
        command = (
            'python=$UV_PYTHON; unset UV_PYTHON; '
            f'uv run ${{python:+--python "$python"}} {path}'
        )
    else:
        kind, command = "js", f"node {path}"
    test_shell_command(
        name=file,
        command=command,
        tools=["uv", "node", *tools],
        workdir="/",
        execution_dependencies=[f"./{file}:{kind}", *needs, "//:uvproject", "//:runner"],
        extra_env_vars=["HOME", "UV_CACHE_DIR", "UV_PYTHON"],
        timeout=timeout or 600,
    )


# The one shape of an example's unit: its code, its data, and a `suite(...)`
# per test file. An example's BUILD file is one `unit(...)` call, and what it
# passes is what no import shows. Every unit gets the same globs, so a file
# type a unit gains is in its sandbox with no edit, and no unit drifts from
# another: `**` takes the unit's subdirectories (`.golden/`, `original/`,
# `required-digits/`) too. Every suite of the unit declares the whole unit;
# this is coarse on purpose, since a suite reads the component, the page
# script and the boards by path. A file in another unit is named one by one,
# never by its whole directory.
#
#   suites       the test files and the soundness harness, one suite each
#   py_edges     {python file: [what it reads by path or starts, which no
#                import shows]}, each a target address
#   js_edges     the same for a JavaScript file: a `// #include`, a file
#                read by path
#   needs        files of other units every suite reads, by name
#   timeouts     {suite file: seconds}: a ceiling in place of the default 600
#                for a suite whose run was measured through Pants, about 5 to
#                7 times that run. A name that is no suite of the unit fails
#                the BUILD file


def unit(suites, py_edges=None, js_edges=None, needs=(), timeouts=None):
    def overrides(edges):
        return {file: {"dependencies": deps} for file, deps in (edges or {}).items()}

    python_sources(name="py", sources=["**/*.py"], overrides=overrides(py_edges))
    javascript_sources(
        name="js", sources=["**/*.mjs", "**/*.js"], overrides=overrides(js_edges)
    )
    files(
        name="data",
        sources=[
            "**/*.json",
            "**/*.jsonl",
            "**/*.toml",
            "**/*.md",
            "**/*.tsv",
            "**/*.txt",
        ],
    )
    ceilings = dict(timeouts or {})
    for file in suites:
        suite(
            file,
            needs=[":py", ":js", ":data", *needs],
            timeout=ceilings.pop(file, None),
        )
    if ceilings:
        raise ValueError(
            f"{build_file_dir()}: timeouts name no suite: {sorted(ceilings)}"
        )
