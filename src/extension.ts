import * as vscode from "vscode";
import { copyAsHtml, copyFileAsHtml } from "./copyAsHtml";
import { PasteAsMarkdownProvider } from "./pasteProvider";

export function activate(context: vscode.ExtensionContext) {
  const provider = new PasteAsMarkdownProvider();

  context.subscriptions.push(
    vscode.languages.registerDocumentPasteEditProvider(
      { language: "markdown" },
      provider,
      {
        providedPasteEditKinds: [
          vscode.DocumentDropOrPasteEditKind.Empty.append("markdown", "paste", "html"),
        ],
        pasteMimeTypes: ["text/html"],
      }
    ),
    vscode.commands.registerCommand(
      'pasteAsMarkdown.copyAsHtml',
      (uri?: vscode.Uri) => {
        if (uri) {
          return copyFileAsHtml(uri);
        }
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          return copyAsHtml(editor);
        }
      }
    )
  );
}

export function deactivate() {}
