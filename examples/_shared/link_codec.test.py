# Round-trip test for the shared link codec, against a real committed link.
#
#   uv run --with lzstring examples/_shared/link_codec.test.py

import pathlib

from link_codec import decode_puzzle, encode_link

HERE = pathlib.Path(__file__).parent
LINK_FILE = HERE.parent / "hit-counts" / "PUZZLE_LINK_4x4.txt"

if __name__ == "__main__":
    link = LINK_FILE.read_text().rstrip("\n")

    doc = decode_puzzle(link)
    assert encode_link(doc) == link, "encode_link(decode_puzzle(link)) != link"

    assert decode_puzzle(encode_link(doc)) == doc, (
        "decode_puzzle(encode_link(doc)) != doc"
    )

    print("ok")
