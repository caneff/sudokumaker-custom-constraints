# The humanify tools are no unit: their two tests are on
# tests/sandbox-exceptions.txt (they resolve npm packages), so each has a
# selector and runs from the tree.
javascript_sources(name="js", sources=["*.mjs"])
files(name="data", sources=["*.json", "*.md", "vt/**"])

excepted("build-ref.test.mjs", needs=[":js", ":data"])
excepted("verify.test.mjs", needs=[":js", ":data"])
