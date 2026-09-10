import json, re, sys, random
from pathlib import Path
root = Path(__file__).resolve().parent
sys.path.insert(0, str(root / 'probe406-worktree/examples/_shared'))
from link_codec import encode_link, decode_puzzle

# The true grid, taken from the run that finished 81/81.
sol = {}
for t in json.loads((root / 'marks_loud.json').read_text()):
    m = re.match(r'translate\((\d+) (\d+)\) scale\(25\)$', t['tr'] or '')
    if not m or float(t['fs']) <= 1.0: continue
    col = (int(m.group(1)) - 25) // 50; row = (int(m.group(2)) - 25) // 50
    if 1 <= col <= 9 and 1 <= row <= 9: sol[(row - 1, col - 1)] = int(t['v'])
assert len(sol) == 81
H = [[(r, c) for c in range(9)] for r in range(9)] + [[(r, c) for r in range(9)] for c in range(9)] \
    + [[(br * 3 + i, bc * 3 + j) for i in range(3) for j in range(3)] for br in range(3) for bc in range(3)]

def singles_solve(g):
    cand = {p: ({g[p]} if p in g else set(range(1, 10))) for p in sol}
    for _ in range(200):
        ch = 0
        for h in H:
            fixed = set()
            for p in h:
                if len(cand[p]) == 1: fixed |= cand[p]
            for p in h:
                if len(cand[p]) > 1:
                    n = cand[p] - fixed
                    if n != cand[p]: ch += 1; cand[p] = n
            for v in range(1, 10):
                if any(cand[p] == {v} for p in h): continue
                homes = [p for p in h if v in cand[p]]
                if len(homes) == 1 and len(cand[homes[0]]) > 1: cand[homes[0]] = {v}; ch += 1
        if not ch: break
    return sum(1 for v in cand.values() if len(v) == 1)

rng = random.Random(7)
order = list(sol); rng.shuffle(order)
givens = dict(sol)
for p in order:
    trial = {k: v for k, v in givens.items() if k != p}
    if singles_solve(trial) == 81: givens = trial
print('givens kept:', len(givens), '- singles alone solve it:', singles_solve(givens) == 81)

doc = json.loads((root / 'doc.json').read_text())
p = doc['puzzle']
keep = [1, 2] + [i for i, c in enumerate(p['constraints']) if c.get('type') in (0, 2000)]
p['constraints'] = [c for i, c in enumerate(p['constraints']) if i in keep]
assert not any(c.get('name') == 'Skyscrapers' for c in p['constraints'])
for i in range(121):
    r, c = divmod(i, 11)
    if 1 <= r <= 9 and 1 <= c <= 9:
        key = (r - 1, c - 1)
        p['cells'][i] = {'given': True, 'value': givens[key]} if key in givens else {}
    else:
        p['cells'][i] = {}
p['comment'] = 'Normal sudoku rules apply on the inner grid.'
base = json.loads(json.dumps(doc))
link = encode_link(doc); assert decode_puzzle(link) == doc
(root / 'link_plain.txt').write_text(link + '\n')

doc2 = json.loads(json.dumps(base))
name = 'Naked singles over every house'
doc2['puzzle']['constraints'].append({'name': name, 'type': 1000, 'definition': {'name': name, 'input': [],
  'backend': {'type': 'code', 'code': (root / 'naked-main.js').read_text()},
  'components': [{'type': 'code', 'name': 'NakedOnlyComponent', 'code': (root / 'NakedOnly.js').read_text()}]},
  'input': {}, 'style': {}})
link2 = encode_link(doc2); assert decode_puzzle(link2) == doc2
(root / 'link_plain_naked.txt').write_text(link2 + '\n')
print('built link_plain.txt and link_plain_naked.txt')

doc3 = json.loads(json.dumps(base))
nm = 'Solver candidate reporter'
doc3['puzzle']['constraints'].append({'name': nm, 'type': 1000, 'definition': {'name': nm, 'input': [],
  'backend': {'type': 'code', 'code': (root / 'reporter-main.js').read_text()},
  'components': [{'type': 'code', 'name': 'ReporterComponent', 'code': (root / 'Reporter.js').read_text()}]},
  'input': {}, 'style': {}})
link3 = encode_link(doc3); assert decode_puzzle(link3) == doc3
(root / 'link_plain_reporter.txt').write_text(link3 + '\n')
print('built link_plain_reporter.txt')

doc4 = json.loads(json.dumps(base))
nm4 = 'Heavy no-op busywork'
doc4['puzzle']['constraints'].append({'name': nm4, 'type': 1000, 'definition': {'name': nm4, 'input': [],
  'backend': {'type': 'code', 'code': (root / 'heavy-main.js').read_text()},
  'components': [{'type': 'code', 'name': 'HeavyNoopComponent', 'code': (root / 'HeavyNoop.js').read_text()}]},
  'input': {}, 'style': {}})
