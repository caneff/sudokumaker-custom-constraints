# time_example.py: the offline seams — the paste-ready row builder plus its
# PASS/FAIL verdict, and the loud-fail behavior for a missing PUZZLE_LINK.txt
# or build_link.py. Fake medians only; no live browser. The CLI's real run
# against numbered-rooms is a manual check recorded in the PR, not here — see
# docs/real-app-timing.md.
#
#   uv run --with lzstring examples/_shared/time_example.test.py

import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

from time_example import build_row, run

if __name__ == "__main__":
    # candidate under the 0.9x bar -> PASS
    row, verdict = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "numbered-rooms", 1000, 800
    )
    assert verdict == "PASS"
    assert row == (
        "| 2026-08-26 | v2026.08.14-d47fc4b | numbered-rooms | 1000ms | 800ms | 0.80 | PASS |"
    )

    # candidate at exactly the 0.9x bar -> PASS (bar is <=, not <)
    row, verdict = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "numbered-rooms", 1000, 900
    )
    assert verdict == "PASS"
    assert "0.90" in row and "PASS" in row

    # candidate over the bar -> FAIL
    row, verdict = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "numbered-rooms", 1000, 950
    )
    assert verdict == "FAIL"
    assert row == (
        "| 2026-08-26 | v2026.08.14-d47fc4b | numbered-rooms | 1000ms | 950ms | 0.95 | FAIL |"
    )

    # byte-equal code -> baseline-only row, no candidate/ratio
    row, verdict = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "numbered-rooms", 1000
    )
    assert verdict == "BASELINE"
    assert (
        row
        == "| 2026-08-26 | v2026.08.14-d47fc4b | numbered-rooms | 1000ms | — | — | BASELINE |"
    )

    # missing PUZZLE_LINK.txt raises naming the file
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "no-baseline"
        example_dir.mkdir()
        (example_dir / "build_link.py").write_text("# stub\n")
        try:
            run(example_dir)
            raise AssertionError("expected a missing-PUZZLE_LINK.txt failure")
        except FileNotFoundError as e:
            assert "PUZZLE_LINK.txt" in str(e)

    # missing build_link.py raises naming the file
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "no-builder"
        example_dir.mkdir()
        (example_dir / "PUZZLE_LINK.txt").write_text("stub\n")
        try:
            run(example_dir)
            raise AssertionError("expected a missing-build_link.py failure")
        except FileNotFoundError as e:
            assert "build_link.py" in str(e)

    print("ok")
