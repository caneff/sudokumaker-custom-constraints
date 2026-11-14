# `just time-link <link_file> [<link_file_b>]` -- times any SudokuMaker link on
# the recorded app, no repo example needed. One link prints two paste-ready
# rows (cold, then after-logical), each the median of 3 reps with
# non-deterministic solve off. Two links are interleaved one rep per link per
# round, the lead alternating (app_timing.run_app_solve), and each row carries
# both medians and the b/a ratio. The link is timed as given: nothing is
# stripped (searchable_link.py is the tool for that), and a link that carries entered
# digits in the ring needs --ring-clues, as for app-solve.mjs. No ship verdict
# is printed -- see docs/real-app-timing.md.
#
#   uv run examples/_shared/time_link.py <link_file> [<link_file_b>] [--ring-clues]

import argparse
import datetime
import functools
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

from app_timing import build_link_row, time_modes


def run(link_a, link_b=None, ring_clues=False):
    """Time one link, or two interleaved, in both modes and return the two
    paste-ready rows (cold, then after-logical). Raises FileNotFoundError
    naming a missing file, ValueError for the same file twice, and
    RuntimeError (run_app_solve) when every rep of a link times out. Only file
    names reach the rows, never a link's contents."""
    links = [pathlib.Path(link_a)] + ([pathlib.Path(link_b)] if link_b else [])
    for link in links:
        if not link.is_file():
            raise FileNotFoundError(f"missing {link}")
    if len(links) == 2 and links[0].resolve() == links[1].resolve():
        raise ValueError(f"both links are the same file: {links[0]}")
    # "(a)" and "(b)" say which side the b/a ratio reads, so two files with
    # the same name (a link before and after a change) stay distinguishable.
    board = f"{links[0].name} (a) vs {links[1].name} (b)" if link_b else links[0].name
    date = datetime.date.today().isoformat()

    return time_modes(
        links[0],
        links[1] if link_b else None,
        ring_clues,
        (f"{board} cold", f"{board} after-logical"),
        functools.partial(build_link_row, date),
    )


def main(argv):
    """The CLI: print the rows, or exit non-zero with a one-line reason. Only
    the first line of an error is printed: a driver failure carries its
    stdout/stderr tail, and Playwright's navigation errors quote the link
    (AGENTS.md: never print a link)."""
    p = argparse.ArgumentParser()
    p.add_argument("link_file")
    p.add_argument("link_file_b", nargs="?")
    p.add_argument("--ring-clues", action="store_true")
    a = p.parse_args(argv)
    try:
        rows = run(a.link_file, a.link_file_b, ring_clues=a.ring_clues)
    except (FileNotFoundError, ValueError, RuntimeError) as e:
        first = str(e).splitlines()[0] if str(e) else type(e).__name__
        suffix = (
            " (driver output withheld: it may quote the link)" if "\n" in str(e) else ""
        )
        return f"time-link: {first}{suffix}"
    for row in rows:
        print(row)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
