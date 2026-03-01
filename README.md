<p align="center">
  <img src="docs/logo.png" alt="Paste as Markdown" width="128">
</p>

# Paste as Markdown

> Copy from anywhere. Paste clean Markdown. Zero config.

Ever paste from a webpage into a `.md` file and get a wall of raw HTML? Or lose all your formatting from a Google Doc? **Paste as Markdown** fixes that — just `Cmd+V` and it works, like Obsidian but in VS Code.

## Before / After

| You copy this from a webpage | You get this in your `.md` file |
|---|---|
| **Bold text** with a [link](https://example.com) | `**Bold text** with a [link](https://example.com)` |
| A full HTML table | A clean GFM pipe table |
| Word doc with `mso-*` style noise | Clean Markdown, no Office junk |

## How It Works

1. Copy formatted text from any source — Word, browser, Google Docs, email, Notion, Confluence
2. Paste into a Markdown file with `Cmd+V` / `Ctrl+V`
3. Done. The extension converts the HTML clipboard to Markdown automatically.

No commands. No shortcuts. No menus. Want to paste as plain text instead? Use the paste widget or `Cmd+Shift+V`.

## What Gets Converted

| Source | Result |
|---|---|
| Bold, italic, headings, links, lists | Standard Markdown equivalents |
| HTML `<table>` | GitHub Flavored Markdown table |
| `<input type="checkbox">` | `- [x]` / `- [ ]` task lists |
| `<del>`, `<s>` | `~~strikethrough~~` |
| `<pre><code class="language-py">` | Fenced code block with language |
| `<img>` | `![alt](src)` |
| `<mark>` | `==highlight==` |

## Smart Enough to Stay Out of the Way

- **Inside a code block or math block?** Paste is left alone — no conversion.
- **Clipboard is just plain text in a wrapper tag?** Passes through unchanged.
- **Pasting an image?** Yields to VS Code's built-in image handler.

## Handles the Messy Stuff

Real-world clipboards are full of garbage HTML. This extension cleans it up:

- **Microsoft Word / Office** — strips `mso-*` styles, Office XML namespaces (`<o:p>`, `<w:Sdt>`), conditional comments, empty paragraphs
- **Google Docs** — unwraps redirect URLs (`google.com/url?q=...`), removes fake bold wrappers, strips internal GUID attributes
- **Notion, Confluence, Slack** — removes `data-*` attributes and app-specific noise

## Settings

| Setting | Default | Description |
|---|---|---|
| `pasteAsMarkdown.enabled` | `true` | Turn the extension on or off |

## Requirements

VS Code 1.109.0 or later.

## Contributing

Issues and PRs welcome at [github.com/digitarald/paste-as-markdown](https://github.com/digitarald/paste-as-markdown).

## License

[MIT](LICENSE)
