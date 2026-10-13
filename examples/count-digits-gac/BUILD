python_sources(name="py", sources=["**/*.py"])
javascript_sources(
    name="js",
    sources=["**/*.mjs", "**/*.js"],
    overrides={
        # `// #include ../_shared/bit-helpers.js`, which no import shows.
        "RequiredDigitsGacComponent.js": {"dependencies": ["examples/_shared/bit-helpers.js:js"]},
        # `// #include ../../_shared/frame-lines.js`.
        "required-digits/main-required-digits-global.js": {"dependencies": ["examples/_shared/frame-lines.js:js"]},
    },
)
files(name="data", sources=["**/*.json", "**/*.toml", "**/*.md", "**/PUZZLE_LINK*.txt"])

# Coarse on purpose: every suite of the unit gets the whole unit, since a suite
# reads the component, the boards and the page script by path. Files outside
# the unit are named one by one.
# The one edge across units: build_required_digits.py builds its link from
# outside-sudoku's PUZZLE_LINK.txt, which no import shows: the one file, by name.
for file in [
    "board_kit.test.py",
    "build_count_digits_demo.test.py",
    "build_count_digits_selfcount.test.py",
    "build_required_digits.test.py",
    "build_sparse_count_digits.test.py",
    "build_sparse_required_digits.test.py",
    "count-digits.test.mjs",
    "soundness-harness.mjs",
]:
    suite(file, needs=[":py", ":js", ":data", "examples/outside-sudoku/PUZZLE_LINK.txt:data"])
