unit(
    suites=[
        "backends.test.mjs",
        "build_link.test.py",
        "build_size.test.py",
        "soundness-harness.mjs",
        "update-strength.test.mjs",
        "verify.test.py",
    ],
    js_edges={
        # `// #include ../_shared/frame-lines.js`.
        "main-global.js": ["examples/_shared/frame-lines.js:js"],
    },
)
