# Lexical scan for `new <Name>Component` registrations in a backend source
# string. Shared by `framebuild.check` (checked at build time, before a link
# is committed) and `check_layout.check_components` (checked at sweep time,
# over already-committed links) so the two do not carry their own copies of
# the same regex (#292). stdlib `re` only, no ortools: `check_layout.py`
# imports this module under `--with lzstring` alone.

import functools
import pathlib
import re

_NEW_COMPONENT = re.compile(r"new ([A-Za-z0-9_]+Component)\b")

# The built-in list of record: the component tables in
# docs/builtin-components.md, reproduced there from the SudokuMaker docs. The
# app injects these classes into a backend's scope by name -- they are not
# properties of `globalThis`, so nothing can enumerate them at run time and
# this doc is the only list there is (#394).
_BUILTINS_DOC = pathlib.Path(__file__).parents[2] / "docs" / "builtin-components.md"
_DOC_COMPONENT = re.compile(r"`([A-Z][A-Za-z0-9_]*Component)[(`]")


@functools.cache
def builtin_components():
    """The component classes SudokuMaker itself provides.

    A backend that constructs one of these ships no component file for it --
    the class lives in the app -- so the shipped-vs-registered checks in
    `framebuild.check` and `check_layout.check_components` subtract this set
    before they compare. Read from the doc rather than copied into code, so
    the two cannot drift.
    """
    return set(_DOC_COMPONENT.findall(_BUILTINS_DOC.read_text()))


def registered_components(backend_code):
    """Return the set of component names `backend_code` constructs with
    `new <Name>Component(...)`.

    Comment lines are dropped first, so a note that mentions a component does
    not read as a registration. A shipped link carries no comments at all
    (#385, minify.py), but this scan also reads backends off already-committed
    links that were not built that way -- fillomino's frozen timing fixtures
    and hunt records, which `check_layout` sweeps and no builder rebuilds. A
    class reached through an alias, or registered some other way than a
    literal `new` call, is invisible to this scan -- it is lexical, not a JS
    parse.
    """
    code = "\n".join(
        line for line in backend_code.splitlines() if not line.lstrip().startswith("//")
    )
    return set(_NEW_COMPONENT.findall(code))
