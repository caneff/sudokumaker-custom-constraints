"""SCRATCH check for docs/research/fortress-fillomino-deductions.md (#852).

Not the repo's model: the repo's fillomino model is CP-SAT `model()` in
examples/fillomino/generate.py. This is a throwaway exhaustive enumerator for
boards small enough to list every solution, used only to look for
counterexamples to the candidate fortress deductions. Nothing imports or runs
it. Usage: uv run docs/research/fortress-fillomino-deductions/scratch_check.py

1. Enumerate every fillomino partition of an R x C board with digits 1..D
   (each region generated once, from its lowest unassigned cell), and mark
   which ones satisfy the fortress rule.
2. Soundness fuzz: from a random fortress solution, place a random subset of
   cells and give every open cell a random candidate superset of its true
   digit (the soundness harness's state model). Run each rule; a removal of a
   true digit, or a dead verdict, is a violation.
3. Semantic checks: digit-colour, ordering transitivity, and pins (two
   non-adjacent same-digit islands in one region in every solution consistent
   with the placed cells), fortress vs plain.
"""

import random
import sys
from collections import defaultdict

sys.setrecursionlimit(10000)


def nbrs_of(R, C):
    out = []
    for i in range(R * C):
        r, c = divmod(i, C)
        n = []
        if r > 0:
            n.append(i - C)
        if r < R - 1:
            n.append(i + C)
        if c > 0:
            n.append(i - 1)
        if c < C - 1:
            n.append(i + 1)
        out.append(n)
    return out


def enumerate_partitions(R, C, D):
    """Yield (grid, region_id) for every fillomino solution, digits 1..D."""
    G = R * C
    nb = nbrs_of(R, C)
    grid = [0] * G
    rid = [-1] * G

    def polys(seed, k):
        # every connected set of k unassigned cells containing seed, whose
        # cells are all >= seed in index order is NOT required; seed is the
        # lowest unassigned cell, so all other unassigned cells are > seed.
        seen = set()
        res = []

        def grow(cur, frontier):
            key = frozenset(cur)
            if key in seen:
                return
            seen.add(key)
            if len(cur) == k:
                res.append(key)
                return
            for f in list(frontier):
                if f in cur:
                    continue
                newc = cur | {f}
                newf = (frontier | {x for x in nb[f] if grid[x] == 0 and x not in newc}) - newc
                grow(newc, newf)

        grow(frozenset([seed]), frozenset(x for x in nb[seed] if grid[x] == 0))
        return res

    nreg = [0]

    def rec():
        try:
            seed = grid.index(0)
        except ValueError:
            yield list(grid), list(rid)
            return
        for k in range(1, D + 1):
            for p in polys(seed, k):
                # equal size may not touch
                bad = False
                for c in p:
                    for x in nb[c]:
                        if x not in p and grid[x] == k:
                            bad = True
                            break
                    if bad:
                        break
                if bad:
                    continue
                r = nreg[0]
                nreg[0] += 1
                for c in p:
                    grid[c] = k
                    rid[c] = r
                yield from rec()
                for c in p:
                    grid[c] = 0
                    rid[c] = -1
                nreg[0] -= 1

    yield from rec()


def region_colours(grid, rid, nb):
    """Return {region: 'peak'|'pit'|'both'} or None if not fortress."""
    smaller = defaultdict(bool)
    larger = defaultdict(bool)
    regs = set(rid)
    for i, n in enumerate(nb):
        for x in n:
            if rid[x] != rid[i]:
                if grid[x] < grid[i]:
                    smaller[rid[i]] = True
                else:
                    larger[rid[i]] = True
    col = {}
    for r in regs:
        if smaller[r] and larger[r]:
            return None
        col[r] = 'peak' if smaller[r] else ('pit' if larger[r] else 'both')
    return col


# ---------------------------------------------------------------- rules
# A state: placed[i] = digit or 0; cand[i] = set of digits (for placed, {d}).

def islands(state, nb):
    placed, cand = state
    G = len(placed)
    seen = [False] * G
    out = []
    for i in range(G):
        if seen[i] or not placed[i]:
            continue
        d = placed[i]
        comp = [i]
        seen[i] = True
        h = 0
        while h < len(comp):
            for x in nb[comp[h]]:
                if not seen[x] and placed[x] == d:
                    seen[x] = True
                    comp.append(x)
            h += 1
        out.append((d, comp))
    return out


def certain_lt(cand, y, k):
    return max(cand[y]) < k


def certain_gt(cand, y, k):
    return min(cand[y]) > k


def set_neighbours(S, nb):
    Ss = set(S)
    return {x for c in S for x in nb[c] if x not in Ss}


