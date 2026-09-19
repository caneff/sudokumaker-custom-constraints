# Shrink the embedded JS before it goes into a puzzle link, so the shared URL
# stays small. The source files keep their full commentary; only the copy baked
# into the link is stripped.
#
# What survives into the export: the code and its indentation. Every comment
# and every blank line is dropped, block comments included -- a component's
# `/* eslint-disable ... */` is an apology to a linter the recipient does not
# run, and the commentary a source file carries in its "//!" blocks is a large
# fraction of both the shipped code and the link it goes into (#385; the
# measured shares are in docs/research/skyscraper-builtin-constraint-baseline.md).
# The source files keep those blocks; how a reuser gets the commentary is a
# separate question -- `keep_comments=True` is that answer for a link that
# wants it: every comment survives (only blank lines go), for the rare link
# built to be read inside the app's own code box (#433).
#
# One source file can splice in another with a line reading
#
#     // #include ../_shared/frame-lines.js
#
# resolved relative to the INCLUDING file's directory, and minified the same
# way its includer is -- the directive is read before the comment strip, so it
# is never mistaken for commentary. `minify_file(path)` is the entry point that
# knows a directory; `minify_js` on a bare string has none, and refuses a
# directive rather than dropping it. A missing file, a cycle, and a directive
# with no path all stop the build, the way an unpaired block marker does.
#
# After every include resolves, a top-level `function name (...) { ... }`
# declaration that came FROM an include and that the assembled script never
# references by name is dropped (#395). Scoped to spliced-in code only: a
# component's own unused top-level function is still shipped, so it stays a
# lint error instead of a silent deletion. A reference is any other
# occurrence of the bare name in the assembled text -- a call, a value
# passed around, or a string that happens to spell it -- so the count is
# conservative in the direction of keeping code, not dropping it. The one
# thing this cannot see through is dispatch by a COMPUTED name (`obj[key]()`,
# `eval(...)`, `new Function(...)`): finding one of those anywhere in the
# assembled script means some name might be reached in a way no text search
# can confirm or rule out, so the whole prune refuses rather than guessing.
#
# The Node side runs the same assembled source without Python: the include
# splice is mirrored in examples/_shared/include.mjs. Two copies of one rule --
# keep the syntax identical when either changes.
#
# Comments are stripped by one left-to-right scan per file (`_strip_line`) that
# tracks '...', "...", template literals (`${...}` nesting included, carried
# across lines) and regex literals, so a comment marker inside a string is left
# alone and a "//" comment may hold "/*", "*/" or "://". It is a scanner, not a
# parser, and it refuses rather than guesses: a block comment that does not
# close on its line, an unterminated string, template or regex, and a "/" whose
# reading (division or regex) depends on more than the token before it, all stop
# the build naming the line. `keep_comments=True` never scans -- every line
# survives as written.

import pathlib
import re

# A whole line whose only content is the directive. Group 1 is everything after
# the keyword, so a pathless "// #include" is caught rather than read as a
# comment.
_INCLUDE_RE = re.compile(r"^\s*//\s*#include\b(.*)$")

# A top-level function declaration: no leading whitespace, so a helper nested
# inside another function (indented) is never a prune candidate.
_FUNC_DECL_RE = re.compile(r"^function\s+([A-Za-z_$][\w$]*)\s*\(")

# Dispatch through a name this strip cannot read: a computed member call
# (`obj[key](...)`) or a call built from a string at runtime. `\bFunction\(`
# only matches the bare word, so an identifier merely ending in "Function"
# (`myFunction(`) does not trip it.
_DYNAMIC_RE = re.compile(
    r"\beval\s*\(|\bnew\s+Function\s*\(|\bFunction\s*\(|\[\s*[A-Za-z_$][\w$]*\s*\]\s*\("
)


def minify_file(path, keep_comments=False):
    """`minify_js` on `path`'s text, with includes resolved against its own
    directory. Every caller that ships a file's code into a link uses this."""
    path = pathlib.Path(path)
    return minify_js(
        path.read_text(), base_dir=path.parent, keep_comments=keep_comments
    )


