unit(
    suites=[
        "build_link.test.py",
        "soundness-harness.mjs",
        "update-strength.test.mjs",
    ],
    py_edges={
        # Reads the shared component by path: `COMPONENT = ../_shared/HouseGacComponent.js`.
        "build_link.py": ["examples/_shared/HouseGacComponent.js:js"],
    },
    js_edges={
        # Loads the shared component by path: `load('../_shared/HouseGacComponent.js')`.
        "soundness-harness.mjs": ["examples/_shared/HouseGacComponent.js:js"],
        # Loads the shared component by path, `makeIo(_shared).load('HouseGacComponent.js')`.
        "update-strength.test.mjs": ["examples/_shared/HouseGacComponent.js:js"],
    },
)