def rule_island_orientation(state, nb, D):
    """Rule 1. Returns ('dead', None) or list of (cell, digit) removals."""
    placed, cand = state
    rem = []
    for k, I in islands(state, nb):
        N = set_neighbours(I, nb)
        below = any(certain_lt(cand, y, k) for y in N)
        above = any(certain_gt(cand, y, k) for y in N)
        if below and above:
            return 'dead'
        for y in N:
            if placed[y]:
                continue
            if below:
                rem += [(y, d) for d in cand[y] if d > k]
            if above:
                rem += [(y, d) for d in cand[y] if d < k]
    return rem


def rule_sandwich(state, nb, D):
    """Rule 2. Open x loses d when lo[x] < d < hi[x]."""
    placed, cand = state
    rem = []
    for x in range(len(placed)):
        if placed[x]:
            continue
        lo = min(max(cand[y]) for y in nb[x])
        hi = max(min(cand[y]) for y in nb[x])
        rem += [(x, d) for d in cand[x] if lo < d < hi]
    return rem


def rule_merge_orientation(state, nb, D):
    """Rule 3. At a door x of digit k: M = x + adjacent k-islands."""
    placed, cand = state
    isl = islands(state, nb)
    owner = {}
    for idx, (k, I) in enumerate(isl):
        for c in I:
            owner[c] = idx
    rem = []
    for x in range(len(placed)):
        if placed[x]:
            continue
        for k in cand[x]:
            M = {x}
            for y in nb[x]:
                if placed[y] == k:
                    M |= set(isl[owner[y]][1])
            N = set_neighbours(M, nb)
            # cells of N that are placed k cannot be: they would be in M
            below = any(certain_lt(cand, y, k) for y in N)
            above = any(certain_gt(cand, y, k) for y in N)
            if below and above:
                rem.append((x, k))
    return rem


def rule_cell_bounds(state, nb, D):
    """Rule 2b. Open x certain-peak (every candidate has a certainly smaller
    neighbour) caps every neighbour at max(cand x); certain-pit floors them."""
    placed, cand = state
    rem = []
    for x in range(len(placed)):
        lo = min(max(cand[y]) for y in nb[x])
        hi = max(min(cand[y]) for y in nb[x])
        if lo < min(cand[x]):  # every candidate d of x has a neighbour < d
            m = max(cand[x])
            for y in nb[x]:
                rem += [(y, d) for d in cand[y] if d > m]
        if hi > max(cand[x]):
            m = min(cand[x])
            for y in nb[x]:
                rem += [(y, d) for d in cand[y] if d < m]
    return rem


def walk(cells_ok, start, k, nb, placed, cand):
    """0-1 walk from start (set) over cells_ok allowing k, budget k-|start|."""
    budget = k - len(start)
    dist = {c: 0 for c in start}
    # 0-1 BFS
    from collections import deque
    dq = deque(start)
    while dq:
        u = dq.popleft()
        for v in nb[u]:
            if not cells_ok(v) or k not in cand[v]:
                continue
            w = 0 if placed[v] == k else 1
            nd = dist[u] + w
            if nd > budget:
                continue
            if v not in dist or nd < dist[v]:
                dist[v] = nd
                if w == 0:
                    dq.appendleft(v)
                else:
                    dq.append(v)
    return set(dist)


def colour_ok(nb, cand, k, colour):
    def ok(v):
        if colour == 'peak':
            return not any(min(cand[y]) > k for y in nb[v])
        return not any(max(cand[y]) < k for y in nb[v])
    return ok


def rule_colour_walk(state, nb, D):
    """Rule 4. Colour-filtered walk: starve per colour; both starve -> dead;
    known colour + walk == k -> force."""
    placed, cand = state
    rem = []
    for k, I in islands(state, nb):
        full = set(I)
        # live island extent: islands() already maximal
        if len(I) >= k:
            continue
        sizes = {}
        walks = {}
        for col in ('peak', 'pit'):
            ok = colour_ok(nb, cand, k, col)
            if not all(ok(c) for c in I):
                sizes[col] = 0
                walks[col] = set()
                continue
            w = walk(ok, full, k, nb, placed, cand)
            walks[col] = w
            sizes[col] = len(w)
        alive = [c for c in ('peak', 'pit') if sizes[c] >= k]
        if not alive:
            return 'dead'
        if len(alive) == 1 and sizes[alive[0]] == k:
            for v in walks[alive[0]]:
                if not placed[v]:
                    rem += [(v, d) for d in cand[v] if d != k]
    return rem


