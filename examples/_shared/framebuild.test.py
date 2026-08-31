# framebuild.check asserts a built link matches its own doc, opens the
# rules text right, and ships exactly the components its backend registers
# in both directions. These fixtures build a minimal doc via build_doc
# itself (a real n=4 board, one dummy component) rather than reconstructing
# framebuild's document shape by hand, so a case tracks the real builder
# instead of drifting from it.
#
#   uv run --with lzstring examples/_shared/framebuild.test.py

import contextlib
import pathlib
import tempfile

import link_codec
from framebuild import Spec, build_doc, check, make_lines


@contextlib.contextmanager
def _spec(components, main_global="puzzle.addConstraintComponent(new FooComponent())"):
    """A minimal Spec backed by a temp example dir: `main.js` /
    `main-global.js` plus one `FooComponent.js` and one `BarComponent.js`
    file (content unused by `check`; only the backend files' text matters).
    `components` names the global lane's own declared list.
    """
    with tempfile.TemporaryDirectory() as tmp:
        d = pathlib.Path(tmp)
        (d / "main.js").write_text("puzzle.addConstraintComponent(new FooComponent())")
        (d / "main-global.js").write_text(main_global)
        (d / "FooComponent.js").write_text("class FooComponent {}")
        (d / "BarComponent.js").write_text("class BarComponent {}")
        yield Spec(
            dir=d,
            title="Widget",
            lines_name="Widget Lines",
            components=components,
            min_digit=1,
            clue_fn=lambda values, cells: 0,
            cp_sat_clue_fn=lambda *a, **k: None,
            comment_fn=lambda n: "test rules",
        )


def _build(spec, n=4, bh=2, bw=2):
    """A real n x n board built through `build_doc`, no drawn groups (global
    lane), no givens, and every ring clue shown -- unit fixtures only, this
    board is never shared, so the "leave most of the ring blank" rule for a
    shared board does not apply here.
    """
    grid = [[((r * bw + r // bh + c) % n) + 1 for c in range(n)] for r in range(n)]
    lines = make_lines(n)
    clue = dict.fromkeys(lines, 0)
    doc = build_doc(spec, n, bh, bw, grid, clue, {}, set(lines), lines, local=False)
    link = link_codec.encode_link(doc)
    return link, doc


if __name__ == "__main__":
    # backend registers exactly the declared component: check passes
    with _spec(["FooComponent.js"]) as spec:
        link, doc = _build(spec)
        check(spec, link, doc, 4, local=False)

    # the declared list carries a dead name the backend never registers with
    # `new`: the existing two checks both pass (names == want; registered is
    # a subset of shipped), so only the new shipped-minus-registered
    # assertion catches it (#292)
    with _spec(["FooComponent.js", "BarComponent.js"]) as spec:
        link, doc = _build(spec)
        try:
            check(spec, link, doc, 4, local=False)
        except AssertionError as e:
            assert "BarComponent" in str(e), e
        else:
            raise AssertionError("a shipped, never-registered component was not caught")

    print("framebuild self-check OK")
