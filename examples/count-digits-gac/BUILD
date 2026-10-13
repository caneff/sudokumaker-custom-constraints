python_sources(name="py", sources=["**/*.py"])
javascript_sources(name="js", sources=["**/*.mjs", "**/*.js"])
files(name="data", sources=["**/*.json", "**/*.toml", "**/*.md", "**/PUZZLE_LINK*.txt"])

# Coarse on purpose: every suite of the unit gets the whole unit, and the
# shared directory's code, since a suite reads the component, the boards and
# the shared helpers by path.
# The one edge across units: build_required_digits.py builds its link from
# outside-sudoku's PUZZLE_LINK.txt, which no import shows.
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
    suite(file, needs=[":py", ":js", ":data", "examples/_shared:py", "examples/_shared:js", "examples/outside-sudoku:data"])
