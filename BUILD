# uv owns the Python environment; every `uv run` test needs these two in its sandbox.
files(name="uvproject", sources=["pyproject.toml", "uv.lock"])

# A Markdown file examples/_shared/component_scan.py parses. No inference: named here.
files(name="builtin-components", sources=["docs/builtin-components.md"])

# Item 3 experiment: third-party requirements read from pyproject.toml's [project].dependencies.
python_requirements(name="reqs", source="pyproject.toml", module_mapping={"python-sat": ["pysat"]})
