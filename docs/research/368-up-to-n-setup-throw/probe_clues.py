# Probe links for the seed-102 9x9: zero givens, the committed 13 clues plus
# extra clues added in a fixed seeded order, up to `count` shown. Scratch only.
import pathlib, random, sys
sys.path.insert(0, "examples/_shared")
sys.path.insert(0, "examples/up-to-n")
from dataclasses import replace
import link_codec
from build_size import SPEC
from framebuild import build_doc, check, load_board, unique, _ring_name
board = load_board(pathlib.Path("examples/up-to-n/gen.json"))
assert not board.givens
extra = sorted(set(board.lines) - board.active)
random.Random(370).shuffle(extra)
for count in map(int, sys.argv[1:]):
    active = set(board.active) | set(extra[: count - len(board.active)])
    b = replace(board, active=active)
    assert len(b.active) == count and unique(SPEC.cp_sat_clue_fn, b) is True
    doc = build_doc(SPEC, b, local=True)
    link = link_codec.encode_link(doc)
    check(SPEC, link, doc, b, local=True)
    out = pathlib.Path(f".scratch/370/probe_{count}clues.txt")
    out.write_text(link + "\n")
    print(out, sorted(_ring_name(k) for k in active))
