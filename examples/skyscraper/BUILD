python_sources(name="py", sources=["*.py"])
javascript_sources(
    name="js",
    sources=["*.mjs", "*.js", ".golden/*.js", "original/*.js"],
    overrides={
        # `// #include`, which no import shows.
        "SkyscraperPairComponent.js": {"dependencies": ["examples/_shared/line-kind.js:js"]},
        "main-global.js": {"dependencies": ["examples/_shared/frame-lines.js:js"]},
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
    "build_original.test.py",
    "verify.test.py",
    "verify.py",
    "empty-line.test.mjs",
    "update-strength.test.mjs",
    "soundness-harness.mjs",
]:
    suite(file, needs=[":py", ":js", ":data"])

# Seconds: about 5 to 7 times the run measured through Pants (see the PR).
TIMEOUTS = {
    "recovery-probe.test.mjs": 120,
}

# The heavy tests keep their groups in tests/all.sh; the sandbox changes only
# where they run.
for file in TIMEOUTS:
    suite(file, needs=[":py", ":js", ":data"], timeout=TIMEOUTS[file])
