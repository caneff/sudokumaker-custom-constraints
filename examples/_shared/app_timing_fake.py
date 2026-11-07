# The one test stand-in for the app: `fake_solve` swaps app_timing.app_solve,
# the only call in the timing driver that needs a browser, for a stub that
# prints canned medians as app-solve.mjs's JSON line. Shared by the timing
# tests (app_timing, time_example, time_link, spec_895_closing) so a change to
# the driver's JSON line is made in one stub, not one copy per test.

import contextlib
import json
import pathlib

import app_timing

VERSION = "v2026.08.14-d47fc4b"


@contextlib.contextmanager
def fake_solve(by_link):
    """Replace app_timing.app_solve with a stub printing, per link file name,
    that link's next value from `by_link` ({name: [per-rep medians, in call
    order]}) as the driver's JSON line. One call is one rep. A median may be
    None (a timed-out rep) or `(median, extra)`: extra's fields (`loads`,
    `busy`, `loadThreshold`) ride on that rep's JSON line. A call on a link
    with no value left fails loud. Yields the list of (link_name, ring_clues,
    after_logical) calls, so a case can assert on the arguments the caller
    derived as well as on the rows it built."""
    calls = []
    real = app_timing.app_solve
    pending = {
        name: [v if isinstance(v, tuple) else (v, {}) for v in reps]
        for name, reps in by_link.items()
    }

    def stub(link_path, reps, ring_clues=False, after_logical=False):
        assert reps == 1, "interleaving means one rep per driver call"
        name = pathlib.Path(link_path).name
        calls.append((name, ring_clues, after_logical))
        assert pending.get(name), f"unexpected driver call on {name}"
        median, extra = pending[name].pop(0)
        data = {
            "median": median,
            "version": VERSION,
            "repsRun": reps,
            "repsTimedOut": 0,
            **extra,
        }
        return f"JSON: {json.dumps(data)}\n"

    app_timing.app_solve = stub
    try:
        yield calls
    finally:
        app_timing.app_solve = real
