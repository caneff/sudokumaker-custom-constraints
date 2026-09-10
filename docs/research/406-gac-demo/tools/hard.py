GRIDS = {
 # forum.enjoysudoku.com "The hardest sudokus (new thread)" reference list
 'Golden_Nugget':   '.......39.....1..5..3.5.8....8.9...6.7...2...1..4.......9.8..5..2....6..4..7.....',
 'Platinum_Blonde': '.......12........3..23..4....18....5.6..7.8.......9.....85.....9...4.5..47...6...',
 'Fata_Morgana':    '........3..1..56...9..4..7......9.5.7.......8.5.4.2....8..2..9...35..1..6........',
 'Kolk':            '12.3.....4.......3.5.......4.2..5......8...9.6..7..1..5.....2........9.....7...8.',
 'Patience':        '12.3....4.5....6...7......2.6..1..3....453........8..9....45.1...........8.....2.',
 'Imam_bayildi':    '..3..6.8....1..2......7...4..9..8.6..3.4...1.7.2.....3....5.....5...6..98.....5.',
 'Red_Dwarf':       '12.3.....435......1...4...........5.4..2..6.......7.....8..9....3.1..5.......6...',
 'cigarette':       '12.3.....34......1..5......6.24..5.......6..7.......8..6..42..3.......7......9.8.',
 'Cheese':          '.2..5.7..4..1....68....3.....2.....8..3.4.1.....6.5.1.......2.9.....7.....4.5..9.',
 # dcc.fc.up.pt/~acm/sudoku.pdf via stackoverflow 24682039: ~1.5e9 SDFS cycles
 'AntiDFS_SDFS':    '9..8...........5............2..1...3.1.....6....4...7.7.86.........3.1..4.....2..',
 'AI_Escargot':     '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..',
}
def solve_count(s, cap=2):
    g = [0]*81
    for i,ch in enumerate(s): g[i] = 0 if ch in '.0' else int(ch)
    n = [0]
    def ok(p, v):
        r, c = divmod(p, 9); br, bc = (r//3)*3, (c//3)*3
        for k in range(9):
            if g[r*9+k] == v or g[k*9+c] == v: return False
        for i in range(3):
            for j in range(3):
                if g[(br+i)*9+bc+j] == v: return False
        return True
    def bt():
        if n[0] >= cap: return
        best, bl = -1, 10
        for p in range(81):
            if g[p]: continue
            k = sum(1 for v in range(1,10) if ok(p,v))
            if k < bl: bl, best = k, p
            if k == 0: return
        if best == -1: n[0] += 1; return
        for v in range(1,10):
            if ok(best, v):
                g[best] = v; bt(); g[best] = 0
                if n[0] >= cap: return
    bt(); return n[0]
if __name__ == '__main__':
    for k, s in GRIDS.items():
        bad = len(s) != 81
        print('%-16s len=%d %s' % (k, len(s), 'BAD LENGTH' if bad else
              ('clues=%d solutions=%d' % (81-s.count('.'), solve_count(s)))))
