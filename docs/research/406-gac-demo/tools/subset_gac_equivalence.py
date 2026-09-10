# Is "naked subsets of size 1..k, to a fixpoint" the same as GAC on a house?
# Answer: yes at k = n-1, and only at k = n-1. Result (n=9, 3000 states/row):
#   k=1..1  789/3000 differ    k=1..4  729/3000 differ
#   k=1..2  761/3000 differ    k=1..7  405/3000 differ
#   k=1..3  748/3000 differ    k=1..8    0/3000 differ
import random, itertools
N = 9

def regin(cand):
    """GAC reference: keep v in cell i iff some perfect matching sets i -> v."""
    def match(dom):
        owner = {}
        def aug(i, seen):
            for v in dom[i]:
                if v in seen: continue
                seen.add(v)
                if v not in owner or aug(owner[v], seen): owner[v] = i; return True
            return False
        return sum(1 for i in range(N) if aug(i, set()))
    out = [set(s) for s in cand]
    if match(out) != N: return None
    for i in range(N):
        for v in sorted(out[i]):
            d = [set(s) for s in out]; d[i] = {v}
            if match(d) != N: out[i].discard(v)
    return out

def subsets(cand, maxk):
    out = [set(s) for s in cand]
    for _ in range(60):
        ch = False
        for k in range(1, maxk + 1):
            for sub in itertools.combinations(range(N), k):
                u = set().union(*(out[i] for i in sub))
                if len(u) == k:
                    for i in range(N):
                        if i not in sub and out[i] & u:
                            out[i] -= u; ch = True
        if not ch: break
    return out

if __name__ == '__main__':
    rng = random.Random(12345)
    for maxk in (1, 2, 3, 4, 7, 8):
        diff = tested = 0
        for _ in range(3000):
            perm = list(range(1, 10)); rng.shuffle(perm)
            cand = []
            for i in range(N):
                s = {perm[i]}
                for v in range(1, 10):
                    if rng.random() < 0.35: s.add(v)
                cand.append(s)
            g = regin(cand)
            if g is None: continue
            tested += 1
            if subsets(cand, maxk) != g: diff += 1
        print('naked subsets k=1..%d vs GAC: %4d/%4d states differ' % (maxk, diff, tested))
