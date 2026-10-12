# The CP-SAT helper and the link codec have one home, the sudoku-kit library
# (#750): this repo pins it by tag, keeps no copy of its own, imports neither
# as a module of this repo, and no tracked file names a path into a gridfind
# checkout in one of GRIDFIND_PATH's spellings. Checked on the tracked tree,
# the lock file and one real link.
#
#   uv run examples/_shared/sudoku_kit_source.test.py

import pathlib
import re
import subprocess
import tomllib

ROOT = pathlib.Path(__file__).resolve().parents[2]
ME = pathlib.Path(__file__).resolve().relative_to(ROOT).as_posix()

TAG = "v0.1.0"

LOCAL_COPIES = [
    "examples/_shared/cpsat.py",
    "examples/_shared/link_codec.py",
]

# `import cpsat`, `from link_codec import ...`, `from examples._shared import
# cpsat`, `from examples._shared.cpsat import ...`: every spelling that names
# a module of this repo instead of the library's.
LOCAL_IMPORT = re.compile(
    r"^\s*(?:"
    r"(?:from|import)\s+(?:cpsat|link_codec)\b"
    r"|from\s+examples\._shared\s+import\s+.*\b(?:cpsat|link_codec)\b"
    r"|(?:from|import)\s+examples\._shared\.(?:cpsat|link_codec)\b"
    r")",
    re.MULTILINE,
)

# A path into a gridfind checkout: `~/src/gridfind` in prose or a shell line,
# and `src` joined to `gridfind` in code, as one string or as the separate
# arguments of path.join or a pathlib `/` chain. An absolute path a research
# note records (`/home/<user>/src/gridfind`) is not a reach and is not matched.
GRIDFIND_PATH = re.compile(
    rb"""~/src/gridfind|['"]src/gridfind['"/]|['"]src['"]\s*[,/]\s*['"]gridfind"""
)


def tracked(*patterns):
    out = subprocess.run(
        ["git", "ls-files", "-z", "--", *patterns],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return [p for p in out.split("\0") if p and p != ME and (ROOT / p).is_file()]


def the_lock_pins_the_tag():
    lock = tomllib.loads((ROOT / "uv.lock").read_text())
    kits = [p for p in lock["package"] if p["name"] == "sudoku-kit"]
    assert len(kits) == 1, f"uv.lock holds {len(kits)} sudoku-kit packages"
    git = kits[0]["source"].get("git", "")
    assert f"?tag={TAG}#" in git, f"sudoku-kit is not pinned at {TAG}: {git!r}"


def no_local_copy_is_left():
    left = [p for p in LOCAL_COPIES if (ROOT / p).exists()]
    assert not left, f"local copies still in the tree: {left}"


def nothing_imports_a_local_copy():
    hits = [
        f"{p}:{text.count(chr(10), 0, m.start()) + 1}: {m.group().strip()}"
        for p in tracked("*.py")
        for text in [(ROOT / p).read_text()]
        for m in LOCAL_IMPORT.finditer(text)
    ]
    assert not hits, "imports of a local copy:\n" + "\n".join(hits)


def nothing_reaches_into_gridfind():
    hits = [
        f"{p}: {m.group().decode()}"
        for p in tracked()
        for m in GRIDFIND_PATH.finditer((ROOT / p).read_bytes())
    ]
    assert not hits, "paths into a gridfind checkout:\n" + "\n".join(hits)


def the_library_reads_a_committed_link():
    from sudoku_kit.link_codec import decode_puzzle, encode_link, read_link

    link_file = ROOT / "examples" / "house-gac" / "PUZZLE_LINK.txt"
    doc = decode_puzzle(read_link(link_file))
    assert decode_puzzle(encode_link(doc)) == doc, "a committed link's round trip"


if __name__ == "__main__":
    the_lock_pins_the_tag()
    no_local_copy_is_left()
    nothing_imports_a_local_copy()
    nothing_reaches_into_gridfind()
    the_library_reads_a_committed_link()
    print("sudoku_kit_source.test.py: ok")
