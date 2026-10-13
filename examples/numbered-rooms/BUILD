python_sources(name="py", sources=["**/*.py"])
javascript_sources(name="js", sources=["**/*.mjs", "**/*.js"])
files(name="data", sources=["**/*.json", "**/*.toml", "**/*.md", "**/PUZZLE_LINK*.txt"])

# Coarse on purpose: every suite of the unit gets the whole unit, and the
# shared directory's code, since a suite reads the component, the boards and
# the shared helpers by path.
# update-strength.test.mjs is not wired: it reads components as they stood at
# git commits (`gitShow`), and the sandbox holds no git history. It keeps
# running from the tree, through the seam runner's own loop.
for file in [
    "build_clued.test.py",
    "build_link.test.py",
    "build_original.test.py",
    "dead-index.test.mjs",
    "soundness-harness.mjs",
]:
    suite(file, needs=[":py", ":js", ":data", "examples/_shared:py", "examples/_shared:js"])
