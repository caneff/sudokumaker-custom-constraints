unit(
    suites=[
        "build_link.test.py",
        "end-to-end.test.mjs",
        "marker-contract.test.mjs",
        "update-strength.test.mjs",
        "soundness-harness.mjs",
    ],
    js_edges={
        # `// #include`, which no import shows.
        "UpToNComponent.js": ["examples/_shared/line-kind.js:js"],
    },
)
