python_sources(
    name="src",
    sources=["*.py"],
    # Edges no import shows: a file read, or a script started as a subprocess.
    overrides={
        "test_penpa.py": {"dependencies": [":fixtures", "./ubahn_finder.py:src"]},
        "test_ubahn_hunt.py": {"dependencies": ["./ubahn_finder.py:src"]},
        "time_sat.py": {"dependencies": [":fixtures"]},
    },
)
files(name="fixtures", sources=["fixtures/*"])

for t in ["test_penpa", "test_ubahn_brute", "test_ubahn_hunt", "test_ubahn_measure", "test_ubahn_sat"]:
    test_shell_command(
        name=t,
        command=f"uv run finders/ubahn/{t}.py",
        tools=["uv"],
        workdir="/",
        execution_dependencies=[f"./{t}.py:src", "//:uvproject"],
        extra_env_vars=["HOME"],
        timeout=300,
    )
