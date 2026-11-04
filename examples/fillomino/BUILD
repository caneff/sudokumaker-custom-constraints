unit(
    suites=[
        "build_link.test.py",
        "hunt_offline.test.py",
        "hunt-lib.test.mjs",
        "bound-screen-lib.test.mjs",
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
    # One core, 2026-11-04, a loaded box: the 12x12 board's CP-SAT proof puts
    # pipeline.test.py at 60-90 s, the 65 s through Pants with generate.test.py.
    timeouts={"pipeline.test.py": 400, "generate.test.py": 120},
)
