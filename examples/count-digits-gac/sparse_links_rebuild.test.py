"""The two sparse count-digits boards rebuild their committed links byte for
byte through the one shared `sparse_backend_code`, and neither builder keeps a
backend encoder of its own.

    uv run examples/count-digits-gac/sparse_links_rebuild.test.py
"""

import inspect
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "_shared"))

import build_sparse_count_digits
import build_sparse_required_digits


def sparse_links_rebuild():
    for builder in (build_sparse_count_digits, build_sparse_required_digits):
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp)
            builder.build(out)
            built = sorted(p.name for p in out.iterdir())
            assert built == ["PUZZLE_LINK.txt", "PUZZLE_LINK_original.txt"], built
            for name in built:
                assert (out / name).read_bytes() == (
                    builder.BOARD_DIR / name
                ).read_bytes(), f"{builder.__name__}: {name} does not reproduce"
        assert "def backend_code" not in inspect.getsource(builder), (
            f"{builder.__name__} keeps its own backend encoder"
        )


if __name__ == "__main__":
    sparse_links_rebuild()
    print("sparse links rebuild: ok")
