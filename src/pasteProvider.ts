import * as vscode from "vscode";
import { htmlToMarkdown, isTrivialHtml } from "./markdownConverter";
import {
  isInsideFencedCodeBlock,
  isInsideMathBlock,
  isInsideInlineCode,
} from "./smartPaste";

const PASTE_MARKDOWN_KIND =
  vscode.DocumentDropOrPasteEditKind.Empty.append("markdown", "paste", "html");

export class PasteAsMarkdownProvider
  implements vscode.DocumentPasteEditProvider
{
  async provideDocumentPasteEdits(
    document: vscode.TextDocument,
    ranges: readonly vscode.Range[],
    dataTransfer: vscode.DataTransfer,
    _context: vscode.DocumentPasteEditContext,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentPasteEdit[] | undefined> {
    // Check if the feature is enabled
    const enabled = vscode.workspace
      .getConfiguration("pasteAsMarkdown")
      .get<boolean>("enabled", true);
    if (!enabled) {
      return undefined;
    }

    // Skip conversion when pasting inside code blocks, inline code, or math blocks
    if (!shouldConvertPaste(document, ranges)) {
      return undefined;
    }

    // Get HTML content from clipboard
    const htmlItem = dataTransfer.get("text/html");
    if (!htmlItem) {
      return undefined;
    }

    const html = await htmlItem.asString();
    if (!html || token.isCancellationRequested) {
      return undefined;
    }

    // Skip excessively large HTML to avoid blocking the extension host
    if (html.length > 1_000_000) {
      return undefined;
    }

    // Skip trivial HTML (just plain text wrapped in a single tag)
    if (isTrivialHtml(html)) {
      return undefined;
    }

    // Convert HTML to Markdown
    const markdown = htmlToMarkdown(html);
    if (!markdown || token.isCancellationRequested) {
      return undefined;
    }

    // If the result is identical to what plain text paste would give, skip
    const plainItem = dataTransfer.get("text/plain");
    if (plainItem) {
      const plain = await plainItem.asString();
      if (plain && plain.trim() === markdown.trim()) {
        return undefined;
      }
    }

    const edit = new vscode.DocumentPasteEdit(
      markdown,
      "Paste as Markdown",
      PASTE_MARKDOWN_KIND
    );

    // Yield to built-in markdown image paste (so image pastes use VS Code's native handling)
    edit.yieldTo = [
      vscode.DocumentDropOrPasteEditKind.Empty.append("markdown", "link", "image"),
    ];

    return [edit];
  }
}

/**
 * Check whether the paste ranges are in a context where HTML-to-markdown
 * conversion makes sense. Returns false when inside fenced code blocks,
 * inline code spans, or math blocks — matching the built-in markdown
 * extension's smart paste behavior.
 */
function shouldConvertPaste(
  document: vscode.TextDocument,
  ranges: readonly vscode.Range[]
): boolean {
  const text = document.getText();
  for (const range of ranges) {
    const offset = document.offsetAt(range.start);
    if (isInsideFencedCodeBlock(text, offset)) {
      return false;
    }
    if (isInsideMathBlock(text, offset)) {
      return false;
    }
    const line = document.lineAt(range.start.line).text;
    if (isInsideInlineCode(line, range.start.character)) {
      return false;
    }
  }
  return true;
}
