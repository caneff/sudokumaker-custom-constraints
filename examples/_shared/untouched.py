# The check a builder test makes around a rebuild into a scratch `--out`
# directory: the committed links it reproduces are left exactly as they were.

import contextlib


@contextlib.contextmanager
def leaves_untouched(paths):
    """Yield {path: bytes} for each of `paths`, read before the body runs;
    on exit, fail naming any whose bytes or modification time changed.

    Bytes alone cannot show a write: a rebuild that also wrote the committed
    file rewrites the same bytes, and only the modification time moves."""
    before = {p: (p.read_bytes(), p.stat().st_mtime_ns) for p in paths}
    yield {p: data for p, (data, _) in before.items()}
    for p, (data, mtime) in before.items():
        assert p.read_bytes() == data, f"{p.name} was touched by --out"
        assert p.stat().st_mtime_ns == mtime, f"{p.name} was rewritten by --out"
