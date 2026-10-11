python_sources(
    name="py",
    sources=["*.py"],
    overrides={
        "build_link.test.py": {
            "dependencies": [":data", "./main.js:js", "./UpToNComponent.js:js", "examples/_shared/harness-lib.mjs:js"],
        },
        "build_size.py": {"dependencies": [":data", "./UpToNComponent.js:js"]},
    },
)
javascript_sources(
    name="js",
    sources=["*.mjs", "*.js", ".golden/*.js"],
    overrides={
        "UpToNComponent.js": {"dependencies": ["examples/_shared/line-kind.js:js"]},  # `// #include`
        "end-to-end.test.mjs": {"dependencies": [":data", "./main.js:js", "./UpToNComponent.js:js"]},
        "marker-contract.test.mjs": {"dependencies": ["./main.js:js"]},
        "update-strength.test.mjs": {"dependencies": ["./UpToNComponent.js:js", "examples/up-to-n/.golden/UpToNComponent.floor.js:../js"]},
    },
)
files(name="data", sources=["*.json", "PUZZLE_LINK*.txt"])

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

# Item 3 experiment: the one scoped test that already has test_* functions, run by Pants' own pytest.
python_tests(
    name="pytest",
    sources=["build_link.test.py"],
    dependencies=[":data", "./main.js:js", "./UpToNComponent.js:js", "examples/_shared/harness-lib.mjs:js"],
    extra_env_vars=["PATH"],
    timeout=300,
)
