# The research-load scan (#659): no code under examples/ may load from
# docs/research/, which holds records, not live code. It reads the whole repo,
# so the pre-commit hook and `just check` run it as its own step beside
# check_layout.py (#896 THERMO-3).
#
#   uv run examples/_shared/check_research_loads.py [root]
#
# `root` is the repo root to scan and defaults to this repo's.

import ast
import io
import pathlib
import re
import sys
import tokenize

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from minify import INCLUDE_RE

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]

# A path into docs/research/, in each spelling a loader writes it: one string,
# path.join's separate arguments (on one line or several), or a pathlib `/`
# chain.
RESEARCH_PATH = re.compile(r"""docs(?:/|['"]\s*[,/]\s*['"])research""")

# The gate's own files, which name docs/research/ to police it, not to load
# from it.
RESEARCH_INSPECTORS = frozenset(
    {
        "examples/_shared/check_research_loads.py",
        "examples/_shared/check_research_loads.test.py",
        "examples/_shared/gate.test.py",
        "examples/_shared/spec_649_closing.test.py",
        "examples/_shared/spec_748_closing.test.py",
    }
)

# A JavaScript comment, opening a line or after whitespace: a `//` or `/*`
# inside a string (a URL, a glob) follows other characters, so it is left be.
_JS_COMMENT = re.compile(r"(?:^|(?<=\s))(?://[^\n]*|/\*.*?\*/)", re.M | re.S)


def _blank(text, spans):
    """`text` with each (start, end) offset span replaced by spaces, keeping its
    newlines, so every offset left keeps its line number."""
    chars = list(text)
    for start, end in spans:
        for i in range(start, end):
            if chars[i] != "\n":
                chars[i] = " "
    return "".join(chars)


def _python_code(text):
    """Python source with its comments and docstrings blanked."""
    prose = set()
    for node in ast.walk(ast.parse(text)):
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant):
            prose.update(range(node.lineno, node.end_lineno + 1))
    starts = [0]
    for line in text.splitlines(keepends=True):
        starts.append(starts[-1] + len(line))
    spans = []
    for tok in tokenize.generate_tokens(io.StringIO(text).readline):
        if tok.type == tokenize.COMMENT or (
            tok.type == tokenize.STRING and tok.start[0] in prose
        ):
            (r0, c0), (r1, c1) = tok.start, tok.end
            spans.append((starts[r0 - 1] + c0, starts[r1 - 1] + c1))
    return _blank(text, spans)


def _js_code(text):
    """JavaScript source with its comments blanked."""
    return _blank(text, [m.span() for m in _JS_COMMENT.finditer(text)])


def check_research_loads(repo_root):
    """Return one violation string per load of a docs/research/ path from
    examples/ code: a path built in code, or a `// #include` that resolves
    into docs/research/ (minify splices the included file into the link).

    docs/research/ holds records, not live code: a file the gate's code
    loads from there is maintained source the gate never lints. A citation in
    a comment or docstring is not a load. A dot directory (scratch) and
    node_modules are not scanned.

    It reads text, not a parse tree, so a pass is not proof: a path segment
    held in a variable, and code hidden behind a `//` or `/*` that sits after
    whitespace inside a string, are not seen."""
    repo_root = pathlib.Path(repo_root)
    research = (repo_root / "docs" / "research").resolve()
    violations = []
    for path in sorted((repo_root / "examples").rglob("*")):
        parts = path.relative_to(repo_root).parts
        if path.suffix not in {".py", ".js", ".mjs", ".cjs"} or any(
            p == "node_modules" or p.startswith(".") for p in parts
        ):
            continue
        rel = path.relative_to(repo_root).as_posix()
        if rel in RESEARCH_INSPECTORS:
            continue
        text = path.read_text()
        loads = set()
        if path.suffix == ".py":
            try:
                code = _python_code(text)
            except SyntaxError as e:
                violations.append(
                    f"{rel}: does not parse ({e.msg}), so its loads cannot be checked"
                )
                continue
        else:
            code = _js_code(text)
            for n, line in enumerate(text.splitlines(), 1):
                directive = INCLUDE_RE.match(line)
                target = (
                    directive and (path.parent / directive.group(1).strip()).resolve()
                )
                if target and target.is_relative_to(research):
                    loads.add(n)
        for m in RESEARCH_PATH.finditer(code):
            loads.add(code.count("\n", 0, m.start()) + 1)
        violations.extend(
            f"{rel}:{n}: loads from docs/research/ -- research holds records, "
            "so move what it loads into examples/"
            for n in sorted(loads)
        )
    return violations


def main(argv):
    root = argv[1] if len(argv) > 1 else REPO_ROOT
    violations = check_research_loads(root)
    for v in violations:
        print(v)
    print(f"{'FAILED' if violations else 'ok'} — {len(violations)} violation(s)")
    return 1 if violations else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
