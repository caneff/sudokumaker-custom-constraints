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
# The toolchain is not sealed, so uv must find in the sandbox what it finds
# outside it: `python3` from the PATH, its own installs and cache under HOME,
# and UV_CACHE_DIR where one is set (CI sets it). Without `python3` and with
# no install of its own, uv downloads the newest CPython, which the locked
# packages may have no wheel for.


def suite(file, needs=()):
    kind, run = ("py", "uv run") if file.endswith(".py") else ("js", "node")
    test_shell_command(
        name=file,
        command=f"{run} {build_file_dir()}/{file}",
        tools=["uv", "node", "python3"],
        workdir="/",
        execution_dependencies=[f"./{file}:{kind}", *needs, "//:uvproject"],
        extra_env_vars=["HOME", "UV_CACHE_DIR"],
        timeout=600,
    )