def minify_js(src, drop_blocks=True, base_dir=None, _stack=(), keep_comments=False):
    """`drop_blocks=False` keeps block comments, for vendored code that has to
    round-trip byte-for-byte: the fillomino baseline carries `/* : Generator
    <Change> */` type annotations, and its whole point is being the author's
    own file. Everything shipped from examples/ takes the default.

    `keep_comments=True` is the annotated-link mode: every comment survives
    (line and block alike, `drop_blocks` is ignored), and only blank lines
    are dropped -- for a link whose whole point is a reader inside the app's
    code box learning the filter from its own commentary. Includes still
    resolve and dead top-level functions still prune the same way; a
    computed-dispatch site still refuses the prune rather than guessing."""
    lines = _splice_and_strip(src, drop_blocks, base_dir, _stack, keep_comments)
    if not _stack:  # the outermost call sees the whole assembled script
        lines = _prune_dead_includes(lines)
    return "\n".join(text for text, _included in lines) + "\n"


def _splice_and_strip(src, drop_blocks, base_dir, stack, keep_comments):
    """`(line, included)` pairs for `src`, includes spliced in and comments
    stripped (unless `keep_comments`). `included` is true for every line that
    came from a `#include` (at any depth), false for the top-level file's own
    lines -- the split `_prune_dead_includes` scopes itself to."""
    included = bool(stack)
    out = []
    frames = ()  # open template literals / block comments, carried across lines
    for line in src.splitlines():
        directive = _INCLUDE_RE.match(line)
        if directive:
            # An include that minifies to nothing appends nothing: every blank
            # line is dropped, an included file's included.
            out.extend(
                _include(
                    directive.group(1), drop_blocks, base_dir, stack, keep_comments
                )
            )
            continue
        if keep_comments:  # never scanned: only blank lines go
            if line.strip():
                out.append((line.rstrip(), included))
            continue
        text, frames = _strip_line(line, frames, drop_blocks)
        if any(f != _BLOCK for f in frames):  # a template literal runs on:
            out.append((text, included))  # its text is content, blanks included
        elif text.strip():
            out.append((text.rstrip(), included))
    assert not frames, (
        f"{'block comment' if frames[-1] == _BLOCK else 'template literal'} never closes, which this strip cannot read"
    )
    return out


_BLOCK = "block"  # frame: inside a block comment that is being kept
# After one of these a "/" cannot be a division, so it opens a regex literal.
_REGEX_AFTER = "(,=:[!&|?;{"
# After a word ending in one of these a "/" cannot be a division either, but
# these are only the words this strip knows -- it refuses the slash, not guesses.
_KEYWORDS = {
    "return", "typeof", "case", "in", "of", "new", "yield", "delete", "void",
    "throw", "else", "do", "instanceof", "await",
}  # fmt: skip


def _slash_kind(before):
    """'regex' or 'division' for a "/" that follows `before` (the line's output
    so far), or None when the token before it does not settle which."""
    before = before.rstrip()
    if not before:
        return None
    last = before[-1]
    if last in _REGEX_AFTER:
        return "regex"
    if last in ")]'\"`":
        return "division"
    if last.isalnum() or last in "_$":
        word = re.search(r"[\w$]+$", before).group(0)
        return None if word in _KEYWORDS else "division"
    return None


def _skip_quoted(line, i):
    """Index just past the string that opens at `line[i]`, or -1."""
    j = i + 1
    while j < len(line) and line[j] != line[i]:
        j += 2 if line[j] == "\\" else 1
    return j + 1 if j < len(line) else -1


def _skip_regex(line, i):
    """Index just past the regex literal that opens at `line[i]`, or -1."""
    j, in_class = i + 1, False
    while j < len(line) and (in_class or line[j] != "/"):
        if line[j] == "\\":
            j += 1
        elif line[j] in "[]":
            in_class = line[j] == "["
        j += 1
    return j + 1 if j < len(line) else -1


