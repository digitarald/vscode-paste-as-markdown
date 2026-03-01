import * as vscode from "vscode";
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
    )
  );
}

export function deactivate() {}
