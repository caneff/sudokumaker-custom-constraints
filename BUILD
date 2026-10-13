# uv owns the Python environment: every wired suite has these two in its
# sandbox, so a lockfile change reaches every one of them.
files(name="uvproject", sources=["pyproject.toml", "uv.lock"])

# The one Markdown file code reads: examples/_shared/component_scan.py takes
# the built-in component list from it.
files(name="builtin-components", sources=["docs/builtin-components.md"])
