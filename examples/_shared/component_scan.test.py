# component_scan.registered_components is a lexical scan over backend
# source text, shared by framebuild.check and check_layout.check_components
# (#292). Tested in isolation here so a change to the scan itself does not
# need a full link/doc fixture to exercise.
#
#   uv run --with lzstring examples/_shared/component_scan.test.py

from component_scan import builtin_components, registered_components

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

    # a comment line naming a component is not a registration. A link built
    # today ships no comments (#385), but the sweep also reads backends off
    # links no builder rebuilds -- fillomino's frozen fixtures and hunt
    # records, whose committed backends still carry comment lines.
    code = "// a paired end gets a new BarComponent\nnew FooComponent()"
    assert registered_components(code) == {"FooComponent"}

    # an indented comment line counts too: the scan strips leading whitespace
    # before it looks for the marker
    code = "    // a new BarComponent goes here\nnew FooComponent()"
    assert registered_components(code) == {"FooComponent"}

    # no registrations at all
    assert registered_components("") == set()
    assert registered_components("const x = 1;") == set()

    # the built-ins SudokuMaker ships are read off docs/builtin-components.md,
    # the list of record. A backend may construct one of these without the
    # link carrying any component file for it -- they live in the app, not in
    # the link -- so the shipped-vs-registered checks subtract them (#394).
    builtins = builtin_components()
    assert "PredefinedCandidatesComponent" in builtins
    assert "HouseComponent" in builtins
    assert "DifferentDigitsComponent" in builtins
    # an example's own component is not a built-in, or the checks that keep a
    # link's component list honest would stop seeing it
    assert "SkyscraperLineComponent" not in builtins
    assert "FooComponent" not in builtins

    print("component_scan self-check OK")
