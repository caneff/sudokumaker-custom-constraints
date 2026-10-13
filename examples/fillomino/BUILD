unit(
    suites=[
        "build_link.test.py",
        "hunt_offline.test.py",
        "hunt-lib.test.mjs",
        "stamp-wrap.test.mjs",
        "update-strength.test.mjs",
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
    # Measured through Pants on 2026-10-13, one core: 19.6 s and 21.0 s.
    timeouts={"pipeline.test.py": 120, "generate.test.py": 120},
)
