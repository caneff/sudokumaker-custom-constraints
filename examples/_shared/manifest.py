# One example's traits, read from the `example.toml` beside its code
# (docs/example-layout.md, "The manifest"). The shared checker and the timing
# driver used to keep these as tables keyed by example name; they now iterate
# manifests and name no example.

import pathlib
import tomllib
from dataclasses import dataclass

MANIFEST_NAME = "example.toml"

LANES = ("split", "single")
RULES_PREFIXES = ("inner-grid", "ringless", "none")


@dataclass(frozen=True)
class Manifest:
    # The registered component `just time` follows.
    timed_component: str
    # The name of the constraint on the example's board, where a builder reads it.
    constraint_name: str | None = None
    # "split": a local lane (main.js, drawn groups) and a global lane
    # (main-global.js). "single": main.js alone -- a whole-grid or
    # fixed-geometry constraint, or one whose clues are typed into its groups.
    lanes: str = "split"
    # What a link's rules text must open on: RULES_PREFIX ("inner-grid"),
    # NO_RING_RULES_PREFIX ("ringless" -- a plain board with no clue ring), or
    # nothing ("none" -- the rules are not sudoku rules).
    rules_prefix: str = "inner-grid"
    # False: a bare board with no row, column or box rule to check.
    houses: bool = True
    # True: the digit range is deliberately wider than the interior lines.
    digits_exceed_lines: bool = False
    # A component whose one file lives in `_shared/`, not in the example dir.
    shared_component: str | None = None
    # Links with no gen*.json behind them (hand-made or derived from another).
    generator_less_links: tuple[str, ...] = ()
    # The name a borrowed, non-frame rows-and-columns backend ships under.
    rowcol_backend: str | None = None


def _check(path, key, value):
    """`value` for `key`, or a ValueError naming the manifest and the key."""
    field_type = Manifest.__annotations__[key]
    choices = {"lanes": LANES, "rules_prefix": RULES_PREFIXES}.get(key)
    if key == "generator_less_links":
        ok = isinstance(value, list) and all(isinstance(v, str) for v in value)
        value = tuple(value) if ok else value
    elif key in ("houses", "digits_exceed_lines"):
        ok = isinstance(value, bool)
    else:
        ok = isinstance(value, str) and (choices is None or value in choices)
    if not ok:
        want = f"one of {list(choices)}" if choices else str(field_type)
        raise ValueError(f"{path}: {key} = {value!r} is not {want}")
    return value


def load_manifest(example_dir):
    """The `Manifest` of the example at `example_dir`. Fails loud: a missing
    file (FileNotFoundError), a missing timed_component, an unknown key or a
    bad value (ValueError), each naming the manifest."""
    path = pathlib.Path(example_dir) / MANIFEST_NAME
    if not path.is_file():
        raise FileNotFoundError(f"missing {path}")
    raw = tomllib.loads(path.read_text())
    unknown = sorted(set(raw) - set(Manifest.__annotations__))
    if unknown:
        raise ValueError(f"{path}: unknown key(s) {', '.join(unknown)}")
    if "timed_component" not in raw:
        raise ValueError(f"{path}: missing timed_component")
    return Manifest(**{key: _check(path, key, value) for key, value in raw.items()})
