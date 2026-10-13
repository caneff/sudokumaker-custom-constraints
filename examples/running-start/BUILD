unit(
    suites=[
        "build_link.test.py",
        "soundness-harness.mjs",
        "update-strength.test.mjs",
        "zero-clue.test.mjs",
    ],
    js_edges={
        # `// #include ../_shared/line-kind.js` and `../_shared/below.js`.
        "RunningStartComponent.js": [
            "examples/_shared/line-kind.js:js",
            "examples/_shared/below.js:js",
        ],
        # `// #include ../_shared/line-kind.js` and `../_shared/below.js`.
        "RunningStartPairComponent.js": [
            "examples/_shared/line-kind.js:js",
            "examples/_shared/below.js:js",
        ],
        # `// #include ../_shared/frame-lines.js`.
        "main-global.js": ["examples/_shared/frame-lines.js:js"],
    },
)
