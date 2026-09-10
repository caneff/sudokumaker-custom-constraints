# Warp's Project Explorer goes stale on WSL

Researched 2026-09-10. Environment note, not a repo finding: it explains why the
Warp sidebar never shows files that agents write, on any repo opened from WSL.

## Symptom

The Project Explorer tree shows whatever existed when the folder was first
walked. Files and directories created afterwards from inside WSL never appear.
`ls` in the same pane shows them; the sidebar does not.

Observed locally on `v0.2026.09.02.08.27.stable_01` (Windows build, WSL
Ubuntu-24.04): `docs/research` listed 15 of 23 entries, missing `renbanana/` and
six files added after the tree was built.

## Root cause

Warp on Windows registers the `\\wsl$` UNC root with the `notify` crate, which
uses `ReadDirectoryChangesW`. Changes made inside the distro do not raise
notifications on the 9P share, and there is no polling fallback. The tree
re-walks only on an app-state change — cwd change or session switch.

Source pointer, from a contributor's analysis on warpdotdev/warp#8635:
`crates/repo_metadata/src/local_model.rs`.

A second, platform-independent bug compounds it: in `apply_file_tree_mutations`
three branches do `if lazy_load && !is_parent_loaded_in_entry { continue }`,
silently dropping watcher mutations when a parent directory is not loaded. That
is why macOS users see staleness too, despite working FSEvents.

## Upstream state

| Issue | Subject |
|---|---|
| #7900 | Project Explorer does not refresh — closed Apr 2026, users still reporting |
| #9190 | Same, reopened thread; no refresh button |
| #8635 | Enable Project Explorer for WSL — open, carries the root-cause analysis |
| #11643 | Stale/missing entries for WSL directories on Windows |
| #9018 | Sidebar does not refresh when a coding agent modifies files |

PR #10551 added a `Refresh` item to the directory right-click menu and was
merged to `warp-oss` (merge commit `991e453`, Jun 2026). It is **not** present in
the shipped Windows build as of `v0.2026.09.02.08.27.stable_01` — verified by
right-clicking a directory: the menu offers New file, cd to directory, Open in
new tab, Reveal in Explorer, Rename, Delete, Attach as context, Copy path, Copy
relative path, and nothing else.

## What does not work

- Collapsing and re-expanding the directory.
- Any setting: `settings.toml` has no watcher or refresh key.
- Clearing cached state: the tree is in-memory, not on disk. `warp.sqlite` has
  `projects`, `folders` and `workspace_metadata` all at 0 rows.

## What does work

The tree re-walks on an app-state change, so any of these force it:

1. `cd` out of the directory and back, in the pane the sidebar follows.
2. Switch to another Warp tab and back.
3. Open a new split pane (`Ctrl+Shift+D`).
4. Restart Warp.

Options 1-3 are the cheap ones and are what upstream commenters use daily.
