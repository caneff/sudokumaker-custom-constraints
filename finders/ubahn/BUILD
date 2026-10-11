python_sources(name="src", sources=["*.py"])

for t in ["test_penpa", "test_ubahn_brute", "test_ubahn_hunt", "test_ubahn_measure", "test_ubahn_sat"]:
    test_shell_command(
        name=t,
        command=f"uv run finders/ubahn/{t}.py",
        tools=["uv"],
        workdir="/",
        execution_dependencies=[f"./{t}.py:src", "//:uvproject"],
        extra_env_vars=["HOME", "UV_PROJECT_ENVIRONMENT"],
        timeout=300,
    )
