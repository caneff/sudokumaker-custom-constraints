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

# The heavy tests keep their groups in tests/all.sh; the sandbox changes only
# where they run. Each timeout is about 5 to 7 times the run measured through
# Pants on 2026-10-13, one core.
suite("recovery-probe.test.mjs", needs=[":py", ":js", ":data"], timeout=90)  # ran in 12.8 s
