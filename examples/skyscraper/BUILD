unit(
    suites=[
        "build_link.test.py",
        "build_original.test.py",
        "verify.test.py",
        "verify.py",
        "empty-line.test.mjs",
        "update-strength.test.mjs",
        "soundness-harness.mjs",
        # The heavy test keeps its group in tests/all.sh; the sandbox changes
        # only where it runs.
        "recovery-probe.test.mjs",
    ],
    js_edges={
        # `// #include`, which no import shows.
        "SkyscraperPairComponent.js": ["examples/_shared/line-kind.js:js"],
        "main-global.js": ["examples/_shared/frame-lines.js:js"],
    },
    # Measured through Pants on 2026-10-13, one core: 17.7 s.
    timeouts={"recovery-probe.test.mjs": 120},
)