def rule_colour_component(state, nb, D):
    """Rule 5. Colour-split component bound."""
    placed, cand = state
    G = len(placed)
    rem = []
    for k in range(1, D + 1):
        keep = set()
        for col in ('peak', 'pit'):
            ok = colour_ok(nb, cand, k, col)
            A = {v for v in range(G) if k in cand[v] and ok(v)}
            seen = set()
            for s in A:
                if s in seen:
                    continue
                comp = [s]
                seen.add(s)
                h = 0
                while h < len(comp):
                    for x in nb[comp[h]]:
                        if x in A and x not in seen:
                            seen.add(x)
                            comp.append(x)
                    h += 1
                if len(comp) >= k:
                    keep |= set(comp)
        for v in range(G):
            if k in cand[v] and v not in keep:
                if placed[v]:
                    return 'dead'
                rem.append((v, k))
    return rem


def rule_pin_walk(state, nb, D):
    """Plain-fillomino pin (section 'revive'): islands I, J of k; walk from I
    avoiding J and N(J) under k cells => R(I) contains J. Not a prune; returns
    pins as ('pin', I0, J0) so the fuzz can check them against the solution."""
    placed, cand = state
    isl = islands(state, nb)
    pins = []
    for a, (k, I) in enumerate(isl):
        if len(I) >= k:
            continue
        for b, (k2, J) in enumerate(isl):
            if b == a or k2 != k or len(I) + len(J) > k:
                continue
            ban = set(J) | set_neighbours(J, nb)
            w = walk(lambda v: v not in ban, set(I), k, nb, placed, cand)
            if len(w) < k:
                pins.append((I[0], J[0]))
    return pins


def dist01(src, dst, k, nb, placed, cand):
    """Fewest open cells allowing k on a path from set src to set dst (placed
    k cells free, other digits blocked). None if unreachable."""
    from collections import deque
    dist = {c: 0 for c in src}
    dq = deque(src)
    while dq:
        u = dq.popleft()
        if u in dst:
            return dist[u]
        for v in nb[u]:
            if k not in cand[v]:
                continue
            w = 0 if placed[v] == k else 1
            if v not in dist or dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                (dq.appendleft if w == 0 else dq.append)(v)
    return None


def rule_pinned_door_starve(state, nb, D):
    """Revived tour, two-terminal form: for each pin (I, J) from the pin walk,
    a door x of I with M = x + I + adjacent k-islands loses k when M cannot
    reach J within the k - |M| - |J| open cells left."""
    placed, cand = state
    isl = islands(state, nb)
    owner = {}
    for idx, (k, I) in enumerate(isl):
        for c in I:
            owner[c] = idx
    rem = []
    for (a0, b0) in rule_pin_walk(state, nb, D):
        k = placed[a0]
        I = isl[owner[a0]][1]
        J = set(isl[owner[b0]][1])
        if dist01(set(I), J, k, nb, placed, cand) is None:
            return 'dead'
        for x in set_neighbours(I, nb):
            if placed[x] or k not in cand[x]:
                continue
            M = {x} | set(I)
            for y in nb[x]:
                if placed[y] == k:
                    M |= set(isl[owner[y]][1])
            if M & J:
                continue
            d = dist01(M, J, k, nb, placed, cand)
            if d is None or d > k - len(M) - len(J):
                rem.append((x, k))
    return rem


# ---------------------------------------------------------------- unsound
# candidates the note names as dying; the fuzz must find a violation.

def rule_digit_colour(state, nb, D):
    """UNSOUND on purpose: a known-peak island of k makes every other island
    of k a peak too (colour per digit, not per region)."""
    placed, cand = state
    isl = islands(state, nb)
    peak_digits = set()
    for k, I in isl:
        N = set_neighbours(I, nb)
        if any(certain_lt(cand, y, k) for y in N):
            peak_digits.add(k)
    rem = []
    for k, I in isl:
        if k in peak_digits:
            for y in set_neighbours(I, nb):
                if not placed[y]:
                    rem += [(y, d) for d in cand[y] if d > k]
    return rem


def rule_walk_rim(state, nb, D):
    """UNSOUND on purpose: a known-peak island's walk rim (cells adjacent to
    the walk) loses digits above k."""
    placed, cand = state
    rem = []
    for k, I in islands(state, nb):
        N = set_neighbours(I, nb)
        if not any(certain_lt(cand, y, k) for y in N):
            continue
        w = walk(lambda v: True, set(I), k, nb, placed, cand)
        for y in set_neighbours(w, nb):
            if not placed[y]:
                rem += [(y, d) for d in cand[y] if d > k]
    return rem


RULES = {
    '1 island orientation': rule_island_orientation,
    '2 sandwich': rule_sandwich,
    '2b cell bounds': rule_cell_bounds,
    '3 merge orientation': rule_merge_orientation,
    '4 colour walk': rule_colour_walk,
    '5 colour component': rule_colour_component,
    'P pinned door starve': rule_pinned_door_starve,
    'U digit colour (expected unsound)': rule_digit_colour,
    'U walk rim (expected unsound)': rule_walk_rim,
}


