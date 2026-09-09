# The Python side of include.test.mjs's agreement check, run by that test as
#   uv run include_agreement.py <paste target> <the same file, assembled by Node>
# Prints "agree" when minifying Node's assembled text gives exactly what
# minify_file gives by splicing the paste target itself, and raises otherwise.
# It is not a test of its own: `just test` runs include.test.mjs.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from minify import minify_file, minify_js

target, assembled = (pathlib.Path(a) for a in sys.argv[1:3])
python_spliced = minify_file(target)
node_spliced = minify_js(assembled.read_text())
assert python_spliced == node_spliced, (
    f"the two halves of #include disagree:\n"
    f"python: {python_spliced!r}\nnode:   {node_spliced!r}"
)
print("agree")