link4 = encode_link(doc4); assert decode_puzzle(link4) == doc4
(root / 'link_plain_heavy.txt').write_text(link4 + '\n')
print('built link_plain_heavy.txt')

# A plain board that STALLS: dig until singles alone cannot finish, so the
# fixpoint still has multi-candidate cells and violations are observable.
hard = dict(givens)
for q in order:
    if q not in hard: continue
    trial = {k: v for k, v in hard.items() if k != q}
    hard = trial
    if singles_solve(hard) < 70: break
print('hard givens:', len(hard), 'singles reach:', singles_solve(hard), '/81')
doc5 = json.loads(json.dumps(base))
for i in range(121):
    r, c = divmod(i, 11)
    if 1 <= r <= 9 and 1 <= c <= 9:
        k = (r - 1, c - 1)
        doc5['puzzle']['cells'][i] = {'given': True, 'value': hard[k]} if k in hard else {}
    else:
        doc5['puzzle']['cells'][i] = {}
nm5 = 'Solver candidate reporter'
doc5['puzzle']['constraints'].append({'name': nm5, 'type': 1000, 'definition': {'name': nm5, 'input': [],
  'backend': {'type': 'code', 'code': (root / 'reporter-main.js').read_text()},
  'components': [{'type': 'code', 'name': 'ReporterComponent', 'code': (root / 'Reporter.js').read_text()}]},
  'input': {}, 'style': {}})
link5 = encode_link(doc5); assert decode_puzzle(link5) == doc5
(root / 'link_plain_hard.txt').write_text(link5 + '\n')
print('built link_plain_hard.txt')

for tag, comp, fn in (('naked', 'NakedOnlyComponent', 'NakedOnly.js'),):
    d6 = json.loads(json.dumps(base))
    for i in range(121):
        r, c = divmod(i, 11)
        if 1 <= r <= 9 and 1 <= c <= 9:
            k = (r - 1, c - 1)
            d6['puzzle']['cells'][i] = {'given': True, 'value': hard[k]} if k in hard else {}
        else:
            d6['puzzle']['cells'][i] = {}
    nm = 'Naked singles over every house'
    d6['puzzle']['constraints'].append({'name': nm, 'type': 1000, 'definition': {'name': nm, 'input': [],
      'backend': {'type': 'code', 'code': (root / 'naked-main.js').read_text()},
      'components': [{'type': 'code', 'name': comp, 'code': (root / fn).read_text()}]},
      'input': {}, 'style': {}})
    lk = encode_link(d6); assert decode_puzzle(lk) == d6
    (root / ('link_plain_hard_%s.txt' % tag)).write_text(lk + '\n')
    print('built link_plain_hard_%s.txt' % tag)

d7 = json.loads(json.dumps(base))
for i in range(121):
    r, c = divmod(i, 11)
    if 1 <= r <= 9 and 1 <= c <= 9:
        k = (r - 1, c - 1)
        d7['puzzle']['cells'][i] = {'given': True, 'value': hard[k]} if k in hard else {}
    else:
        d7['puzzle']['cells'][i] = {}
nm7 = 'All-different refuter (never removes a candidate)'
d7['puzzle']['constraints'].append({'name': nm7, 'type': 1000, 'definition': {'name': nm7, 'input': [],
  'backend': {'type': 'code', 'code': (root / 'refuter-main.js').read_text()},
  'components': [{'type': 'code', 'name': 'RefuterComponent', 'code': (root / 'Refuter.js').read_text()}]},
  'input': {}, 'style': {}})
lk7 = encode_link(d7); assert decode_puzzle(lk7) == d7
(root / 'link_plain_hard_refuter.txt').write_text(lk7 + '\n')
print('built link_plain_hard_refuter.txt')

d8 = json.loads(json.dumps(base))
for i in range(121):
    r, c = divmod(i, 11)
    if 1 <= r <= 9 and 1 <= c <= 9:
        k = (r - 1, c - 1)
        d8['puzzle']['cells'][i] = {'given': True, 'value': hard[k]} if k in hard else {}
    else:
        d8['puzzle']['cells'][i] = {}
nm8 = 'GAC all-different over every house'
d8['puzzle']['constraints'].append({'name': nm8, 'type': 1000, 'definition': {'name': nm8, 'input': [],
  'backend': {'type': 'code', 'code': (root / 'alldiff-main.js').read_text()},
  'components': [{'type': 'code', 'name': 'AllDiffGacComponent',
                  'code': (root / 'AllDiffGacComponent.js').read_text()}]},
  'input': {}, 'style': {}})
lk8 = encode_link(d8); assert decode_puzzle(lk8) == d8
(root / 'link_plain_hard_gac.txt').write_text(lk8 + '\n')
print('built link_plain_hard_gac.txt')
