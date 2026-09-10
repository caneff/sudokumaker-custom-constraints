import json, sys, random, re
from pathlib import Path
root = Path(__file__).resolve().parent
sys.path.insert(0, str(root / 'probe406-worktree/examples/_shared'))
from link_codec import encode_link, decode_puzzle
exec(open(root / 'build_search.py').read().split('base = json.loads')[0].replace("sys.argv[1]", "'0'"))

def make9(givens, gac, title):
    d = {'formatVersion': json.loads((root / 'doc.json').read_text())['formatVersion'],
         'puzzle': {'name': title, 'author': 'probe', 'type': 'custom', 'width': 9, 'height': 9,
                    'cells': [], 'constraints': [], 'export': {'sudokuPad': {'useIncompleteGridAsSolution': True}}}}
    p = d['puzzle']
    for r in range(9):
        for c in range(9):
            k = (r, c)
            p['cells'].append({'given': True, 'value': givens[k]} if k in givens else {})
    p['constraints'].append({'type': 1, 'regions': [(r // 3) * 3 + (c // 3) for r in range(9) for c in range(9)]})
    p['constraints'].append({'type': 1000, 'input': {}, 'style': {}, 'definition': {
        'name': 'Rows & Columns', 'input': [], 'backend': {'type': 'code', 'code': (root / 'rowcol9-main.js').read_text()},
        'components': []}})
    p['constraints'].append({'type': 0})
    if gac:
        nm = 'GAC all-different (Regin) on every row, column and box'
        p['constraints'].append({'name': nm, 'type': 1000, 'input': {}, 'style': {}, 'definition': {
            'name': nm, 'input': [], 'backend': {'type': 'code', 'code': (root / 'gac9-main.js').read_text()},
            'components': [{'type': 'code', 'name': 'AllDiffGacComponent',
                            'code': (root / 'AllDiffGacComponent.js').read_text()}]}})
    p['comment'] = ('Normal sudoku rules apply. Press the AutoStep button (the run-to-fixpoint '
                    'logical solver) and compare the two links: the only difference is the extra constraint.')
    lk = encode_link(d); assert decode_puzzle(lk) == d
    return lk

rng = random.Random(6)
order = list(sol); rng.shuffle(order)
g = dict(sol)
for p in order:
    t = {k: v for k, v in g.items() if k != p}
    if unique(t): g = t
print('givens', len(g), 'unique', unique(g), 'singles reach', singles(g))
out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
(out / 'PUZZLE_LINK_without_gac.txt').write_text(make9(g, False, 'GAC demo - without the component') + '\n')
(out / 'PUZZLE_LINK_with_gac.txt').write_text(make9(g, True, 'GAC demo - with the component') + '\n')
print('wrote both 9x9 links')
