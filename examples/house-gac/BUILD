python_sources(
    name="py",
    sources=["**/*.py"],
    overrides={
        # Reads the shared component by path: `COMPONENT = ../_shared/HouseGacComponent.js`.
        "build_link.py": {"dependencies": ["examples/_shared/HouseGacComponent.js:js"]},
    },
)
javascript_sources(
    name="js",
    sources=["**/*.mjs", "**/*.js"],
    overrides={
        # Loads the shared component by path: `load('../_shared/HouseGacComponent.js')`.
        "soundness-harness.mjs": {"dependencies": ["examples/_shared/HouseGacComponent.js:js"]},
        # Loads the shared component by path, `makeIo(_shared).load('HouseGacComponent.js')`.
        "update-strength.test.mjs": {"dependencies": ["examples/_shared/HouseGacComponent.js:js"]},
    },
)
files(name="data", sources=["**/*.json", "**/*.toml", "**/*.md", "**/PUZZLE_LINK*.txt"])

# Coarse on purpose: every suite of the unit gets the whole unit, since a suite
# reads the component, the boards and the page script by path. Files outside
# the unit are named one by one.
for file in [
    "build_link.test.py",
    "soundness-harness.mjs",
    "update-strength.test.mjs",
]:
    suite(file, needs=[":py", ":js", ":data"])
