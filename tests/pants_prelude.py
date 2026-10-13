# The one shape of a wired suite. `suite("x.test.py")` in a unit's BUILD file
# runs that file in Pants's sandbox with the command the seam runner
# (tests/all.sh) names it by, `uv run <file>` or `node <file>`, from the
# sandbox root. The target is named for the file, which is how the runner
# finds the target of a suite: `<directory>:<file>`.
#
# The sandbox holds the file's own source target, so every import Pants infers
# from it and every dependency the unit's BUILD file declares on it, then
# `needs` (what the suite reads that no import shows), plus pyproject.toml and
# uv.lock: `uv run` builds the environment inside the
# sandbox, and HOME is passed through so uv finds its cache.


def suite(file, needs=()):
    kind, run = ("py", "uv run") if file.endswith(".py") else ("js", "node")
    test_shell_command(
        name=file,
        command=f"{run} {build_file_dir()}/{file}",
        tools=["uv", "node"],
        workdir="/",
        execution_dependencies=[f"./{file}:{kind}", *needs, "//:uvproject"],
        extra_env_vars=["HOME"],
        timeout=600,
    )
