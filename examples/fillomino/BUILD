python_sources(name="py", sources=["*.py"])
javascript_sources(
    name="js",
    sources=["*.mjs", "*.js", ".golden/*.js", "original/*.js"],
    overrides={
        # `// #include`, which no import shows.
        "FillominoComponent.js": {"dependencies": ["examples/_shared/dominator.js:js", "examples/_shared/stamp.js:js"]},
    },
)
files(
    name="data",
    sources=["*.json", "*.jsonl", "*.toml", "*.md", "*.tsv", "*.txt", ".golden/*.txt"],
)

# Coarse on purpose: every suite of the unit gets the whole unit, since a
# suite reads the component, the page script and the boards by path.
for file in [
    "build_link.test.py",
    "hunt_offline.test.py",
    "hunt-lib.test.mjs",
    "stamp-wrap.test.mjs",
    "update-strength.test.mjs",
    "soundness-harness.mjs",
]:
    suite(file, needs=[":py", ":js", ":data"])

# The heavy tests keep their groups in tests/all.sh; the sandbox changes only
# where they run. Each timeout is about 5 to 7 times the run measured through
# Pants on 2026-10-13, one core.
suite("pipeline.test.py", needs=[":py", ":js", ":data"], timeout=120)  # ran in 19.6 s
suite("generate.test.py", needs=[":py", ":js", ":data"], timeout=120)  # ran in 21.0 s
