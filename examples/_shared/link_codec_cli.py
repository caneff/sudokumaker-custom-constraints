"""Decode a SudokuMaker link and print its puzzle document as JSON.

The one JS-side consumer of `link_codec.decode_puzzle`: there is no JS
LZString decompressor in this repo (`pyproject.toml`'s `lzstring` is the only
codec dependency, #429), so `bundle-solve.mjs` shells out to this instead of
carrying a second decoder or a new npm dependency.

    uv run examples/_shared/link_codec_cli.py <link_file>
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from link_codec import decode_puzzle

if __name__ == "__main__":
    link = Path(sys.argv[1]).read_text().strip()
    import json

    print(json.dumps(decode_puzzle(link)))