def random_state(grid, D, rng, p_place, p_extra):
    placed = [0] * len(grid)
    cand = []
    for i, d in enumerate(grid):
        if rng.random() < p_place:
            placed[i] = d
            cand.append({d})
        else:
            s = {d} | {e for e in range(1, D + 1) if rng.random() < p_extra}
            if len(s) == 1:
                placed[i] = d
            cand.append(s)
    return placed, cand


def fuzz(sols, R, C, D, n, rng):
    nb = nbrs_of(R, C)
    stats = {name: [0, 0, 0] for name in RULES}  # states, removals, violations
    pin_stats = [0, 0]
    examples = {}
    for _ in range(n):
        grid, rid = rng.choice(sols)
        state = random_state(grid, D, rng, rng.choice([0.2, 0.4, 0.6]), rng.choice([0.3, 0.6, 0.9]))
        for name, fn in RULES.items():
            out = fn(state, nb, D)
            st = stats[name]
            st[0] += 1
            if out == 'dead':
                st[2] += 1
                examples.setdefault(name, (grid, state, 'dead'))
                continue
            st[1] += len(out)
            for (cell, d) in out:
                if grid[cell] == d:
                    st[2] += 1
                    examples.setdefault(name, (grid, state, (cell, d)))
                    break
        for (a, b) in rule_pin_walk(state, nb, D):
            pin_stats[0] += 1
            if rid[a] != rid[b]:
                pin_stats[1] += 1
    return stats, pin_stats, examples


def semantic(sols_f, sols_p, R, C, D, rng, n):
    nb = nbrs_of(R, C)
    # digit colour: does some digit appear as both peak and pit across / within solutions?
    both_within = None
    for grid, rid in sols_f:
        col = region_colours(grid, rid, nb)
        seen = defaultdict(set)
        for r, c in col.items():
            k = grid[rid.index(r)]
            seen[k].add(c)
        for k, cs in seen.items():
            if {'peak', 'pit'} <= cs:
                both_within = (grid, k)
                break
        if both_within:
            break
    # pins: for random placed-cell subsets taken from a fortress solution, find
    # two non-adjacent same-digit islands that share a region in every fortress
    # solution consistent with the placed cells, and test plain likewise.
    fpin = ppin = only_f = 0
    tried = 0
    for _ in range(n):
        grid, rid = rng.choice(sols_f)
        placed = [d if rng.random() < rng.choice([0.25, 0.4, 0.55]) else 0 for d in grid]
        st = (placed, [{d} if d else set(range(1, D + 1)) for d in placed])
        isl = islands(st, nb)
        pairs = [(I[0], J[0]) for a, (k, I) in enumerate(isl) for b, (k2, J) in enumerate(isl)
                 if a < b and k == k2 and len(I) + len(J) <= k]
        if not pairs:
            continue
        cf = [s for s in sols_f if all(not p or s[0][i] == p for i, p in enumerate(placed))]
        cp = [s for s in sols_p if all(not p or s[0][i] == p for i, p in enumerate(placed))]
        for a, b in pairs:
            tried += 1
            f = all(s[1][a] == s[1][b] for s in cf)
            p = all(s[1][a] == s[1][b] for s in cp)
            fpin += f
            ppin += p
            if f and not p:
                only_f += 1
    return both_within, (tried, fpin, ppin, only_f)


def main():
    rng = random.Random(852)
    for (R, C, D) in [(3, 4, 6), (4, 4, 5), (3, 5, 6), (4, 4, 7)]:
        sols_p = list(enumerate_partitions(R, C, D))
        nb = nbrs_of(R, C)
        sols_f = [s for s in sols_p if region_colours(s[0], s[1], nb) is not None]
        print(f'\n== {R}x{C}, digits 1..{D}: {len(sols_p)} fillomino solutions, {len(sols_f)} fortress')
        stats, pin_stats, examples = fuzz(sols_f, R, C, D, 4000, rng)
        for name, (s, r, v) in stats.items():
            print(f'  {name:36s} states {s}  removals {r}  violations {v}')
        print(f'  pin walk: {pin_stats[0]} pins, {pin_stats[1]} wrong')
        for name, ex in examples.items():
            print(f'  first violation, {name}: grid {ex[0]} at {ex[2]}')
        both, pins = semantic(sols_f, sols_p, R, C, D, rng, 300)
        print(f'  digit both peak and pit in one solution: {both}')
        print(f'  same-digit island pairs tried {pins[0]}: pinned under fortress {pins[1]}, '
              f'under plain {pins[2]}, fortress-only pins {pins[3]}')


if __name__ == '__main__':
    main()
