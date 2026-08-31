# Lexical scan for `new <Name>Component` registrations in a backend source
# string. Shared by `framebuild.check` (checked at build time, before a link
# is committed) and `check_layout.check_components` (checked at sweep time,
# over already-committed links) so the two do not carry their own copies of
# the same regex (#292). stdlib `re` only, no ortools: `check_layout.py`
# imports this module under `--with lzstring` alone.

import re

_NEW_COMPONENT = re.compile(r"new ([A-Za-z0-9_]+Component)\b")


def registered_components(backend_code):
    """Return the set of component names `backend_code` constructs with
    `new <Name>Component(...)`.

    Comment lines are dropped first, so a `//!` note that mentions a
    component does not read as a registration. A class reached through an
    alias, or registered some other way than a literal `new` call, is
    invisible to this scan -- it is lexical, not a JS parse.
    """
    code = "\n".join(
        line for line in backend_code.splitlines() if not line.lstrip().startswith("//")
    )
    return set(_NEW_COMPONENT.findall(code))
