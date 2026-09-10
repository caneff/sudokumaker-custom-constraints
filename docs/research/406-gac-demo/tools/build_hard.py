import json, sys
from pathlib import Path
root = Path(__file__).resolve().parent
sys.path.insert(0, str(root / 'probe406-worktree/examples/_shared'))
from link_codec import encode_link, decode_puzzle
sys.path.insert(0, str(root))
from hard import GRIDS

def make9(s, gac, title):
    d = {'formatVersion': json.loads((root / 'doc.json').read_text())['formatVersion'],
         'puzzle': {'name': title, 'author': 'probe', 'type': 'custom', 'width': 9, 'height': 9,
                    'cells': [], 'constraints': [],
                    'export': {'sudokuPad': {'useIncompleteGridAsSolution': True}}}}
    p = d['puzzle']
    for ch in s:
        p['cells'].append({} if ch in '.0' else {'given': True, 'value': int(ch)})
    p['constraints'].append({'type': 1, 'regions': [(r // 3) * 3 + (c // 3) for r in range(9) for c in range(9)]})
    p['constraints'].append({'type': 1000, 'input': {}, 'style': {}, 'definition': {
        'name': 'Rows & Columns', 'input': [],
        'backend': {'type': 'code', 'code': (root / 'rowcol9-main.js').read_text()}, 'components': []}})
    p['constraints'].append({'type': 0})
    if gac:
        nm = 'GAC all-different (Regin) on every row, column and box'
        p['constraints'].append({'name': nm, 'type': 1000, 'input': {}, 'style': {}, 'definition': {
            'name': nm, 'input': [],
            'backend': {'type': 'code', 'code': (root / 'gac9-main.js').read_text()},
            'components': [{'type': 'code', 'name': 'AllDiffGacComponent',
                            'code': (root / 'AllDiffGacComponent.js').read_text()}]}})
    p['comment'] = 'Normal sudoku rules apply.'
    lk = encode_link(d); assert decode_puzzle(lk) == d
    return lk

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
for name in sys.argv[2:]:
    s = GRIDS[name]
    assert len(s) == 81, '%s is %d chars' % (name, len(s))
    (out / ('%s_base.txt' % name)).write_text(make9(s, False, name + ' (no component)') + '\n')
    (out / ('%s_gac.txt' % name)).write_text(make9(s, True, name + ' (GAC component)') + '\n')
    print('built', name, '%d clues' % (81 - s.count('.')))
