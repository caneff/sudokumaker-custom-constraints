"""The finder contract every hunt drives (#483/#484).

A finder states only its rule and its search; `driver.run` supplies the
output directory, dedupe and the CLI. See `finders/AGENTS.md` and
docs/agents/... for the pointer from a new finder to this package.
"""

from typing import Any, NamedTuple, Protocol


class Verdict(NamedTuple):
    """The result of `Finder.verify`: ok, plus why not when it isn't."""

    ok: bool
    reason: str = ""


class Finder(Protocol):
    """A finder rule: propose a candidate, verify it, say how to record it.

    `symmetry` is the group `key()`'s grid dedupes under: `dedupe.D4`
    (default expectation for a square-board rule), `dedupe.IDENTITY`, or a
    custom list of cell maps (see dedupe.py).
    """

    symmetry: Any

    def propose(self, rng) -> Any | None:
        """One candidate for this seed's rng, or None if this seed found
        nothing."""
        ...

    def verify(self, candidate: Any) -> Verdict:
        """Whether a proposed candidate actually satisfies the finder's
        rule."""
        ...

    def record(self, candidate: Any) -> dict:
        """The JSON-serialisable line written to examples.jsonl."""
        ...

    def key(self, candidate: Any) -> Any:
        """The flat tuple of cell values dedupe canonicalizes under
        `symmetry`."""
        ...
