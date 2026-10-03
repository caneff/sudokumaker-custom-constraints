# Shared codec for SudokuMaker puzzle links: https://sudokumaker.app/?puzzle=<payload>
#
# encode_link returns the full link, not the bare payload. decode_puzzle takes a
# full link or a bare payload and splits out the payload itself, so encode_link's
# output can be fed straight back into decode_puzzle.

import json
import urllib.parse

from lzstring import LZString


def decode_puzzle(link):
    """The puzzle doc (a dict) held in a SudokuMaker link or bare payload."""
    payload = link.split("puzzle=")[-1]
    return json.loads(
        LZString.decompressFromEncodedURIComponent(urllib.parse.unquote(payload))
    )


def encode_link(doc):
    """The full SudokuMaker link for a puzzle doc; decode_puzzle reads it back."""
    return "https://sudokumaker.app/?puzzle=" + LZString.compressToEncodedURIComponent(
        json.dumps(doc)
    )
