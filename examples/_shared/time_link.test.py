# time_link.py: argument handling, the interleaved schedule and row building,
# with the browser call faked out (time_example.app_solve reassigned to a
# canned-median stub). No live browser. The real run is a manual check, see
# docs/real-app-timing.md.
#
#   uv run examples/_shared/time_link.test.py

import contextlib
import io
import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

import time_example
import time_link
from time_example import build_link_row, rep_order

SECRET = "SECRETLINKCONTENTS" * 50
VERSION = "v2026.08.14-d47fc4b"


@contextlib.contextmanager
def fake_solve(by_link):
    """Stub app_solve: per link file name, the next per-rep median from
    `by_link`. Yields the list of (name, ring_clues, after_logical) calls."""
    calls = []
    real = time_example.app_solve
    pending = {name: list(v) for name, v in by_link.items()}

    def stub(link_path, reps, ring_clues=False, after_logical=False):
        assert reps == 1
        name = pathlib.Path(link_path).name
        calls.append((name, ring_clues, after_logical))
        assert pending.get(name), f"unexpected driver call on {name}"
        data = {
            "median": pending[name].pop(0),
            "version": VERSION,
            "repsRun": 1,
            "repsTimedOut": 0,
        }
        return f"JSON: {json.dumps(data)}\n"

    time_example.app_solve = stub
    try:
        yield calls
    finally:
        time_example.app_solve = real


def expect_raises(exc, fragment, fn, *args, **kw):
    try:
        fn(*args, **kw)
    except exc as e:
        assert fragment in str(e), e
    else:
        raise AssertionError(f"expected {exc.__name__}")


if __name__ == "__main__":
    R = time_example.REPS

    # the schedule: the lead alternates by round
    assert [rep_order(["a", "b"], r) for r in range(3)] == [
        ["a", "b"],
        ["b", "a"],
        ["a", "b"],
    ]
    assert rep_order(["a"], 1) == ["a"]

    # row building: one link, two links, a 0ms baseline, a busy note
    one = build_link_row("2026-10-15", "v1", "a.txt cold", 1200, None, "")
    assert one == "| 2026-10-15 | v1 | a.txt cold | 1200ms | — | — | — |", one
    two = build_link_row("2026-10-15", "v1", "a.txt vs b.txt cold", 1000, 500, "")
    assert (
        two == "| 2026-10-15 | v1 | a.txt vs b.txt cold | 1000ms | 500ms | 0.50 | — |"
    )
    assert build_link_row("d", "v", "x", 0, 0, "").endswith("| 0ms | 0ms | — | — |")
    assert build_link_row("d", "v", "x", 0, 5, "").endswith("| 0ms | 5ms | ∞ | — |")
    assert build_link_row("d", "v", "x", 1, 1, " (BUSY load 9.0 > 4)").endswith(
        "| 1.00 | — (BUSY load 9.0 > 4) |"
    )

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        a, b = tmp / "a.txt", tmp / "b.txt"
        a.write_text(SECRET)
        b.write_text(SECRET + "x")

        # one link outside the repo: exactly two rows, cold then after-logical,
        # one driver call per rep, flags passed through
        with fake_solve({"a.txt": [100, 300, 200, 40, 50, 60]}) as calls:
            rows = time_link.run(a, ring_clues=True)
        assert len(rows) == 2, rows
        assert "| a.txt cold | 200ms | — | — | — |" in rows[0], rows[0]
        assert "| a.txt after-logical | 50ms | — | — | — |" in rows[1], rows[1]
        assert calls == [("a.txt", True, False)] * R + [("a.txt", True, True)] * R

        # two links: interleaved with the lead alternating, b/a on each row
        with fake_solve(
            {"a.txt": [1000] * R + [100] * R, "b.txt": [500] * R + [200] * R}
        ) as calls:
            rows = time_link.run(a, b)
        cold = [c[0] for c in calls[: 2 * R]]
        assert cold == ["a.txt", "b.txt", "b.txt", "a.txt", "a.txt", "b.txt"], cold
        assert "| a.txt (a) vs b.txt (b) cold | 1000ms | 500ms | 0.50 | — |" in rows[0]
        assert (
            "| a.txt (a) vs b.txt (b) after-logical | 100ms | 200ms | 2.00 | — |"
            in rows[1]
        )

        # no row line carries the link's contents
        for row in rows:
            assert SECRET[:20] not in row and "\n" not in row

        # a missing file, and the same file twice, fail before any timing
        with fake_solve({}) as calls:
            expect_raises(FileNotFoundError, "missing", time_link.run, tmp / "nope.txt")
            expect_raises(
                FileNotFoundError, "nope.txt", time_link.run, a, tmp / "nope.txt"
            )
            expect_raises(ValueError, "same file", time_link.run, a, a)
        assert calls == []

        # every rep of a link timing out is the DNF refusal, not a number
        with fake_solve({"a.txt": [None] * R}):
            expect_raises(RuntimeError, "300s per-rep timeout", time_link.run, a)

        # the CLI: rows on stdout and exit 0; a driver failure that quotes the
        # link exits non-zero with its first line only, never the link
        out = io.StringIO()
        with fake_solve({"a.txt": [1] * (2 * R)}), contextlib.redirect_stdout(out):
            assert time_link.main([str(a)]) == 0
        assert out.getvalue().count("\n") == 2 and SECRET[:20] not in out.getvalue()

        real = time_example.app_solve

        def failing(link_path, reps, ring_clues=False, after_logical=False):
            raise RuntimeError(
                f"app-solve.mjs failed on {link_path}:\n"
                f'page.goto: Timeout\n  navigating to "{SECRET}"'
            )

        time_example.app_solve = failing
        try:
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                reason = time_link.main([str(a)])
        finally:
            time_example.app_solve = real
        assert isinstance(reason, str) and reason.startswith(
            "time-link: app-solve.mjs failed"
        )
        assert SECRET[:20] not in reason and SECRET[:20] not in out.getvalue(), reason
        assert time_link.main([str(tmp / "nope.txt")]).startswith("time-link: missing ")

    print("ok")
