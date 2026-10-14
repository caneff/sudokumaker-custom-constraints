unit(
    suites=[
        "build_link.test.py",
        "verify.test.py",
        "cut-filter.test.mjs",
        "cut-profile.test.mjs",
        "pooling.test.mjs",
        "update-strength.test.mjs",
        "soundness-harness.mjs",
    ],
    js_edges={
        # `// #include`, which no import shows.
        "IsofillComponent.js": [
            "examples/_shared/dominator.js:js",
            "examples/_shared/stamp.js:js",
        ],
    },
)
