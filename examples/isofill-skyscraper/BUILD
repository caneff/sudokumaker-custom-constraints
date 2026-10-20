unit(
    suites=[
        "build_link.test.py",
        "build_size.test.py",
        "verify.test.py",
        "verify.py",
        "update-strength.test.mjs",
        "soundness-harness.mjs",
    ],
    js_edges={
        # `// #include`, which no import shows.
        "main-global.js": ["examples/_shared/frame-lines.js:js"],
        "IsofillComponent.js": [
            "examples/_shared/dominator.js:js",
            "examples/_shared/stamp.js:js",
        ],
    },
    # The edges across units, each by name. The two component files here are
    # symlinks to the ones in examples/isofill and examples/skyscraper;
    # update-strength.test.mjs loads the floors those examples pin; and
    # build_size.test.py loads skyscraper's build_size.py by path.
    needs=[
        "examples/isofill/IsofillComponent.js:js",
        "examples/skyscraper/SkyscraperOneSidedComponent.js:js",
        "examples/isofill/.golden/IsofillComponent.db93523.js:../js",
        "examples/skyscraper/.golden/SkyscraperRunningCapComponent.c776ab7.js:../js",
        "examples/skyscraper/build_size.py:py",
    ],
)
