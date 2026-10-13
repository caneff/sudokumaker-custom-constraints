python_sources(name="py", sources=["*.py"])
javascript_sources(
    name="js",
    sources=["*.mjs", "*.js", ".golden/*.js"],
    overrides={
        # `// #include`, which no import shows.
        "UpToNComponent.js": {"dependencies": ["examples/_shared/line-kind.js:js"]},
    },
)
files(name="data", sources=["*.json", "*.toml", "*.md", "PUZZLE_LINK*.txt"])

# Coarse on purpose: every suite of the unit gets the whole unit, since a
# suite reads the component, the page script and the boards by path.
for file in [
    "build_link.test.py",
    "end-to-end.test.mjs",
    "marker-contract.test.mjs",
    "update-strength.test.mjs",
    "soundness-harness.mjs",
]:
    suite(file, needs=[":py", ":js", ":data"])
