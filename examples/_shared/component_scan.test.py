# component_scan.registered_components is a lexical scan over backend
# source text, shared by framebuild.check and check_layout.check_components
# (#292). Tested in isolation here so a change to the scan itself does not
# need a full link/doc fixture to exercise.
#
#   uv run --with lzstring examples/_shared/component_scan.test.py

from component_scan import registered_components

if __name__ == "__main__":
    # a single registration is found
    assert registered_components("new FooComponent()") == {"FooComponent"}

    # every registration in a multi-line, multi-call backend is found
    code = "puzzle.addConstraintComponent(new FooComponent())\nnew BarComponent()\n"
    assert registered_components(code) == {"FooComponent", "BarComponent"}

    # a call spanning a line break is still found -- the scan reads the
    # whole joined source, not line by line
    code = "puzzle.addConstraintComponent(\n  new FooComponent()\n)"
    assert registered_components(code) == {"FooComponent"}

    # a comment line naming a component is not a registration
    code = "// a paired end gets a new BarComponent\nnew FooComponent()"
    assert registered_components(code) == {"FooComponent"}

    # a kept `//!` note (already turned into a plain `//` comment by minify
    # before this scan ever sees it) is likewise not a registration
    code = "// kept note: a new BarComponent\nnew FooComponent()"
    assert registered_components(code) == {"FooComponent"}

    # no registrations at all
    assert registered_components("") == set()
    assert registered_components("const x = 1;") == set()

    print("component_scan self-check OK")
