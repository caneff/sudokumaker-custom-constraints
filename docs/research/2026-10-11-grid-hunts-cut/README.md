# The cut of `caneff/grid-hunts` from this repo (#751)

**Date:** 2026-10-11. Slice of spec #748.

`caneff/grid-hunts` takes the finders, their research notes and data, and the
grid-finder lessons doc, with their history. It was cut with `git filter-repo`
from a fresh clone of this repo at `bbdaf09` (the tip of `spec-748` after
#750), so this repo's history is not rewritten. Nothing is deleted here by
#751; #753 removes what moved.

The cut, run by the spec's controller on Chris's yes:

```
git clone --single-branch --branch spec-748 https://github.com/caneff/sudokumaker-custom-constraints.git /home/caneff/src/grid-hunts
cd /home/caneff/src/grid-hunts
uvx git-filter-repo --paths-from-file <this directory>/filter-paths.txt \
  --message-callback 'return re.sub(rb"(?<![\w/])#(\d+)\b", rb"caneff/sudokumaker-custom-constraints#\1", message)'
git branch -m spec-748 main
```

The message callback is Chris's ruling: a bare `#373` in a kept commit message
reads `caneff/sudokumaker-custom-constraints#373` there, so it links back to
this repo's issue and not to a `grid-hunts` issue of the same number. The
result, read in `/home/caneff/src/grid-hunts`: 255 of this repo's 776 commits,
1575 tracked files, tip `54f2f21`. The clone and the callback are written here
as the worker proposed them; the controller ran the cut, and its exact command
line is its own record.

## Files

- `moved-files.tsv` — every file that moves, one per line: its path, a tab,
  and the reason. 1575 files. This is the delete list #753 reads.
- `reasons.tsv` — the same reasons per entry (a directory or a file), 39
  entries. `moved-files.tsv` is this table expanded over `git ls-files`.
- `filter-paths.txt` — the path file `git filter-repo --paths-from-file`
  reads: the 39 entries, and 30 earlier names of the same files, because
  filter-repo does not follow renames. The earlier names were read from
  `git log --name-status -M50% --diff-filter=R` on the cut commit.

Rebuild `moved-files.tsv`, from the repo root at the cut commit:

```
while IFS=$'\t' read -r p why; do
  git ls-files -- "$p" | awk -v w="$why" '{print $0 "\t" w}'
done < docs/research/2026-10-11-grid-hunts-cut/reasons.tsv | LC_ALL=C sort
```

## What moves

An entry moves when a finder reads it, writes it or it describes a finder,
and nothing on the constraint side needs it:

- all of `finders/`;
- `docs/agents/grid-finder-lessons.md`;
- 37 entries under `docs/research/`, listed in `reasons.tsv`.

## What stays, although a finder note cites it

Mixed notes stay here, by the ticket's rule:

- `2026-09-14-puzzle-genre-survey.md` — a genre survey that cites finders and
  `examples/fillomino` alike.
- `2026-09-16-gridfind-pinned-dependency.md` — about this repo taking gridfind
  as a dependency.
- `choco-banana-propagation.md` — what a component may deduce.
- `connectivity-techniques.md` — cited by `examples/isofill` and
  `docs/agents/iss.md`.
- `ortools-tuning.md` — solver settings both sides use.

Two notes move although each cites one file under `examples/`:
`2026-10-10-u-bahn-cpsat-finder.md` (`GLOSSARY.md`'s U-Bahn terms link to it)
and `2026-10-10-u-bahn-penpa-link.md`.

## Not carried by the filter

`GLOSSARY.md`'s finder and U-Bahn terms, `CODING_STANDARDS.md`, `ruff.toml`,
`pyproject.toml`, the justfile and `tests/all.sh` are mixed files. `grid-hunts`
gets its own versions as new commits, with no history from here.
