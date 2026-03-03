# Changelog

## 0.3.0 — Copy as HTML

- **Copy as HTML**: Convert markdown to rich HTML on the clipboard for pasting into Gmail, Google Docs, Word, and other rich text apps
- Clipboard contains both `text/html` (rendered) and `text/plain` (original markdown) — safe for all paste targets
- Cross-platform: macOS (NSPasteboard), Windows (CF_HTML), Linux (xclip/wl-copy)
- Available from command palette, editor context menu, and explorer context menu
- Opt-in `pasteAsMarkdown.copyAsHtmlOnCopy` setting to override `Cmd+C`/`Ctrl+C` in markdown files
- GitHub-flavored styling with task list checkbox support

## 0.2.0 — Twitter/X article support

- Twitter/X article paste: strip Tailwind CSS bloat (6 MB → 200 KB), promote title to `<h1>`, remove engagement metrics, wire code block language labels
- Unwrap block elements inside headings for correct Turndown conversion
- Fix empty span removal to preserve newlines inside `<pre>` code blocks
- Increase HTML size limit from 1 MB to 25 MB

## 0.1.0 — Initial release

- Automatic HTML to Markdown conversion when pasting into `.md` files
- Word HTML cleanup (mso styles, Office XML, conditional comments)
- GFM support: tables, task lists, strikethrough
- Code block language detection
- Smart detection: plain text pastes are unaffected
- "Paste As..." picker integration
