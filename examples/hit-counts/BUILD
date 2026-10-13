python_sources(name="py", sources=["*.py"])
javascript_sources(
    name="js",
    sources=["*.mjs", "*.js", ".golden/*.js", "original/*.js"],
    overrides={
        # `// #include`, which no import shows.
        "HitCountsComponent.js": {"dependencies": ["examples/_shared/line-kind.js:js"]},
        "HitCountsPairComponent.js": {"dependencies": ["examples/_shared/line-kind.js:js"]},
        "SideHitMatchingComponent.js": {"dependencies": ["examples/_shared/line-kind.js:js"]},
        "SideSumComponent.js": {"dependencies": ["examples/_shared/line-kind.js:js"]},
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
    "component-contract.test.mjs",
    "update-strength.test.mjs",
    "soundness-harness.mjs",
]:
    suite(file, needs=[":py", ":js", ":data"])

# Seconds: about 5 to 7 times the run measured through Pants (see the PR).
TIMEOUTS = {
    "recovery-probe.test.mjs": 90,
}

# The heavy tests keep their groups in tests/all.sh; the sandbox changes only
# where they run.
for file in TIMEOUTS:
    suite(file, needs=[":py", ":js", ":data"], timeout=TIMEOUTS[file])
