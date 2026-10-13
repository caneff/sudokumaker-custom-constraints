unit(
    suites=[
        "board_kit.test.py",
        "build_count_digits_demo.test.py",
        "build_count_digits_selfcount.test.py",
        "build_required_digits.test.py",
        "build_sparse_count_digits.test.py",
        "build_sparse_required_digits.test.py",
        "count-digits.test.mjs",
        "soundness-harness.mjs",
    ],
    js_edges={
        # `// #include ../_shared/bit-helpers.js`, which no import shows.
        "RequiredDigitsGacComponent.js": ["examples/_shared/bit-helpers.js:js"],
        # `// #include ../../_shared/frame-lines.js`.
        "required-digits/main-required-digits-global.js": ["examples/_shared/frame-lines.js:js"],
    },
    # The one edge across units: build_required_digits.py builds its link from
    # outside-sudoku's PUZZLE_LINK.txt, which no import shows: the one file,
    # by name.
    needs=["examples/outside-sudoku/PUZZLE_LINK.txt:data"],
)
