# Build the #335 bisect variants of QuadRankComponent2.js.
import pathlib

s = pathlib.Path("proto/QuadRankComponent2.js").read_text()

# A: contradiction only, no per-cell pruning.
a = (
    s[: s.index("  // Per-cell: pin one of my four cells")]
    + "}\n"
    + s[s.index("// The rule itself") :]
)
pathlib.Path("proto/QuadRankComponent2_stoponly.js").write_text(a)

# B: compute the whole rule, yield nothing from it (pure cost).
b = s.replace(
    """    yield puzzle.stop(`no assignment gives ${instance.name} rank ${rank}`, cells)
    return""",
    "    return // variant: inert",
).replace(
    "      if (rank - 1 < Ld || rank - 1 > Pd) yield puzzle.removeCandidateFromCell(d, cells[j])",
    "      if (rank - 1 < Ld || rank - 1 > Pd) globalThis.__hits = (globalThis.__hits || 0) + 1 // variant: inert",
)
pathlib.Path("proto/QuadRankComponent2_inert.js").write_text(b)
print("wrote stoponly and inert variants")
