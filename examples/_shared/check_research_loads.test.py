# check_research_loads flags code under examples/ that loads from
# docs/research/ (#659): a path built in code, or a `// #include` into it. These
# fixtures build small temp trees and pass the root to the scan, so a case is
# exact and does not drift with what another session has under examples/.
#
#   uv run examples/_shared/check_research_loads.test.py

import contextlib
import io
import pathlib
import tempfile

import check_research_loads

if __name__ == "__main__":
    # a path into docs/research/ in examples/ code fails, in each spelling the
    # tree has used: a joined path, a pathlib chain, a URL, a plain string
    loads = {
        "examples/a/x.mjs": "const B = join(HERE, '..', '..', 'docs', 'research', 'b.js')\n",
        "examples/a/y.py": 'BASE = REPO / "docs" / "research" / "x.txt"\n',
        "examples/_shared/z.test.mjs": (
            "const u = new URL('../../docs/research/l.txt', import.meta.url)\n"
        ),
        "examples/a/w.py": 'sys.path.insert(0, str(REPO / "docs/research/h"))\n',
    }
    for rel, text in loads.items():
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root / rel).parent.mkdir(parents=True)
            (root / rel).write_text("\n" + text)
            violations = check_research_loads.check_research_loads(root)
            assert len(violations) == 1, (rel, violations)
            assert violations[0].startswith(f"{rel}:2:"), violations[0]

    # ...but a citation in a comment or a docstring is a reference, not a load
    citations = {
        "examples/a/x.mjs": (
            "// see docs/research/a.md\n//! (docs/research/b.md)\n"
            "/* docs/research/c.md\n   docs/research/d.md */\nconst n = 1 // docs/research/e.md\n"
        ),
        "examples/a/y.py": (
            '"""Module notes: docs/research/a.md."""\n# docs/research/b.md\n'
            'def f():\n    """docs/research/c.md"""\n    return 1  # docs/research/d.md\n'
        ),
    }
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        for rel, text in citations.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text)
        assert check_research_loads.check_research_loads(root) == [], (
            check_research_loads.check_research_loads(root)
        )

    # a load that hides from a line-by-line read still fails: an `#include`
    # resolving into research (minify splices it into the link), a join split
    # over lines, a .cjs file, and code after a `/*` inside a string
    hidden = {
        "examples/a/x.js": "// #include ../../docs/research/h.js\n",
        "examples/a/y.mjs": "const B = join(HERE,\n  'docs',\n  'research', 'b.js')\n",
        "examples/a/z.cjs": "const B = join(HERE, 'docs', 'research', 'b.js')\n",
        "examples/a/w.mjs": "const g = '**/*.js'; const B = join(HERE, 'docs', 'research')\n",
    }
    for rel, text in hidden.items():
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root / rel).parent.mkdir(parents=True)
            (root / rel).write_text(text)
            violations = check_research_loads.check_research_loads(root)
            assert len(violations) == 1, (rel, violations)
            assert violations[0].startswith(f"{rel}:"), violations[0]

    # ...an `#include` of a sibling file is not a load from research, and
    # node_modules and dot directories (scratch) are not scanned
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        skipped = {
            "examples/a/x.js": "// #include ../_shared/frame-lines.js\n",
            "examples/node_modules/p/i.js": "require('../../docs/research/x')\n",
            "examples/a/.scratch/s.py": 'P = "docs/research/x"\n',
        }
        for rel, text in skipped.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text)
        assert check_research_loads.check_research_loads(root) == [], (
            check_research_loads.check_research_loads(root)
        )

    # a .py that does not parse is a violation naming it, not a traceback
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        (root / "examples" / "a").mkdir(parents=True)
        (root / "examples" / "a" / "b.py").write_text("def (:\n")
        violations = check_research_loads.check_research_loads(root)
        assert len(violations) == 1 and "examples/a/b.py" in violations[0], violations

    # main takes the root to scan: a load there fails the run and is printed;
    # a clean tree exits 0
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        (root / "examples" / "_shared").mkdir(parents=True)
        (root / "examples" / "_shared" / "z.mjs").write_text(
            "const u = new URL('../../docs/research/l.txt', import.meta.url)\n"
        )
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = check_research_loads.main(["check_research_loads.py", str(root)])
        assert code == 1, out.getvalue()
        assert "examples/_shared/z.mjs:1: loads from docs/research/" in out.getvalue()
        (root / "examples" / "_shared" / "z.mjs").write_text("const n = 1\n")
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = check_research_loads.main(["check_research_loads.py", str(root)])
        assert code == 0 and out.getvalue().startswith("ok"), out.getvalue()

    # a root with nothing to scan fails rather than reading as clean: a
    # missing path, and a tree with no code under examples/
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        for arg in (root / "no-such-repo", root):
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                code = check_research_loads.main(["check_research_loads.py", str(arg)])
            assert code == 1, out.getvalue()
            assert "no code under examples/" in out.getvalue(), out.getvalue()

    # the gate's own files name docs/research/ to police it, and pass
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        target = root / "examples" / "_shared" / "check_research_loads.py"
        target.parent.mkdir(parents=True)
        target.write_text('research_dir = repo_root / "docs" / "research"\n')
        assert check_research_loads.check_research_loads(root) == [], (
            check_research_loads.check_research_loads(root)
        )
