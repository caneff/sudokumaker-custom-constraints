"""Decode a SudokuMaker link and print its puzzle document as JSON.

The one JS-side consumer of `sudoku_kit.link_codec.decode_puzzle`: there is
no JS LZString decompressor in this repo (the sudoku-kit library, pinned in
`pyproject.toml`, is the only codec dependency), so `bundle-solve-lib.mjs` shells out to this instead of
carrying a second decoder or a new npm dependency.

    uv run examples/_shared/link_codec_cli.py <link_file>
"""

import sys
from pathlib import Path

from sudoku_kit.link_codec import decode_puzzle

if __name__ == "__main__":
    link = Path(sys.argv[1]).read_text().strip()
    import json

    print(json.dumps(decode_puzzle(link)))
