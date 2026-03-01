# Paste as Markdown — Product Brief

## Problem

When writing Markdown in VS Code, pasting rich text from Word, websites, or Google Docs drops raw or mangled text. Obsidian handles this seamlessly — VS Code doesn't. Existing extensions are unreliable or abandoned.

## Solution

A zero-config VS Code extension that intercepts paste in Markdown files, detects HTML on the clipboard, and converts it to clean GitHub Flavored Markdown. It just works — no commands, no shortcuts, no setup.

## Target User

Anyone writing Markdown in VS Code who copies content from external sources: technical writers, developers writing docs/READMEs, students, anyone migrating notes from other tools.

## Core Behavior

1. User copies formatted text from any source (Word, browser, email, Google Docs)
2. User pastes into a `.md` file with Cmd+V / Ctrl+V
3. Extension detects `text/html` on the clipboard
4. If the cursor is inside a fenced code block, inline code, or math block → skip conversion (smart context detection)
5. If the HTML contains meaningful formatting, convert to Markdown
6. If the HTML is trivial (plain text in a wrapper tag), let VS Code's default paste handle it
7. If clipboard also contains an image (`image/*`), yield to VS Code's built-in image paste handler
8. "Paste As..." picker always offers plain-text fallback

## Key Features

| Feature | Description |
|---------|-------------|
| **Basic formatting** | Bold, italic, headings, links, ordered/unordered lists |
| **GFM tables** | HTML `<table>` → GitHub Flavored Markdown table syntax |
| **Task lists** | `<input type="checkbox">` → `- [x]` / `- [ ]` |
| **Strikethrough** | `<del>`, `<s>` → `~text~` |
| **Code blocks** | `<pre><code>` with language detection from class names |
| **Images** | `<img>` → `![alt](src)` |
| **Word HTML cleanup** | Strips `mso-*` styles, Office XML tags, conditional comments |
| **Highlight syntax** | `<mark>` → `==highlight==` |
| **Google Docs cleanup** | Unwraps redirect URLs, strips fake bold, removes GUID attrs |
| **Smart context skip** | No conversion inside fenced code blocks, inline code, or math blocks |
| **Smart content skip** | Plain text pastes and trivial HTML pass through unchanged |
| **Built-in coexistence** | Yields to VS Code's built-in image paste and text paste providers |

## Non-Goals (v1)

- Image download/save to workspace (images stay as URL references)
- Working in non-Markdown file types
- RTF parsing (only HTML clipboard format)
- Clipboard history or paste transformation UI
- Configurable Markdown output style (ATX headings, bullet char, etc.)

## Architecture

```
Clipboard (text/html)
    │
    ▼
┌─────────────────┐
│  Smart Paste     │  Skip if inside code block, inline code, or math
│  (smartPaste.ts) │  Context-aware detection via line scanning
└────────┬────────┘
         │ (only if safe context)
         ▼
┌─────────────────┐
│  HTML Cleaner    │  Strip Word bloat, Office XML, mso-* styles,
│  (htmlCleaner.ts)│  Google Docs artifacts, data-* attrs
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Turndown.js    │  HTML → Markdown conversion
│  + GFM plugin   │  Tables, task lists, strikethrough, highlights
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Post-processor  │  Collapse blank lines, unwrap Google redirect URLs
└────────┬────────┘
         │
         ▼
   DocumentPasteEdit → VS Code inserts Markdown
```

**Integration point:** `DocumentPasteEditProvider` API (stable since VS Code 1.82). Registers for `{ language: 'markdown' }` with `pasteMimeTypes: ['text/html']`. Edit kind is `markdown.paste.html` — scoped to avoid conflicts with the built-in markdown extension's `markdown.link.*` kinds. Returns edits with `yieldTo` for both default text paste and the built-in `markdown.link.image` provider (so image pastes use VS Code's native image-to-workspace handling).

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `pasteAsMarkdown.enabled` | boolean | `true` | Master on/off toggle |

## Success Criteria

- Paste from Word with bold + table + list → produces correct, readable Markdown
- Paste from Chrome/Safari/Firefox → headings, links, lists, formatting preserved
- Paste plain text → completely unaffected
- "Paste As..." menu → both Markdown and plain-text options appear
- Bundle size < 300KB
- Zero activation overhead (activates only in Markdown files)

## Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `turndown` | HTML → Markdown engine | ~30KB |
| `turndown-plugin-gfm` | GFM tables, task lists, strikethrough | ~5KB |

No native modules. No network access. No filesystem writes.
