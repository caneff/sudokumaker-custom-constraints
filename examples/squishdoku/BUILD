unit(
    suites=[
        "build_link.test.py",
        "embedded_forced_houses.test.py",
        "forced_houses.test.py",
    ],
    py_edges={
        # Starts `registered-houses.mjs` under Node, which no import shows.
        "squish_board.py": ["examples/squishdoku/registered-houses.mjs:js"],
    },
)
