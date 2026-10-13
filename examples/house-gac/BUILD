python_sources(name="py", sources=["**/*.py"])
javascript_sources(name="js", sources=["**/*.mjs", "**/*.js"])
files(name="data", sources=["**/*.json", "**/*.toml", "**/*.md", "**/PUZZLE_LINK*.txt"])

# Coarse on purpose: every suite of the unit gets the whole unit, and the
# shared directory's code, since a suite reads the component, the boards and
# the shared helpers by path.
# update-strength.test.mjs is not wired: it reads a component as it stood at a
# git commit (`loadAt`, REF_COMMIT), and the sandbox holds no git history. It
# keeps running from the tree, through the seam runner's own loop.
for file in [
    "build_link.test.py",
    "soundness-harness.mjs",
]:
    suite(file, needs=[":py", ":js", ":data", "examples/_shared:py", "examples/_shared:js"])
