# The one shape of a wired suite. `suite("x.test.py")` in a unit's BUILD file
# runs that file in Pants's sandbox with the command the seam runner
# (tests/all.sh) names it by, `uv run <file>` or `node <file>`, from the
# sandbox root. The target is named for the file, which is how the runner
# finds the target of a suite: `<directory>:<file>`.
#
# The sandbox holds the file's own source target, so every import Pants infers
# from it and every dependency the unit's BUILD file declares on it, then
# `needs` (what the suite reads that no import shows), plus pyproject.toml and
# uv.lock: `uv run` builds the environment inside the sandbox.
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


def suite(file, needs=(), tools=(), timeout=600):
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
        execution_dependencies=[f"./{file}:{kind}", *needs, "//:uvproject"],
        extra_env_vars=["HOME", "UV_CACHE_DIR", "UV_PYTHON"],
        timeout=timeout,
    )
