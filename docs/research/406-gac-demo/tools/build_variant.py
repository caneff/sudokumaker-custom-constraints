import json, sys
from pathlib import Path
root = Path(__file__).resolve().parent
sys.path.insert(0, str(root / 'probe406-worktree/examples/_shared'))
from link_codec import encode_link, decode_puzzle
mode, out = sys.argv[1], sys.argv[2]
doc = json.loads((root / 'doc.json').read_text())
p = doc['puzzle']
c0 = p['constraints'][0]['definition']['backend']['code']
assert '/R3|R4|C3/' in c0
if mode == 'skipall':
    p['constraints'][0]['definition']['backend']['code'] = c0.replace('/R3|R4|C3/', '/R|C/')
elif mode == 'skipnone':
    p['constraints'][0]['definition']['backend']['code'] = c0.replace('/R3|R4|C3/', '/ZZZ/')
elif mode == 'norowcolcomp':
    # keep all skyscraper lines; make Rows & Columns register NO components
    p['constraints'][0]['definition']['backend']['code'] = c0.replace('/R3|R4|C3/', '/ZZZ/')
    c2 = p['constraints'][2]['definition']['backend']['code']
    assert 'addConstraintComponent' in c2
    p['constraints'][2]['definition']['backend']['code'] = c2.replace(
        'for (let component of components) {\n  puzzle.addConstraintComponent(component);\n}', '')
elif mode == 'skip4_norowcolcomp':
    p['constraints'][0]['definition']['backend']['code'] = c0.replace('/R3|R4|C3/', '/R3|R4|C3|C4/')
    c2 = p['constraints'][2]['definition']['backend']['code']
    p['constraints'][2]['definition']['backend']['code'] = c2.replace(
        'for (let component of components) {\n  puzzle.addConstraintComponent(component);\n}', '')
elif mode == 'skip4_rowcolon':
    # skip four lines, but leave the app's OWN row/column sudoku turned on
    p['constraints'][0]['definition']['backend']['code'] = c0.replace('/R3|R4|C3/', '/R3|R4|C3|C4/')
    c2 = p['constraints'][2]['definition']['backend']['code']
    assert 'json.metadata.norowcol = true;' in c2
    p['constraints'][2]['definition']['backend']['code'] = c2.replace('json.metadata.norowcol = true;', '')
elif mode == 'skipall_rowcolon':
    p['constraints'][0]['definition']['backend']['code'] = c0.replace('/R3|R4|C3/', '/R|C/')
    c2 = p['constraints'][2]['definition']['backend']['code']
    p['constraints'][2]['definition']['backend']['code'] = c2.replace('json.metadata.norowcol = true;', '')
else:
    raise SystemExit('bad mode')
p['comment'] = 'Normal sudoku rules apply on the inner grid.'
link = encode_link(doc)
assert decode_puzzle(link) == doc
(root / out).write_text(link + '\n')
print('built', out, 'mode', mode)
