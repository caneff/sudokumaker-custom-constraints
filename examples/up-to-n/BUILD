python_sources(name="py", sources=["*.py"])
javascript_sources(name="js", sources=["*.mjs", "*.js"])

test_shell_command(
    name="build_link.test",
    command="uv run examples/up-to-n/build_link.test.py",
    tools=["uv", "node"],
    workdir="/",
    execution_dependencies=["./build_link.test.py:py", "//:uvproject"],
    extra_env_vars=["HOME", "UV_PROJECT_ENVIRONMENT"],
    timeout=300,
)

for t in ["end-to-end", "marker-contract", "update-strength"]:
    test_shell_command(
        name=f"{t}.test",
        command=f"node examples/up-to-n/{t}.test.mjs",
        tools=["node", "uv"],
        workdir="/",
        execution_dependencies=[f"./{t}.test.mjs:js", "//:uvproject"],
        extra_env_vars=["HOME", "UV_PROJECT_ENVIRONMENT"],
        timeout=300,
    )
