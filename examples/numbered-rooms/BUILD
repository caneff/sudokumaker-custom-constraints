unit(
    suites=[
        "build_clued.test.py",
        "build_link.test.py",
        "build_original.test.py",
        "dead-index.test.mjs",
        "soundness-harness.mjs",
        "update-strength.test.mjs",
    ],
    js_edges={
        # `// #include ../_shared/line-kind.js`.
        "NumberedRoomsComponent.js": ["examples/_shared/line-kind.js:js"],
        # `// #include ../_shared/frame-lines.js`.
        "main-global.js": ["examples/_shared/frame-lines.js:js"],
    },
)
