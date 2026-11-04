unit(
    suites=[
        "build_link.test.py",
        "hunt_offline.test.py",
        "hunt-lib.test.mjs",
        "bound-screen-lib.test.mjs",
        "fixture.test.mjs",
        "stamp-wrap.test.mjs",
        "equivalence.test.mjs",
        "update-strength.test.mjs",
        "setup-pass.test.mjs",
        "soundness-harness.mjs",
        # The heavy tests keep their groups in tests/all.sh; the sandbox
        # changes only where they run.
        "pipeline.test.py",
        "generate.test.py",
    ],
    js_edges={
        # `// #include`, which no import shows.
        "FillominoComponent.js": [
            "examples/_shared/dominator.js:js",
            "examples/_shared/stamp.js:js",
        ],
    },
    # generate.test.py runs about 30 s; pipeline.test.py proves the 7x5 board in
    # about a second. The shipped board's proof is `just verify-fillomino`.
    timeouts={"pipeline.test.py": 120, "generate.test.py": 120},
)