def _strip_line(line, frames, drop_blocks):
    """`(text, frames)`: `line` with its comments removed. `frames` is the
    stack carried in from earlier lines and out to later ones: None while
    inside a template literal's own text, an int (the brace depth) inside one of
    its `${...}` expressions, `_BLOCK` inside a kept block comment. A construct
    this scan cannot read stops the build naming the line."""
    frames = list(frames)
    out = []
    i, n = 0, len(line)

    def confused(what):
        raise AssertionError(f"{what}, which this strip cannot read: {line!r}")

    while i < n:
        c = line[i]
        nxt = line[i + 1] if i + 1 < n else ""
        if frames and frames[-1] == _BLOCK:  # in a kept multi-line block
            end = line.find("*/", i)
            stop = n if end < 0 else end + 2
            out.append(line[i:stop])
            i = stop
            if end >= 0:
                frames.pop()
        elif frames and frames[-1] is None:  # a template literal's own text
            if c == "\\":
                out.append(line[i : i + 2])
                i += 2
                continue
            if c == "`":
                frames.pop()
            elif c == "$" and nxt == "{":
                frames[-1] = 1
                out.append("${")
                i += 2
                continue
            out.append(c)
            i += 1
        elif c in "'\"":
            end = _skip_quoted(line, i)
            if end < 0:
                confused("unterminated string")
            out.append(line[i:end])
            i = end
        elif c == "`":
            frames.append(None)
            out.append(c)
            i += 1
        elif c == "/" and nxt == "/":
            break
        elif c == "/" and nxt == "*":
            end = line.find("*/", i + 2)
            if end >= 0:
                if not drop_blocks:
                    out.append(line[i : end + 2])
                i = end + 2
            elif drop_blocks:
                confused("unpaired block-comment marker")
            else:  # kept: its text is not code, so it is not scanned
                out.append(line[i:])
                frames.append(_BLOCK)
                i = n
        elif c == "/":
            kind = _slash_kind("".join(out))
            if kind is None:
                confused("ambiguous slash (regex literal or division)")
            end = _skip_regex(line, i) if kind == "regex" else i + 1
            if end < 0:
                confused("unterminated regex literal")
            out.append(line[i:end])
            i = end
        else:
            if frames:  # inside a `${ ... }` expression
                if c == "{":
                    frames[-1] += 1
                elif c == "}":
                    frames[-1] -= 1
                    if frames[-1] == 0:
                        frames[-1] = None
            out.append(c)
            i += 1
    return "".join(out), tuple(frames)


def _include(rest, drop_blocks, base_dir, stack, keep_comments):
    """The minified `(line, included)` pairs for the file one `// #include`
    names -- the caller splices them straight into its own list."""
    rel = rest.strip()
    assert rel and len(rel.split()) == 1, (
        f"an #include names exactly one path, which this one does not: {rest!r}"
    )
    assert base_dir is not None, (
        f"#include {rel} needs the including file's directory: minify a path "
        "with minify_file, not a bare string with minify_js"
    )
    target = (pathlib.Path(base_dir) / rel).resolve()
    assert target.is_file(), f"#include {rel} resolves to no file: {target}"
    assert target not in stack, f"#include cycle through {target}"
    return _splice_and_strip(
        target.read_text(), drop_blocks, target.parent, (*stack, target), keep_comments
    )


def _prune_dead_includes(lines):
    """`lines` with a spliced-in top-level function dropped whenever the
    assembled script never refers to its name again. See the module docstring
    for what counts as a reference and when this refuses instead of guessing."""
    whole = "\n".join(text for text, _included in lines)
    dynamic = _DYNAMIC_RE.search(whole)
    assert not dynamic, (
        f"refuses to prune: {dynamic.group(0)!r} could reach a function by a "
        "computed name, which a text search cannot confirm or rule out"
    )

    spans = []  # (start, end) inclusive, over `lines`
    i, n = 0, len(lines)
    while i < n:
        text, included = lines[i]
        decl = _FUNC_DECL_RE.match(text)
        if decl and included:
            depth = text.count("{") - text.count("}")
            end = i
            while depth > 0:
                end += 1
                assert end < n, (
                    f"function {decl.group(1)!r} never closes its brace, which "
                    "this strip cannot read"
                )
                end_text, _ = lines[end]
                depth += end_text.count("{") - end_text.count("}")
            spans.append((i, end, decl.group(1)))
            i = end + 1
        else:
            i += 1

    drop = set()
    for start, end, name in spans:
        pattern = re.compile(rf"\b{re.escape(name)}\b")
        span_text = "\n".join(text for text, _included in lines[start : end + 1])
        used_elsewhere = len(pattern.findall(whole)) - len(pattern.findall(span_text))
        if used_elsewhere == 0:
            drop.update(range(start, end + 1))
    return [pair for idx, pair in enumerate(lines) if idx not in drop]


if __name__ == "__main__":
    sample = (
        "/* eslint-disable no-unused-vars -- the component API */\n"
        "// ordinary comment, dropped\n"
        "  //! marked comment, dropped too\n"
        "const x = 1        // inline note, dropped\n"
        "\n"
        "  const u = 'http://a/b'\n"
    )
    got = minify_js(sample)
    assert got == "const x = 1\n  const u = 'http://a/b'\n", repr(got)
    print("minify self-check OK")
