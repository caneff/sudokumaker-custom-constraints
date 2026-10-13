python_sources(name="py", sources=["**/*.py"])
javascript_sources(name="js", sources=["**/*.mjs", "**/*.js"])
files(name="data", sources=["**/*.json", "**/*.toml", "**/*.md", "**/PUZZLE_LINK*.txt"])

# Coarse on purpose: every suite of the unit gets the whole unit, and the
# shared directory's code, since a suite reads the component, the boards and
# the shared helpers by path.
for file in [
    "backends.test.mjs",
    "build_link.test.py",
    "build_size.test.py",
    "soundness-harness.mjs",
    "update-strength.test.mjs",
    "verify.test.py",
]:
    suite(file, needs=[":py", ":js", ":data", "examples/_shared:py", "examples/_shared:js"])
