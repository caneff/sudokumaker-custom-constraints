python_sources(name="py", sources=["**/*.py"])
javascript_sources(
    name="js",
    sources=["**/*.mjs", "**/*.js"],
    overrides={
        # `// #include ../_shared/line-kind.js`.
        "NumberedRoomsComponent.js": {"dependencies": ["examples/_shared/line-kind.js:js"]},
        # `// #include ../_shared/frame-lines.js`.
        "main-global.js": {"dependencies": ["examples/_shared/frame-lines.js:js"]},
    },
)
files(name="data", sources=["**/*.json", "**/*.toml", "**/*.md", "**/PUZZLE_LINK*.txt"])

# Coarse on purpose: every suite of the unit gets the whole unit, since a suite
# reads the component, the boards and the page script by path. Files outside
# the unit are named one by one.
for file in [
    "build_clued.test.py",
    "build_link.test.py",
    "build_original.test.py",
    "dead-index.test.mjs",
    "soundness-harness.mjs",
    "update-strength.test.mjs",
]:
    suite(file, needs=[":py", ":js", ":data"])
