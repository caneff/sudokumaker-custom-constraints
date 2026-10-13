python_sources(name="py", sources=["**/*.py"])
javascript_sources(
    name="js",
    sources=["**/*.mjs", "**/*.js"],
    overrides={
        # `// #include ../_shared/frame-lines.js`.
        "main-global.js": {"dependencies": ["examples/_shared/frame-lines.js:js"]},
    },
)
files(name="data", sources=["**/*.json", "**/*.toml", "**/*.md", "**/PUZZLE_LINK*.txt"])

# Coarse on purpose: every suite of the unit gets the whole unit, since a suite
# reads the component, the boards and the page script by path. Files outside
# the unit are named one by one.
for file in [
    "backends.test.mjs",
    "build_link.test.py",
    "build_size.test.py",
    "soundness-harness.mjs",
    "update-strength.test.mjs",
    "verify.test.py",
]:
    suite(file, needs=[":py", ":js", ":data"])
