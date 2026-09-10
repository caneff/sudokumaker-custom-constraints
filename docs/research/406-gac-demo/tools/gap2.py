import json,re,sys,itertools
d=json.load(open(sys.argv[1]))
cells={}
for t in d:
    m=re.match(r'translate\((\d+) (\d+)\) scale\(25\)$', t['tr'] or '')
    if not m: continue
    col=(int(m.group(1))-25)//50; row=(int(m.group(2))-25)//50
    cells[(row,col)] = set(t['v']) if float(t['fs'])<=1.0 else {t['v']}
inner=[(r,c) for r in range(1,10) for c in range(1,10)]
cand={p:set(cells[p]) for p in inner}
H=[]
for r in range(1,10): H.append(('row%d'%r,[(r,c) for c in range(1,10)]))
for c in range(1,10): H.append(('col%d'%c,[(r,c) for r in range(1,10)]))
for br in range(3):
    for bc in range(3): H.append(('box%d%d'%(br,bc),[(1+br*3+i,1+bc*3+j) for i in range(3) for j in range(3)]))
def lbl(p): return f"R{p[0]+1}C{p[1]+1}"
for k in (2,3,4):
    naked=[];hidden=[]
    for name,h in H:
        free=[p for p in h if len(cand[p])>1]
        for sub in itertools.combinations(free,k):
            u=set().union(*(cand[p] for p in sub))
            if len(u)==k and any(cand[p]&u for p in free if p not in sub):
                naked.append((name,[lbl(p) for p in sub],sorted(u)))
        for vs in itertools.combinations('123456789',k):
            hs=[{p for p in free if v in cand[p]} for v in vs]
            if any(not s for s in hs): continue
            u=set().union(*hs)
            if len(u)==k and any(cand[p]-set(vs) for p in u):
                hidden.append((name,[lbl(p) for p in sorted(u)],list(vs)))
    print(f'k={k}: naked {len(naked)}, hidden {len(hidden)}')
    for x in naked[:3]: print('   naked',x)
    for x in hidden[:3]: print('   hidden',x)
# Regin GAC on each house
def maxmatch(cs):
    by={}
    def aug(c,seen):
        for v in cand[c]:
            if v in seen: continue
            seen.add(v)
            if v not in by or aug(by[v],seen): by[v]=c; return True
        return False
    return sum(1 for c in cs if aug(c,set()))
tot=0
for name,h in H:
    if maxmatch(h)!=9: print('INFEASIBLE house', name); continue
    for p in list(h):
        for v in sorted(cand[p]):
            save=cand[p]; cand[p]={v}
            ok = maxmatch(h)==9
            cand[p]=save
            if not ok: cand[p].discard(v); tot+=1
print('Regin GAC one sweep removes', tot, 'candidates')
