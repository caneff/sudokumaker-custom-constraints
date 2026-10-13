python_sources(
    name="py",
    sources=["*.py"],
    # These read shared .js files by computed name; coarse on purpose (every shared .js).
    overrides={
        ("framebuild.py", "no_ring.py"): {"dependencies": [":js"]},
        "component_scan.py": {"dependencies": ["//:builtin-components"]},
    },
)
javascript_sources(
    name="js",
    sources=["*.mjs", "*.js"],
    # Edges no import shows: a file read, or a script started as a subprocess.
    overrides={
        "bundle-solve-lib.mjs": {"dependencies": ["./link_codec_cli.py:py"]},
        "bundle-load.mjs": {"dependencies": [":vendor"]},
    },
)
files(name="vendor", sources=["vendor/*"])
